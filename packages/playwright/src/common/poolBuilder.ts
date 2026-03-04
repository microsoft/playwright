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

import { FixturePool, inheritFixtureNames } from './fixtures';
import { formatLocation } from '../util';
import { currentTestInfo } from './globals';

import type { FullProjectInternal } from './config';
import type { LoadError } from './fixtures';
import type { Suite, TestCase } from './test';
import type { TestTypeImpl } from './testType';
import type { TestError } from '../../types/testReporter';

export class PoolBuilder {
  private _project: FullProjectInternal | undefined;
  private _testTypePools = new Map<TestTypeImpl, FixturePool>();
  private _type: 'loader' | 'worker';

  static createForLoader() {
    return new PoolBuilder('loader');
  }

  static createForWorker(project: FullProjectInternal) {
    return new PoolBuilder('worker', project);
  }

  private constructor(type: 'loader' | 'worker', project?: FullProjectInternal) {
    this._type = type;
    this._project = project;
  }

  buildPools(topSuite: Suite, testErrors?: TestError[]) {
    topSuite.forEachSuite(suite => {
      const modifiers = suite._modifiers.slice();
      suite._modifiers = [];

      for (const modifier of modifiers.reverse()) {
        let pool = this._buildTestTypePool(modifier.testType, testErrors);
        pool = this._buildPoolForSuite(pool, suite, testErrors);
        const scope = pool.validateFunction(modifier.fn, modifier.type + ' modifier', modifier.location);

        const fn = async (fixtures: any) => {
          const result = await modifier.fn(fixtures);
          currentTestInfo()?._modifier(modifier.type, modifier.location, [!!result, modifier.description]);
        };
        inheritFixtureNames(modifier.fn, fn);

        suite._hooks.unshift({
          type: scope === 'worker' ? 'beforeAll' : 'beforeEach',
          fn,
          title: `${modifier.type} modifier`,
          location: modifier.location,
        });
      }
    });

    topSuite.forEachTest(test => {
      const pool = this._buildPoolForTest(test, testErrors);
      if (this._type === 'loader')
        test._poolDigest = pool.digest;
      if (this._type === 'worker')
        test._pool = pool;
    });
  }

  private _buildPoolForTest(test: TestCase, testErrors?: TestError[]): FixturePool {
    let pool = this._buildTestTypePool(test._testType, testErrors);
    pool = this._buildPoolForSuite(pool, test.parent, testErrors);
    pool.validateFunction(test.fn, 'Test', test.location);
    return pool;
  }

  private _buildPoolForSuite(pool: FixturePool, suite: Suite, testErrors?: TestError[]): FixturePool {
    if (suite.parent)
      pool = this._buildPoolForSuite(pool, suite.parent, testErrors);
    if (suite._use.length)
      pool = new FixturePool(suite._use, e => this._handleLoadError(e, testErrors), pool, suite._type === 'describe');
    for (const hook of suite._hooks)
      pool.validateFunction(hook.fn, hook.type + ' hook', hook.location);
    return pool;
  }

  private _buildTestTypePool(testType: TestTypeImpl, testErrors?: TestError[]): FixturePool {
    if (!this._testTypePools.has(testType)) {
      const optionOverrides = {
        overrides: this._project?.project?.use ?? {},
        location: { file: `project#${this._project?.id}`, line: 1, column: 1 }
      };
      const pool = new FixturePool(testType.fixtures, e => this._handleLoadError(e, testErrors), undefined, undefined, optionOverrides);
      this._testTypePools.set(testType, pool);
    }
    return this._testTypePools.get(testType)!;
  }

  private _handleLoadError(e: LoadError, testErrors?: TestError[]): void {
    if (testErrors)
      testErrors.push(e);
    else
      throw new Error(`${formatLocation(e.location)}: ${e.message}`);
  }
}
