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

const pirates = require('pirates');
const babel = require('@babel/core');
const { FixturePool, registerFixture, registerWorkerFixture } = require('../harness/fixturePool');
const { FocusedFilter, Repeater } = require('../../utils/testrunner/TestCollector');
const { Test, Suite } = require('../../utils/testrunner/Test');
const Location = require('../../utils/testrunner/Location');

Error.stackTraceLimit = 15;
global.testOptions = require('../harness/testOptions');
global.registerFixture = registerFixture;
global.registerWorkerFixture = registerWorkerFixture;

const fixturePool = new FixturePool();

class NoMochaUI {
  constructor(options) {
    this._filter = new FocusedFilter();
    this._repeater = new Repeater();
    this._options = options;

    this._tests = [];
    this._suites = [];
    this._currentSuite = new Suite(null, '', new Location());
    this._rootSuite = this._currentSuite;

    global.beforeEach = callback => this._currentSuite.beforeEach(callback);
    global.afterEach = callback => this._currentSuite.afterEach(callback);
    fixturePool.patchToEnableFixtures(global, 'beforeEach');
    fixturePool.patchToEnableFixtures(global, 'afterEach');

    global.describe = (name, suiteCallback) => {
      const location = Location.getCallerLocation(__dirname);
      const suite = new Suite(this._currentSuite, name, location);
      this._currentSuite = suite;
      suiteCallback();
      this._suites.push(suite);
      this._currentSuite = suite.parentSuite();
      return suite;
    };

    global.xdescribe = (...args) => {
      return global.describe(...args).setSkipped(true);
    };

    global.describe.skip = function(condition) {
      return condition ? global.xdescribe : global.describe;
    };

    global.describe.only = (...args) => {
      const suite = global.describe(...args);
      this._filter.focusSuite(suite);
      return suite;
    };

    global.fdescribe = global.describe.only;

    global.it = (name, testCallback) => {
      const location = Location.getCallerLocation(__dirname);
      const wrapped = fixturePool.wrapTestCallback(testCallback);
      const test = new Test(this._currentSuite, name, wrapped, location);
      test.setTimeout(options.timeout);
      this._tests.push(test);
      return test;
    };

    global.it.only = (...args) => {
      const test = global.it(...args);
      this._filter.focusTest(test);
      return test;
    };

    global.fit = global.it.only;

    global.xit = (...args) => {
      return global.it(...args).setSkipped(true);
    };

    global.it.skip = condition => {
      return condition ? global.xit : global.it;
    };

    global.it.fail = global.it.skip;

    global.it.slow = condition => {
      return global.it;
    };
  }

  addFile(file) {
    global.describe(file, () => {
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
    });
  }

  createTestRuns() {
    return this._repeater.createTestRuns(this._filter.filter(this._tests));
  }
}

module.exports = NoMochaUI;
