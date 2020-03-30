/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

const EventEmitter = require('events');
const {SourceMapSupport} = require('./SourceMapSupport');
const debug = require('debug');
const Location = require('./Location');

const INFINITE_TIMEOUT = 100000000;
const TimeoutError = new Error('Timeout');
const TerminatedError = new Error('Terminated');

function runUserCallback(callback, timeout, args) {
  let terminateCallback;
  let timeoutId;
  const promise = Promise.race([
    Promise.resolve().then(callback.bind(null, ...args)).then(() => null).catch(e => e),
    new Promise(resolve => {
      timeoutId = setTimeout(resolve.bind(null, TimeoutError), timeout);
    }),
    new Promise(resolve => terminateCallback = resolve),
  ]).catch(e => e).finally(() => clearTimeout(timeoutId));
  const terminate = () => terminateCallback(TerminatedError);
  return { promise, terminate };
}

const TestExpectation = {
  Ok: 'ok',
  Fail: 'fail',
};

const TestResult = {
  Ok: 'ok',
  MarkedAsFailing: 'markedAsFailing', // User marked as failed
  Skipped: 'skipped', // User marked as skipped
  Failed: 'failed', // Exception happened during running
  TimedOut: 'timedout', // Timeout Exceeded while running
  Terminated: 'terminated', // Execution terminated
  Crashed: 'crashed', // If testrunner crashed due to this test
};

function createHook(callback, name) {
  const location = Location.getCallerLocation(__filename);
  return { name, body: callback, location };
}

class Test {
  constructor(suite, name, callback, location) {
    this._suite = suite;
    this._name = name;
    this._fullName = (suite.fullName() + ' ' + name).trim();
    this._skipped = false;
    this._focused = false;
    this._expectation = TestExpectation.Ok;
    this._body = callback;
    this._location = location;
    this._timeout = INFINITE_TIMEOUT;
    this._repeat = 1;
    this._hooks = [];

    this.Expectations = { ...TestExpectation };
  }

  suite() {
    return this._suite;
  }

  name() {
    return this._name;
  }

  fullName() {
    return this._fullName;
  }

  location() {
    return this._location;
  }

  body() {
    return this._body;
  }

  skipped() {
    return this._skipped;
  }

  setSkipped(skipped) {
    this._skipped = skipped;
    return this;
  }

  focused() {
    return this._focused;
  }

  setFocused(focused) {
    this._focused = focused;
    return this;
  }

  timeout() {
    return this._timeout;
  }

  setTimeout(timeout) {
    this._timeout = timeout;
    return this;
  }

  expectation() {
    return this._expectation;
  }

  setExpectation(expectation) {
    this._expectation = expectation;
    return this;
  }

  repeat() {
    return this._repeat;
  }

  setRepeat(repeat) {
    this._repeat = repeat;
    return this;
  }

  before(callback) {
    this._hooks.push(createHook(callback, 'before'));
    return this;
  }

  after(callback) {
    this._hooks.push(createHook(callback, 'after'));
    return this;
  }

  hooks(name) {
    return this._hooks.filter(hook => !name || hook.name === name);
  }
}

class Suite {
  constructor(parentSuite, name, location) {
    this._parentSuite = parentSuite;
    this._name = name;
    this._fullName = (parentSuite ? parentSuite.fullName() + ' ' + name : name).trim();
    this._skipped = false;
    this._focused = false;
    this._expectation = TestExpectation.Ok;
    this._location = location;
    this._repeat = 1;
    this._hooks = [];

    this.Expectations = { ...TestExpectation };
  }

  parentSuite() {
    return this._parentSuite;
  }

  name() {
    return this._name;
  }

  fullName() {
    return this._fullName;
  }

  skipped() {
    return this._skipped;
  }

  setSkipped(skipped) {
    this._skipped = skipped;
    return this;
  }

  focused() {
    return this._focused;
  }

  setFocused(focused) {
    this._focused = focused;
    return this;
  }

  location() {
    return this._location;
  }

  expectation() {
    return this._expectation;
  }

  setExpectation(expectation) {
    this._expectation = expectation;
    return this;
  }

  repeat() {
    return this._repeat;
  }

  setRepeat(repeat) {
    this._repeat = repeat;
    return this;
  }

  beforeEach(callback) {
    this._hooks.push(createHook(callback, 'beforeEach'));
    return this;
  }

  afterEach(callback) {
    this._hooks.push(createHook(callback, 'afterEach'));
    return this;
  }

  beforeAll(callback) {
    this._hooks.push(createHook(callback, 'beforeAll'));
    return this;
  }

  afterAll(callback) {
    this._hooks.push(createHook(callback, 'afterAll'));
    return this;
  }

  hooks(name) {
    return this._hooks.filter(hook => !name || hook.name === name);
  }
}

class TestRun {
  constructor(test) {
    this._test = test;
    this._result = null;
    this._error = null;
    this._startTimestamp = 0;
    this._endTimestamp = 0;
    this._workerId = null;
  }

  finished() {
    return this._result !== null && this._result !== 'running';
  }

  isFailure() {
    return this._result === TestResult.Failed || this._result === TestResult.TimedOut || this._result === TestResult.Crashed;
  }

  ok() {
    return this._result === TestResult.Ok;
  }

  result() {
    return this._result;
  }

  error() {
    return this._error;
  }

  duration() {
    return this._endTimestamp - this._startTimestamp;
  }

  test() {
    return this._test;
  }

  workerId() {
    return this._workerId;
  }
}

class Result {
  constructor() {
    this.result = TestResult.Ok;
    this.exitCode = 0;
    this.message = '';
    this.errors = [];
    this.runs = [];
  }

  setResult(result, message) {
    if (!this.ok())
      return;
    this.result = result;
    this.message = message || '';
    if (result === TestResult.Ok)
      this.exitCode = 0;
    else if (result === TestResult.Terminated)
      this.exitCode = 130;
    else if (result === TestResult.Crashed)
      this.exitCode = 2;
    else
      this.exitCode = 1;
  }

  addError(message, error, worker) {
    const data = { message, error, runs: [] };
    if (worker)
      data.runs = worker._runs.slice();
    this.errors.push(data);
  }

  ok() {
    return this.result === TestResult.Ok;
  }
}

class TestWorker {
  constructor(testPass, workerId, parallelIndex) {
    this._testPass = testPass;
    this._state = { parallelIndex };
    this._suiteStack = [];
    this._terminating = false;
    this._workerId = workerId;
    this._runningTestTerminate = null;
    this._runningHookTerminate = null;
    this._runs = [];
  }

  terminate(terminateHooks) {
    this._terminating = true;
    if (this._runningTestTerminate)
      this._runningTestTerminate();
    if (terminateHooks && this._runningHookTerminate)
      this._runningHookTerminate();
  }

  _markTerminated(testRun) {
    if (!this._terminating)
      return false;
    testRun._result = TestResult.Terminated;
    return true;
  }

  async run(testRun) {
    this._runs.push(testRun);

    const test = testRun.test();
    let skipped = test.skipped() && !test.focused();
    for (let suite = test.suite(); suite; suite = suite.parentSuite())
      skipped = skipped || (suite.skipped() && !suite.focused());
    if (skipped) {
      await this._willStartTestRun(testRun);
      testRun._result = TestResult.Skipped;
      await this._didFinishTestRun(testRun);
      return;
    }

    let expectedToFail = test.expectation() === TestExpectation.Fail;
    for (let suite = test.suite(); suite; suite = suite.parentSuite())
      expectedToFail = expectedToFail || (suite.expectation() === TestExpectation.Fail);
    if (expectedToFail && !test.focused()) {
      await this._willStartTestRun(testRun);
      testRun._result = TestResult.MarkedAsFailing;
      await this._didFinishTestRun(testRun);
      return;
    }

    const suiteStack = [];
    for (let suite = test.suite(); suite; suite = suite.parentSuite())
      suiteStack.push(suite);
    suiteStack.reverse();

    let common = 0;
    while (common < suiteStack.length && this._suiteStack[common] === suiteStack[common])
      common++;

    while (this._suiteStack.length > common) {
      if (this._markTerminated(testRun))
        return;
      const suite = this._suiteStack.pop();
      for (const hook of suite.hooks('afterAll')) {
        if (!await this._runHook(testRun, hook, suite.fullName()))
          return;
      }
    }
    while (this._suiteStack.length < suiteStack.length) {
      if (this._markTerminated(testRun))
        return;
      const suite = suiteStack[this._suiteStack.length];
      this._suiteStack.push(suite);
      for (const hook of suite.hooks('beforeAll')) {
        if (!await this._runHook(testRun, hook, suite.fullName()))
          return;
      }
    }

    if (this._markTerminated(testRun))
      return;

    // From this point till the end, we have to run all hooks
    // no matter what happens.

    await this._willStartTestRun(testRun);
    for (const suite of this._suiteStack) {
      for (const hook of suite.hooks('beforeEach'))
        await this._runHook(testRun, hook, suite.fullName(), true);
    }
    for (const hook of test.hooks('before'))
      await this._runHook(testRun, hook, test.fullName(), true);

    if (!testRun._error && !this._markTerminated(testRun)) {
      await this._willStartTestBody(testRun);
      const { promise, terminate } = runUserCallback(test.body(), test.timeout(), [this._state, test]);
      this._runningTestTerminate = terminate;
      testRun._error = await promise;
      this._runningTestTerminate = null;
      if (testRun._error && testRun._error.stack)
        await this._testPass._runner._sourceMapSupport.rewriteStackTraceWithSourceMaps(testRun._error);
      if (!testRun._error)
        testRun._result = TestResult.Ok;
      else if (testRun._error === TimeoutError)
        testRun._result = TestResult.TimedOut;
      else if (testRun._error === TerminatedError)
        testRun._result = TestResult.Terminated;
      else
        testRun._result = TestResult.Failed;
      await this._didFinishTestBody(testRun);
    }

    for (const hook of test.hooks('after'))
      await this._runHook(testRun, hook, test.fullName(), true);
    for (const suite of this._suiteStack.slice().reverse()) {
      for (const hook of suite.hooks('afterEach'))
        await this._runHook(testRun, hook, suite.fullName(), true);
    }
    await this._didFinishTestRun(testRun);
  }

  async _runHook(testRun, hook, fullName, passTest = false) {
    await this._willStartHook(hook, fullName);
    const timeout = this._testPass._runner._timeout;
    const { promise, terminate } = runUserCallback(hook.body, timeout, passTest ? [this._state, testRun.test()] : [this._state]);
    this._runningHookTerminate = terminate;
    let error = await promise;
    this._runningHookTerminate = null;

    if (error) {
      if (testRun && testRun._result !== TestResult.Terminated) {
        // Prefer terminated result over any hook failures.
        testRun._result = error === TerminatedError ? TestResult.Terminated : TestResult.Crashed;
      }
      let message;
      if (error === TimeoutError) {
        message = `${hook.location.toDetailedString()} - Timeout Exceeded ${timeout}ms while running "${hook.name}" in "${fullName}"`;
        error = null;
      } else if (error === TerminatedError) {
        // Do not report termination details - it's just noise.
        message = '';
        error = null;
      } else {
        if (error.stack)
          await this._testPass._runner._sourceMapSupport.rewriteStackTraceWithSourceMaps(error);
        message = `${hook.location.toDetailedString()} - FAILED while running "${hook.name}" in suite "${fullName}": `;
      }
      await this._didFailHook(hook, fullName, message, error);
      if (testRun)
        testRun._error = error;
      return false;
    }

    await this._didCompleteHook(hook, fullName);
    return true;
  }

  async _willStartTestRun(testRun) {
    testRun._startTimestamp = Date.now();
    testRun._workerId = this._workerId;
    this._testPass._runner.emit(TestRunner.Events.TestStarted, testRun);
  }

  async _didFinishTestRun(testRun) {
    testRun._endTimestamp = Date.now();
    testRun._workerId = this._workerId;
    this._testPass._runner.emit(TestRunner.Events.TestFinished, testRun);
  }

  async _willStartTestBody(testRun) {
    debug('testrunner:test')(`[${this._workerId}] starting "${testRun.test().fullName()}" (${testRun.test().location()})`);
  }

  async _didFinishTestBody(testRun) {
    debug('testrunner:test')(`[${this._workerId}] ${testRun._result.toUpperCase()} "${testRun.test().fullName()}" (${testRun.test().location()})`);
  }

  async _willStartHook(hook, fullName) {
    debug('testrunner:hook')(`[${this._workerId}] "${hook.name}" started for "${fullName}" (${hook.location})`);
  }

  async _didFailHook(hook, fullName, message, error) {
    debug('testrunner:hook')(`[${this._workerId}] "${hook.name}" FAILED for "${fullName}" (${hook.location})`);
    if (message)
      this._testPass._result.addError(message, error, this);
    this._testPass._result.setResult(TestResult.Crashed, message);
  }

  async _didCompleteHook(hook, fullName) {
    debug('testrunner:hook')(`[${this._workerId}] "${hook.name}" OK for "${fullName}" (${hook.location})`);
  }

  async shutdown() {
    while (this._suiteStack.length > 0) {
      const suite = this._suiteStack.pop();
      for (const hook of suite.hooks('afterAll'))
        await this._runHook(null, hook, suite.fullName());
    }
  }
}

class TestPass {
  constructor(runner, parallel, breakOnFailure) {
    this._runner = runner;
    this._workers = [];
    this._nextWorkerId = 1;
    this._parallel = parallel;
    this._breakOnFailure = breakOnFailure;
    this._errors = [];
    this._result = new Result();
    this._terminating = false;
  }

  async run(testRuns) {
    const terminations = [
      createTermination.call(this, 'SIGINT', TestResult.Terminated, 'SIGINT received'),
      createTermination.call(this, 'SIGHUP', TestResult.Terminated, 'SIGHUP received'),
      createTermination.call(this, 'SIGTERM', TestResult.Terminated, 'SIGTERM received'),
      createTermination.call(this, 'unhandledRejection', TestResult.Crashed, 'UNHANDLED PROMISE REJECTION'),
      createTermination.call(this, 'uncaughtException', TestResult.Crashed, 'UNHANDLED ERROR'),
    ];
    for (const termination of terminations)
      process.on(termination.event, termination.handler);

    this._result = new Result();
    this._result.runs = testRuns;

    const parallel = Math.min(this._parallel, testRuns.length);
    const workerPromises = [];
    for (let i = 0; i < parallel; ++i) {
      const initialTestRunIndex = i * Math.floor(testRuns.length / parallel);
      workerPromises.push(this._runWorker(initialTestRunIndex, testRuns, i));
    }
    await Promise.all(workerPromises);

    for (const termination of terminations)
      process.removeListener(termination.event, termination.handler);

    if (testRuns.some(run => run.isFailure()))
      this._result.setResult(TestResult.Failed, '');
    return this._result;

    function createTermination(event, result, message) {
      return {
        event,
        message,
        handler: error => this._terminate(result, message, event === 'SIGTERM', event.startsWith('SIG') ? null : error)
      };
    }
  }

  async _runWorker(testRunIndex, testRuns, parallelIndex) {
    let worker = new TestWorker(this, this._nextWorkerId++, parallelIndex);
    this._workers[parallelIndex] = worker;
    while (!this._terminating) {
      let skipped = 0;
      while (skipped < testRuns.length && testRuns[testRunIndex]._result !== null) {
        testRunIndex = (testRunIndex + 1) % testRuns.length;
        skipped++;
      }
      const testRun = testRuns[testRunIndex];
      if (testRun._result !== null) {
        // All tests have been run.
        break;
      }

      // Mark as running so that other workers do not run it again.
      testRun._result = 'running';
      await worker.run(testRun);
      if (testRun.isFailure()) {
        // Something went wrong during test run, let's use a fresh worker.
        await worker.shutdown();
        if (this._breakOnFailure) {
          const message = `Terminating because a test has failed and |testRunner.breakOnFailure| is enabled`;
          await this._terminate(TestResult.Terminated, message, false /* force */, null /* error */);
          return;
        }
        worker = new TestWorker(this, this._nextWorkerId++, parallelIndex);
        this._workers[parallelIndex] = worker;
      }
    }
    await worker.shutdown();
  }

  async _terminate(result, message, force, error) {
    debug('testrunner')(`TERMINATED result = ${result}, message = ${message}`);
    this._terminating = true;
    for (const worker of this._workers)
      worker.terminate(force /* terminateHooks */);
    this._result.setResult(result, message);
    if (this._result.message === 'SIGINT received' && message === 'SIGTERM received')
      this._result.message = message;
    if (error) {
      if (error.stack)
        await this._runner._sourceMapSupport.rewriteStackTraceWithSourceMaps(error);
      this._result.addError(message, error, this._workers.length === 1 ? this._workers[0] : null);
    }
  }
}

class TestRunner extends EventEmitter {
  constructor(options = {}) {
    super();
    const {
      timeout = 10 * 1000, // Default timeout is 10 seconds.
      parallel = 1,
      breakOnFailure = false,
      crashIfTestsAreFocusedOnCI = true,
      installCommonHelpers = true,
    } = options;
    this._crashIfTestsAreFocusedOnCI = crashIfTestsAreFocusedOnCI;
    this._sourceMapSupport = new SourceMapSupport();
    this._rootSuite = new Suite(null, '', new Location());
    this._currentSuite = this._rootSuite;
    this._tests = [];
    this._suites = [];
    this._timeout = timeout === 0 ? INFINITE_TIMEOUT : timeout;
    this._parallel = parallel;
    this._breakOnFailure = breakOnFailure;
    this._suiteModifiers = new Map();
    this._suiteAttributes = new Map();
    this._testModifiers = new Map();
    this._testAttributes = new Map();

    this.beforeAll = (callback) => this._currentSuite.beforeAll(callback);
    this.beforeEach = (callback) => this._currentSuite.beforeEach(callback);
    this.afterAll = (callback) => this._currentSuite.afterAll(callback);
    this.afterEach = (callback) => this._currentSuite.afterEach(callback);

    this.describe = this._suiteBuilder([]);
    this.it = this._testBuilder([]);
    this.Expectations = { ...TestExpectation };

    if (installCommonHelpers) {
      this.fdescribe = this._suiteBuilder([{ callback: s => s.setFocused(true), args: [] }]);
      this.xdescribe = this._suiteBuilder([{ callback: s => s.setSkipped(true), args: [] }]);
      this.fit = this._testBuilder([{ callback: t => t.setFocused(true), args: [] }]);
      this.xit = this._testBuilder([{ callback: t => t.setSkipped(true), args: [] }]);
    }
  }

  _suiteBuilder(callbacks) {
    return new Proxy((name, callback, ...suiteArgs) => {
      const location = Location.getCallerLocation(__filename);
      const suite = new Suite(this._currentSuite, name, location);
      for (const { callback, args } of callbacks)
        callback(suite, ...args);
      this._currentSuite = suite;
      callback(...suiteArgs);
      this._suites.push(suite);
      this._currentSuite = suite.parentSuite();
      return suite;
    }, {
      get: (obj, prop) => {
        if (this._suiteModifiers.has(prop))
          return (...args) => this._suiteBuilder([...callbacks, { callback: this._suiteModifiers.get(prop), args }]);
        if (this._suiteAttributes.has(prop))
          return this._suiteBuilder([...callbacks, { callback: this._suiteAttributes.get(prop), args: [] }]);
        return obj[prop];
      },
    });
  }

  _testBuilder(callbacks) {
    return new Proxy((name, callback) => {
      const location = Location.getCallerLocation(__filename);
      const test = new Test(this._currentSuite, name, callback, location);
      test.setTimeout(this._timeout);
      for (const { callback, args } of callbacks)
        callback(test, ...args);
      this._tests.push(test);
      return test;
    }, {
      get: (obj, prop) => {
        if (this._testModifiers.has(prop))
          return (...args) => this._testBuilder([...callbacks, { callback: this._testModifiers.get(prop), args }]);
        if (this._testAttributes.has(prop))
          return this._testBuilder([...callbacks, { callback: this._testAttributes.get(prop), args: [] }]);
        return obj[prop];
      },
    });
  }

  testModifier(name, callback) {
    this._testModifiers.set(name, callback);
  }

  testAttribute(name, callback) {
    this._testAttributes.set(name, callback);
  }

  suiteModifier(name, callback) {
    this._suiteModifiers.set(name, callback);
  }

  suiteAttribute(name, callback) {
    this._suiteAttributes.set(name, callback);
  }

  async run(options = {}) {
    const { totalTimeout = 0 } = options;
    const testRuns = [];
    for (const test of this._testsToRun()) {
      let repeat = test.repeat();
      for (let suite = test.suite(); suite; suite = suite.parentSuite())
        repeat *= suite.repeat();
      for (let i = 0; i < repeat; i++)
        testRuns.push(new TestRun(test));
    }
    this.emit(TestRunner.Events.Started, testRuns);

    let result;
    if (this._crashIfTestsAreFocusedOnCI && process.env.CI && this.hasFocusedTestsOrSuites()) {
      result = new Result();
      result.setResult(TestResult.Crashed, '"focused" tests or suites are probitted on CI');
    } else {
      this._runningPass = new TestPass(this, this._parallel, this._breakOnFailure);
      let timeoutId;
      if (totalTimeout) {
        timeoutId = setTimeout(() => {
          this._runningPass._terminate(TestResult.Terminated, `Total timeout of ${totalTimeout}ms reached.`, true /* force */, null /* error */);
        }, totalTimeout);
      }
      try {
        result = await this._runningPass.run(testRuns).catch(e => { console.error(e); throw e; });
      } finally {
        this._runningPass = null;
        clearTimeout(timeoutId);
      }
    }
    this.emit(TestRunner.Events.Finished, result);
    return result;
  }

  _testsToRun() {
    if (!this.hasFocusedTestsOrSuites())
      return this._tests;
    const notFocusedSuites = new Set();
    // Mark parent suites of focused tests as not focused.
    for (const test of this._tests) {
      if (test.focused()) {
        for (let suite = test.suite(); suite; suite = suite.parentSuite())
          notFocusedSuites.add(suite);
      }
    }
    // Pick all tests that are focused or belong to focused suites.
    const tests = [];
    for (const test of this._tests) {
      let focused = test.focused();
      for (let suite = test.suite(); suite; suite = suite.parentSuite())
        focused = focused || (suite.focused() && !notFocusedSuites.has(suite));
      if (focused)
        tests.push(test);
    }
    return tests;
  }

  async terminate() {
    if (!this._runningPass)
      return;
    await this._runningPass._terminate(TestResult.Terminated, 'Terminated with |TestRunner.terminate()| call', true /* force */, null /* error */);
  }

  timeout() {
    return this._timeout;
  }

  hasFocusedTestsOrSuites() {
    return this._tests.some(test => test.focused()) || this._suites.some(suite => suite.focused());
  }

  focusMatchingTests(fullNameRegex) {
    for (const test of this._tests) {
      if (fullNameRegex.test(test.fullName()))
        test.setFocused(true);
    }
  }

  tests() {
    return this._tests.slice();
  }

  suites() {
    return this._suites.slice();
  }

  parallel() {
    return this._parallel;
  }
}

TestRunner.Events = {
  Started: 'started',
  Finished: 'finished',
  TestStarted: 'teststarted',
  TestFinished: 'testfinished',
};

module.exports = TestRunner;
