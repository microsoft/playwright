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

import * as path from 'path';
import { calculateSha1 } from 'playwright-core/lib/utils';
import { FixturePool, isFixtureOption } from './fixtures';
import { setCurrentlyLoadingFileSuite } from './globals';
import { Suite, type TestCase } from './test';
import type { TestTypeImpl } from './testType';
import { requireOrImport } from './transform';
import type { Fixtures, FixturesWithLocation, FullConfigInternal, FullProjectInternal } from './types';
import { serializeError } from './util';

export const defaultTimeout = 30000;

// To allow multiple loaders in the same process without clearing require cache,
// we make these maps global.
const cachedFileSuites = new Map<string, Suite>();

export class TestLoader {
  private _projectSuiteBuilders = new Map<FullProjectInternal, ProjectSuiteBuilder>();
  private _fullConfig: FullConfigInternal;

  constructor(fullConfig: FullConfigInternal) {
    this._fullConfig = fullConfig;
  }

  async loadTestFile(file: string, environment: 'runner' | 'worker', phase: 'test' | 'projectSetup' | 'globalSetup') {
    if (cachedFileSuites.has(file))
      return cachedFileSuites.get(file)!;
    const suite = new Suite(path.relative(this._fullConfig.rootDir, file) || path.basename(file), 'file');
    suite._requireFile = file;
    suite._phase = phase;
    suite.location = { file, line: 0, column: 0 };

    setCurrentlyLoadingFileSuite(suite);
    try {
      await requireOrImport(file);
      cachedFileSuites.set(file, suite);
    } catch (e) {
      if (environment === 'worker')
        throw e;
      suite._loadError = serializeError(e);
    } finally {
      setCurrentlyLoadingFileSuite(undefined);
    }

    {
      // Test locations that we discover potentially have different file name.
      // This could be due to either
      //   a) use of source maps or due to
      //   b) require of one file from another.
      // Try fixing (a) w/o regressing (b).

      const files = new Set<string>();
      suite.allTests().map(t => files.add(t.location.file));
      if (files.size === 1) {
        // All tests point to one file.
        const mappedFile = files.values().next().value;
        if (suite.location.file !== mappedFile) {
          // The file is different, check for a likely source map case.
          if (path.extname(mappedFile) !== path.extname(suite.location.file))
            suite.location.file = mappedFile;
        }
      }
    }

    return suite;
  }

  buildFileSuiteForProject(project: FullProjectInternal, suite: Suite, repeatEachIndex: number, filter: (test: TestCase) => boolean): Suite | undefined {
    if (!this._projectSuiteBuilders.has(project))
      this._projectSuiteBuilders.set(project, new ProjectSuiteBuilder(project));
    const builder = this._projectSuiteBuilders.get(project)!;
    return builder.cloneFileSuite(suite, repeatEachIndex, filter);
  }
}

class ProjectSuiteBuilder {
  private _project: FullProjectInternal;
  private _testTypePools = new Map<TestTypeImpl, FixturePool>();
  private _testPools = new Map<TestCase, FixturePool>();

  constructor(project: FullProjectInternal) {
    this._project = project;
  }

  private _buildTestTypePool(testType: TestTypeImpl): FixturePool {
    if (!this._testTypePools.has(testType)) {
      const fixtures = this._applyConfigUseOptions(testType, this._project.use || {});
      const pool = new FixturePool(fixtures);
      this._testTypePools.set(testType, pool);
    }
    return this._testTypePools.get(testType)!;
  }

  // TODO: we can optimize this function by building the pool inline in cloneSuite
  private _buildPool(test: TestCase): FixturePool {
    if (!this._testPools.has(test)) {
      let pool = this._buildTestTypePool(test._testType);

      const parents: Suite[] = [];
      for (let parent: Suite | undefined = test.parent; parent; parent = parent.parent)
        parents.push(parent);
      parents.reverse();

      for (const parent of parents) {
        if (parent._use.length)
          pool = new FixturePool(parent._use, pool, parent._type === 'describe');
        for (const hook of parent._hooks)
          pool.validateFunction(hook.fn, hook.type + ' hook', hook.location);
        for (const modifier of parent._modifiers)
          pool.validateFunction(modifier.fn, modifier.type + ' modifier', modifier.location);
      }

      pool.validateFunction(test.fn, 'Test', test.location);
      this._testPools.set(test, pool);
    }
    return this._testPools.get(test)!;
  }

  private _cloneEntries(from: Suite, to: Suite, repeatEachIndex: number, filter: (test: TestCase) => boolean): boolean {
    for (const entry of from._entries) {
      if (entry instanceof Suite) {
        const suite = entry._clone();
        suite._fileId = to._fileId;
        to._addSuite(suite);
        // Ignore empty titles, similar to Suite.titlePath().
        if (!this._cloneEntries(entry, suite, repeatEachIndex, filter)) {
          to._entries.pop();
          to.suites.pop();
        }
      } else {
        const test = entry._clone();
        to._addTest(test);
        test.retries = this._project.retries;
        for (let parentSuite: Suite | undefined = to; parentSuite; parentSuite = parentSuite.parent) {
          if (parentSuite._retries !== undefined) {
            test.retries = parentSuite._retries;
            break;
          }
        }
        const repeatEachIndexSuffix = repeatEachIndex ? ` (repeat:${repeatEachIndex})` : '';
        // At the point of the query, suite is not yet attached to the project, so we only get file, describe and test titles.
        const testIdExpression = `[project=${this._project._id}]${test.titlePath().join('\x1e')}${repeatEachIndexSuffix}`;
        const testId = to._fileId + '-' + calculateSha1(testIdExpression).slice(0, 20);
        test.id = testId;
        test.repeatEachIndex = repeatEachIndex;
        test._projectId = this._project._id;
        if (!filter(test)) {
          to._entries.pop();
          to.tests.pop();
        } else {
          const pool = this._buildPool(entry);
          test._workerHash = `run${this._project._id}-${pool.digest}-repeat${repeatEachIndex}`;
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
    const relativeFile = path.relative(this._project.testDir, suite.location!.file).split(path.sep).join('/');
    result._fileId = calculateSha1(relativeFile).slice(0, 20);
    return this._cloneEntries(suite, result, repeatEachIndex, filter) ? result : undefined;
  }

  private _applyConfigUseOptions(testType: TestTypeImpl, configUse: Fixtures): FixturesWithLocation[] {
    const configKeys = new Set(Object.keys(configUse));
    if (!configKeys.size)
      return testType.fixtures;
    const result: FixturesWithLocation[] = [];
    for (const f of testType.fixtures) {
      result.push(f);
      const optionsFromConfig: Fixtures = {};
      for (const [key, value] of Object.entries(f.fixtures)) {
        if (isFixtureOption(value) && configKeys.has(key))
          (optionsFromConfig as any)[key] = [(configUse as any)[key], value[1]];
      }
      if (Object.entries(optionsFromConfig).length) {
        // Add config options immediately after original option definition,
        // so that any test.use() override it.
        result.push({ fixtures: optionsFromConfig, location: { file: `project#${this._project._id}`, line: 1, column: 1 }, fromConfig: true });
      }
    }
    return result;
  }
}
