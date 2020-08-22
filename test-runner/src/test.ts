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

export type Configuration = { name: string, value: string }[];

export class Test {
  suite: Suite;
  title: string;
  file: string;
  only = false;
  pending = false;
  duration = 0;
  timeout = 0;
  fn: Function;
  error: any;

  _ordinal: number;
  _configurationObject: Configuration;
  _configurationString: string;
  _overriddenFn: Function;
  _startTime: number;

  constructor(title: string, fn: Function) {
    this.title = title;
    this.fn = fn;
  }

  clone(): Test {
    const test = new Test(this.title, this.fn);
    test.suite = this.suite;
    test.only = this.only;
    test.file = this.file;
    test.pending = this.pending;
    test.timeout = this.timeout;
    test._overriddenFn = this._overriddenFn;
    return test;
  }

  titlePath(): string[] {
    return [...this.suite.titlePath(), this.title];
  }

  fullTitle(): string {
    return this.titlePath().join(' ');
  }

  slow(): number {
    return 10000;
  }
}

export class Suite {
  title: string;
  parent?: Suite;
  suites: Suite[] = [];
  tests: Test[] = [];
  only = false;
  pending = false;
  file: string;

  _hooks: { type: string, fn: Function } [] = [];
  _entries: (Suite | Test)[] = [];

  constructor(title: string, parent?: Suite) {
    this.title = title;
    this.parent = parent;
  }

  titlePath(): string[] {
    if (!this.parent)
      return [];
    return [...this.parent.titlePath(), this.title];
  }

  total(): number {
    let count = 0;
    this.eachTest(fn => {
      ++count;
    });
    return count;
  }

  isPending(): boolean {
    return this.pending || (this.parent && this.parent.isPending());
  }

  addTest(test: Test) {
    test.suite = this;
    this.tests.push(test);
    this._entries.push(test);
  }

  addSuite(suite: Suite) {
    suite.parent = this;
    this.suites.push(suite);
    this._entries.push(suite);
  }

  eachTest(fn: (test: Test) => boolean | void): boolean {
    for (const suite of this.suites) {
      if (suite.eachTest(fn))
        return true;
    }
    for (const test of this.tests) {
      if (fn(test))
        return true;
    }
    return false;
  }

  clone(): Suite {
    const suite = new Suite(this.title);
    suite.only = this.only;
    suite.file = this.file;
    suite.pending = this.pending;
    return suite;
  }

  _renumber() {
    let ordinal = 0;
    this.eachTest((test: Test) => {
      // All tests are identified with their ordinals.
      test._ordinal = ordinal++;
    });
  }

  _addHook(type: string, fn: any) {
    this._hooks.push({ type, fn });
  }

  _hasTestsToRun(): boolean {
    let found = false;
    this.eachTest(test => {
      if (!test.pending) {
        found = true;
        return true;
      }
    });
    return found;
  }
}
