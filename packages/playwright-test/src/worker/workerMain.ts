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

import { colors, rimraf } from 'playwright-core/lib/utilsBundle';
import util from 'util';
import { debugTest, formatLocation, relativeFilePath, serializeError } from '../util';
import type { TestBeginPayload, TestEndPayload, RunPayload, DonePayload, WorkerInitParams, TeardownErrorsPayload, TestOutputPayload } from '../common/ipc';
import { setCurrentTestInfo, setIsWorkerProcess } from '../common/globals';
import { ConfigLoader } from '../common/configLoader';
import type { Suite, TestCase } from '../common/test';
import type { Annotation, FullConfigInternal, FullProjectInternal, TestInfoError } from '../common/types';
import { FixtureRunner } from './fixtureRunner';
import { ManualPromise } from 'playwright-core/lib/utils';
import { TestInfoImpl } from './testInfo';
import { TimeoutManager, type TimeSlot } from './timeoutManager';
import { ProcessRunner } from '../common/process';
import { loadTestFile } from '../common/testLoader';
import { buildFileSuiteForProject, filterTestsRemoveEmptySuites } from '../common/suiteUtils';
import { PoolBuilder } from '../common/poolBuilder';
import { addToCompilationCache } from '../common/compilationCache';

const removeFolderAsync = util.promisify(rimraf);

export class WorkerMain extends ProcessRunner {
  private _params: WorkerInitParams;
  private _config!: FullConfigInternal;
  private _project!: FullProjectInternal;
  private _poolBuilder!: PoolBuilder;
  private _fixtureRunner: FixtureRunner;

  // Accumulated fatal errors that cannot be attributed to a test.
  private _fatalErrors: TestInfoError[] = [];
  // Whether we should skip running remaining tests in this suite because
  // of a setup error, usually beforeAll hook.
  private _skipRemainingTestsInSuite: Suite | undefined;
  // The stage of the full cleanup. Once "finished", we can safely stop running anything.
  private _didRunFullCleanup = false;
  // Whether the worker was requested to stop.
  private _isStopped = false;
  // This promise resolves once the single "run test group" call finishes.
  private _runFinished = new ManualPromise<void>();
  private _currentTest: TestInfoImpl | null = null;
  private _lastRunningTests: TestInfoImpl[] = [];
  private _totalRunningTests = 0;
  // Dynamic annotations originated by modifiers with a callback, e.g. `test.skip(() => true)`.
  private _extraSuiteAnnotations = new Map<Suite, Annotation[]>();
  // Suites that had their beforeAll hooks, but not afterAll hooks executed.
  // These suites still need afterAll hooks to be executed for the proper cleanup.
  private _activeSuites = new Set<Suite>();

  constructor(params: WorkerInitParams) {
    super();
    process.env.TEST_WORKER_INDEX = String(params.workerIndex);
    process.env.TEST_PARALLEL_INDEX = String(params.parallelIndex);
    setIsWorkerProcess();
    addToCompilationCache(params.config.compilationCache);

    this._params = params;
    this._fixtureRunner = new FixtureRunner();

    // Resolve this promise, so worker does not stall waiting for the non-existent run to finish,
    // when it was sopped before running any test group.
    this._runFinished.resolve();

    process.on('unhandledRejection', reason => this.unhandledError(reason));
    process.on('uncaughtException', error => this.unhandledError(error));
    process.stdout.write = (chunk: string | Buffer) => {
      const outPayload: TestOutputPayload = {
        ...chunkToParams(chunk)
      };
      this.dispatchEvent('stdOut', outPayload);
      return true;
    };

    if (!process.env.PW_RUNNER_DEBUG) {
      process.stderr.write = (chunk: string | Buffer) => {
        const outPayload: TestOutputPayload = {
          ...chunkToParams(chunk)
        };
        this.dispatchEvent('stdErr', outPayload);
        return true;
      };
    }
  }

  private _stop(): Promise<void> {
    if (!this._isStopped) {
      this._isStopped = true;

      // Interrupt current action.
      this._currentTest?._timeoutManager.interrupt();

      if (this._currentTest && this._currentTest.status === 'passed')
        this._currentTest.status = 'interrupted';
    }
    return this._runFinished;
  }

  override async gracefullyClose() {
    try {
      await this._stop();
      // We have to load the project to get the right deadline below.
      await this._loadIfNeeded();
      await this._teardownScopes();
    } catch (e) {
      this._fatalErrors.push(serializeError(e));
    }

    if (this._fatalErrors.length) {
      this._appendProcessTeardownDiagnostics(this._fatalErrors[this._fatalErrors.length - 1]);
      const payload: TeardownErrorsPayload = { fatalErrors: this._fatalErrors };
      this.dispatchEvent('teardownErrors', payload);
    }
  }

  private _appendProcessTeardownDiagnostics(error: TestInfoError) {
    if (!this._lastRunningTests.length)
      return;
    const count = this._totalRunningTests === 1 ? '1 test' : `${this._totalRunningTests} tests`;
    let lastMessage = '';
    if (this._lastRunningTests.length < this._totalRunningTests)
      lastMessage = `, last ${this._lastRunningTests.length} tests were`;
    const message = [
      '',
      '',
      colors.red(`Failed worker ran ${count}${lastMessage}:`),
      ...this._lastRunningTests.map(testInfo => formatTestTitle(testInfo._test, testInfo.project.name)),
    ].join('\n');
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

  private async _teardownScopes() {
    // TODO: separate timeout for teardown?
    const timeoutManager = new TimeoutManager(this._project.timeout);
    timeoutManager.setCurrentRunnable({ type: 'teardown' });
    const timeoutError = await timeoutManager.runWithTimeout(async () => {
      await this._fixtureRunner.teardownScope('test', timeoutManager);
      await this._fixtureRunner.teardownScope('worker', timeoutManager);
    });
    if (timeoutError)
      this._fatalErrors.push(timeoutError);
  }

  unhandledError(error: Error | any) {
    // Usually, we do not differentiate between errors in the control flow
    // and unhandled errors - both lead to the test failing. This is good for regular tests,
    // so that you can, e.g. expect() from inside an event handler. The test fails,
    // and we restart the worker.
    //
    // However, for tests marked with test.fail(), this is a problem. Unhandled error
    // could come either from the user test code (legit failure), or from a fixture or
    // a test runner. In the latter case, the worker state could be messed up,
    // and continuing to run tests in the same worker is problematic. Therefore,
    // we turn this into a fatal error and restart the worker anyway.
    // The only exception is the expect() error that we still consider ok.
    const isExpectError = (error instanceof Error) && !!(error as any).matcherResult;
    const isCurrentTestExpectedToFail = this._currentTest?.expectedStatus === 'failed';
    const shouldConsiderAsTestError = isExpectError || !isCurrentTestExpectedToFail;
    if (this._currentTest && shouldConsiderAsTestError) {
      this._currentTest._failWithError(serializeError(error), true /* isHardError */);
    } else {
      // No current test - fatal error.
      if (!this._fatalErrors.length)
        this._fatalErrors.push(serializeError(error));
    }
    this._stop();
  }

  private async _loadIfNeeded() {
    if (this._config)
      return;

    const configLoader = await ConfigLoader.deserialize(this._params.config);
    this._config = configLoader.fullConfig();
    this._project = this._config.projects.find(p => p._internal.id === this._params.projectId)!;
    this._poolBuilder = PoolBuilder.createForWorker(this._project);
  }

  async runTestGroup(runPayload: RunPayload) {
    this._runFinished = new ManualPromise<void>();
    const entries = new Map(runPayload.entries.map(e => [e.testId, e]));
    let fatalUnknownTestIds;
    try {
      await this._loadIfNeeded();
      const fileSuite = await loadTestFile(runPayload.file, this._config.rootDir);
      const suite = buildFileSuiteForProject(this._project, fileSuite, this._params.repeatEachIndex);
      const hasEntries = filterTestsRemoveEmptySuites(suite, test => entries.has(test.id));
      if (hasEntries) {
        this._poolBuilder.buildPools(suite);
        this._extraSuiteAnnotations = new Map();
        this._activeSuites = new Set();
        this._didRunFullCleanup = false;
        const tests = suite.allTests();
        for (let i = 0; i < tests.length; i++) {
          // Do not run tests after full cleanup, because we are entirely done.
          if (this._isStopped && this._didRunFullCleanup)
            break;
          const entry = entries.get(tests[i].id)!;
          entries.delete(tests[i].id);
          debugTest(`test started "${tests[i].title}"`);
          await this._runTest(tests[i], entry.retry, tests[i + 1]);
          debugTest(`test finished "${tests[i].title}"`);
        }
      } else {
        fatalUnknownTestIds = runPayload.entries.map(e => e.testId);
        this._stop();
      }
    } catch (e) {
      // In theory, we should run above code without any errors.
      // However, in the case we screwed up, or loadTestFile failed in the worker
      // but not in the runner, let's do a fatal error.
      this._fatalErrors.push(serializeError(e));
      this._stop();
    } finally {
      const donePayload: DonePayload = {
        fatalErrors: this._fatalErrors,
        skipTestsDueToSetupFailure: [],
        fatalUnknownTestIds
      };
      for (const test of this._skipRemainingTestsInSuite?.allTests() || []) {
        if (entries.has(test.id))
          donePayload.skipTestsDueToSetupFailure.push(test.id);
      }
      this.dispatchEvent('done', donePayload);
      this._fatalErrors = [];
      this._skipRemainingTestsInSuite = undefined;
      this._runFinished.resolve();
    }
  }

  private async _runTest(test: TestCase, retry: number, nextTest: TestCase | undefined) {
    const testInfo = new TestInfoImpl(this._config, this._project, this._params, test, retry,
        stepBeginPayload => this.dispatchEvent('stepBegin', stepBeginPayload),
        stepEndPayload => this.dispatchEvent('stepEnd', stepEndPayload));

    const processAnnotation = (annotation: Annotation) => {
      testInfo.annotations.push(annotation);
      switch (annotation.type) {
        case 'fixme':
        case 'skip':
          testInfo.expectedStatus = 'skipped';
          break;
        case 'fail':
          if (testInfo.expectedStatus !== 'skipped')
            testInfo.expectedStatus = 'failed';
          break;
        case 'slow':
          testInfo.slow();
          break;
      }
    };

    if (!this._isStopped)
      this._fixtureRunner.setPool(test._pool!);

    const suites = getSuites(test);
    const reversedSuites = suites.slice().reverse();
    const nextSuites = new Set(getSuites(nextTest));

    testInfo._timeoutManager.setTimeout(test.timeout);
    for (const annotation of test._staticAnnotations)
      processAnnotation(annotation);

    // Process existing annotations dynamically set for parent suites.
    for (const suite of suites) {
      const extraAnnotations = this._extraSuiteAnnotations.get(suite) || [];
      for (const annotation of extraAnnotations)
        processAnnotation(annotation);
    }

    this._currentTest = testInfo;
    setCurrentTestInfo(testInfo);
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
    this._lastRunningTests.push(testInfo);
    if (this._lastRunningTests.length > 10)
      this._lastRunningTests.shift();
    let didFailBeforeAllForSuite: Suite | undefined;
    let shouldRunAfterEachHooks = false;

    await testInfo._runWithTimeout(async () => {
      if (this._isStopped || isSkipped) {
        // Two reasons to get here:
        // - Last test is skipped, so we should not run the test, but run the cleanup.
        // - Worker is requested to stop, but was not able to run full cleanup yet.
        //   We should skip the test, but run the cleanup.
        testInfo.status = 'skipped';
        didFailBeforeAllForSuite = undefined;
        return;
      }

      const beforeHooksStep = testInfo._addStep({
        category: 'hook',
        title: 'Before Hooks',
        canHaveChildren: true,
        forceNoParent: true,
        wallTime: Date.now(),
      });

      // Note: wrap all preparation steps together, because failure/skip in any of them
      // prevents further setup and/or test from running.
      const maybeError = await testInfo._runFn(async () => {
        // Run "beforeAll" modifiers on parent suites, unless already run during previous tests.
        for (const suite of suites) {
          if (this._extraSuiteAnnotations.has(suite))
            continue;
          const extraAnnotations: Annotation[] = [];
          this._extraSuiteAnnotations.set(suite, extraAnnotations);
          didFailBeforeAllForSuite = suite;  // Assume failure, unless reset below.
          // Separate timeout for each "beforeAll" modifier.
          const timeSlot = { timeout: this._project.timeout, elapsed: 0 };
          await this._runModifiersForSuite(suite, testInfo, 'worker', timeSlot, extraAnnotations);
        }

        // Run "beforeAll" hooks, unless already run during previous tests.
        for (const suite of suites) {
          didFailBeforeAllForSuite = suite;  // Assume failure, unless reset below.
          await this._runBeforeAllHooksForSuite(suite, testInfo);
        }

        // Running "beforeAll" succeeded for all suites!
        didFailBeforeAllForSuite = undefined;

        // Run "beforeEach" modifiers.
        for (const suite of suites)
          await this._runModifiersForSuite(suite, testInfo, 'test', undefined);

        // Run "beforeEach" hooks. Once started with "beforeEach", we must run all "afterEach" hooks as well.
        shouldRunAfterEachHooks = true;
        await this._runEachHooksForSuites(suites, 'beforeEach', testInfo, undefined);

        // Setup fixtures required by the test.
        testInfo._timeoutManager.setCurrentRunnable({ type: 'test' });
        const params = await this._fixtureRunner.resolveParametersForFunction(test.fn, testInfo, 'test');
        beforeHooksStep.complete({}); // Report fixture hooks step as completed.
        if (params === null) {
          // Fixture setup failed, we should not run the test now.
          return;
        }

        // Now run the test itself.
        debugTest(`test function started`);
        const fn = test.fn; // Extract a variable to get a better stack trace ("myTest" vs "TestCase.myTest [as fn]").
        await fn(params, testInfo);
        debugTest(`test function finished`);
      }, 'allowSkips');

      beforeHooksStep.complete({ error: maybeError }); // Second complete is a no-op.
    });

    if (didFailBeforeAllForSuite) {
      // This will inform dispatcher that we should not run more tests from this group
      // because we had a beforeAll error.
      // This behavior avoids getting the same common error for each test.
      this._skipRemainingTestsInSuite = didFailBeforeAllForSuite;
    }

    const afterHooksStep = testInfo._addStep({
      category: 'hook',
      title: 'After Hooks',
      canHaveChildren: true,
      forceNoParent: true,
      wallTime: Date.now(),
    });
    let firstAfterHooksError: TestInfoError | undefined;

    let afterHooksSlot: TimeSlot | undefined;
    if (testInfo._didTimeout) {
      // A timed-out test gets a full additional timeout to run after hooks.
      afterHooksSlot = { timeout: this._project.timeout, elapsed: 0 };
      testInfo._timeoutManager.setCurrentRunnable({ type: 'afterEach', slot: afterHooksSlot });
    }
    await testInfo._runWithTimeout(async () => {
      // Note: do not wrap all teardown steps together, because failure in any of them
      // does not prevent further teardown steps from running.

      // Run "immediately upon test failure" callbacks.
      if (testInfo._isFailure()) {
        const onFailureError = await testInfo._runFn(async () => {
          testInfo._timeoutManager.setCurrentRunnable({ type: 'test', slot: afterHooksSlot });
          for (const [fn, title] of testInfo._onTestFailureImmediateCallbacks) {
            debugTest(`on-failure callback started`);
            await testInfo._runAsStep(fn, {
              category: 'hook',
              title,
              canHaveChildren: true,
              forceNoParent: false,
            });
            debugTest(`on-failure callback finished`);
          }
        });
        firstAfterHooksError = firstAfterHooksError || onFailureError;
      }

      // Run "afterEach" hooks, unless we failed at beforeAll stage.
      if (shouldRunAfterEachHooks) {
        const afterEachError = await testInfo._runFn(() => this._runEachHooksForSuites(reversedSuites, 'afterEach', testInfo, afterHooksSlot));
        firstAfterHooksError = firstAfterHooksError || afterEachError;
      }

      // Run "afterAll" hooks for suites that are not shared with the next test.
      // In case of failure the worker will be stopped and we have to make sure that afterAll
      // hooks run before test fixtures teardown.
      for (const suite of reversedSuites) {
        if (!nextSuites.has(suite) || testInfo._isFailure()) {
          const afterAllError = await this._runAfterAllHooksForSuite(suite, testInfo);
          firstAfterHooksError = firstAfterHooksError || afterAllError;
        }
      }

      // Teardown test-scoped fixtures. Attribute to 'test' so that users understand
      // they should probably increate the test timeout to fix this issue.
      testInfo._timeoutManager.setCurrentRunnable({ type: 'test', slot: afterHooksSlot });
      debugTest(`tearing down test scope started`);
      const testScopeError = await testInfo._runFn(() => this._fixtureRunner.teardownScope('test', testInfo._timeoutManager));
      debugTest(`tearing down test scope finished`);
      firstAfterHooksError = firstAfterHooksError || testScopeError;
    });

    if (testInfo._isFailure())
      this._isStopped = true;

    if (this._isStopped) {
      // Run all remaining "afterAll" hooks and teardown all fixtures when worker is shutting down.
      // Mark as "cleaned up" early to avoid running cleanup twice.
      this._didRunFullCleanup = true;

      // Give it more time for the full cleanup.
      await testInfo._runWithTimeout(async () => {
        debugTest(`running full cleanup after the failure`);
        for (const suite of reversedSuites) {
          const afterAllError = await this._runAfterAllHooksForSuite(suite, testInfo);
          firstAfterHooksError = firstAfterHooksError || afterAllError;
        }
        const teardownSlot = { timeout: this._project.timeout, elapsed: 0 };
        // Attribute to 'test' so that users understand they should probably increate the test timeout to fix this issue.
        testInfo._timeoutManager.setCurrentRunnable({ type: 'test', slot: teardownSlot });
        debugTest(`tearing down test scope started`);
        const testScopeError = await testInfo._runFn(() => this._fixtureRunner.teardownScope('test', testInfo._timeoutManager));
        debugTest(`tearing down test scope finished`);
        firstAfterHooksError = firstAfterHooksError || testScopeError;
        // Attribute to 'teardown' because worker fixtures are not perceived as a part of a test.
        testInfo._timeoutManager.setCurrentRunnable({ type: 'teardown', slot: teardownSlot });
        debugTest(`tearing down worker scope started`);
        const workerScopeError = await testInfo._runFn(() => this._fixtureRunner.teardownScope('worker', testInfo._timeoutManager));
        debugTest(`tearing down worker scope finished`);
        firstAfterHooksError = firstAfterHooksError || workerScopeError;
      });
    }

    afterHooksStep.complete({ error: firstAfterHooksError });
    this._currentTest = null;
    setCurrentTestInfo(null);
    this.dispatchEvent('testEnd', buildTestEndPayload(testInfo));

    const preserveOutput = this._config.preserveOutput === 'always' ||
      (this._config.preserveOutput === 'failures-only' && testInfo._isFailure());
    if (!preserveOutput)
      await removeFolderAsync(testInfo.outputDir).catch(e => {});
  }

  private async _runModifiersForSuite(suite: Suite, testInfo: TestInfoImpl, scope: 'worker' | 'test', timeSlot: TimeSlot | undefined, extraAnnotations?: Annotation[]) {
    for (const modifier of suite._modifiers) {
      const actualScope = this._fixtureRunner.dependsOnWorkerFixturesOnly(modifier.fn, modifier.location) ? 'worker' : 'test';
      if (actualScope !== scope)
        continue;
      debugTest(`modifier at "${formatLocation(modifier.location)}" started`);
      testInfo._timeoutManager.setCurrentRunnable({ type: modifier.type, location: modifier.location, slot: timeSlot });
      const result = await testInfo._runAsStep(() => this._fixtureRunner.resolveParametersAndRunFunction(modifier.fn, testInfo, scope), {
        category: 'hook',
        title: `${modifier.type} modifier`,
        canHaveChildren: true,
        forceNoParent: false,
        location: modifier.location,
      });
      debugTest(`modifier at "${formatLocation(modifier.location)}" finished`);
      if (result && extraAnnotations)
        extraAnnotations.push({ type: modifier.type, description: modifier.description });
      testInfo[modifier.type](!!result, modifier.description);
    }
  }

  private async _runBeforeAllHooksForSuite(suite: Suite, testInfo: TestInfoImpl) {
    if (this._activeSuites.has(suite))
      return;
    this._activeSuites.add(suite);
    let beforeAllError: Error | undefined;
    for (const hook of suite._hooks) {
      if (hook.type !== 'beforeAll')
        continue;
      debugTest(`${hook.type} hook at "${formatLocation(hook.location)}" started`);
      try {
        // Separate time slot for each "beforeAll" hook.
        const timeSlot = { timeout: this._project.timeout, elapsed: 0 };
        testInfo._timeoutManager.setCurrentRunnable({ type: 'beforeAll', location: hook.location, slot: timeSlot });
        await testInfo._runAsStep(() => this._fixtureRunner.resolveParametersAndRunFunction(hook.fn, testInfo, 'all-hooks-only'), {
          category: 'hook',
          title: `${hook.type} hook`,
          canHaveChildren: true,
          forceNoParent: false,
          location: hook.location,
        });
      } catch (e) {
        // Always run all the hooks, and capture the first error.
        beforeAllError = beforeAllError || e;
      }
      debugTest(`${hook.type} hook at "${formatLocation(hook.location)}" finished`);
    }
    if (beforeAllError)
      throw beforeAllError;
  }

  private async _runAfterAllHooksForSuite(suite: Suite, testInfo: TestInfoImpl) {
    if (!this._activeSuites.has(suite))
      return;
    this._activeSuites.delete(suite);
    let firstError: TestInfoError | undefined;
    for (const hook of suite._hooks) {
      if (hook.type !== 'afterAll')
        continue;
      debugTest(`${hook.type} hook at "${formatLocation(hook.location)}" started`);
      const afterAllError = await testInfo._runFn(async () => {
        // Separate time slot for each "afterAll" hook.
        const timeSlot = { timeout: this._project.timeout, elapsed: 0 };
        testInfo._timeoutManager.setCurrentRunnable({ type: 'afterAll', location: hook.location, slot: timeSlot });
        await testInfo._runAsStep(() => this._fixtureRunner.resolveParametersAndRunFunction(hook.fn, testInfo, 'all-hooks-only'), {
          category: 'hook',
          title: `${hook.type} hook`,
          canHaveChildren: true,
          forceNoParent: false,
          location: hook.location,
        });
      });
      firstError = firstError || afterAllError;
      debugTest(`${hook.type} hook at "${formatLocation(hook.location)}" finished`);
    }
    return firstError;
  }

  private async _runEachHooksForSuites(suites: Suite[], type: 'beforeEach' | 'afterEach', testInfo: TestInfoImpl, timeSlot: TimeSlot | undefined) {
    const hooks = suites.map(suite => suite._hooks.filter(hook => hook.type === type)).flat();
    let error: Error | undefined;
    for (const hook of hooks) {
      try {
        testInfo._timeoutManager.setCurrentRunnable({ type, location: hook.location, slot: timeSlot });
        await testInfo._runAsStep(() => this._fixtureRunner.resolveParametersAndRunFunction(hook.fn, testInfo, 'test'), {
          category: 'hook',
          title: `${hook.type} hook`,
          canHaveChildren: true,
          forceNoParent: false,
          location: hook.location,
        });
      } catch (e) {
        // Always run all the hooks, and capture the first error.
        error = error || e;
      }
    }
    if (error)
      throw error;
  }
}

function buildTestBeginPayload(testInfo: TestInfoImpl): TestBeginPayload {
  return {
    testId: testInfo._test.id,
    startWallTime: testInfo._startWallTime,
  };
}

function buildTestEndPayload(testInfo: TestInfoImpl): TestEndPayload {
  return {
    testId: testInfo._test.id,
    duration: testInfo.duration,
    status: testInfo.status!,
    errors: testInfo.errors,
    expectedStatus: testInfo.expectedStatus,
    annotations: testInfo.annotations,
    timeout: testInfo.timeout,
    attachments: testInfo.attachments.map(a => ({
      name: a.name,
      contentType: a.contentType,
      path: a.path,
      body: a.body?.toString('base64')
    }))
  };
}

function getSuites(test: TestCase | undefined): Suite[] {
  const suites: Suite[] = [];
  for (let suite: Suite | undefined = test?.parent; suite; suite = suite.parent)
    suites.push(suite);
  suites.reverse();  // Put root suite first.
  return suites;
}

function formatTestTitle(test: TestCase, projectName: string) {
  // file, ...describes, test
  const [, ...titles] = test.titlePath();
  const location = `${relativeFilePath(test.location.file)}:${test.location.line}:${test.location.column}`;
  const projectTitle = projectName ? `[${projectName}] › ` : '';
  return `${projectTitle}${location} › ${titles.join(' › ')}`;
}

function chunkToParams(chunk: Buffer | string):  { text?: string, buffer?: string } {
  if (chunk instanceof Buffer)
    return { buffer: chunk.toString('base64') };
  if (typeof chunk !== 'string')
    return { text: util.inspect(chunk) };
  return { text: chunk };
}

export const create = (params: WorkerInitParams) => new WorkerMain(params);
