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

import Mocha from 'mocha';
import { fixturesUI } from './fixturesUI';
import { EventEmitter } from 'events';

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

  _ordinal: number;
  _configurationObject: Configuration;
  _configurationString: string;
  _overriddenFn: Function;
  _impl: any;

  constructor(title: string, fn: Function) {
    this.title = title;
    this.fn = fn;
  }

  _materialize(overriddenFn: Function) {
    this._impl = new Mocha.Test(this.title, overriddenFn);
    this._impl.pending = this.pending;
  }

  clone(): Test {
    const test = new Test(this.title, this.fn);
    test.suite = this.suite;
    test.only = this.only;
    test.file = this.file;
    test.pending = this.pending;
    test.timeout = this.timeout;
    test._overriddenFn = this._overriddenFn;
    test._materialize(this._overriddenFn);
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

  _impl: any;

  constructor(title: string, parent?: Suite) {
    this.title = title;
    this.parent = parent;
    this._impl = new Mocha.Suite(title, new Mocha.Context());
    this._impl.__nomocha = this;
  }

  titlePath(): string[] {
    if (!this.parent)
      return [this.title];
    return [...this.parent.titlePath(), this.title];
  }

  total(): number {
    let count = 0;
    this.eachTest(fn => ++count);
    return count;
  }

  isPending(): boolean {
    return this.pending || (this.parent && this.parent.isPending());
  }

  addTest(test: Test) {
    test.suite = this;
    this.tests.push(test);
    this._impl.addTest(test._impl);
  }

  addSuite(suite: Suite) {
    suite.parent = this;
    this.suites.push(suite);
    this._impl.addSuite(suite._impl);
  }

  eachTest(fn: (test: Test) => void) {
    for (const suite of this.suites)
      suite.eachTest(fn);
    for (const test of this.tests)
      fn(test);
  }

  clone(): Suite {
    const suite = new Suite(this.title);
    suite.only = this.only;
    suite.file = this.file;
    suite.pending = this.pending;
    suite._impl = this._impl.clone();
    return suite;
  }
}

class NullReporter {
  stats = {
    suites: 0,
    tests: 0,
    passes: 0,
    pending: 0,
    failures: 0
  };
  runner = null;
  failures = [];
  epilogue: () => {};
}

type NoMockaOptions = {
  forbidOnly?: boolean;
  timeout: number;
  testWrapper: (test: Test, fn: Function) => Function;
  hookWrapper: (hook: any, fn: Function) => Function;
};

class PatchedMocha extends Mocha {
  suite: any;
  static pendingSuite: Suite;

  constructor(suite, options) {
    PatchedMocha.pendingSuite = suite;
    super(options);
  }

  grep(...args) {
    this.suite = new Mocha.Suite('', new Mocha.Context());
    this.suite.__nomocha = PatchedMocha.pendingSuite;
    PatchedMocha.pendingSuite._impl = this.suite;
    return super.grep(...args);
  }
}

export class Runner extends EventEmitter {
  private _mochaRunner: any;

  constructor(mochaRunner: any) {
    super();
    const constants = Mocha.Runner.constants;
    this._mochaRunner = mochaRunner;
    this._mochaRunner.on(constants.EVENT_TEST_BEGIN, test => this.emit('test', test));
    this._mochaRunner.on(constants.EVENT_TEST_PENDING, test => this.emit('pending', test));
    this._mochaRunner.on(constants.EVENT_TEST_PASS, test => this.emit('pass', test));
    this._mochaRunner.on(constants.EVENT_TEST_FAIL, (test, err) => this.emit('fail', test, err));
    this._mochaRunner.on(constants.EVENT_RUN_END, () => this.emit('done'));
  }

  duration(): number {
    return this._mochaRunner.stats.duration || 0;
  }
}

export class NoMocha {
  suite: Suite;
  private _mocha: Mocha;

  constructor(file: string, options: NoMockaOptions) {
    this.suite = new Suite('');
    this._mocha = new PatchedMocha(this.suite, {
      forbidOnly: options.forbidOnly,
      reporter: NullReporter,
      timeout: options.timeout,
      ui: fixturesUI.bind(null, options)
    });
    this._mocha.addFile(file);
    (this._mocha as any).loadFiles();
  }

  run(cb: () => void): Runner {
    return new Runner(this._mocha.run(cb));
  }
}
