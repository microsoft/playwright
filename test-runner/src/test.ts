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

type TestStatus = 'passed' | 'failed' | 'timedOut' | 'skipped';

export class Runnable {
  title: string;
  file: string;
  parent?: Suite;

  _only = false;
  _skipped = false;
  _flaky = false;
  _slow = false;
  _expectedStatus: TestStatus = 'passed';

  isOnly(): boolean {
    return this._only;
  }

  isSlow(): boolean {
    return this._slow;
  }

  slow(): void;
  slow(condition: boolean): void;
  slow(description: string): void;
  slow(condition: boolean, description: string): void;
  slow(arg?: boolean | string, description?: string) {
    const { condition } = this._interpretCondition(arg, description);
    if (condition)
      this._slow = true;
  }

  skip(): void;
  skip(condition: boolean): void;
  skip(description: string): void;
  skip(condition: boolean, description: string): void;
  skip(arg?: boolean | string, description?: string) {
    const { condition } = this._interpretCondition(arg, description);
    if (condition)
      this._skipped = true;
  }

  fixme(): void;
  fixme(condition: boolean): void;
  fixme(description: string): void;
  fixme(condition: boolean, description: string): void;
  fixme(arg?: boolean | string, description?: string) {
    const { condition } = this._interpretCondition(arg, description);
    if (condition)
      this._skipped = true;
  }

  flaky(): void;
  flaky(condition: boolean): void;
  flaky(description: string): void;
  flaky(condition: boolean, description: string): void;
  flaky(arg?: boolean | string, description?: string) {
    const { condition } = this._interpretCondition(arg, description);
    if (condition)
      this._flaky = true;
  }

  fail(): void;
  fail(condition: boolean): void;
  fail(description: string): void;
  fail(condition: boolean, description: string): void;
  fail(arg?: boolean | string, description?: string) {
    const { condition } = this._interpretCondition(arg, description);
    if (condition)
      this._expectedStatus = 'failed';
  }

  private _interpretCondition(arg?: boolean | string, description?: string): { condition: boolean, description?: string } {
    if (arg === undefined && description === undefined)
      return { condition: true };
    if (typeof arg === 'string')
      return { condition: true, description: arg };
    return { condition: !!arg, description };
  }

  _isSkipped(): boolean {
    return this._skipped || (this.parent && this.parent._isSkipped());
  }

  _isSlow(): boolean {
    return this._slow || (this.parent && this.parent._isSlow());
  }

  isFlaky(): boolean {
    return this._flaky || (this.parent && this.parent.isFlaky());
  }

  titlePath(): string[] {
    if (!this.parent)
      return [];
    return [...this.parent.titlePath(), this.title];
  }

  fullTitle(): string {
    return this.titlePath().join(' ');
  }

  _copyFrom(other: Runnable) {
    this.file = other.file;
    this._only = other._only;
    this._flaky = other._flaky;
    this._skipped = other._skipped;
    this._slow = other._slow;
  }
}

export class Test extends Runnable {
  fn: Function;
  results: TestResult[] = [];
  _id: string;
  _overriddenFn: Function;
  _startTime: number;
  _timeout = 0;

  constructor(title: string, fn: Function) {
    super();
    this.title = title;
    this.fn = fn;
  }

  _appendResult(): TestResult {
    const result: TestResult = {
      duration: 0,
      expectedStatus: 'passed',
      stdout: [],
      stderr: [],
      data: {}
    };
    this.results.push(result);
    return result;
  }

  timeout(): number {
    return this._timeout;
  }

  _ok(): boolean {
    if (this._isSkipped())
      return true;
    const hasFailedResults = !!this.results.find(r => r.status !== r.expectedStatus);
    if (!hasFailedResults)
      return true;
    if (!this.isFlaky())
      return false;
    const hasPassedResults = !!this.results.find(r => r.status === r.expectedStatus);
    return hasPassedResults;
  }

  _hasResultWithStatus(status: TestStatus): boolean {
    return !!this.results.find(r => r.status === status);
  }

  _clone(): Test {
    const test = new Test(this.title, this.fn);
    test._copyFrom(this);
    test._timeout = this._timeout;
    test._overriddenFn = this._overriddenFn;
    return test;
  }
}

export type TestResult = {
  duration: number;
  status?: TestStatus;
  expectedStatus: TestStatus;
  error?: any;
  stdout: (string | Buffer)[];
  stderr: (string | Buffer)[];
  data: any;
}

export class Suite extends Runnable {
  suites: Suite[] = [];
  tests: Test[] = [];
  configuration: Configuration;
  _configurationString: string;

  _hooks: { type: string, fn: Function } [] = [];
  _entries: (Suite | Test)[] = [];

  constructor(title: string, parent?: Suite) {
    super();
    this.title = title;
    this.parent = parent;
  }

  total(): number {
    let count = 0;
    this.findTest(fn => {
      ++count;
    });
    return count;
  }

  _addTest(test: Test) {
    test.parent = this;
    this.tests.push(test);
    this._entries.push(test);
  }

  _addSuite(suite: Suite) {
    suite.parent = this;
    this.suites.push(suite);
    this._entries.push(suite);
  }

  eachSuite(fn: (suite: Suite) => boolean | void): boolean {
    for (const suite of this.suites) {
      if (suite.eachSuite(fn))
        return true;
    }
    return false;
  }

  findTest(fn: (test: Test) => boolean | void): boolean {
    for (const suite of this.suites) {
      if (suite.findTest(fn))
        return true;
    }
    for (const test of this.tests) {
      if (fn(test))
        return true;
    }
    return false;
  }

  _clone(): Suite {
    const suite = new Suite(this.title);
    suite._copyFrom(this);
    return suite;
  }

  _renumber() {
    let ordinal = 0;
    this.findTest((test: Test) => {
      // All tests are identified with their ordinals.
      test._id = `${ordinal++}@${this.file}::[${this._configurationString}]`;
    });
  }

  _addHook(type: string, fn: any) {
    this._hooks.push({ type, fn });
  }

  _hasTestsToRun(): boolean {
    let found = false;
    this.findTest(test => {
      if (!test._isSkipped()) {
        found = true;
        return true;
      }
    });
    return found;
  }
}

export function serializeConfiguration(configuration: Configuration): string {
  const tokens = [];
  for (const { name, value } of configuration)
    tokens.push(`${name}=${value}`);
  return tokens.join(', ');
}

export function serializeError(error: Error | any): any {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack
    };
  }
  return trimCycles(error);
}

function trimCycles(obj: any): any {
  const cache = new Set();
  return JSON.parse(
      JSON.stringify(obj, function(key, value) {
        if (typeof value === 'object' && value !== null) {
          if (cache.has(value))
            return '' + value;
          cache.add(value);
        }
        return value;
      })
  );
}
