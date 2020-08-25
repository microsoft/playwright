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

import { FixturePool } from "./fixtures";

export type Configuration = { name: string, value: string }[];

export class Test {
  suite: Suite;
  title: string;
  file: string;
  only = false;
  pending = false;
  slow = false;
  duration = 0;
  timeout = 0;
  fn: Function;
  error: any;

  _ordinal: number;
  _overriddenFn: Function;
  _startTime: number;

  constructor(title: string, fn: Function) {
    this.title = title;
    this.fn = fn;
  }

  titlePath(): string[] {
    return [...this.suite.titlePath(), this.title];
  }

  fullTitle(): string {
    return this.titlePath().filter(x => x).join(' ');
  }

  _clone(): Test {
    const test = new Test(this.title, this.fn);
    test.suite = this.suite;
    test.only = this.only;
    test.file = this.file;
    test.pending = this.pending;
    test.timeout = this.timeout;
    test._overriddenFn = this._overriddenFn;
    return test;
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
  configuration: Configuration;
  _configurationString: string;

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

  _isPending(): boolean {
    return this.pending || (this.parent && this.parent._isPending());
  }

  _addTest(test: Test) {
    test.suite = this;
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

  _clone(): Suite {
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

  async run(options: {
    testFilter: (test: Test) => boolean;
    onResult: (test: Test, status: 'pass'|'skip'|'fail', error?: any) => void;
    onTestStart: (test: Test) => void;
    fixturePool: FixturePool<any>;
    timeout: number;
    trialRun: boolean;
  }) {
    const beforeResult = {success: true, error: undefined};
    try {
      if (!options.trialRun)
        await this._runHooks(options.fixturePool, options.timeout, 'beforeAll');
    } catch (e) {
      beforeResult.success = false;
      beforeResult.error = e
    }
    for (const entry of this._entries) {
      if (entry instanceof Suite) {
        await entry.run(options);
      } else {
        if (!options.testFilter(entry))
          continue;
        if (entry.pending || this._isPending())
          options.onResult(entry, 'skip');
        else {
          if (options.trialRun) {
            options.onResult(entry, 'pass')
          } else if (!beforeResult.success) {
            entry.error = serializeError(beforeResult.error);
            options.onResult(entry, 'fail', entry.error);
          } else {
            options.onTestStart(entry);
            const {status, error} = await this._runTest(options.fixturePool, options.timeout, entry);
            options.onResult(entry, status, error);
          }
        }
      }
    }
    try {
      if (!options.trialRun)
        await this._runHooks(options.fixturePool, options.timeout, 'afterAll');
    } catch (e) {
    }
  }

  private async _runTest(fixturePool: FixturePool<any>, timeout: number, test: Test): Promise<{status: 'pass'|'fail', error?: any}> {
    try {
      await this._runHooks(fixturePool, timeout, 'beforeEach');
      test._startTime = Date.now();
      await fixturePool.wrapTestCallback(test.fn, test.slow ? timeout * 3 : timeout, test)();
      await this._runHooks(fixturePool, timeout, 'afterEach');
    } catch (error) {
      test.error = serializeError(error);
      return { status: 'fail', error };
    }
    return { status: 'pass' };
  }

  private async _runHooks(fixturePool: FixturePool<any>, timeout: number, type: 'beforeEach'|'afterEach'|'beforeAll'|'afterAll') {
    if (!this._hasTestsToRun())
      return;
    const all = [];
    for (let s: Suite = this; s; s = s.parent) {
      const funcs = s._hooks.filter(e => e.type === type).map(e => e.fn);
      all.push(...funcs.reverse());
      if (type === 'beforeAll' || type === 'afterAll')
        break;
    }
    if (type === 'beforeAll' || type === 'beforeEach')
      all.reverse();
    for (const hook of all)
      await fixturePool.resolveParametersAndRun(hook, timeout);
  }

  filterOnly() {
    const onlySuites = this.suites.filter(child => child.filterOnly() || child.only);
    const onlyTests = this.tests.filter(test => test.only);
    if (onlySuites.length || onlyTests.length) {
      this.suites = onlySuites;
      this.tests = onlyTests;
      const all = new Set([...this.suites, ...this.tests]);
      this._entries = this._entries.filter(x => all.has(x));
      return true;
    }
    return false;
  }
}


function trimCycles(obj: any): any {
  if (obj === undefined)
    return undefined;
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

function serializeError(error: any): any {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack
    }
  }
  return trimCycles(error);
}
