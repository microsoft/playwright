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

const path = require('path');
const Mocha = require('mocha');
const { fixturesForCallback, optionRegistrations } = require('./fixtures');
const { fixturesUI } = require('./fixturesUI');

class NullReporter {}

class TestCollector {
  constructor(files, options) {
    this._options = options;
    this.suite = new Mocha.Suite('', new Mocha.Context(), true);
    this._total = 0;
    if (options.grep) {
      const match = options.grep.match(/^\/(.*)\/(g|i|)$|.*/);
      this._grep = new RegExp(match[1] || match[0], match[2]);
    }

    for (const file of files)
      this._addFile(file);

    this._hasOnly = this._filterOnly(this.suite);
  }

  hasOnly() {
    return this._hasOnly;
  }

  _addFile(file) {
    const mocha = new Mocha({
      forbidOnly: this._options.forbidOnly,
      reporter: NullReporter,
      timeout: this._options.timeout,
      ui: fixturesUI.bind(null, {
        testWrapper: (fn) => done => done(),
        hookWrapper: (hook, fn) => {},
        ignoreOnly: false,
      }),
    });
    mocha.addFile(file);
    mocha.loadFiles();

    const workerGeneratorConfigurations = new Map();

    let ordinal = 0;
    mocha.suite.eachTest(test => {
      // All tests are identified with their ordinals.
      test.__ordinal = ordinal++;

      // Get all the fixtures that the test needs.
      const fixtures = fixturesForCallback(test.fn.__original);

      // For generator fixtures, collect all variants of the fixture values
      // to build different workers for them.
      const generatorConfigurations = [];
      for (const name of fixtures) {
        if (!optionRegistrations.has(name))
          continue;
        const values = optionRegistrations.get(name)();
        let state = generatorConfigurations.length ? generatorConfigurations.slice() : [[]];
        generatorConfigurations.length = 0;
        for (const gen of state) {
          for (const value of values)
            generatorConfigurations.push([...gen, { name, value }]);
        }
      }

      // No generator fixtures for test, include empty set.
      if (!generatorConfigurations.length)
        generatorConfigurations.push([]);

      for (const configurationObject of generatorConfigurations) {
        // Serialize configuration as readable string, we will use it as a hash.
        const tokens = [];
        for (const { name, value } of configurationObject)
          tokens.push(`${name}=${value}`);
        const configurationString = tokens.join(', ');
        // Allocate worker for this configuration, add test into it.
        if (!workerGeneratorConfigurations.has(configurationString))
          workerGeneratorConfigurations.set(configurationString, { configurationObject, configurationString, tests: new Set() });
        workerGeneratorConfigurations.get(configurationString).tests.add(test);
      }
    });

    // Clone the suite as many times as there are worker hashes.
    // Only include the tests that requested these generations.
    for (const [hash, {configurationObject, configurationString, tests}] of workerGeneratorConfigurations.entries()) {
      const clone = this._cloneSuite(mocha.suite, configurationObject, configurationString, tests);
      this.suite.addSuite(clone);
      clone.title = path.basename(file) + (hash.length ? `::[${hash}]` : '');
    }
  }

  _cloneSuite(suite, configurationObject, configurationString, tests) {
    const copy = suite.clone();
    copy.__only = suite.__only;
    for (const child of suite.suites)
      copy.addSuite(this._cloneSuite(child, configurationObject, configurationString, tests));
    for (const test of suite.tests) {
      if (!tests.has(test))
        continue;
      if (this._grep && !this._grep.test(test.fullTitle()))
        continue;
      const testCopy = test.clone();
      testCopy.__only = test.__only;
      testCopy.__ordinal = test.__ordinal;
      testCopy.__configurationObject = configurationObject;
      testCopy.__configurationString = configurationString;
      copy.addTest(testCopy);
    }
    return copy;
  }

  _filterOnly(suite) {
    const onlySuites = suite.suites.filter(child => this._filterOnly(child) || child.__only);
    const onlyTests = suite.tests.filter(test => test.__only);
    if (onlySuites.length || onlyTests.length) {
      suite.suites = onlySuites;
      suite.tests = onlyTests;
      return true;
    }
    return false;
  }
}

module.exports = { TestCollector };
