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

import { FixturePool } from './fixtures';
import { formatLocation } from '../util';

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

  buildPools(suite: Suite, testErrors?: TestError[]) {
    suite.forEachTest(test => {
      const pool = this._buildPoolForTest(test, testErrors);
      if (this._type === 'loader')
        test._poolDigest = pool.digest;
      if (this._type === 'worker')
        test._pool = pool;
    });
  }

  private _buildPoolForTest(test: TestCase, testErrors?: TestError[]): FixturePool {
    let pool = this._buildTestTypePool(test._testType, testErrors);

    const parents: Suite[] = [];
    for (let parent: Suite | undefined = test.parent; parent; parent = parent.parent)
      parents.push(parent);
    parents.reverse();

    for (const parent of parents) {
      if (parent._use.length)
        pool = new FixturePool(parent._use, e => this._handleLoadError(e, testErrors), pool, parent._type === 'describe');
      for (const hook of parent._hooks)
        pool.validateFunction(hook.fn, hook.type + ' hook', hook.location);
      for (const modifier of parent._modifiers)
        pool.validateFunction(modifier.fn, modifier.type + ' modifier', modifier.location);
    }

    pool.validateFunction(test.fn, 'Test', test.location);
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
