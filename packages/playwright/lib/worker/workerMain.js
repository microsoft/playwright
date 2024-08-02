"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.create = exports.WorkerMain = void 0;
var _utilsBundle = require("playwright-core/lib/utilsBundle");
var _util = require("../util");
var _ipc = require("../common/ipc");
var _globals = require("../common/globals");
var _configLoader = require("../common/configLoader");
var _fixtureRunner = require("./fixtureRunner");
var _utils = require("playwright-core/lib/utils");
var _testInfo = require("./testInfo");
var _process = require("../common/process");
var _testLoader = require("../common/testLoader");
var _suiteUtils = require("../common/suiteUtils");
var _poolBuilder = require("../common/poolBuilder");
var _fixtures = require("../common/fixtures");
var _timeoutManager = require("./timeoutManager");
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

class WorkerMain extends _process.ProcessRunner {
  constructor(params) {
    super();
    this._params = void 0;
    this._config = void 0;
    this._project = void 0;
    this._poolBuilder = void 0;
    this._fixtureRunner = void 0;
    // Accumulated fatal errors that cannot be attributed to a test.
    this._fatalErrors = [];
    // Whether we should skip running remaining tests in this suite because
    // of a setup error, usually beforeAll hook.
    this._skipRemainingTestsInSuite = void 0;
    // The stage of the full cleanup. Once "finished", we can safely stop running anything.
    this._didRunFullCleanup = false;
    // Whether the worker was requested to stop.
    this._isStopped = false;
    // This promise resolves once the single "run test group" call finishes.
    this._runFinished = new _utils.ManualPromise();
    this._currentTest = null;
    this._lastRunningTests = [];
    this._totalRunningTests = 0;
    // Suites that had their beforeAll hooks, but not afterAll hooks executed.
    // These suites still need afterAll hooks to be executed for the proper cleanup.
    // Contains dynamic annotations originated by modifiers with a callback, e.g. `test.skip(() => true)`.
    this._activeSuites = new Map();
    process.env.TEST_WORKER_INDEX = String(params.workerIndex);
    process.env.TEST_PARALLEL_INDEX = String(params.parallelIndex);
    (0, _globals.setIsWorkerProcess)();
    this._params = params;
    this._fixtureRunner = new _fixtureRunner.FixtureRunner();

    // Resolve this promise, so worker does not stall waiting for the non-existent run to finish,
    // when it was sopped before running any test group.
    this._runFinished.resolve();
    process.on('unhandledRejection', reason => this.unhandledError(reason));
    process.on('uncaughtException', error => this.unhandledError(error));
    process.stdout.write = chunk => {
      var _this$_currentTest;
      this.dispatchEvent('stdOut', (0, _ipc.stdioChunkToParams)(chunk));
      (_this$_currentTest = this._currentTest) === null || _this$_currentTest === void 0 || _this$_currentTest._tracing.appendStdioToTrace('stdout', chunk);
      return true;
    };
    if (!process.env.PW_RUNNER_DEBUG) {
      process.stderr.write = chunk => {
        var _this$_currentTest2;
        this.dispatchEvent('stdErr', (0, _ipc.stdioChunkToParams)(chunk));
        (_this$_currentTest2 = this._currentTest) === null || _this$_currentTest2 === void 0 || _this$_currentTest2._tracing.appendStdioToTrace('stderr', chunk);
        return true;
      };
    }
  }
  _stop() {
    if (!this._isStopped) {
      var _this$_currentTest3;
      this._isStopped = true;
      (_this$_currentTest3 = this._currentTest) === null || _this$_currentTest3 === void 0 || _this$_currentTest3._interrupt();
    }
    return this._runFinished;
  }
  async gracefullyClose() {
    try {
      await this._stop();
      // Ignore top-level errors, they are already inside TestInfo.errors.
      const fakeTestInfo = new _testInfo.TestInfoImpl(this._config, this._project, this._params, undefined, 0, () => {}, () => {}, () => {});
      const runnable = {
        type: 'teardown'
      };
      // We have to load the project to get the right deadline below.
      await fakeTestInfo._runAsStage({
        title: 'worker cleanup',
        runnable
      }, () => this._loadIfNeeded()).catch(() => {});
      await this._fixtureRunner.teardownScope('test', fakeTestInfo, runnable).catch(() => {});
      await this._fixtureRunner.teardownScope('worker', fakeTestInfo, runnable).catch(() => {});
      // Close any other browsers launched in this process. This includes anything launched
      // manually in the test/hooks and internal browsers like Playwright Inspector.
      await fakeTestInfo._runAsStage({
        title: 'worker cleanup',
        runnable
      }, () => (0, _utils.gracefullyCloseAll)()).catch(() => {});
      this._fatalErrors.push(...fakeTestInfo.errors);
    } catch (e) {
      this._fatalErrors.push((0, _util.serializeError)(e));
    }
    if (this._fatalErrors.length) {
      this._appendProcessTeardownDiagnostics(this._fatalErrors[this._fatalErrors.length - 1]);
      const payload = {
        fatalErrors: this._fatalErrors
      };
      this.dispatchEvent('teardownErrors', payload);
    }
  }
  _appendProcessTeardownDiagnostics(error) {
    if (!this._lastRunningTests.length) return;
    const count = this._totalRunningTests === 1 ? '1 test' : `${this._totalRunningTests} tests`;
    let lastMessage = '';
    if (this._lastRunningTests.length < this._totalRunningTests) lastMessage = `, last ${this._lastRunningTests.length} tests were`;
    const message = ['', '', _utilsBundle.colors.red(`Failed worker ran ${count}${lastMessage}:`), ...this._lastRunningTests.map(test => formatTestTitle(test, this._project.project.name))].join('\n');
    if (error.message) {
      if (error.stack) {
        let index = error.stack.indexOf(error.message);
        if (index !== -1) {
          index += error.message.length;
          error.stack = error.stack.substring(0, index) + message + error.stack.substring(index);
        }
      }
      error.message += message;
    } else if (error.value) {
      error.value += message;
    }
  }
  unhandledError(error) {
    // No current test - fatal error.
    if (!this._currentTest) {
      if (!this._fatalErrors.length) this._fatalErrors.push((0, _util.serializeError)(error));
      void this._stop();
      return;
    }

    // We do not differentiate between errors in the control flow
    // and unhandled errors - both lead to the test failing. This is good for regular tests,
    // so that you can, e.g. expect() from inside an event handler. The test fails,
    // and we restart the worker.
    if (!this._currentTest._hasUnhandledError) {
      this._currentTest._hasUnhandledError = true;
      this._currentTest._failWithError(error);
    }

    // For tests marked with test.fail(), this might be a problem when unhandled error
    // is not coming from the user test code (legit failure), but from fixtures or test runner.
    //
    // Ideally, we would mark this test as "failed unexpectedly" and show that in the report.
    // However, we do not have such a special test status, so the test will be considered ok (failed as expected).
    //
    // To avoid messing up future tests, we forcefully stop the worker, unless it is
    // an expect() error which we know does not mess things up.
    const isExpectError = error instanceof Error && !!error.matcherResult;
    const shouldContinueInThisWorker = this._currentTest.expectedStatus === 'failed' && isExpectError;
    if (!shouldContinueInThisWorker) void this._stop();
  }
  async _loadIfNeeded() {
    if (this._config) return;
    this._config = await (0, _configLoader.deserializeConfig)(this._params.config);
    this._project = this._config.projects.find(p => p.id === this._params.projectId);
    this._poolBuilder = _poolBuilder.PoolBuilder.createForWorker(this._project);
  }
  async runTestGroup(runPayload) {
    this._runFinished = new _utils.ManualPromise();
    const entries = new Map(runPayload.entries.map(e => [e.testId, e]));
    let fatalUnknownTestIds;
    try {
      await this._loadIfNeeded();
      const fileSuite = await (0, _testLoader.loadTestFile)(runPayload.file, this._config.config.rootDir);
      const suite = (0, _suiteUtils.bindFileSuiteToProject)(this._project, fileSuite);
      if (this._params.repeatEachIndex) (0, _suiteUtils.applyRepeatEachIndex)(this._project, suite, this._params.repeatEachIndex);
      const hasEntries = (0, _suiteUtils.filterTestsRemoveEmptySuites)(suite, test => entries.has(test.id));
      if (hasEntries) {
        this._poolBuilder.buildPools(suite);
        this._activeSuites = new Map();
        this._didRunFullCleanup = false;
        const tests = suite.allTests();
        for (let i = 0; i < tests.length; i++) {
          // Do not run tests after full cleanup, because we are entirely done.
          if (this._isStopped && this._didRunFullCleanup) break;
          const entry = entries.get(tests[i].id);
          entries.delete(tests[i].id);
          (0, _util.debugTest)(`test started "${tests[i].title}"`);
          await this._runTest(tests[i], entry.retry, tests[i + 1]);
          (0, _util.debugTest)(`test finished "${tests[i].title}"`);
        }
      } else {
        fatalUnknownTestIds = runPayload.entries.map(e => e.testId);
        void this._stop();
      }
    } catch (e) {
      // In theory, we should run above code without any errors.
      // However, in the case we screwed up, or loadTestFile failed in the worker
      // but not in the runner, let's do a fatal error.
      this._fatalErrors.push((0, _util.serializeError)(e));
      void this._stop();
    } finally {
      const donePayload = {
        fatalErrors: this._fatalErrors,
        skipTestsDueToSetupFailure: [],
        fatalUnknownTestIds
      };
      for (const test of ((_this$_skipRemainingT = this._skipRemainingTestsInSuite) === null || _this$_skipRemainingT === void 0 ? void 0 : _this$_skipRemainingT.allTests()) || []) {
        var _this$_skipRemainingT;
        if (entries.has(test.id)) donePayload.skipTestsDueToSetupFailure.push(test.id);
      }
      this.dispatchEvent('done', donePayload);
      this._fatalErrors = [];
      this._skipRemainingTestsInSuite = undefined;
      this._runFinished.resolve();
    }
  }
  async _runTest(test, retry, nextTest) {
    const testInfo = new _testInfo.TestInfoImpl(this._config, this._project, this._params, test, retry, stepBeginPayload => this.dispatchEvent('stepBegin', stepBeginPayload), stepEndPayload => this.dispatchEvent('stepEnd', stepEndPayload), attachment => this.dispatchEvent('attach', attachment));
    const processAnnotation = annotation => {
      testInfo.annotations.push(annotation);
      switch (annotation.type) {
        case 'fixme':
        case 'skip':
          testInfo.expectedStatus = 'skipped';
          break;
        case 'fail':
          if (testInfo.expectedStatus !== 'skipped') testInfo.expectedStatus = 'failed';
          break;
        case 'slow':
          testInfo.slow();
          break;
      }
    };
    if (!this._isStopped) this._fixtureRunner.setPool(test._pool);
    const suites = getSuites(test);
    const reversedSuites = suites.slice().reverse();
    const nextSuites = new Set(getSuites(nextTest));
    testInfo._timeoutManager.setTimeout(test.timeout);
    for (const annotation of test.annotations) processAnnotation(annotation);

    // Process existing annotations dynamically set for parent suites.
    for (const suite of suites) {
      const extraAnnotations = this._activeSuites.get(suite) || [];
      for (const annotation of extraAnnotations) processAnnotation(annotation);
    }
    this._currentTest = testInfo;
    (0, _globals.setCurrentTestInfo)(testInfo);
    this.dispatchEvent('testBegin', buildTestBeginPayload(testInfo));
    const isSkipped = testInfo.expectedStatus === 'skipped';
    const hasAfterAllToRunBeforeNextTest = reversedSuites.some(suite => {
      return this._activeSuites.has(suite) && !nextSuites.has(suite) && suite._hooks.some(hook => hook.type === 'afterAll');
    });
    if (isSkipped && nextTest && !hasAfterAllToRunBeforeNextTest) {
      // Fast path - this test is skipped, and there are more tests that will handle cleanup.
      testInfo.status = 'skipped';
      this.dispatchEvent('testEnd', buildTestEndPayload(testInfo));
      return;
    }
    this._totalRunningTests++;
    this._lastRunningTests.push(test);
    if (this._lastRunningTests.length > 10) this._lastRunningTests.shift();
    let shouldRunAfterEachHooks = false;
    const tracingSlot = {
      timeout: this._project.project.timeout,
      elapsed: 0
    };
    testInfo._allowSkips = true;
    await testInfo._runAsStage({
      title: 'setup and test'
    }, async () => {
      await testInfo._runAsStage({
        title: 'start tracing',
        runnable: {
          type: 'test',
          slot: tracingSlot
        }
      }, async () => {
        var _testLifecycleInstrum, _testLifecycleInstrum2;
        // Ideally, "trace" would be an config-level option belonging to the
        // test runner instead of a fixture belonging to Playwright.
        // However, for backwards compatibility, we have to read it from a fixture today.
        // We decided to not introduce the config-level option just yet.
        const traceFixtureRegistration = test._pool.resolve('trace');
        if (!traceFixtureRegistration) return;
        if (typeof traceFixtureRegistration.fn === 'function') throw new Error(`"trace" option cannot be a function`);
        await testInfo._tracing.startIfNeeded(traceFixtureRegistration.fn);
        await ((_testLifecycleInstrum = (0, _globals.testLifecycleInstrumentation)()) === null || _testLifecycleInstrum === void 0 || (_testLifecycleInstrum2 = _testLifecycleInstrum.onTestBegin) === null || _testLifecycleInstrum2 === void 0 ? void 0 : _testLifecycleInstrum2.call(_testLifecycleInstrum));
      });
      if (this._isStopped || isSkipped) {
        // Two reasons to get here:
        // - Last test is skipped, so we should not run the test, but run the cleanup.
        // - Worker is requested to stop, but was not able to run full cleanup yet.
        //   We should skip the test, but run the cleanup.
        testInfo.status = 'skipped';
        return;
      }
      await (0, _utils.removeFolders)([testInfo.outputDir]);
      let testFunctionParams = null;
      await testInfo._runAsStage({
        title: 'Before Hooks',
        stepInfo: {
          category: 'hook'
        }
      }, async () => {
        // Run "beforeAll" hooks, unless already run during previous tests.
        for (const suite of suites) await this._runBeforeAllHooksForSuite(suite, testInfo);

        // Run "beforeEach" hooks. Once started with "beforeEach", we must run all "afterEach" hooks as well.
        shouldRunAfterEachHooks = true;
        await this._runEachHooksForSuites(suites, 'beforeEach', testInfo);

        // Setup fixtures required by the test.
        testFunctionParams = await this._fixtureRunner.resolveParametersForFunction(test.fn, testInfo, 'test', {
          type: 'test'
        });
      });
      if (testFunctionParams === null) {
        // Fixture setup failed or was skipped, we should not run the test now.
        return;
      }
      await testInfo._runAsStage({
        title: 'test function',
        runnable: {
          type: 'test'
        }
      }, async () => {
        // Now run the test itself.
        const fn = test.fn; // Extract a variable to get a better stack trace ("myTest" vs "TestCase.myTest [as fn]").
        await fn(testFunctionParams, testInfo);
      });
    }).catch(() => {}); // Ignore the top-level error, it is already inside TestInfo.errors.

    // Update duration, so it is available in fixture teardown and afterEach hooks.
    testInfo.duration = testInfo._timeoutManager.defaultSlot().elapsed | 0;

    // No skips in after hooks.
    testInfo._allowSkips = true;

    // After hooks get an additional timeout.
    const afterHooksTimeout = calculateMaxTimeout(this._project.project.timeout, testInfo.timeout);
    const afterHooksSlot = {
      timeout: afterHooksTimeout,
      elapsed: 0
    };
    await testInfo._runAsStage({
      title: 'After Hooks',
      stepInfo: {
        category: 'hook'
      }
    }, async () => {
      let firstAfterHooksError;
      let didTimeoutInAfterHooks = false;
      try {
        // Run "immediately upon test function finish" callback.
        await testInfo._runAsStage({
          title: 'on-test-function-finish',
          runnable: {
            type: 'test',
            slot: tracingSlot
          }
        }, async () => {
          var _testLifecycleInstrum3, _testLifecycleInstrum4;
          await ((_testLifecycleInstrum3 = (0, _globals.testLifecycleInstrumentation)()) === null || _testLifecycleInstrum3 === void 0 || (_testLifecycleInstrum4 = _testLifecycleInstrum3.onTestFunctionEnd) === null || _testLifecycleInstrum4 === void 0 ? void 0 : _testLifecycleInstrum4.call(_testLifecycleInstrum3));
        });
      } catch (error) {
        var _firstAfterHooksError;
        firstAfterHooksError = (_firstAfterHooksError = firstAfterHooksError) !== null && _firstAfterHooksError !== void 0 ? _firstAfterHooksError : error;
      }
      try {
        // Run "afterEach" hooks, unless we failed at beforeAll stage.
        if (!didTimeoutInAfterHooks && shouldRunAfterEachHooks) await this._runEachHooksForSuites(reversedSuites, 'afterEach', testInfo, afterHooksSlot);
      } catch (error) {
        var _firstAfterHooksError2;
        if (error instanceof _timeoutManager.TimeoutManagerError) didTimeoutInAfterHooks = true;
        firstAfterHooksError = (_firstAfterHooksError2 = firstAfterHooksError) !== null && _firstAfterHooksError2 !== void 0 ? _firstAfterHooksError2 : error;
      }
      try {
        if (!didTimeoutInAfterHooks) {
          // Teardown test-scoped fixtures. Attribute to 'test' so that users understand
          // they should probably increase the test timeout to fix this issue.
          await this._fixtureRunner.teardownScope('test', testInfo, {
            type: 'test',
            slot: afterHooksSlot
          });
        }
      } catch (error) {
        var _firstAfterHooksError3;
        if (error instanceof _timeoutManager.TimeoutManagerError) didTimeoutInAfterHooks = true;
        firstAfterHooksError = (_firstAfterHooksError3 = firstAfterHooksError) !== null && _firstAfterHooksError3 !== void 0 ? _firstAfterHooksError3 : error;
      }

      // Run "afterAll" hooks for suites that are not shared with the next test.
      // In case of failure the worker will be stopped and we have to make sure that afterAll
      // hooks run before worker fixtures teardown.
      for (const suite of reversedSuites) {
        if (!nextSuites.has(suite) || testInfo._isFailure()) {
          try {
            await this._runAfterAllHooksForSuite(suite, testInfo);
          } catch (error) {
            var _firstAfterHooksError4;
            // Continue running "afterAll" hooks even after some of them timeout.
            firstAfterHooksError = (_firstAfterHooksError4 = firstAfterHooksError) !== null && _firstAfterHooksError4 !== void 0 ? _firstAfterHooksError4 : error;
          }
        }
      }
      if (firstAfterHooksError) throw firstAfterHooksError;
    }).catch(() => {}); // Ignore the top-level error, it is already inside TestInfo.errors.

    if (testInfo._isFailure()) this._isStopped = true;
    if (this._isStopped) {
      // Run all remaining "afterAll" hooks and teardown all fixtures when worker is shutting down.
      // Mark as "cleaned up" early to avoid running cleanup twice.
      this._didRunFullCleanup = true;
      await testInfo._runAsStage({
        title: 'Worker Cleanup',
        stepInfo: {
          category: 'hook'
        }
      }, async () => {
        let firstWorkerCleanupError;

        // Give it more time for the full cleanup.
        const teardownSlot = {
          timeout: this._project.project.timeout,
          elapsed: 0
        };
        try {
          // Attribute to 'test' so that users understand they should probably increate the test timeout to fix this issue.
          await this._fixtureRunner.teardownScope('test', testInfo, {
            type: 'test',
            slot: teardownSlot
          });
        } catch (error) {
          var _firstWorkerCleanupEr;
          firstWorkerCleanupError = (_firstWorkerCleanupEr = firstWorkerCleanupError) !== null && _firstWorkerCleanupEr !== void 0 ? _firstWorkerCleanupEr : error;
        }
        for (const suite of reversedSuites) {
          try {
            await this._runAfterAllHooksForSuite(suite, testInfo);
          } catch (error) {
            var _firstWorkerCleanupEr2;
            firstWorkerCleanupError = (_firstWorkerCleanupEr2 = firstWorkerCleanupError) !== null && _firstWorkerCleanupEr2 !== void 0 ? _firstWorkerCleanupEr2 : error;
          }
        }
        try {
          // Attribute to 'teardown' because worker fixtures are not perceived as a part of a test.
          await this._fixtureRunner.teardownScope('worker', testInfo, {
            type: 'teardown',
            slot: teardownSlot
          });
        } catch (error) {
          var _firstWorkerCleanupEr3;
          firstWorkerCleanupError = (_firstWorkerCleanupEr3 = firstWorkerCleanupError) !== null && _firstWorkerCleanupEr3 !== void 0 ? _firstWorkerCleanupEr3 : error;
        }
        if (firstWorkerCleanupError) throw firstWorkerCleanupError;
      }).catch(() => {}); // Ignore the top-level error, it is already inside TestInfo.errors.
    }
    await testInfo._runAsStage({
      title: 'stop tracing',
      runnable: {
        type: 'test',
        slot: tracingSlot
      }
    }, async () => {
      var _testLifecycleInstrum5, _testLifecycleInstrum6;
      await ((_testLifecycleInstrum5 = (0, _globals.testLifecycleInstrumentation)()) === null || _testLifecycleInstrum5 === void 0 || (_testLifecycleInstrum6 = _testLifecycleInstrum5.onTestEnd) === null || _testLifecycleInstrum6 === void 0 ? void 0 : _testLifecycleInstrum6.call(_testLifecycleInstrum5));
      await testInfo._tracing.stopIfNeeded();
    }).catch(() => {}); // Ignore the top-level error, it is already inside TestInfo.errors.

    testInfo.duration = testInfo._timeoutManager.defaultSlot().elapsed + afterHooksSlot.elapsed | 0;
    this._currentTest = null;
    (0, _globals.setCurrentTestInfo)(null);
    this.dispatchEvent('testEnd', buildTestEndPayload(testInfo));
    const preserveOutput = this._config.config.preserveOutput === 'always' || this._config.config.preserveOutput === 'failures-only' && testInfo._isFailure();
    if (!preserveOutput) await (0, _utils.removeFolders)([testInfo.outputDir]);
  }
  _collectHooksAndModifiers(suite, type, testInfo) {
    const runnables = [];
    for (const modifier of suite._modifiers) {
      const modifierType = this._fixtureRunner.dependsOnWorkerFixturesOnly(modifier.fn, modifier.location) ? 'beforeAll' : 'beforeEach';
      if (modifierType !== type) continue;
      const fn = async fixtures => {
        const result = await modifier.fn(fixtures);
        testInfo[modifier.type](!!result, modifier.description);
      };
      (0, _fixtures.inheritFixtureNames)(modifier.fn, fn);
      runnables.push({
        title: `${modifier.type} modifier`,
        location: modifier.location,
        type: modifier.type,
        fn
      });
    }
    // Modifiers first, then hooks.
    runnables.push(...suite._hooks.filter(hook => hook.type === type));
    return runnables;
  }
  async _runBeforeAllHooksForSuite(suite, testInfo) {
    if (this._activeSuites.has(suite)) return;
    const extraAnnotations = [];
    this._activeSuites.set(suite, extraAnnotations);
    await this._runAllHooksForSuite(suite, testInfo, 'beforeAll', extraAnnotations);
  }
  async _runAllHooksForSuite(suite, testInfo, type, extraAnnotations) {
    // Always run all the hooks, and capture the first error.
    let firstError;
    for (const hook of this._collectHooksAndModifiers(suite, type, testInfo)) {
      try {
        await testInfo._runAsStage({
          title: hook.title,
          stepInfo: {
            category: 'hook',
            location: hook.location
          }
        }, async () => {
          // Separate time slot for each beforeAll/afterAll hook.
          const timeSlot = {
            timeout: this._project.project.timeout,
            elapsed: 0
          };
          const runnable = {
            type: hook.type,
            slot: timeSlot,
            location: hook.location
          };
          const existingAnnotations = new Set(testInfo.annotations);
          try {
            await this._fixtureRunner.resolveParametersAndRunFunction(hook.fn, testInfo, 'all-hooks-only', runnable);
          } finally {
            if (extraAnnotations) {
              // Inherit all annotations defined in the beforeAll/modifer to all tests in the suite.
              const newAnnotations = testInfo.annotations.filter(a => !existingAnnotations.has(a));
              extraAnnotations.push(...newAnnotations);
            }
            // Each beforeAll/afterAll hook has its own scope for test fixtures. Attribute to the same runnable and timeSlot.
            // Note: we must teardown even after hook fails, because we'll run more hooks.
            await this._fixtureRunner.teardownScope('test', testInfo, runnable);
          }
        });
      } catch (error) {
        var _firstError;
        firstError = (_firstError = firstError) !== null && _firstError !== void 0 ? _firstError : error;
        // Skip in beforeAll/modifier prevents others from running.
        if (type === 'beforeAll' && error instanceof _testInfo.SkipError) break;
        if (type === 'beforeAll' && !this._skipRemainingTestsInSuite) {
          // This will inform dispatcher that we should not run more tests from this group
          // because we had a beforeAll error.
          // This behavior avoids getting the same common error for each test.
          this._skipRemainingTestsInSuite = suite;
        }
      }
    }
    if (firstError) throw firstError;
  }
  async _runAfterAllHooksForSuite(suite, testInfo) {
    if (!this._activeSuites.has(suite)) return;
    this._activeSuites.delete(suite);
    await this._runAllHooksForSuite(suite, testInfo, 'afterAll');
  }
  async _runEachHooksForSuites(suites, type, testInfo, slot) {
    // Always run all the hooks, unless one of the times out, and capture the first error.
    let firstError;
    const hooks = suites.map(suite => this._collectHooksAndModifiers(suite, type, testInfo)).flat();
    for (const hook of hooks) {
      try {
        await testInfo._runAsStage({
          title: hook.title,
          stepInfo: {
            category: 'hook',
            location: hook.location
          }
        }, async () => {
          const runnable = {
            type: hook.type,
            location: hook.location,
            slot
          };
          await this._fixtureRunner.resolveParametersAndRunFunction(hook.fn, testInfo, 'test', runnable);
        });
      } catch (error) {
        var _firstError2;
        if (error instanceof _timeoutManager.TimeoutManagerError) throw error;
        firstError = (_firstError2 = firstError) !== null && _firstError2 !== void 0 ? _firstError2 : error;
        // Skip in modifier prevents others from running.
        if (error instanceof _testInfo.SkipError) break;
      }
    }
    if (firstError) throw firstError;
  }
}
exports.WorkerMain = WorkerMain;
function buildTestBeginPayload(testInfo) {
  return {
    testId: testInfo.testId,
    startWallTime: testInfo._startWallTime
  };
}
function buildTestEndPayload(testInfo) {
  return {
    testId: testInfo.testId,
    duration: testInfo.duration,
    status: testInfo.status,
    errors: testInfo.errors,
    hasNonRetriableError: testInfo._hasNonRetriableError,
    expectedStatus: testInfo.expectedStatus,
    annotations: testInfo.annotations,
    timeout: testInfo.timeout
  };
}
function getSuites(test) {
  const suites = [];
  for (let suite = test === null || test === void 0 ? void 0 : test.parent; suite; suite = suite.parent) suites.push(suite);
  suites.reverse(); // Put root suite first.
  return suites;
}
function formatTestTitle(test, projectName) {
  // file, ...describes, test
  const [, ...titles] = test.titlePath();
  const location = `${(0, _util.relativeFilePath)(test.location.file)}:${test.location.line}:${test.location.column}`;
  const projectTitle = projectName ? `[${projectName}] › ` : '';
  return `${projectTitle}${location} › ${titles.join(' › ')}`;
}
function calculateMaxTimeout(t1, t2) {
  // Zero means "no timeout".
  return !t1 || !t2 ? 0 : Math.max(t1, t2);
}
const create = params => new WorkerMain(params);
exports.create = create;