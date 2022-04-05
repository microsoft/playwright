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

import type { Fixtures, FixturesWithLocation, FullProjectInternal } from './types';
import { Suite, TestCase } from './test';
import { FixturePool, isFixtureOption } from './fixtures';
import { TestTypeImpl } from './testType';
import { calculateSha1 } from 'playwright-core/lib/utils/utils';

export class ProjectImpl {
  config: FullProjectInternal;
  private index: number;
  private testTypePools = new Map<TestTypeImpl, FixturePool>();
  private testPools = new Map<TestCase, FixturePool>();

  constructor(project: FullProjectInternal, index: number) {
    this.config = project;
    this.index = index;
  }

  private buildTestTypePool(testType: TestTypeImpl): FixturePool {
    if (!this.testTypePools.has(testType)) {
      const fixtures = this.resolveFixtures(testType, this.config.use);
      const pool = new FixturePool(fixtures);
      this.testTypePools.set(testType, pool);
    }
    return this.testTypePools.get(testType)!;
  }

  // TODO: we can optimize this function by building the pool inline in cloneSuite
  private buildPool(test: TestCase): FixturePool {
    if (!this.testPools.has(test)) {
      let pool = this.buildTestTypePool(test._testType);

      const parents: Suite[] = [];
      for (let parent: Suite | undefined = test.parent; parent; parent = parent.parent)
        parents.push(parent);
      parents.reverse();

      for (const parent of parents) {
        if (parent._use.length)
          pool = new FixturePool(parent._use, pool, parent._isDescribe);
        for (const hook of parent._hooks)
          pool.validateFunction(hook.fn, hook.type + ' hook', hook.location);
        for (const modifier of parent._modifiers)
          pool.validateFunction(modifier.fn, modifier.type + ' modifier', modifier.location);
      }

      pool.validateFunction(test.fn, 'Test', test.location);
      this.testPools.set(test, pool);
    }
    return this.testPools.get(test)!;
  }

  private _cloneEntries(from: Suite, to: Suite, repeatEachIndex: number, filter: (test: TestCase) => boolean, relativeTitlePath: string): boolean {
    for (const entry of from._entries) {
      if (entry instanceof Suite) {
        const suite = entry._clone();
        to._addSuite(suite);
        if (!this._cloneEntries(entry, suite, repeatEachIndex, filter, relativeTitlePath + ' ' + suite.title)) {
          to._entries.pop();
          to.suites.pop();
        }
      } else {
        const test = entry._clone();
        test.retries = this.config.retries;
        // We rely upon relative paths being unique.
        // See `getClashingTestsPerSuite()` in `runner.ts`.
        test._id = `${calculateSha1(relativeTitlePath + ' ' + entry.title)}@${entry._requireFile}#run${this.index}-repeat${repeatEachIndex}`;
        test.repeatEachIndex = repeatEachIndex;
        test._projectIndex = this.index;
        to._addTest(test);
        if (!filter(test)) {
          to._entries.pop();
          to.tests.pop();
        } else {
          const pool = this.buildPool(entry);
          test._workerHash = `run${this.index}-${pool.digest}-repeat${repeatEachIndex}`;
          test._pool = pool;
        }
      }
    }
    if (!to._entries.length)
      return false;
    return true;
  }

  cloneFileSuite(suite: Suite, repeatEachIndex: number, filter: (test: TestCase) => boolean): Suite | undefined {
    const result = suite._clone();
    return this._cloneEntries(suite, result, repeatEachIndex, filter, '') ? result : undefined;
  }

  private resolveFixtures(testType: TestTypeImpl, configUse: Fixtures): FixturesWithLocation[] {
    return testType.fixtures.map(f => {
      const configKeys = new Set(Object.keys(configUse || {}));
      const resolved = { ...f.fixtures };
      for (const [key, value] of Object.entries(resolved)) {
        if (!isFixtureOption(value) || !configKeys.has(key))
          continue;
        // Apply override from config file.
        const override = (configUse as any)[key];
        (resolved as any)[key] = [override, value[1]];
      }
      return { fixtures: resolved, location: f.location };
    });
  }
}
