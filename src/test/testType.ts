/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { expect } from './expect';
import { currentlyLoadingFileSuite, currentTestInfo, setCurrentlyLoadingFileSuite } from './globals';
import { Spec, Suite } from './test';
import { callLocation, errorWithCallLocation } from './util';
import { Fixtures, FixturesWithLocation, Location, TestInfo, TestType } from './types';
import { inheritFixtureParameterNames } from './fixtures';

Error.stackTraceLimit = 15;

const countByFile = new Map<string, number>();

export class DeclaredFixtures {
  testType!: TestTypeImpl;
  location!: Location;
}

export class TestTypeImpl {
  readonly fixtures: (FixturesWithLocation | DeclaredFixtures)[];
  readonly test: TestType<any, any>;
  readonly tags: ReadonlyArray<string>;

  constructor(fixtures: (FixturesWithLocation | DeclaredFixtures)[], tags: ReadonlyArray<string>) {
    this.fixtures = fixtures;
    this.tags = tags;

    const test: any = this._spec.bind(this, 'default');
    test.expect = expect;
    test.only = this._spec.bind(this, 'only');
    test.describe = this._describe.bind(this, 'default');
    test.describe.only = this._describe.bind(this, 'only');
    test.beforeEach = this._hook.bind(this, 'beforeEach');
    test.afterEach = this._hook.bind(this, 'afterEach');
    test.beforeAll = this._hook.bind(this, 'beforeAll');
    test.afterAll = this._hook.bind(this, 'afterAll');
    test.skip = this._modifier.bind(this, 'skip');
    test.fixme = this._modifier.bind(this, 'fixme');
    test.fail = this._modifier.bind(this, 'fail');
    test.slow = this._modifier.bind(this, 'slow');
    test.setTimeout = this._setTimeout.bind(this);
    test.use = this._use.bind(this);
    test.extend = this._extend.bind(this);
    test.declare = this._declare.bind(this);
    this.test = test;
  }

  private _spec(type: 'default' | 'only', title: string, fn: Function) {
    const suite = currentlyLoadingFileSuite();
    if (!suite)
      throw errorWithCallLocation(`test() can only be called in a test file`);
    const location = callLocation(suite.file);

    const ordinalInFile = countByFile.get(suite.file) || 0;
    countByFile.set(location.file, ordinalInFile + 1);

    const spec = new Spec(title, fn, ordinalInFile, this);
    spec.file = location.file;
    spec.line = location.line;
    spec.column = location.column;
    suite._addSpec(spec);

    if (type === 'only')
      spec._only = true;
  }

  private _describe(type: 'default' | 'only', title: string, fn: Function) {
    const suite = currentlyLoadingFileSuite();
    if (!suite)
      throw errorWithCallLocation(`describe() can only be called in a test file`);
    const location = callLocation(suite.file);

    const child = new Suite(title);
    child.file = suite.file;
    child.line = location.line;
    child.column = location.column;
    suite._addSuite(child);

    if (type === 'only')
      child._only = true;

    setCurrentlyLoadingFileSuite(child);
    fn();
    setCurrentlyLoadingFileSuite(suite);
  }

  private _hook(name: 'beforeEach' | 'afterEach' | 'beforeAll' | 'afterAll', fn: Function) {
    const suite = currentlyLoadingFileSuite();
    if (!suite)
      throw errorWithCallLocation(`${name} hook can only be called in a test file`);
    suite._hooks.push({ type: name, fn, location: callLocation() });
  }

  private _modifier(type: 'skip' | 'fail' | 'fixme' | 'slow', ...modiferAgs: [arg?: any | Function, description?: string]) {
    const suite = currentlyLoadingFileSuite();
    if (suite) {
      const location = callLocation();
      if (typeof modiferAgs[0] === 'function') {
        const [conditionFn, description] = modiferAgs;
        const fn = (args: any, testInfo: TestInfo) => testInfo[type](conditionFn(args), description!);
        inheritFixtureParameterNames(conditionFn, fn, location);
        suite._hooks.unshift({ type: 'beforeEach', fn, location });
      } else {
        const fn = ({}: any, testInfo: TestInfo) => testInfo[type](...modiferAgs as [any, any]);
        suite._hooks.unshift({ type: 'beforeEach', fn, location });
      }
      return;
    }

    const testInfo = currentTestInfo();
    if (!testInfo)
      throw new Error(`test.${type}() can only be called inside test, describe block or fixture`);
    if (typeof modiferAgs[0] === 'function')
      throw new Error(`test.${type}() with a function can only be called inside describe block`);
    testInfo[type](...modiferAgs as [any, any]);
  }

  private _setTimeout(timeout: number) {
    const testInfo = currentTestInfo();
    if (!testInfo)
      throw new Error(`test.setTimeout() can only be called inside test or fixture`);
    testInfo.setTimeout(timeout);
  }

  private _use(fixtures: Fixtures) {
    const suite = currentlyLoadingFileSuite();
    if (!suite)
      throw errorWithCallLocation(`test.use() can only be called in a test file`);
    suite._fixtureOverrides = { ...suite._fixtureOverrides, ...fixtures };
  }

  private _extend(fixtures: Fixtures, options: {tag?: string|string[]} = {}) {
    const fixturesWithLocation = {
      fixtures,
      location: callLocation(),
    };
    const tags = options.tag ? (typeof options.tag === 'string' ? [options.tag] : options.tag) : [];
    return new TestTypeImpl([...this.fixtures, fixturesWithLocation], tags).test;
  }

  private _declare() {
    const declared = new DeclaredFixtures();
    declared.location = callLocation();
    const child = new TestTypeImpl([...this.fixtures, declared], this.tags);
    declared.testType = child;
    return child.test;
  }
}

export const rootTestType = new TestTypeImpl([], []);
