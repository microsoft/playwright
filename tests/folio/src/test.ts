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

import * as types from './types';

class Base {
  title: string;
  file: string;
  line: number;
  column: number;
  parent?: Suite;

  _only = false;
  _ordinal: number;

  constructor(title: string, parent?: Suite) {
    this.title = title;
    this.parent = parent;
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

export class Spec extends Base implements types.Spec {
  fn: Function;
  tests: Test[] = [];
  testOptions: any = {};

  constructor(title: string, fn: Function, suite: Suite) {
    super(title, suite);
    this.fn = fn;
    suite._addSpec(this);
  }

  ok(): boolean {
    return !this.tests.find(r => !r.ok());
  }

  _appendTest(runListIndex: number, runListAlias: string, repeatEachIndex: number) {
    const test = new Test(this);
    test.alias = runListAlias;
    test._runListIndex = runListIndex;
    test._workerHash = `${runListIndex}#repeat-${repeatEachIndex}`;
    test._id = `${this._ordinal}@${this.file}::[${test._workerHash}]`;
    test._repeatEachIndex = repeatEachIndex;
    this.tests.push(test);
    return test;
  }
}

export class Suite extends Base implements types.Suite {
  suites: Suite[] = [];
  specs: Spec[] = [];
  _entries: (Suite | Spec)[] = [];
  _hooks: { type: string, fn: Function } [] = [];
  _annotations: { type: 'skip' | 'fixme' | 'fail', description?: string }[] = [];

  constructor(title: string, parent?: Suite) {
    super(title, parent);
    if (parent)
      parent._addSuite(this);
  }

  _clear() {
    this.suites = [];
    this.specs = [];
    this._entries = [];
    this._hooks = [];
    this._annotations = [];
  }

  _addSpec(spec: Spec) {
    spec.parent = this;
    this.specs.push(spec);
    this._entries.push(spec);
  }

  _addSuite(suite: Suite) {
    suite.parent = this;
    this.suites.push(suite);
    this._entries.push(suite);
  }

  findTest(fn: (test: Test) => boolean | void): boolean {
    for (const suite of this.suites) {
      if (suite.findTest(fn))
        return true;
    }
    for (const spec of this.specs) {
      for (const test of spec.tests) {
        if (fn(test))
          return true;
      }
    }
    return false;
  }

  findSpec(fn: (spec: Spec) => boolean | void): boolean {
    for (const suite of this.suites) {
      if (suite.findSpec(fn))
        return true;
    }
    for (const spec of this.specs) {
      if (fn(spec))
        return true;
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

  _renumber() {
    // All tests are identified with their ordinals.
    let ordinal = 0;
    this.findSpec((test: Spec) => {
      test._ordinal = ordinal++;
    });
  }

  _hasOnly(): boolean {
    if (this._only)
      return true;
    if (this.suites.find(suite => suite._hasOnly()))
      return true;
    if (this.specs.find(spec => spec._only))
      return true;
  }

  _addHook(type: string, fn: any) {
    this._hooks.push({ type, fn });
  }
}

export class Test implements types.Test {
  spec: Spec;
  results: types.TestResult[] = [];

  skipped = false;
  expectedStatus: types.TestStatus = 'passed';
  timeout = 0;
  annotations: any[] = [];
  alias = '';

  _id: string;
  _workerHash: string;
  _repeatEachIndex: number;
  _runListIndex: number;

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

  _appendTestResult(): types.TestResult {
    const result: types.TestResult = {
      retry: this.results.length,
      workerIndex: 0,
      duration: 0,
      stdout: [],
      stderr: [],
      data: {}
    };
    this.results.push(result);
    return result;
  }
}
