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
  MarkAsFailing: 'markAsFailing',
  Flake: 'flake'
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
  constructor(suite, name, callback, declaredMode, timeout) {
    this.suite = suite;
    this.name = name;
    this.fullName = (suite.fullName + ' ' + name).trim();
    this.declaredMode = declaredMode;
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
  constructor(parentSuite, name, declaredMode) {
    this.parentSuite = parentSuite;
    this.name = name;
    this.fullName = (parentSuite ? parentSuite.fullName + ' ' + name : name).trim();
    this.declaredMode = declaredMode;
    /** @type {!Array<(!Test|!Suite)>} */
    this.children = [];

    this.beforeAll = null;
    this.beforeEach = null;
    this.afterAll = null;
    this.afterEach = null;
  }
}

class TestWorker {
  constructor(testPass, workerId, parallelIndex) {
    this._testPass = testPass;
    this._state = { parallelIndex };
    this._suiteStack = [];
    this._termination = false;
    this._workerId = workerId;
    this._runningUserCallback = null;
  }

  terminate() {
    this._termination = true;
    if (this._runningUserCallback)
      this._runningUserCallback.terminate();
  }

  _markTerminated(test) {
    if (!this._termination)
      return false;
    test.result = TestResult.Terminated;
    return true;
  }

  async runTest(test) {
    if (this._markTerminated(test))
      return;

    if (test.declaredMode === TestMode.MarkAsFailing) {
      await this._testPass._willStartTest(this, test);
      test.result = TestResult.MarkedAsFailing;
      await this._testPass._didFinishTest(this, test);
      return;
    }

    if (test.declaredMode === TestMode.Skip) {
      await this._testPass._willStartTest(this, test);
      test.result = TestResult.Skipped;
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
      this._runningUserCallback = test._userCallback;
      await this._testPass._willStartTestBody(this, test);
      test.error = await test._userCallback.run(this._state, test);
      this._runningUserCallback = null;
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
    // TODO: do we want hooks to be terminatable? Perhaps, only on SIGTERM?
    this._runningUserCallback = hook;
    let error = await hook.run(this._state, test);
    this._runningUserCallback = null;

    if (error) {
      const location = `${hook.location.fileName}:${hook.location.lineNumber}:${hook.location.columnNumber}`;
      if (test.result !== TestResult.Terminated) {
        // Prefer terminated result over any hook failures.
        test.result = error === TerminatedError ? TestResult.Terminated : TestResult.Crashed;
      }
      if (error === TimeoutError) {
        error = new Error(`${location} - Timeout Exceeded ${hook.timeout}ms while running "${hookName}" in suite "${suite.fullName}"`);
        error.stack = '';
      } else if (error === TerminatedError) {
        error = new Error(`${location} - TERMINATED while running "${hookName}" in suite "${suite.fullName}"`);
        error.stack = '';
      } else {
        if (error.stack)
          await this._testPass._runner._sourceMapSupport.rewriteStackTraceWithSourceMaps(error);
        error.message = `${location} - FAILED while running "${hookName}" in suite "${suite.fullName}": ` + error.message;
      }
      await this._testPass._didFailHook(this, suite, hook, hookName, error);
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
    this._nextWorkerId = 0;
    this._parallel = parallel;
    this._breakOnFailure = breakOnFailure;
    this._termination = null;
    this._hookErrors = [];
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

    const parallel = Math.min(this._parallel, testList.length);
    const workerPromises = [];
    for (let i = 0; i < parallel; ++i) {
      const initialTestIndex = i * Math.floor(testList.length / parallel);
      workerPromises.push(this._runWorker(initialTestIndex, testList, i));
    }
    await Promise.all(workerPromises);

    for (const termination of terminations)
      process.removeListener(termination.event, termination.handler);
    return this._termination;

    function createTermination(event, result, message) {
      return {
        event,
        message,
        handler: error => this._terminate(result, message, error)
      };
    }
  }

  async _runWorker(testIndex, testList, parallelIndex) {
    let worker = new TestWorker(this, this._nextWorkerId++, parallelIndex);
    this._workers[parallelIndex] = worker;
    while (!this._termination) {
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
          await this._terminate(TestResult.Terminated, `Terminating because a test has failed and |testRunner.breakOnFailure| is enabled`, null);
          return;
        }
        worker = new TestWorker(this, this._nextWorkerId++, parallelIndex);
        this._workers[parallelIndex] = worker;
      }
    }
    await worker.shutdown();
  }

  async _terminate(result, message, error) {
    if (this._termination)
      return false;
    if (error && error.stack)
      await this._runner._sourceMapSupport.rewriteStackTraceWithSourceMaps(error);
    this._termination = { result, message, error };
    this._willTerminate(this._termination);
    for (const worker of this._workers)
      worker.terminate();
    return true;
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

  async _didFailHook(worker, suite, hook, hookName, error) {
    debug('testrunner:hook')(`[${worker._workerId}] "${hookName}" FAILED for "${suite.fullName}" (${hook.location.fileName + ':' + hook.location.lineNumber})`);
    this._hookErrors.push(error);
    // Note: we can skip termination and report all errors in the end.
    await this._terminate(TestResult.Crashed, error.message, error);
  }

  async _didCompleteHook(worker, suite, hook, hookName) {
    debug('testrunner:hook')(`[${worker._workerId}] "${hookName}" OK for "${suite.fullName}" (${hook.location.fileName + ':' + hook.location.lineNumber})`);
  }

  _willTerminate(termination) {
    debug('testrunner')(`TERMINTED result = ${termination.result}, message = ${termination.message}`);
  }
}

function specBuilder(defaultTimeout, action) {
  let mode = TestMode.Run;
  let repeat = 1;
  let timeout = defaultTimeout;

  const func = (...args) => {
    for (let i = 0; i < repeat; ++i)
      action(mode, timeout, ...args);
    mode = TestMode.Run;
    repeat = 1;
  };

  func.skip = condition => {
    if (condition)
      mode = TestMode.Skip;
    return func;
  };
  func.fail = condition => {
    if (condition)
      mode = TestMode.MarkAsFailing;
    return func;
  };
  func.flake = condition => {
    if (condition)
      mode = TestMode.Flake;
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
      disableTimeoutWhenInspectorIsEnabled = true,
    } = options;
    this._sourceMapSupport = new SourceMapSupport();
    this._rootSuite = new Suite(null, '', TestMode.Run);
    this._currentSuite = this._rootSuite;
    this._tests = [];
    this._timeout = timeout === 0 ? INFINITE_TIMEOUT : timeout;
    this._parallel = parallel;
    this._breakOnFailure = breakOnFailure;

    this._hasFocusedTestsOrSuites = false;

    if (MAJOR_NODEJS_VERSION >= 8 && disableTimeoutWhenInspectorIsEnabled) {
      if (inspector.url()) {
        console.log('TestRunner detected inspector; overriding certain properties to be debugger-friendly');
        console.log('  - timeout = 0 (Infinite)');
        this._timeout = INFINITE_TIMEOUT;
      }
    }

    this.describe = specBuilder(this._timeout, (mode, timeout, ...args) => this._addSuite(mode, ...args));
    this.fdescribe = specBuilder(this._timeout, (mode, timeout, ...args) => this._addSuite(TestMode.Focus, ...args));
    this.xdescribe = specBuilder(this._timeout, (mode, timeout, ...args) => this._addSuite(TestMode.Skip, ...args));
    this.it = specBuilder(this._timeout, (mode, timeout, name, callback) => this._addTest(name, callback, mode, timeout));
    this.fit = specBuilder(this._timeout, (mode, timeout, name, callback) => this._addTest(name, callback, TestMode.Focus, timeout));
    this.xit = specBuilder(this._timeout, (mode, timeout, name, callback) => this._addTest(name, callback, TestMode.Skip, timeout));
    this.dit = specBuilder(this._timeout, (mode, timeout, name, callback) => {
      const test = this._addTest(name, callback, TestMode.Focus, INFINITE_TIMEOUT);
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
      this._addSuite(TestMode.Run, '', module.describe, ...args);
    if (typeof module.fdescribe === 'function')
      this._addSuite(TestMode.Focus, '', module.fdescribe, ...args);
    if (typeof module.xdescribe === 'function')
      this._addSuite(TestMode.Skip, '', module.xdescribe, ...args);
  }

  _addTest(name, callback, mode, timeout) {
    let suite = this._currentSuite;
    let markedAsFailing = suite.declaredMode === TestMode.MarkAsFailing;
    while ((suite = suite.parentSuite))
      markedAsFailing |= suite.declaredMode === TestMode.MarkAsFailing;
    if (markedAsFailing)
      mode = TestMode.MarkAsFailing;

    suite = this._currentSuite;
    let skip = suite.declaredMode === TestMode.Skip;
    while ((suite = suite.parentSuite))
    skip |= suite.declaredMode === TestMode.Skip;
    if (skip)
      mode = TestMode.Skip;

    const test = new Test(this._currentSuite, name, callback, mode, timeout);
    this._currentSuite.children.push(test);
    this._tests.push(test);
    this._hasFocusedTestsOrSuites = this._hasFocusedTestsOrSuites || mode === TestMode.Focus;
    return test;
  }

  _addSuite(mode, name, callback, ...args) {
    const oldSuite = this._currentSuite;
    const suite = new Suite(this._currentSuite, name, mode);
    this._currentSuite.children.push(suite);
    this._currentSuite = suite;
    callback(...args);
    this._currentSuite = oldSuite;
    this._hasFocusedTestsOrSuites = this._hasFocusedTestsOrSuites || mode === TestMode.Focus;
  }

  _addHook(hookName, callback) {
    assert(this._currentSuite[hookName] === null, `Only one ${hookName} hook available per suite`);
    const hook = new UserCallback(callback, this._timeout);
    this._currentSuite[hookName] = hook;
  }

  async run() {
    let session = this._debuggerLogBreakpointLines.size ? await setLogBreakpoints(this._debuggerLogBreakpointLines) : null;
    const runnableTests = this._runnableTests();
    this.emit(TestRunner.Events.Started, runnableTests);
    this._runningPass = new TestPass(this, this._parallel, this._breakOnFailure);
    const termination = await this._runningPass.run(runnableTests).catch(e => {
      console.error(e);
      throw e;
    });
    this._runningPass = null;
    const result = {};
    if (termination) {
      result.result = termination.result;
      result.exitCode = 130;
      result.terminationMessage = termination.message;
      result.terminationError = termination.error;
    } else {
      if (this.failedTests().length) {
        result.result = TestResult.Failed;
        result.exitCode = 1;
      } else {
        result.result = TestResult.Ok;
        result.exitCode = 0;
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
    await this._runningPass._terminate(TestResult.Terminated, 'Terminated with |TestRunner.terminate()| call', null);
  }

  timeout() {
    return this._timeout;
  }

  _runnableTests() {
    if (!this._hasFocusedTestsOrSuites)
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

  hasFocusedTestsOrSuites() {
    return this._hasFocusedTestsOrSuites;
  }

  tests() {
    return this._tests.slice();
  }

  failedTests() {
    return this._tests.filter(test => test.result === 'failed' || test.result === 'timedout' || test.result === 'crashed');
  }

  passedTests() {
    return this._tests.filter(test => test.result === 'ok');
  }

  skippedTests() {
    return this._tests.filter(test => test.result === 'skipped');
  }

  markedAsFailingTests() {
    return this._tests.filter(test => test.result === 'markedAsFailing');
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
