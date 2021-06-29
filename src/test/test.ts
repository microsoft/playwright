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

import * as reporterTypes from './reporter';
import type { TestTypeImpl } from './testType';
import { Location } from './types';

class Base {
  title: string;
  file: string = '';
  line: number = 0;
  column: number = 0;
  parent?: Suite;

  _only = false;
  _requireFile: string = '';

  constructor(title: string) {
    this.title = title;
  }

  titlePath(): string[] {
    if (!this.parent)
      return [];
    if (!this.title)
      return this.parent.titlePath();
    return [...this.parent.titlePath(), this.title];
  }

  fullTitle(): string {
    return this.titlePath().join(' ');
  }
}

export class Spec extends Base implements reporterTypes.Spec {
  suite!: Suite;
  fn: Function;
  tests: Test[] = [];
  _ordinalInFile: number;
  _testType: TestTypeImpl;

  constructor(title: string, fn: Function, ordinalInFile: number, testType: TestTypeImpl) {
    super(title);
    this.fn = fn;
    this._ordinalInFile = ordinalInFile;
    this._testType = testType;
  }

  ok(): boolean {
    return !this.tests.find(r => !r.ok());
  }

  _testFullTitle(projectName: string) {
    return (projectName ? `[${projectName}] ` : '') + this.fullTitle();
  }
}

export class Suite extends Base implements reporterTypes.Suite {
  suites: Suite[] = [];
  specs: Spec[] = [];
  _fixtureOverrides: any = {};
  _entries: (Suite | Spec)[] = [];
  _hooks: {
    type: 'beforeEach' | 'afterEach' | 'beforeAll' | 'afterAll',
    fn: Function,
    location: Location,
  }[] = [];
  _timeout: number | undefined;

  _addSpec(spec: Spec) {
    spec.parent = this;
    spec.suite = this;
    this.specs.push(spec);
    this._entries.push(spec);
  }

  _addSuite(suite: Suite) {
    suite.parent = this;
    this.suites.push(suite);
    this._entries.push(suite);
  }

  findTest(fn: (test: Test) => boolean | void): boolean {
    for (const entry of this._entries) {
      if (entry instanceof Suite) {
        if (entry.findTest(fn))
          return true;
      } else {
        for (const test of entry.tests) {
          if (fn(test))
            return true;
        }
      }
    }
    return false;
  }

  findSpec(fn: (spec: Spec) => boolean | void): boolean {
    for (const entry of this._entries) {
      if (entry instanceof Suite) {
        if (entry.findSpec(fn))
          return true;
      } else {
        if (fn(entry))
          return true;
      }
    }
    return false;
  }

  findSuite(fn: (suite: Suite) => boolean | void): boolean {
    if (fn(this))
      return true;
    for (const suite of this.suites) {
      if (suite.findSuite(fn))
        return true;
    }
    return false;
  }

  totalTestCount(): number {
    let total = 0;
    for (const suite of this.suites)
      total += suite.totalTestCount();
    for (const spec of this.specs)
      total += spec.tests.length;
    return total;
  }

  _allSpecs(): Spec[] {
    const result: Spec[] = [];
    this.findSpec(test => { result.push(test); });
    return result;
  }

  _getOnlyItems(): (Spec | Suite)[] {
    const items: (Spec | Suite)[] = [];
    if (this._only)
      items.push(this);
    for (const suite of this.suites)
      items.push(...suite._getOnlyItems());
    items.push(...this.specs.filter(spec => spec._only));
    return items;
  }

  _buildFixtureOverrides(): any {
    return this.parent ? { ...this.parent._buildFixtureOverrides(), ...this._fixtureOverrides } : this._fixtureOverrides;
  }
}

export class Test implements reporterTypes.Test {
  spec: Spec;
  results: reporterTypes.TestResult[] = [];

  skipped = false;
  expectedStatus: reporterTypes.TestStatus = 'passed';
  timeout = 0;
  annotations: { type: string, description?: string }[] = [];
  projectName = '';
  retries = 0;

  _id = '';
  _repeatEachIndex = 0;
  _projectIndex = 0;
  _workerHash = '';

  constructor(spec: Spec) {
    this.spec = spec;
  }

  status(): 'skipped' | 'expected' | 'unexpected' | 'flaky' {
    if (this.skipped)
      return 'skipped';
    // List mode bail out.
    if (!this.results.length)
      return 'skipped';
    if (this.results.length === 1 && this.expectedStatus === this.results[0].status)
      return 'expected';
    let hasPassedResults = false;
    for (const result of this.results) {
      // Missing status is Ok when running in shards mode.
      if (!result.status)
        return 'skipped';
      if (result.status === this.expectedStatus)
        hasPassedResults = true;
    }
    if (hasPassedResults)
      return 'flaky';
    return 'unexpected';
  }

  ok(): boolean {
    const status = this.status();
    return status === 'expected' || status === 'flaky' || status === 'skipped';
  }

  fullTitle(): string {
    return this.spec._testFullTitle(this.projectName);
  }

  _appendTestResult(): reporterTypes.TestResult {
    const result: reporterTypes.TestResult = {
      retry: this.results.length,
      workerIndex: 0,
      duration: 0,
      stdout: [],
      stderr: [],
    };
    this.results.push(result);
    return result;
  }
}
