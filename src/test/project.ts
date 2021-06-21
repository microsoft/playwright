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
import { Spec, Test } from './test';
import { FixturePool } from './fixtures';
import { DeclaredFixtures, TestTypeImpl } from './testType';

export class ProjectImpl {
  config: FullProject;
  private index: number;
  private defines = new Map<TestType<any, any>, Fixtures>();
  private testTypePools = new Map<TestTypeImpl, FixturePool>();
  private specPools = new Map<Spec, FixturePool>();

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

  buildPool(spec: Spec): FixturePool {
    if (!this.specPools.has(spec)) {
      let pool = this.buildTestTypePool(spec._testType);
      const overrides: Fixtures = spec.parent!._buildFixtureOverrides();
      if (Object.entries(overrides).length) {
        const overridesWithLocation = {
          fixtures: overrides,
          location: {
            file: spec.file,
            line: 1,  // TODO: capture location
            column: 1,  // TODO: capture location
          }
        };
        pool = new FixturePool([overridesWithLocation], pool);
      }
      this.specPools.set(spec, pool);

      pool.validateFunction(spec.fn, 'Test', true, spec);
      for (let parent = spec.parent; parent; parent = parent.parent) {
        for (const hook of parent._hooks)
          pool.validateFunction(hook.fn, hook.type + ' hook', hook.type === 'beforeEach' || hook.type === 'afterEach', hook.location);
      }
    }
    return this.specPools.get(spec)!;
  }

  generateTests(spec: Spec, repeatEachIndex?: number) {
    const digest = this.buildPool(spec).digest;
    const min = repeatEachIndex === undefined ? 0 : repeatEachIndex;
    const max = repeatEachIndex === undefined ? this.config.repeatEach - 1 : repeatEachIndex;
    const tests: Test[] = [];
    for (let i = min; i <= max; i++) {
      const test = new Test(spec);
      test.projectName = this.config.name;
      test.retries = this.config.retries;
      test._repeatEachIndex = i;
      test._projectIndex = this.index;
      test._workerHash = `run${this.index}-${digest}-repeat${i}`;
      test._id = `${spec._ordinalInFile}@${spec._requireFile}#run${this.index}-repeat${i}`;
      spec.tests.push(test);
      tests.push(test);
    }
    return tests;
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
