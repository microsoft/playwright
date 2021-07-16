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

import type { FixturePool } from './fixtures';
import * as reporterTypes from './reporter';
import type { TestTypeImpl } from './testType';
import { Annotations, Location } from './types';

class Base {
  title: string;
  file: string = '';
  line: number = 0;
  column: number = 0;
  parent?: Suite;

  _fullTitle: string = '';
  _only = false;
  _requireFile: string = '';

  constructor(title: string) {
    this.title = title;
  }

  _buildFullTitle(parentFullTitle: string) {
    if (this.title)
      this._fullTitle = (parentFullTitle ? parentFullTitle + ' ' : '') + this.title;
    else
      this._fullTitle = parentFullTitle;
  }

  fullTitle(): string {
    return this._fullTitle;
  }
}

export type Modifier = {
  type: 'slow' | 'fixme' | 'skip' | 'fail',
  fn: Function,
  location: Location,
  description: string | undefined
};

export class Suite extends Base implements reporterTypes.Suite {
  suites: Suite[] = [];
  tests: Test[] = [];
  _fixtureOverrides: any = {};
  _entries: (Suite | Test)[] = [];
  _hooks: {
    type: 'beforeEach' | 'afterEach' | 'beforeAll' | 'afterAll',
    fn: Function,
    location: Location,
  }[] = [];
  _timeout: number | undefined;
  _annotations: Annotations = [];
  _modifiers: Modifier[] = [];
  _repeatEachIndex = 0;
  _projectIndex = 0;

  _addTest(test: Test) {
    test.parent = this;
    test.suite = this;
    this.tests.push(test);
    this._entries.push(test);
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
        if (fn(entry))
          return true;
      }
    }
    return false;
  }

  totalTestCount(): number {
    let total = 0;
    for (const suite of this.suites)
      total += suite.totalTestCount();
    total += this.tests.length;
    return total;
  }

  _allTests(): Test[] {
    const result: Test[] = [];
    this.findTest(test => { result.push(test); });
    return result;
  }

  _getOnlyItems(): (Test | Suite)[] {
    const items: (Test | Suite)[] = [];
    if (this._only)
      items.push(this);
    for (const suite of this.suites)
      items.push(...suite._getOnlyItems());
    items.push(...this.tests.filter(test => test._only));
    return items;
  }

  _buildFixtureOverrides(): any {
    return this.parent ? { ...this.parent._buildFixtureOverrides(), ...this._fixtureOverrides } : this._fixtureOverrides;
  }

  _clone(): Suite {
    const suite = new Suite(this.title);
    suite._only = this._only;
    suite.file = this.file;
    suite.line = this.line;
    suite.column = this.column;
    suite._requireFile = this._requireFile;
    suite._fixtureOverrides = this._fixtureOverrides;
    suite._hooks = this._hooks.slice();
    suite._timeout = this._timeout;
    suite._annotations = this._annotations.slice();
    suite._modifiers = this._modifiers.slice();
    return suite;
  }
}

export class Test extends Base implements reporterTypes.Test {
  suite!: Suite;
  fn: Function;
  results: reporterTypes.TestResult[] = [];

  skipped = false;
  expectedStatus: reporterTypes.TestStatus = 'passed';
  timeout = 0;
  annotations: Annotations = [];
  projectName = '';
  retries = 0;

  _ordinalInFile: number;
  _testType: TestTypeImpl;
  _id = '';
  _workerHash = '';
  _pool: FixturePool | undefined;

  constructor(title: string, fn: Function, ordinalInFile: number, testType: TestTypeImpl) {
    super(title);
    this.fn = fn;
    this._ordinalInFile = ordinalInFile;
    this._testType = testType;
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

  _clone(): Test {
    const test = new Test(this.title, this.fn, this._ordinalInFile, this._testType);
    test._only = this._only;
    test.file = this.file;
    test.line = this.line;
    test.column = this.column;
    test._requireFile = this._requireFile;
    return test;
  }

  fullTitle(): string {
    return (this.projectName ? `[${this.projectName}] ` : '') + this._fullTitle;
  }

  _appendTestResult(): reporterTypes.TestResult {
    const result: reporterTypes.TestResult = {
      retry: this.results.length,
      workerIndex: 0,
      duration: 0,
      stdout: [],
      stderr: [],
      data: {},
    };
    this.results.push(result);
    return result;
  }
}
