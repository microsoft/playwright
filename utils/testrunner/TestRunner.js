/**
 * Copyright 2017 Google Inc. All rights reserved.
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

const util = require('util');
const url = require('url');
const inspector = require('inspector');
const path = require('path');
const EventEmitter = require('events');
const Multimap = require('./Multimap');
const fs = require('fs');
const {SourceMapSupport} = require('./SourceMapSupport');
const debug = require('debug');
const {getCallerLocation} = require('./utils');

const INFINITE_TIMEOUT = 2147483647;

const readFileAsync = util.promisify(fs.readFile.bind(fs));

const TimeoutError = new Error('Timeout');
const TerminatedError = new Error('Terminated');

const MAJOR_NODEJS_VERSION = parseInt(process.version.substring(1).split('.')[0], 10);

class UserCallback {
  constructor(callback, timeout) {
    this._callback = callback;
    this._terminatePromise = new Promise(resolve => {
      this._terminateCallback = resolve;
    });

    this.timeout = timeout;
    this.location = getCallerLocation(__filename);
  }

  async run(...args) {
    let timeoutId;
    const timeoutPromise = new Promise(resolve => {
      timeoutId = setTimeout(resolve.bind(null, TimeoutError), this.timeout);
    });
    try {
      return await Promise.race([
        Promise.resolve().then(this._callback.bind(null, ...args)).then(() => null).catch(e => e),
        timeoutPromise,
        this._terminatePromise
      ]);
    } catch (e) {
      return e;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  terminate() {
    this._terminateCallback(TerminatedError);
  }
}

const TestMode = {
  Run: 'run',
  Skip: 'skip',
  Focus: 'focus',
};

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

function isTestFailure(testResult) {
  return testResult === TestResult.Failed || testResult === TestResult.TimedOut || testResult === TestResult.Crashed;
}

class Test {
  constructor(suite, name, callback, declaredMode, expectation, timeout) {
    this.suite = suite;
    this.name = name;
    this.fullName = (suite.fullName + ' ' + name).trim();
    this.declaredMode = declaredMode;
    this.expectation = expectation;
    this._userCallback = new UserCallback(callback, timeout);
    this.location = this._userCallback.location;
    this.timeout = timeout;

    // Test results
    this.result = null;
    this.error = null;
    this.startTimestamp = 0;
    this.endTimestamp = 0;
  }
}

class Suite {
  constructor(parentSuite, name, declaredMode, expectation) {
    this.parentSuite = parentSuite;
    this.name = name;
    this.fullName = (parentSuite ? parentSuite.fullName + ' ' + name : name).trim();
    this.declaredMode = declaredMode;
    this.expectation = expectation;
    /** @type {!Array<(!Test|!Suite)>} */
    this.children = [];
    this.location = getCallerLocation(__filename);

    this.beforeAll = null;
    this.beforeEach = null;
    this.afterAll = null;
    this.afterEach = null;
  }
}

class Result {
  constructor() {
    this.result = TestResult.Ok;
    this.exitCode = 0;
    this.message = '';
    this.errors = [];
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
    const data = { message, error, tests: [] };
    if (worker) {
      data.workerId = worker._workerId;
      data.tests = worker._runTests.slice();
    }
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
    this._runningTestCallback = null;
    this._runningHookCallback = null;
    this._runTests = [];
  }

  terminate(terminateHooks) {
    this._terminating = true;
    if (this._runningTestCallback)
      this._runningTestCallback.terminate();
    if (terminateHooks && this._runningHookCallback)
      this._runningHookCallback.terminate();
  }

  _markTerminated(test) {
    if (!this._terminating)
      return false;
    test.result = TestResult.Terminated;
    return true;
  }

  async runTest(test) {
    this._runTests.push(test);

    if (this._markTerminated(test))
      return;

    if (test.declaredMode === TestMode.Skip) {
      await this._testPass._willStartTest(this, test);
      test.result = TestResult.Skipped;
      await this._testPass._didFinishTest(this, test);
      return;
    }

    if (test.expectation === TestExpectation.Fail && test.declaredMode !== TestMode.Focus) {
      await this._testPass._willStartTest(this, test);
      test.result = TestResult.MarkedAsFailing;
      await this._testPass._didFinishTest(this, test);
      return;
    }

    const suiteStack = [];
    for (let suite = test.suite; suite; suite = suite.parentSuite)
      suiteStack.push(suite);
    suiteStack.reverse();

    let common = 0;
    while (common < suiteStack.length && this._suiteStack[common] === suiteStack[common])
      common++;

    while (this._suiteStack.length > common) {
      if (this._markTerminated(test))
        return;
      const suite = this._suiteStack.pop();
      if (!await this._runHook(test, suite, 'afterAll'))
        return;
    }
    while (this._suiteStack.length < suiteStack.length) {
      if (this._markTerminated(test))
        return;
      const suite = suiteStack[this._suiteStack.length];
      this._suiteStack.push(suite);
      if (!await this._runHook(test, suite, 'beforeAll'))
        return;
    }

    if (this._markTerminated(test))
      return;

    // From this point till the end, we have to run all hooks
    // no matter what happens.

    await this._testPass._willStartTest(this, test);
    for (let i = 0; i < this._suiteStack.length; i++)
      await this._runHook(test, this._suiteStack[i], 'beforeEach');

    if (!test.error && !this._markTerminated(test)) {
      await this._testPass._willStartTestBody(this, test);
      this._runningTestCallback = test._userCallback;
      test.error = await test._userCallback.run(this._state, test);
      if (test.error && test.error.stack)
        await this._testPass._runner._sourceMapSupport.rewriteStackTraceWithSourceMaps(test.error);
      this._runningTestCallback = null;
      if (!test.error)
        test.result = TestResult.Ok;
      else if (test.error === TimeoutError)
        test.result = TestResult.TimedOut;
      else if (test.error === TerminatedError)
        test.result = TestResult.Terminated;
      else
        test.result = TestResult.Failed;
      await this._testPass._didFinishTestBody(this, test);
    }

    for (let i = this._suiteStack.length - 1; i >= 0; i--)
      await this._runHook(test, this._suiteStack[i], 'afterEach');
    await this._testPass._didFinishTest(this, test);
  }

  async _runHook(test, suite, hookName) {
    const hook = suite[hookName];
    if (!hook)
      return true;

    await this._testPass._willStartHook(this, suite, hook, hookName);
    this._runningHookCallback = hook;
    let error = await hook.run(this._state, test);
    this._runningHookCallback = null;

    if (error) {
      const location = `${hook.location.fileName}:${hook.location.lineNumber}:${hook.location.columnNumber}`;
      if (test.result !== TestResult.Terminated) {
        // Prefer terminated result over any hook failures.
        test.result = error === TerminatedError ? TestResult.Terminated : TestResult.Crashed;
      }
      let message;
      if (error === TimeoutError) {
        message = `${location} - Timeout Exceeded ${hook.timeout}ms while running "${hookName}" in suite "${suite.fullName}"`;
        error = null;
      } else if (error === TerminatedError) {
        message = `${location} - TERMINATED while running "${hookName}" in suite "${suite.fullName}"`;
        error = null;
      } else {
        if (error.stack)
          await this._testPass._runner._sourceMapSupport.rewriteStackTraceWithSourceMaps(error);
        message = `${location} - FAILED while running "${hookName}" in suite "${suite.fullName}": `;
      }
      await this._testPass._didFailHook(this, suite, hook, hookName, message, error);
      test.error = error;
      return false;
    }

    await this._testPass._didCompleteHook(this, suite, hook, hookName);
    return true;
  }

  async shutdown() {
    while (this._suiteStack.length > 0) {
      const suite = this._suiteStack.pop();
      await this._runHook({}, suite, 'afterAll');
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

  async run(testList) {
    const terminations = [
      createTermination.call(this, 'SIGINT', TestResult.Terminated, 'SIGINT received'),
      createTermination.call(this, 'SIGHUP', TestResult.Terminated, 'SIGHUP received'),
      createTermination.call(this, 'SIGTERM', TestResult.Terminated, 'SIGTERM received'),
      createTermination.call(this, 'unhandledRejection', TestResult.Crashed, 'UNHANDLED PROMISE REJECTION'),
      createTermination.call(this, 'uncaughtException', TestResult.Crashed, 'UNHANDLED ERROR'),
    ];
    for (const termination of terminations)
      process.on(termination.event, termination.handler);

    for (const test of testList) {
      test.result = null;
      test.error = null;
    }
    this._result = new Result();

    const parallel = Math.min(this._parallel, testList.length);
    const workerPromises = [];
    for (let i = 0; i < parallel; ++i) {
      const initialTestIndex = i * Math.floor(testList.length / parallel);
      workerPromises.push(this._runWorker(initialTestIndex, testList, i));
    }
    await Promise.all(workerPromises);

    for (const termination of terminations)
      process.removeListener(termination.event, termination.handler);

    if (this._runner.failedTests().length)
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

  async _runWorker(testIndex, testList, parallelIndex) {
    let worker = new TestWorker(this, this._nextWorkerId++, parallelIndex);
    this._workers[parallelIndex] = worker;
    while (!worker._terminating) {
      let skipped = 0;
      while (skipped < testList.length && testList[testIndex].result !== null) {
        testIndex = (testIndex + 1) % testList.length;
        skipped++;
      }
      const test = testList[testIndex];
      if (test.result !== null) {
        // All tests have been run.
        break;
      }

      // Mark as running so that other workers do not run it again.
      test.result = 'running';
      await worker.runTest(test);
      if (isTestFailure(test.result)) {
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
    for (const worker of this._workers)
      worker.terminate(force /* terminateHooks */);
    this._result.setResult(result, message);
    if (error) {
      if (error.stack)
        await this._runner._sourceMapSupport.rewriteStackTraceWithSourceMaps(error);
      this._result.addError(message, error, this._workers.length === 1 ? this._workers[0] : null);
    }
  }

  async _willStartTest(worker, test) {
    test.startTimestamp = Date.now();
    this._runner.emit(TestRunner.Events.TestStarted, test, worker._workerId);
  }

  async _didFinishTest(worker, test) {
    test.endTimestamp = Date.now();
    this._runner.emit(TestRunner.Events.TestFinished, test, worker._workerId);
  }

  async _willStartTestBody(worker, test) {
    debug('testrunner:test')(`[${worker._workerId}] starting "${test.fullName}" (${test.location.fileName + ':' + test.location.lineNumber})`);
  }

  async _didFinishTestBody(worker, test) {
    debug('testrunner:test')(`[${worker._workerId}] ${test.result.toUpperCase()} "${test.fullName}" (${test.location.fileName + ':' + test.location.lineNumber})`);
  }

  async _willStartHook(worker, suite, hook, hookName) {
    debug('testrunner:hook')(`[${worker._workerId}] "${hookName}" started for "${suite.fullName}" (${hook.location.fileName + ':' + hook.location.lineNumber})`);
  }

  async _didFailHook(worker, suite, hook, hookName, message, error) {
    debug('testrunner:hook')(`[${worker._workerId}] "${hookName}" FAILED for "${suite.fullName}" (${hook.location.fileName + ':' + hook.location.lineNumber})`);
    this._result.addError(message, error, worker);
    this._result.setResult(TestResult.Crashed, message);
  }

  async _didCompleteHook(worker, suite, hook, hookName) {
    debug('testrunner:hook')(`[${worker._workerId}] "${hookName}" OK for "${suite.fullName}" (${hook.location.fileName + ':' + hook.location.lineNumber})`);
  }
}

function specBuilder(defaultTimeout, action) {
  let mode = TestMode.Run;
  let expectation = TestExpectation.Ok;
  let repeat = 1;
  let timeout = defaultTimeout;

  const func = (...args) => {
    for (let i = 0; i < repeat; ++i)
      action(mode, expectation, timeout, ...args);
    mode = TestMode.Run;
    expectation = TestExpectation.Ok;
    repeat = 1;
    timeout = defaultTimeout;
  };

  func.skip = condition => {
    if (condition)
      mode = TestMode.Skip;
    return func;
  };
  func.fail = condition => {
    if (condition)
      expectation = TestExpectation.Fail;
    return func;
  };
  func.slow = () => {
    timeout = 3 * defaultTimeout;
    return func;
  }
  func.repeat = count => {
    repeat = count;
    return func;
  };
  return func;
}

class TestRunner extends EventEmitter {
  constructor(options = {}) {
    super();
    const {
      timeout = 10 * 1000, // Default timeout is 10 seconds.
      parallel = 1,
      breakOnFailure = false,
      crashIfTestsAreFocusedOnCI = true,
      disableTimeoutWhenInspectorIsEnabled = true,
    } = options;
    this._crashIfTestsAreFocusedOnCI = crashIfTestsAreFocusedOnCI;
    this._sourceMapSupport = new SourceMapSupport();
    this._rootSuite = new Suite(null, '', TestMode.Run);
    this._currentSuite = this._rootSuite;
    this._tests = [];
    this._suites = [];
    this._timeout = timeout === 0 ? INFINITE_TIMEOUT : timeout;
    this._parallel = parallel;
    this._breakOnFailure = breakOnFailure;

    if (MAJOR_NODEJS_VERSION >= 8 && disableTimeoutWhenInspectorIsEnabled) {
      if (inspector.url()) {
        console.log('TestRunner detected inspector; overriding certain properties to be debugger-friendly');
        console.log('  - timeout = 0 (Infinite)');
        this._timeout = INFINITE_TIMEOUT;
      }
    }

    this.describe = specBuilder(this._timeout, (mode, expectation, timeout, ...args) => this._addSuite(mode, expectation, ...args));
    this.fdescribe = specBuilder(this._timeout, (mode, expectation, timeout, ...args) => this._addSuite(TestMode.Focus, expectation, ...args));
    this.xdescribe = specBuilder(this._timeout, (mode, expectation, timeout, ...args) => this._addSuite(TestMode.Skip, expectation, ...args));
    this.it = specBuilder(this._timeout, (mode, expectation, timeout, name, callback) => this._addTest(name, callback, mode, expectation, timeout));
    this.fit = specBuilder(this._timeout, (mode, expectation, timeout, name, callback) => this._addTest(name, callback, TestMode.Focus, expectation, timeout));
    this.xit = specBuilder(this._timeout, (mode, expectation, timeout, name, callback) => this._addTest(name, callback, TestMode.Skip, expectation, timeout));
    this.dit = specBuilder(this._timeout, (mode, expectation, timeout, name, callback) => {
      const test = this._addTest(name, callback, TestMode.Focus, expectation, INFINITE_TIMEOUT);
      const N = callback.toString().split('\n').length;
      for (let i = 0; i < N; ++i)
        this._debuggerLogBreakpointLines.set(test.location.filePath, i + test.location.lineNumber);
    });
    this._debuggerLogBreakpointLines = new Multimap();

    this.beforeAll = this._addHook.bind(this, 'beforeAll');
    this.beforeEach = this._addHook.bind(this, 'beforeEach');
    this.afterAll = this._addHook.bind(this, 'afterAll');
    this.afterEach = this._addHook.bind(this, 'afterEach');
  }

  loadTests(module, ...args) {
    if (typeof module.describe === 'function')
      this._addSuite(TestMode.Run, TestExpectation.Ok, '', module.describe, ...args);
    if (typeof module.fdescribe === 'function')
      this._addSuite(TestMode.Focus, TestExpectation.Ok, '', module.fdescribe, ...args);
    if (typeof module.xdescribe === 'function')
      this._addSuite(TestMode.Skip, TestExpectation.Ok, '', module.xdescribe, ...args);
  }

  _addTest(name, callback, mode, expectation, timeout) {
    for (let suite = this._currentSuite; suite; suite = suite.parentSuite) {
      if (suite.expectation === TestExpectation.Fail)
        expectation = TestExpectation.Fail;
      if (suite.declaredMode === TestMode.Skip)
        mode = TestMode.Skip;
    }
    const test = new Test(this._currentSuite, name, callback, mode, expectation, timeout);
    this._currentSuite.children.push(test);
    this._tests.push(test);
    return test;
  }

  _addSuite(mode, expectation, name, callback, ...args) {
    const oldSuite = this._currentSuite;
    const suite = new Suite(this._currentSuite, name, mode, expectation);
    this._suites.push(suite);
    this._currentSuite.children.push(suite);
    this._currentSuite = suite;
    callback(...args);
    this._currentSuite = oldSuite;
  }

  _addHook(hookName, callback) {
    assert(this._currentSuite[hookName] === null, `Only one ${hookName} hook available per suite`);
    const hook = new UserCallback(callback, this._timeout);
    this._currentSuite[hookName] = hook;
  }

  async run(options = {}) {
    const { totalTimeout = 0 } = options;
    let session = this._debuggerLogBreakpointLines.size ? await setLogBreakpoints(this._debuggerLogBreakpointLines) : null;
    const runnableTests = this.runnableTests();
    this.emit(TestRunner.Events.Started, runnableTests);

    let result = new Result();
    if (this._crashIfTestsAreFocusedOnCI && process.env.CI && this.hasFocusedTestsOrSuites()) {
      result.setResult(TestResult.Crashed, '"focused" tests or suites are probitted on CI');
    } else {
      let timeoutId;
      const timeoutPromise = new Promise(resolve => {
        const timeoutResult = new Result();
        timeoutResult.setResult(TestResult.Crashed, `Total timeout of ${totalTimeout}ms reached.`);
        if (totalTimeout)
          timeoutId = setTimeout(resolve.bind(null, timeoutResult), totalTimeout);
      });
      try {
        this._runningPass = new TestPass(this, this._parallel, this._breakOnFailure);
        result = await Promise.race([
          this._runningPass.run(runnableTests).catch(e => { console.error(e); throw e; }),
          timeoutPromise,
        ]);
        this._runningPass = null;
      } finally {
        clearTimeout(timeoutId);
      }
    }
    this.emit(TestRunner.Events.Finished, result);
    if (session)
      session.disconnect();
    return result;
  }

  async terminate() {
    if (!this._runningPass)
      return;
    await this._runningPass._terminate(TestResult.Terminated, 'Terminated with |TestRunner.terminate()| call', true /* force */, null /* error */);
  }

  timeout() {
    return this._timeout;
  }

  runnableTests() {
    if (!this.hasFocusedTestsOrSuites())
      return this._tests;

    const tests = [];
    const blacklistSuites = new Set();
    // First pass: pick "fit" and blacklist parent suites
    for (let i = 0; i < this._tests.length; i++) {
      const test = this._tests[i];
      if (test.declaredMode !== TestMode.Focus)
        continue;
      tests.push({ i, test });
      for (let suite = test.suite; suite; suite = suite.parentSuite)
        blacklistSuites.add(suite);
    }
    // Second pass: pick all tests that belong to non-blacklisted "fdescribe"
    for (let i = 0; i < this._tests.length; i++) {
      const test = this._tests[i];
      let insideFocusedSuite = false;
      for (let suite = test.suite; suite; suite = suite.parentSuite) {
        if (!blacklistSuites.has(suite) && suite.declaredMode === TestMode.Focus) {
          insideFocusedSuite = true;
          break;
        }
      }
      if (insideFocusedSuite)
        tests.push({ i, test });
    }
    tests.sort((a, b) => a.i - b.i);
    return tests.map(t => t.test);
  }

  focusedSuites() {
    return this._suites.filter(suite => suite.declaredMode === TestMode.Focus);
  }

  focusedTests() {
    return this._tests.filter(test => test.declaredMode === TestMode.Focus);
  }

  hasFocusedTestsOrSuites() {
    return !!this.focusedTests().length || !!this.focusedSuites().length;
  }

  focusMatchingTests(fullNameRegex) {
    for (const test of this._tests) {
      if (fullNameRegex.test(test.fullName))
        test.declaredMode = TestMode.Focus;
    }
  }

  tests() {
    return this._tests.slice();
  }

  failedTests() {
    return this._tests.filter(test => test.result === TestResult.Failed || test.result === TestResult.TimedOut || test.result === TestResult.Crashed);
  }

  passedTests() {
    return this._tests.filter(test => test.result === TestResult.Ok);
  }

  skippedTests() {
    return this._tests.filter(test => test.result === TestResult.Skipped);
  }

  markedAsFailingTests() {
    return this._tests.filter(test => test.result === TestResult.MarkedAsFailing);
  }

  parallel() {
    return this._parallel;
  }
}

async function setLogBreakpoints(debuggerLogBreakpoints) {
  const session = new inspector.Session();
  session.connect();
  const postAsync = util.promisify(session.post.bind(session));
  await postAsync('Debugger.enable');
  const setBreakpointCommands = [];
  for (const filePath of debuggerLogBreakpoints.keysArray()) {
    const lineNumbers = debuggerLogBreakpoints.get(filePath);
    const lines = (await readFileAsync(filePath, 'utf8')).split('\n');
    for (const lineNumber of lineNumbers) {
      setBreakpointCommands.push(postAsync('Debugger.setBreakpointByUrl', {
        url: url.pathToFileURL(filePath),
        lineNumber,
        condition: `console.log('${String(lineNumber + 1).padStart(6, ' ')} | ' + ${JSON.stringify(lines[lineNumber])})`,
      }).catch(e => {}));
    };
  }
  await Promise.all(setBreakpointCommands);
  return session;
}

/**
 * @param {*} value
 * @param {string=} message
 */
function assert(value, message) {
  if (!value)
    throw new Error(message);
}

TestRunner.Events = {
  Started: 'started',
  Finished: 'finished',
  TestStarted: 'teststarted',
  TestFinished: 'testfinished',
};

module.exports = TestRunner;
