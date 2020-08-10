/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

const fs = require('fs');
const path = require('path');
const os = require('os');
const pirates = require('pirates');
const babel = require('@babel/core');
const TestRunner = require('../../utils/testrunner');
const { FixturePool, registerFixture, registerWorkerFixture } = require('../harness/fixturePool');
const testOptions = require('../harness/testOptions');

Error.stackTraceLimit = 15;
global.testOptions = require('../harness/testOptions');
global.registerFixture = registerFixture;
global.registerWorkerFixture = registerWorkerFixture;
process.env.JEST_WORKER_ID = 1;
const browserName = process.env.BROWSER || 'chromium';
const goldenPath = path.join(__dirname, '..', 'golden-' + browserName);
const outputPath = path.join(__dirname, '..', 'output-' + browserName);

function getCLIArgument(argName) {
  for (let i = 0; i < process.argv.length; ++i) {
    // Support `./test.js --foo bar
    if (process.argv[i] === argName)
      return process.argv[i + 1];
    // Support `./test.js --foo=bar
    if (argName.startsWith('--') && process.argv[i].startsWith(argName + '='))
      return process.argv[i].substring((argName + '=').length);
    // Support `./test.js -j4
    if (!argName.startsWith('--') && argName.startsWith('-') && process.argv[i].startsWith(argName))
      return process.argv[i].substring(argName.length);
  }
  return null;
}

function collect(browserNames) {
  let parallel = 1;
  if (process.env.PW_PARALLEL_TESTS)
    parallel = parseInt(process.env.PW_PARALLEL_TESTS.trim(), 10);
  if (getCLIArgument('-j'))
    parallel = parseInt(getCLIArgument('-j'), 10);
  require('events').defaultMaxListeners *= parallel;

  let timeout = process.env.CI ? 30 * 1000 : 10 * 1000;
  if (!isNaN(process.env.TIMEOUT))
    timeout = parseInt(process.env.TIMEOUT * 1000, 10);
  if (require('inspector').url()) {
    console.log('Detected inspector - disabling timeout to be debugger-friendly');
    timeout = 0;
  }

  const testRunner = new TestRunner({
    timeout,
    totalTimeout: process.env.CI ? 30 * 60 * 1000 * browserNames.length : 0, // 30 minutes per browser on CI
    parallel,
    breakOnFailure: process.argv.indexOf('--break-on-failure') !== -1,
    verbose: process.argv.includes('--verbose'),
    summary: !process.argv.includes('--verbose'),
    showSlowTests: process.env.CI ? 5 : 0,
    showMarkedAsFailingTests: 10,
    lineBreak: parseInt(getCLIArgument('--line-break') || 0, 10),
    outputPath,
    goldenPath
  });

  for (const [key, value] of Object.entries(testRunner.api()))
    global[key] = value;

  const collector = testRunner.collector();
  collector.addTestModifier('skip', (t, condition) => condition && t.setSkipped(true));
  collector.addSuiteModifier('skip', (s, condition) => condition && s.setSkipped(true));
  collector.addTestModifier('fail', (t, condition) => condition && t.setExpectation(t.Expectations.Fail));
  collector.addSuiteModifier('fail', (s, condition) => condition && s.setExpectation(s.Expectations.Fail));
  collector.addTestModifier('slow', t => t.setTimeout(t.timeout() * 3));
  collector.addTestAttribute('debug', t => TraceTestEnvironment.enableForTest(t));
  testRunner.api().fdescribe = testRunner.api().describe.only;
  testRunner.api().xdescribe = testRunner.api().describe.skip(true);
  testRunner.api().fit = testRunner.api().it.only;
  testRunner.api().xit = testRunner.api().it.skip(true);
  testRunner.api().dit = testRunner.api().it.only.debug;

  const fixturePool = new FixturePool();
  fixturePool.patchToEnableFixtures(global, 'beforeEach');
  fixturePool.patchToEnableFixtures(global, 'afterEach');
  collector.addTestCallbackWrapper(callback => fixturePool.wrapTestCallback(callback));

  describe('', () => {
    for (const name of fs.readdirSync('test')) {
      const file = path.join(process.cwd(), 'test', name);
      if (!name.includes('.spec.'))
        continue;
      const revert = pirates.addHook((code, filename) => {
        const result = babel.transformFileSync(filename, {
          presets: [
            ['@babel/preset-env', {targets: {node: 'current'}}],
            '@babel/preset-typescript']
        });
        return result.code;
      }, {
        exts: ['.ts']
      });
      require(file);
      revert();
      delete require.cache[require.resolve(file)];
    }
  });

  for (const [key, value] of Object.entries(testRunner.api())) {
    // expect is used when running tests, while the rest of api is not.
    if (key !== 'expect')
      delete global[key];
  }

  return testRunner;
}

module.exports = collect;

if (require.main === module) {
  console.log('Testing on Node', process.version);
  const browserNames = ['chromium', 'firefox', 'webkit'].filter(name => {
    return process.env.BROWSER === name || !process.env.BROWSER;
  });
  const testRunner = collect(browserNames);

  const testNameFilter = getCLIArgument('--filter');
  if (testNameFilter && !testRunner.focusMatchingNameTests(new RegExp(testNameFilter, 'i')).length) {
    console.log('ERROR: no tests matched given `--filter` regex.');
    process.exit(1);
  }

  const fileNameFilter = getCLIArgument('--file');
  if (fileNameFilter && !testRunner.focusMatchingFileName(new RegExp(fileNameFilter, 'i')).length) {
    console.log('ERROR: no files matched given `--file` regex.');
    process.exit(1);
  }

  const repeat = parseInt(getCLIArgument('--repeat'), 10);
  if (!isNaN(repeat))
    testRunner.repeatAll(repeat);

  testRunner.run().then(() => { delete global.expect; });
}
