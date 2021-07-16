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

import type { TestType, FullProject, Fixtures, FixturesWithLocation } from './types';
import { Suite, Test } from './test';
import { FixturePool } from './fixtures';
import { DeclaredFixtures, TestTypeImpl } from './testType';

export class ProjectImpl {
  config: FullProject;
  private index: number;
  private defines = new Map<TestType<any, any>, Fixtures>();
  private testTypePools = new Map<TestTypeImpl, FixturePool>();
  private testPools = new Map<Test, FixturePool>();

  constructor(project: FullProject, index: number) {
    this.config = project;
    this.index = index;
    this.defines = new Map();
    for (const { test, fixtures } of Array.isArray(project.define) ? project.define : [project.define])
      this.defines.set(test, fixtures);
  }

  private buildTestTypePool(testType: TestTypeImpl): FixturePool {
    if (!this.testTypePools.has(testType)) {
      const fixtures = this.resolveFixtures(testType);
      const overrides: Fixtures = this.config.use;
      const overridesWithLocation = {
        fixtures: overrides,
        location: {
          file: `<configuration file>`,
          line: 1,
          column: 1,
        }
      };
      const pool = new FixturePool([...fixtures, overridesWithLocation]);
      this.testTypePools.set(testType, pool);
    }
    return this.testTypePools.get(testType)!;
  }

  // TODO: we can optimize this function by building the pool inline in cloneSuite
  private buildPool(test: Test): FixturePool {
    if (!this.testPools.has(test)) {
      let pool = this.buildTestTypePool(test._testType);
      const overrides: Fixtures = test.parent!._buildFixtureOverrides();
      if (Object.entries(overrides).length) {
        const overridesWithLocation = {
          fixtures: overrides,
          // TODO: pass location from test.use() callsite.
          location: test.location,
        };
        pool = new FixturePool([overridesWithLocation], pool);
      }
      this.testPools.set(test, pool);

      pool.validateFunction(test.fn, 'Test', true, test.location);
      for (let parent = test.parent; parent; parent = parent.parent) {
        for (const hook of parent._hooks)
          pool.validateFunction(hook.fn, hook.type + ' hook', hook.type === 'beforeEach' || hook.type === 'afterEach', hook.location);
        for (const modifier of parent._modifiers)
          pool.validateFunction(modifier.fn, modifier.type + ' modifier', true, modifier.location);
      }
    }
    return this.testPools.get(test)!;
  }

  private _cloneEntries(from: Suite, to: Suite, repeatEachIndex: number, filter: (test: Test) => boolean): boolean {
    for (const entry of from._entries) {
      if (entry instanceof Suite) {
        const suite = entry._clone();
        to._addSuite(suite);
        if (!this._cloneEntries(entry, suite, repeatEachIndex, filter)) {
          to._entries.pop();
          to.suites.pop();
        }
      } else {
        const pool = this.buildPool(entry);
        const test = entry._clone();
        test.projectName = this.config.name;
        test.retries = this.config.retries;
        test._workerHash = `run${this.index}-${pool.digest}-repeat${repeatEachIndex}`;
        test._id = `${entry._ordinalInFile}@${entry._requireFile}#run${this.index}-repeat${repeatEachIndex}`;
        test._pool = pool;
        test._repeatEachIndex = repeatEachIndex;
        test._projectIndex = this.index;
        to._addTest(test);
        if (!filter(test)) {
          to._entries.pop();
          to.suites.pop();
        }
      }
    }
    return to._entries.length > 0;
  }

  cloneFileSuite(suite: Suite, repeatEachIndex: number, filter: (test: Test) => boolean): Suite | undefined {
    const result = suite._clone();
    return this._cloneEntries(suite, result, repeatEachIndex, filter) ? result : undefined;
  }

  private resolveFixtures(testType: TestTypeImpl): FixturesWithLocation[] {
    return testType.fixtures.map(f => {
      if (f instanceof DeclaredFixtures) {
        const fixtures = this.defines.get(f.testType.test) || {};
        return { fixtures, location: f.location };
      }
      return f;
    });
  }
}
