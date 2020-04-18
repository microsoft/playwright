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

const { SourceMapSupport } = require('./SourceMapSupport');
const debug = require('debug');
const { TestExpectation } = require('./Test');

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

const TestResult = {
  Ok: 'ok',
  MarkedAsFailing: 'markedAsFailing', // User marked as failed
  Skipped: 'skipped', // User marked as skipped
  Failed: 'failed', // Exception happened during running
  TimedOut: 'timedout', // Timeout Exceeded while running
  Terminated: 'terminated', // Execution terminated
  Crashed: 'crashed', // If testrunner crashed due to this test
};

class TestRun {
  constructor(test) {
    this._test = test;
    this._result = null;
    this._error = null;
    this._startTimestamp = 0;
    this._endTimestamp = 0;
    this._workerId = null;
    this._output = [];
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

  log(log) {
    this._output.push(log);
  }

  output() {
    return this._output;
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
  constructor(testRunner, workerId, parallelIndex) {
    this._testRunner = testRunner;
    this._state = { parallelIndex };
    this._environmentStack = [];
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
    let skipped = test.skipped();
    for (let suite = test.suite(); suite; suite = suite.parentSuite())
      skipped = skipped || suite.skipped();
    if (skipped) {
      await this._willStartTestRun(testRun);
      testRun._result = TestResult.Skipped;
      await this._didFinishTestRun(testRun);
      return;
    }

    let expectedToFail = test.expectation() === TestExpectation.Fail;
    for (let suite = test.suite(); suite; suite = suite.parentSuite())
      expectedToFail = expectedToFail || (suite.expectation() === TestExpectation.Fail);
    if (expectedToFail) {
      await this._willStartTestRun(testRun);
      testRun._result = TestResult.MarkedAsFailing;
      await this._didFinishTestRun(testRun);
      return;
    }

    const environmentStack = [];
    function appendEnvironment(e) {
      while (e) {
        if (!e.isEmpty())
          environmentStack.push(e);
        e = e.parentEnvironment();
      }
    }
    for (const environment of test._environments.slice().reverse())
      appendEnvironment(environment);
    for (let suite = test.suite(); suite; suite = suite.parentSuite()) {
      for (const environment of suite._environments.slice().reverse())
        appendEnvironment(environment);
    }
    environmentStack.reverse();

    let common = 0;
    while (common < environmentStack.length && this._environmentStack[common] === environmentStack[common])
      common++;

    while (this._environmentStack.length > common) {
      if (this._markTerminated(testRun))
        return;
      const environment = this._environmentStack.pop();
      for (const hook of environment.hooks('afterAll')) {
        if (!await this._runHook(testRun, hook, environment.name()))
          return;
      }
    }
    while (this._environmentStack.length < environmentStack.length) {
      if (this._markTerminated(testRun))
        return;
      const environment = environmentStack[this._environmentStack.length];
      this._environmentStack.push(environment);
      for (const hook of environment.hooks('beforeAll')) {
        if (!await this._runHook(testRun, hook, environment.name()))
          return;
      }
    }

    if (this._markTerminated(testRun))
      return;

    // From this point till the end, we have to run all hooks
    // no matter what happens.

    await this._willStartTestRun(testRun);
    for (const environment of this._environmentStack) {
      for (const hook of environment.hooks('beforeEach'))
        await this._runHook(testRun, hook, environment.name(), true);
    }

    if (!testRun._error && !this._markTerminated(testRun)) {
      await this._willStartTestBody(testRun);
      const { promise, terminate } = runUserCallback(test.body(), test.timeout(), [this._state, testRun]);
      this._runningTestTerminate = terminate;
      testRun._error = await promise;
      this._runningTestTerminate = null;
      if (testRun._error && testRun._error.stack)
        await this._testRunner._sourceMapSupport.rewriteStackTraceWithSourceMaps(testRun._error);
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

    for (const environment of this._environmentStack.slice().reverse()) {
      for (const hook of environment.hooks('afterEach'))
        await this._runHook(testRun, hook, environment.name(), true);
    }
    await this._didFinishTestRun(testRun);
  }

  async _runHook(testRun, hook, fullName, passTestRun = false) {
    await this._willStartHook(testRun, hook, fullName);
    const timeout = this._testRunner._hookTimeout;
    const { promise, terminate } = runUserCallback(hook.body, timeout, passTestRun ? [this._state, testRun] : [this._state]);
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
          await this._testRunner._sourceMapSupport.rewriteStackTraceWithSourceMaps(error);
        message = `${hook.location.toDetailedString()} - FAILED while running "${hook.name}" in suite "${fullName}": `;
      }
      await this._didFailHook(testRun, hook, fullName, message, error);
      if (testRun)
        testRun._error = error;
      return false;
    }

    await this._didCompleteHook(testRun, hook, fullName);
    return true;
  }

  async _willStartTestRun(testRun) {
    testRun._startTimestamp = Date.now();
    testRun._workerId = this._workerId;
    await this._testRunner._runDelegateCallback(this._testRunner._delegate.onTestRunStarted, [testRun]);
  }

  async _didFinishTestRun(testRun) {
    testRun._endTimestamp = Date.now();
    testRun._workerId = this._workerId;
    await this._testRunner._runDelegateCallback(this._testRunner._delegate.onTestRunFinished, [testRun]);
  }

  async _willStartTestBody(testRun) {
    debug('testrunner:test')(`[${this._workerId}] starting "${testRun.test().fullName()}" (${testRun.test().location()})`);
  }

  async _didFinishTestBody(testRun) {
    debug('testrunner:test')(`[${this._workerId}] ${testRun._result.toUpperCase()} "${testRun.test().fullName()}" (${testRun.test().location()})`);
  }

  async _willStartHook(testRun, hook, fullName) {
    debug('testrunner:hook')(`[${this._workerId}] "${fullName}.${hook.name}" started for "${testRun ? testRun.test().fullName() : ''}" (${hook.location})`);
  }

  async _didFailHook(testRun, hook, fullName, message, error) {
    debug('testrunner:hook')(`[${this._workerId}] "${fullName}.${hook.name}" FAILED for "${testRun ? testRun.test().fullName() : ''}" (${hook.location})`);
    if (message)
      this._testRunner._result.addError(message, error, this);
    this._testRunner._result.setResult(TestResult.Crashed, message);
  }

  async _didCompleteHook(testRun, hook, fullName) {
    debug('testrunner:hook')(`[${this._workerId}] "${fullName}.${hook.name}" OK for "${testRun ? testRun.test().fullName() : ''}" (${hook.location})`);
  }

  async shutdown() {
    while (this._environmentStack.length > 0) {
      const environment = this._environmentStack.pop();
      for (const hook of environment.hooks('afterAll'))
        await this._runHook(null, hook, environment.name());
    }
  }
}

class TestRunner {
  constructor() {
    this._sourceMapSupport = new SourceMapSupport();
    this._nextWorkerId = 1;
    this._workers = [];
    this._terminating = false;
    this._result = null;
  }

  async _runDelegateCallback(callback, args) {
    let { promise, terminate } = runUserCallback(callback, this._hookTimeout, args);
    // Note: we do not terminate the delegate to keep reporting even when terminating.
    const e = await promise;
    if (e) {
      debug('testrunner')(`Error while running delegate method: ${e}`);
      const { message, error } = this._toError('INTERNAL ERROR', e);
      this._terminate(TestResult.Crashed, message, false, error);
    }
  }

  _toError(message, error) {
    if (!(error instanceof Error)) {
      message += ': ' + error;
      error = new Error();
      error.stack = '';
    }
    return { message, error };
  }

  async run(testRuns, options = {}) {
    const {
      parallel = 1,
      breakOnFailure = false,
      hookTimeout = 10 * 1000,
      totalTimeout = 0,
      onStarted = async (testRuns) => {},
      onFinished = async (result) => {},
      onTestRunStarted = async (testRun) => {},
      onTestRunFinished = async (testRun) => {},
    } = options;
    this._breakOnFailure = breakOnFailure;
    this._hookTimeout = hookTimeout === 0 ? 100000000 : hookTimeout;
    this._delegate = {
      onStarted,
      onFinished,
      onTestRunStarted,
      onTestRunFinished
    };

    this._result = new Result();
    this._result.runs = testRuns;

    const terminationPromises = [];
    const handleSIGINT = () => this._terminate(TestResult.Terminated, 'SIGINT received', false, null);
    const handleSIGHUP = () => this._terminate(TestResult.Terminated, 'SIGHUP received', false, null);
    const handleSIGTERM = () => this._terminate(TestResult.Terminated, 'SIGTERM received', true, null);
    const handleRejection = e => {
      const { message, error } = this._toError('UNHANDLED PROMISE REJECTION', e);
      terminationPromises.push(this._terminate(TestResult.Crashed, message, false, error));
    };
    const handleException = e => {
      const { message, error } = this._toError('UNHANDLED ERROR', e);
      terminationPromises.push(this._terminate(TestResult.Crashed, message, false, error));
    };
    process.on('SIGINT', handleSIGINT);
    process.on('SIGHUP', handleSIGHUP);
    process.on('SIGTERM', handleSIGTERM);
    process.on('unhandledRejection', handleRejection);
    process.on('uncaughtException', handleException);

    let timeoutId;
    if (totalTimeout) {
      timeoutId = setTimeout(() => {
        terminationPromises.push(this._terminate(TestResult.Terminated, `Total timeout of ${totalTimeout}ms reached.`, true /* force */, null /* error */));
      }, totalTimeout);
    }
    await this._runDelegateCallback(this._delegate.onStarted, [testRuns]);

    const workerCount = Math.min(parallel, testRuns.length);
    const workerPromises = [];
    for (let i = 0; i < workerCount; ++i) {
      const initialTestRunIndex = i * Math.floor(testRuns.length / workerCount);
      workerPromises.push(this._runWorker(initialTestRunIndex, testRuns, i));
    }
    await Promise.all(workerPromises);
    await Promise.all(terminationPromises);

    if (testRuns.some(run => run.isFailure()))
      this._result.setResult(TestResult.Failed, '');

    await this._runDelegateCallback(this._delegate.onFinished, [this._result]);
    clearTimeout(timeoutId);

    process.removeListener('SIGINT', handleSIGINT);
    process.removeListener('SIGHUP', handleSIGHUP);
    process.removeListener('SIGTERM', handleSIGTERM);
    process.removeListener('unhandledRejection', handleRejection);
    process.removeListener('uncaughtException', handleException);
    return this._result;
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
        await this._sourceMapSupport.rewriteStackTraceWithSourceMaps(error);
      this._result.addError(message, error, this._workers.length === 1 ? this._workers[0] : null);
    }
  }

  async terminate() {
    if (!this._result)
      return;
    await this._terminate(TestResult.Terminated, 'Terminated with |TestRunner.terminate()| call', true /* force */, null /* error */);
  }
}

module.exports = { TestRunner, TestRun, TestResult, Result };
