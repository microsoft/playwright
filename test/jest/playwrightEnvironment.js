/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const { FixturePool, registerFixture, registerWorkerFixture } = require('../harness/fixturePool');
const registerFixtures = require('../harness/fixtures');
const os = require('os');
const path = require('path');
const fs = require('fs');
const debug = require('debug');
const util = require('util');
const GoldenUtils = require('../../utils/testrunner/GoldenUtils');
const {installCoverageHooks} = require('./coverage');
const reportOnly = !!process.env.REPORT_ONLY_PLATFORM;
const { ModuleMocker } = require('jest-mock');

Error.stackTraceLimit = 15;
global.testOptions = require('../harness/testOptions');
global.registerFixture = registerFixture;
global.registerWorkerFixture = registerWorkerFixture;
registerFixtures(global);

const browserName = process.env.BROWSER || 'chromium';

const goldenPath = path.join(__dirname, '..', 'golden-' + browserName);
const outputPath = path.join(__dirname, '..', 'output-' + browserName);

let currentFixturePool = null;

process.on('SIGINT', async () => {
  if (currentFixturePool) {
    await currentFixturePool.teardownScope('test');
    await currentFixturePool.teardownScope('worker');  
  }
  process.exit(130);
});

class PlaywrightEnvironment {
  constructor(config, context) {
    this.moduleMocker = new ModuleMocker(global);
    this.fixturePool = new FixturePool();
    this.global = global;
    this.global.testOptions = testOptions;
    this.testPath = context.testPath;
  }

  async setup() {
    const {coverage, uninstall} = installCoverageHooks(browserName);
    this.coverage = coverage;
    this.uninstallCoverage = uninstall;
    currentFixturePool = this.fixturePool;
  }

  async teardown() {
    currentFixturePool = null;
    await this.fixturePool.teardownScope('worker');
    // If the setup throws an error, we don't want to override it
    // with a useless error about this.coverage not existing.
    if (!this.coverage)
      return;
    this.uninstallCoverage();
    const testRoot = path.join(__dirname, '..');
    const relativeTestPath = path.relative(testRoot, this.testPath);
    const coveragePath = path.join(outputPath, 'coverage', relativeTestPath + '.json');
    const coverageJSON = [...this.coverage.keys()].filter(key => this.coverage.get(key));
    await fs.promises.mkdir(path.dirname(coveragePath), { recursive: true });
    await fs.promises.writeFile(coveragePath, JSON.stringify(coverageJSON, undefined, 2), 'utf8');
    delete this.coverage;
    delete this.uninstallCoverage;
  }

  runScript(script) {
    return script.runInThisContext();
  }

  async handleTestEvent(event, state) {
    if (event.name === 'setup') {
      this.fixturePool.patchToEnableFixtures(this.global, 'beforeEach');
      this.fixturePool.patchToEnableFixtures(this.global, 'afterEach');

      const describeSkip = this.global.describe.skip;
      this.global.describe.skip = (...args) => {
        if (args.length === 1)
          return args[0] ? describeSkip : this.global.describe;
        return describeSkip(...args);
      };

      function addSlow(f) {
        f.slow = () => {
          return (...args) => f(...args, 90000);
        };
        return f;
      }

      const itSkip = this.global.it.skip;
      addSlow(itSkip);
      addSlow(this.global.it);
      this.global.it.skip = (...args) => {
        if (args.length === 1)
          return args[0] ? itSkip : this.global.it;
        return itSkip(...args);
      };
      if (reportOnly) {
        this.global.it.fail = condition => {
          return addSlow((...inner) => {
            inner[1].__fail = !!condition;
            return this.global.it(...inner);
          });
        };
      } else {
        this.global.it.fail = this.global.it.skip;
      }

      const testOptions = this.global.testOptions;
      function toBeGolden(received, goldenName) {
        const {snapshotState} = this;
        const updateSnapshot = snapshotState._updateSnapshot;
        const expectedPath = path.join(goldenPath, goldenName);
        const fileExists = fs.existsSync(expectedPath);
        if (updateSnapshot === 'all' || (updateSnapshot === 'new' && !fileExists)) {
          fs.writeFileSync(expectedPath, received);
          if (fileExists)
            snapshotState.updated++;
          else
            snapshotState.added++;
          return {
            pass: true
          }
        };

        const {pass, message} =  GoldenUtils.compare(received, {
          goldenPath,
          outputPath,
          goldenName
        });
        if (pass)
          snapshotState.matched++;
        else
          snapshotState.unmatched++;
        return {pass, message: () => message};
      };
      this.global.expect.extend({ toBeGolden });
    }

    if (event.name === 'test_start') {
      const fn = event.test.fn;
      this._lastTest = event.test;
      event.test.fn = async () => {
        if (reportOnly) {
          if (fn.__fail)
            throw new Error('fail');
          return;
        }
        debug('pw:test')(`start "${testOrSuiteName(event.test)}"`);
        try {
          await this.fixturePool.resolveParametersAndRun(fn);
        } catch(e) {
          debug('pw:test')(`error "${testOrSuiteName(event.test)}"`, util.inspect(e));
          throw e;
        } finally {
          await this.fixturePool.teardownScope('test');
          debug('pw:test')(`finish "${testOrSuiteName(event.test)}"`);
        }
      };
    }

    if (event.name === 'error')
      debug('pw:test')(`error "${testOrSuiteName(this._lastTest)}"`, util.inspect(event.error));

    if (event.name === 'test_fn_failure') {
      await this.fixturePool.teardownScope('worker');
    }
  }
}

function testOrSuiteName(o) {
  if (o.name === 'ROOT_DESCRIBE_BLOCK')
    return '';
  let name = o.parent ? testOrSuiteName(o.parent) : '';
  if (name && o.name)
    name += ' ';
  return name + o.name;
}

exports.getPlaywrightEnv = () => PlaywrightEnvironment;
exports.default = exports.getPlaywrightEnv();
