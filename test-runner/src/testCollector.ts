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
import { Test, Suite, serializeConfiguration } from './test';
import { spec } from './spec';
import { RunnerConfig } from './runnerConfig';


export type Matrix = {
  [key: string]: string[]
};

export class TestCollector {
  suite: Suite;

  private _matrix: Matrix;
  private _config: RunnerConfig;
  private _grep: RegExp;
  private _hasOnly: boolean;

  constructor(files: string[], matrix: Matrix, config: RunnerConfig) {
    this._matrix = matrix;
    this._config = config;
    this.suite = new Suite('');
    if (config.grep) {
      const match = config.grep.match(/^\/(.*)\/(g|i|)$|.*/);
      this._grep = new RegExp(match[1] || match[0], match[2]);
    }

    for (const file of files)
      this._addFile(file);

    this._hasOnly = this._filterOnly(this.suite);
  }

  hasOnly() {
    return this._hasOnly;
  }

  private _addFile(file: string) {
    const suite = new Suite('');
    const revertBabelRequire = spec(suite, file, this._config.timeout);
    require(file);
    revertBabelRequire();

    const workerGeneratorConfigurations = new Map();

    suite.findTest((test: Test) => {
      // Get all the fixtures that the test needs.
      const fixtures = fixturesForCallback(test.fn);

      // For generator fixtures, collect all variants of the fixture values
      // to build different workers for them.
      const generatorConfigurations = [];
      for (const name of fixtures) {
        const values = this._matrix[name];
        if (!values)
          continue;
        const state = generatorConfigurations.length ? generatorConfigurations.slice() : [[]];
        generatorConfigurations.length = 0;
        for (const gen of state) {
          for (const value of values)
            generatorConfigurations.push([...gen, { name, value }]);
        }
      }

      // No generator fixtures for test, include empty set.
      if (!generatorConfigurations.length)
        generatorConfigurations.push([]);

      for (const configuration of generatorConfigurations) {
        // Serialize configuration as readable string, we will use it as a hash.
        const configurationString = serializeConfiguration(configuration);
        // Allocate worker for this configuration, add test into it.
        if (!workerGeneratorConfigurations.has(configurationString))
          workerGeneratorConfigurations.set(configurationString, { configuration, configurationString, tests: new Set() });
        workerGeneratorConfigurations.get(configurationString).tests.add(test);
      }
    });

    // Clone the suite as many times as we have repeat each.
    for (let i = 0; i < this._config.repeatEach; ++i) {
      // Clone the suite as many times as there are worker hashes.
      // Only include the tests that requested these generations.
      for (const [hash, {configuration, configurationString, tests}] of workerGeneratorConfigurations.entries()) {
        const clone = this._cloneSuite(suite, tests);
        this.suite._addSuite(clone);
        clone.title = path.basename(file) + (hash.length ? `::[${hash}]` : '') + ' ' + (i ? ` #repeat-${i}#` : '');
        clone.configuration = configuration;
        clone._configurationString = configurationString + `#repeat-${i}#`;
        clone._renumber();
      }
    }
  }

  private _cloneSuite(suite: Suite, tests: Set<Test>) {
    const copy = suite._clone();
    copy.only = suite.only;
    for (const entry of suite._entries) {
      if (entry instanceof Suite) {
        copy._addSuite(this._cloneSuite(entry, tests));
      } else {
        const test = entry;
        if (!tests.has(test))
          continue;
        if (this._grep && !this._grep.test(test.fullTitle()))
          continue;
        const testCopy = test._clone();
        testCopy.only = test.only;
        copy._addTest(testCopy);
      }
    }
    return copy;
  }

  private _filterOnly(suite) {
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
