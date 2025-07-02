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

import { errors } from 'playwright-core';
import { getPackageManagerExecCommand, monotonicTime, raceAgainstDeadline, currentZone } from 'playwright-core/lib/utils';

import { currentTestInfo, currentlyLoadingFileSuite, setCurrentlyLoadingFileSuite } from './globals';
import { Suite, TestCase } from './test';
import { expect } from '../matchers/expect';
import { wrapFunctionWithLocation } from '../transform/transform';

import type { FixturesWithLocation } from './config';
import type { Fixtures, TestDetails, TestStepInfo, TestType } from '../../types/test';
import type { Location } from '../../types/testReporter';

const testTypeSymbol = Symbol('testType');

export class TestTypeImpl {
  readonly fixtures: FixturesWithLocation[];
  readonly test: TestType<any, any>;

  constructor(fixtures: FixturesWithLocation[]) {
    this.fixtures = fixtures;

    const test: any = wrapFunctionWithLocation(this._createTest.bind(this, 'default'));
    test[testTypeSymbol] = this;
    test.expect = expect;
    test.only = wrapFunctionWithLocation(this._createTest.bind(this, 'only'));
    test.describe = wrapFunctionWithLocation(this._describe.bind(this, 'default'));
    test.describe.only = wrapFunctionWithLocation(this._describe.bind(this, 'only'));
    test.describe.configure = wrapFunctionWithLocation(this._configure.bind(this));
    test.describe.fixme = wrapFunctionWithLocation(this._describe.bind(this, 'fixme'));
    test.describe.parallel = wrapFunctionWithLocation(this._describe.bind(this, 'parallel'));
    test.describe.parallel.only = wrapFunctionWithLocation(this._describe.bind(this, 'parallel.only'));
    test.describe.serial = wrapFunctionWithLocation(this._describe.bind(this, 'serial'));
    test.describe.serial.only = wrapFunctionWithLocation(this._describe.bind(this, 'serial.only'));
    test.describe.skip = wrapFunctionWithLocation(this._describe.bind(this, 'skip'));
    test.beforeEach = wrapFunctionWithLocation(this._hook.bind(this, 'beforeEach'));
    test.afterEach = wrapFunctionWithLocation(this._hook.bind(this, 'afterEach'));
    test.beforeAll = wrapFunctionWithLocation(this._hook.bind(this, 'beforeAll'));
    test.afterAll = wrapFunctionWithLocation(this._hook.bind(this, 'afterAll'));
    test.skip = wrapFunctionWithLocation(this._modifier.bind(this, 'skip'));
    test.fixme = wrapFunctionWithLocation(this._modifier.bind(this, 'fixme'));
    test.fail = wrapFunctionWithLocation(this._modifier.bind(this, 'fail'));
    test.fail.only = wrapFunctionWithLocation(this._createTest.bind(this, 'fail.only'));
    test.slow = wrapFunctionWithLocation(this._modifier.bind(this, 'slow'));
    test.setTimeout = wrapFunctionWithLocation(this._setTimeout.bind(this));
    test.step = this._step.bind(this, 'pass');
    test.step.skip = this._step.bind(this, 'skip');
    test.use = wrapFunctionWithLocation(this._use.bind(this));
    test.extend = wrapFunctionWithLocation(this._extend.bind(this));
    test.info = () => {
      const result = currentTestInfo();
      if (!result)
        throw new Error('test.info() can only be called while test is running');
      return result;
    };
    this.test = test;
  }

  private _currentSuite(location: Location, title: string): Suite | undefined {
    const suite = currentlyLoadingFileSuite();
    if (!suite) {
      throw new Error([
        `Playwright Test did not expect ${title} to be called here.`,
        `Most common reasons include:`,
        `- You are calling ${title} in a configuration file.`,
        `- You are calling ${title} in a file that is imported by the configuration file.`,
        `- You have two different versions of @playwright/test. This usually happens`,
        `  when one of the dependencies in your package.json depends on @playwright/test.`,
      ].join('\n'));
    }
    return suite;
  }

  private _createTest(type: 'default' | 'only' | 'skip' | 'fixme' | 'fail' | 'fail.only', location: Location, title: string, fnOrDetails: Function | TestDetails, fn?: Function) {
    throwIfRunningInsideJest();
    const suite = this._currentSuite(location, 'test()');
    if (!suite)
      return;

    let details: TestDetails;
    let body: Function;
    if (typeof fnOrDetails === 'function') {
      body = fnOrDetails;
      details = {};
    } else {
      body = fn!;
      details = fnOrDetails;
    }

    const validatedDetails = validateTestDetails(details, location);
    const test = new TestCase(title, body, this, location);
    test._requireFile = suite._requireFile;
    test.annotations.push(...validatedDetails.annotations);
    test._tags.push(...validatedDetails.tags);
    suite._addTest(test);

    if (type === 'only' || type === 'fail.only')
      test._only = true;
    if (type === 'skip' || type === 'fixme' || type === 'fail')
      test.annotations.push({ type, location });
    else if (type === 'fail.only')
      test.annotations.push({ type: 'fail', location });
  }

  private _describe(type: 'default' | 'only' | 'serial' | 'serial.only' | 'parallel' | 'parallel.only' | 'skip' | 'fixme', location: Location, titleOrFn: string | Function, fnOrDetails?: TestDetails | Function, fn?: Function) {
    throwIfRunningInsideJest();
    const suite = this._currentSuite(location, 'test.describe()');
    if (!suite)
      return;

    let title: string;
    let body: Function;
    let details: TestDetails;

    if (typeof titleOrFn === 'function') {
      title = '';
      details = {};
      body = titleOrFn;
    } else if (typeof fnOrDetails === 'function') {
      title = titleOrFn;
      details = {};
      body = fnOrDetails;
    } else {
      title = titleOrFn;
      details = fnOrDetails!;
      body = fn!;
    }

    const validatedDetails = validateTestDetails(details, location);
    const child = new Suite(title, 'describe');
    child._requireFile = suite._requireFile;
    child.location = location;
    child._staticAnnotations.push(...validatedDetails.annotations);
    child._tags.push(...validatedDetails.tags);
    suite._addSuite(child);

    if (type === 'only' || type === 'serial.only' || type === 'parallel.only')
      child._only = true;
    if (type === 'serial' || type === 'serial.only')
      child._parallelMode = 'serial';
    if (type === 'parallel' || type === 'parallel.only')
      child._parallelMode = 'parallel';
    if (type === 'skip' || type === 'fixme')
      child._staticAnnotations.push({ type, location });

    for (let parent: Suite | undefined = suite; parent; parent = parent.parent) {
      if (parent._parallelMode === 'serial' && child._parallelMode === 'parallel')
        throw new Error('describe.parallel cannot be nested inside describe.serial');
      if (parent._parallelMode === 'default' && child._parallelMode === 'parallel')
        throw new Error('describe.parallel cannot be nested inside describe with default mode');
    }

    setCurrentlyLoadingFileSuite(child);
    body();
    setCurrentlyLoadingFileSuite(suite);
  }

  private _hook(name: 'beforeEach' | 'afterEach' | 'beforeAll' | 'afterAll', location: Location, title: string | Function, fn?: Function) {
    const suite = this._currentSuite(location, `test.${name}()`);
    if (!suite)
      return;
    if (typeof title === 'function') {
      fn = title;
      title = `${name} hook`;
    }

    suite._hooks.push({ type: name, fn: fn!, title, location });
  }

  private _configure(location: Location, options: { mode?: 'default' | 'parallel' | 'serial', retries?: number, timeout?: number }) {
    throwIfRunningInsideJest();
    const suite = this._currentSuite(location, `test.describe.configure()`);
    if (!suite)
      return;

    if (options.timeout !== undefined)
      suite._timeout = options.timeout;

    if (options.retries !== undefined)
      suite._retries = options.retries;

    if (options.mode !== undefined) {
      if (suite._parallelMode !== 'none')
        throw new Error(`"${suite._parallelMode}" mode is already assigned for the enclosing scope.`);
      suite._parallelMode = options.mode;
      for (let parent: Suite | undefined = suite.parent; parent; parent = parent.parent) {
        if (parent._parallelMode === 'serial' && suite._parallelMode === 'parallel')
          throw new Error('describe with parallel mode cannot be nested inside describe with serial mode');
        if (parent._parallelMode === 'default' && suite._parallelMode === 'parallel')
          throw new Error('describe with parallel mode cannot be nested inside describe with default mode');
      }
    }
  }

  private _modifier(type: 'skip' | 'fail' | 'fixme' | 'slow', location: Location, ...modifierArgs: any[]) {
    const suite = currentlyLoadingFileSuite();
    if (suite) {
      if (typeof modifierArgs[0] === 'string' && typeof modifierArgs[1] === 'function' && (type === 'skip' || type === 'fixme' || type === 'fail')) {
        // Support for test.{skip,fixme,fail}(title, body)
        this._createTest(type, location, modifierArgs[0], modifierArgs[1]);
        return;
      }
      if (typeof modifierArgs[0] === 'string' && typeof modifierArgs[1] === 'object' && typeof modifierArgs[2] === 'function' && (type === 'skip' || type === 'fixme' || type === 'fail')) {
        // Support for test.{skip,fixme,fail}(title, details, body)
        this._createTest(type, location, modifierArgs[0], modifierArgs[1], modifierArgs[2]);
        return;
      }

      if (typeof modifierArgs[0] === 'function') {
        suite._modifiers.push({ type, fn: modifierArgs[0], location, description: modifierArgs[1] });
      } else {
        if (modifierArgs.length >= 1 && !modifierArgs[0])
          return;
        const description = modifierArgs[1];
        suite._staticAnnotations.push({ type, description, location });
      }
      return;
    }

    const testInfo = currentTestInfo();
    if (!testInfo)
      throw new Error(`test.${type}() can only be called inside test, describe block or fixture`);
    if (typeof modifierArgs[0] === 'function')
      throw new Error(`test.${type}() with a function can only be called inside describe block`);
    testInfo._modifier(type, location, modifierArgs as [any, any]);
  }

  private _setTimeout(location: Location, timeout: number) {
    const suite = currentlyLoadingFileSuite();
    if (suite) {
      suite._timeout = timeout;
      return;
    }

    const testInfo = currentTestInfo();
    if (!testInfo)
      throw new Error(`test.setTimeout() can only be called from a test`);
    testInfo.setTimeout(timeout);
  }

  private _use(location: Location, fixtures: Fixtures) {
    const suite = this._currentSuite(location, `test.use()`);
    if (!suite)
      return;
    suite._use.push({ fixtures, location });
  }

  async _step<T>(expectation: 'pass'|'skip', title: string, body: (step: TestStepInfo) => T | Promise<T>, options: {box?: boolean, location?: Location, timeout?: number } = {}): Promise<T> {
    const testInfo = currentTestInfo();
    if (!testInfo)
      throw new Error(`test.step() can only be called from a test`);
    const step = testInfo._addStep({ category: 'test.step', title, location: options.location, box: options.box });
    return await currentZone().with('stepZone', step).run(async () => {
      try {
        let result: Awaited<ReturnType<typeof raceAgainstDeadline<T>>> | undefined = undefined;
        result = await raceAgainstDeadline(async () => {
          try {
            return await step.info._runStepBody(expectation === 'skip', body, step.location);
          } catch (e) {
            // If the step timed out, the test fixtures will tear down, which in turn
            // will abort unfinished actions in the step body. Record such errors here.
            if (result?.timedOut)
              testInfo._failWithError(e);
            throw e;
          }
        }, options.timeout ? monotonicTime() + options.timeout : 0);
        if (result.timedOut)
          throw new errors.TimeoutError(`Step timeout of ${options.timeout}ms exceeded.`);
        step.complete({});
        return result.result;
      } catch (error) {
        step.complete({ error });
        throw error;
      }
    });
  }

  private _extend(location: Location, fixtures: Fixtures) {
    if ((fixtures as any)[testTypeSymbol])
      throw new Error(`test.extend() accepts fixtures object, not a test object.\nDid you mean to call mergeTests()?`);
    const fixturesWithLocation: FixturesWithLocation = { fixtures, location };
    return new TestTypeImpl([...this.fixtures, fixturesWithLocation]).test;
  }
}

function throwIfRunningInsideJest() {
  if (process.env.JEST_WORKER_ID) {
    const packageManagerCommand = getPackageManagerExecCommand();
    throw new Error(
        `Playwright Test needs to be invoked via '${packageManagerCommand} playwright test' and excluded from Jest test runs.\n` +
        `Creating one directory for Playwright tests and one for Jest is the recommended way of doing it.\n` +
        `See https://playwright.dev/docs/intro for more information about Playwright Test.`,
    );
  }
}

function validateTestDetails(details: TestDetails, location: Location) {
  const originalAnnotations = Array.isArray(details.annotation) ? details.annotation : (details.annotation ? [details.annotation] : []);
  const annotations = originalAnnotations.map(annotation => ({ ...annotation, location }));
  const tags = Array.isArray(details.tag) ? details.tag : (details.tag ? [details.tag] : []);
  for (const tag of tags) {
    if (tag[0] !== '@')
      throw new Error(`Tag must start with "@" symbol, got "${tag}" instead.`);
  }
  return { annotations, tags };
}

export const rootTestType = new TestTypeImpl([]);

export function mergeTests(...tests: TestType<any, any>[]) {
  let result = rootTestType;
  for (const t of tests) {
    const testTypeImpl = (t as any)[testTypeSymbol] as TestTypeImpl;
    if (!testTypeImpl)
      throw new Error(`mergeTests() accepts "test" functions as parameters.\nDid you mean to call test.extend() with fixtures instead?`);
    // Filter out common ancestor fixtures.
    const newFixtures = testTypeImpl.fixtures.filter(theirs => !result.fixtures.find(ours => ours.fixtures === theirs.fixtures));
    result = new TestTypeImpl([...result.fixtures, ...newFixtures]);
  }
  return result.test;
}
