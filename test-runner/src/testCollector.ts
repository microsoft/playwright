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

import path from 'path';
import { fixturesForCallback } from './fixtures';
import { Configuration, Test, Suite } from './test';
import { fixturesUI } from './fixturesUI';

export class TestCollector {
  suite: Suite;

  private _matrix: { [key: string]: string; };
  private _options: any;
  private _grep: RegExp;
  private _hasOnly: boolean;

  constructor(files: string[], matrix: { [key: string] : string }, options) {
    this._matrix = matrix;
    this._options = options;
    this.suite = new Suite('');
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
    const suite = new Suite('');
    const revertBabelRequire = fixturesUI(suite, file, this._options.timeout);
    require(file);
    revertBabelRequire();
    suite._renumber();

    const workerGeneratorConfigurations = new Map();

    suite.eachTest((test: Test) => {
      // Get all the fixtures that the test needs.
      const fixtures = fixturesForCallback(test.fn);

      // For generator fixtures, collect all variants of the fixture values
      // to build different workers for them.
      const generatorConfigurations = [];
      for (const name of fixtures) {
        const values = this._matrix[name];
        if (!values)
          continue;
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
      const clone = this._cloneSuite(suite, configurationObject, configurationString, tests);
      this.suite.addSuite(clone);
      clone.title = path.basename(file) + (hash.length ? `::[${hash}]` : '');
    }
  }

  _cloneSuite(suite: Suite, configurationObject: Configuration, configurationString: string, tests: Set<Test>) {
    const copy = suite.clone();
    copy.only = suite.only;
    copy.configuration = configurationObject;
    for (const entry of suite._entries) {
      if (entry instanceof Suite) {
        copy.addSuite(this._cloneSuite(entry, configurationObject, configurationString, tests));
      } else {
        const test = entry;
        if (!tests.has(test))
          continue;
        if (this._grep && !this._grep.test(test.fullTitle()))
          continue;
        const testCopy = test.clone();
        testCopy.only = test.only;
        testCopy._ordinal = test._ordinal;
        testCopy._configurationObject = configurationObject;
        testCopy._configurationString = configurationString;
        copy.addTest(testCopy);
      }
    }
    return copy;
  }

  _filterOnly(suite) {
    const onlySuites = suite.suites.filter(child => this._filterOnly(child) || child.only);
    const onlyTests = suite.tests.filter(test => test.only);
    if (onlySuites.length || onlyTests.length) {
      suite.suites = onlySuites;
      suite.tests = onlyTests;
      return true;
    }
    return false;
  }
}

module.exports = { TestCollector };
