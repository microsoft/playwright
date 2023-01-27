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

import { FixturePool, isFixtureOption } from './fixtures';
import type { LoadError } from './fixtures';
import type { Suite, TestCase } from './test';
import type { TestTypeImpl } from './testType';
import type { Fixtures, FixturesWithLocation, FullProjectInternal } from './types';
import { formatLocation } from '../util';

export class PoolBuilder {
  private _project: FullProjectInternal | undefined;
  private _testTypePools = new Map<TestTypeImpl, FixturePool>();
  private _type: 'loader' | 'worker';
  private _loadErrors: LoadError[] | undefined;

  static buildForLoader(suite: Suite, loadErrors: LoadError[]) {
    new PoolBuilder('loader', loadErrors).buildPools(suite);
  }

  static createForWorker(project: FullProjectInternal) {
    return new PoolBuilder('worker', undefined, project);
  }

  private constructor(type: 'loader' | 'worker', loadErrors?: LoadError[], project?: FullProjectInternal) {
    this._type = type;
    this._loadErrors = loadErrors;
    this._project = project;
  }

  buildPools(suite: Suite) {
    suite.forEachTest(test => {
      const pool = this._buildPoolForTest(test);
      if (this._type === 'loader')
        test._poolDigest = pool.digest;
      if (this._type === 'worker')
        test._pool = pool;
    });
  }

  private _buildPoolForTest(test: TestCase): FixturePool {
    let pool = this._buildTestTypePool(test._testType);

    const parents: Suite[] = [];
    for (let parent: Suite | undefined = test.parent; parent; parent = parent.parent)
      parents.push(parent);
    parents.reverse();

    for (const parent of parents) {
      if (parent._use.length)
        pool = new FixturePool(parent._use, e => this._onLoadError(e), pool, parent._type === 'describe');
      for (const hook of parent._hooks)
        pool.validateFunction(hook.fn, hook.type + ' hook', hook.location);
      for (const modifier of parent._modifiers)
        pool.validateFunction(modifier.fn, modifier.type + ' modifier', modifier.location);
    }

    pool.validateFunction(test.fn, 'Test', test.location);
    return pool;
  }

  private _buildTestTypePool(testType: TestTypeImpl): FixturePool {
    if (!this._testTypePools.has(testType)) {
      const fixtures = this._project ? this._applyConfigUseOptions(this._project, testType) : testType.fixtures;
      const pool = new FixturePool(fixtures, e => this._onLoadError(e));
      this._testTypePools.set(testType, pool);
    }
    return this._testTypePools.get(testType)!;
  }

  private _onLoadError(e: LoadError): void {
    if (this._loadErrors)
      this._loadErrors.push(e);
    else
      throw new Error(`${formatLocation(e.location)}: ${e.message}`);
  }

  private _applyConfigUseOptions(project: FullProjectInternal, testType: TestTypeImpl): FixturesWithLocation[] {
    const projectUse = project.use || {};
    const configKeys = new Set(Object.keys(projectUse));
    if (!configKeys.size)
      return testType.fixtures;
    const result: FixturesWithLocation[] = [];
    for (const f of testType.fixtures) {
      result.push(f);
      const optionsFromConfig: Fixtures = {};
      for (const [key, value] of Object.entries(f.fixtures)) {
        if (isFixtureOption(value) && configKeys.has(key))
          (optionsFromConfig as any)[key] = [(projectUse as any)[key], value[1]];
      }
      if (Object.entries(optionsFromConfig).length) {
        // Add config options immediately after original option definition,
        // so that any test.use() override it.
        result.push({ fixtures: optionsFromConfig, location: { file: `project#${project._id}`, line: 1, column: 1 }, fromConfig: true });
      }
    }
    return result;
  }
}
