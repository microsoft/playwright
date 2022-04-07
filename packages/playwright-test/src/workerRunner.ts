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

import colors from 'colors/safe';
import rimraf from 'rimraf';
import util from 'util';
import { EventEmitter } from 'events';
import { relativeFilePath, serializeError } from './util';
import type { TestBeginPayload, TestEndPayload, RunPayload, DonePayload, WorkerInitParams, StepBeginPayload, StepEndPayload, TeardownErrorsPayload } from './ipc';
import { setCurrentTestInfo } from './globals';
import { Loader } from './loader';
import type { Suite, TestCase } from './test';
import type { Annotation, TestError, TestStepInternal } from './types';
import type { ProjectImpl } from './project';
import { FixtureRunner } from './fixtures';
import { ManualPromise } from 'playwright-core/lib/utils';
import { TestInfoImpl } from './testInfo';
import type { TimeSlot } from './timeoutManager';
import { TimeoutManager } from './timeoutManager';

const removeFolderAsync = util.promisify(rimraf);

export class WorkerRunner extends EventEmitter {
  private _params: WorkerInitParams;
  private _loader!: Loader;
  private _project!: ProjectImpl;
  private _fixtureRunner: FixtureRunner;

  // Accumulated fatal errors that cannot be attributed to a test.
  private _fatalErrors: TestError[] = [];
  // Whether we should skip running remaining tests in this suite because
  // of a setup error, usually beforeAll hook.
  private _skipRemainingTestsInSuite: Suite | undefined;
  // The stage of the full cleanup. Once "finished", we can safely stop running anything.
  private _didRunFullCleanup = false;
  // Whether the worker was requested to stop.
  private _isStopped = false;
  // This promise resolves once the single "run test group" call finishes.
  private _runFinished = new ManualPromise<void>();
  _currentTest: TestInfoImpl | null = null;
  private _lastRunningTests: TestInfoImpl[] = [];
  private _totalRunningTests = 0;
  // Dynamic annotations originated by modifiers with a callback, e.g. `test.skip(() => true)`.
  private _extraSuiteAnnotations = new Map<Suite, Annotation[]>();
  // Suites that had their beforeAll hooks, but not afterAll hooks executed.
  // These suites still need afterAll hooks to be executed for the proper cleanup.
  private _activeSuites = new Set<Suite>();

  constructor(params: WorkerInitParams) {
    super();
    this._params = params;
    this._fixtureRunner = new FixtureRunner();

    // Resolve this promise, so worker does not stall waiting for the non-existent run to finish,
    // when it was sopped before running any test group.
    this._runFinished.resolve();
  }

  stop(): Promise<void> {
    if (!this._isStopped) {
      this._isStopped = true;

      // Interrupt current action.
      this._currentTest?._timeoutManager.interrupt();

      // TODO: mark test as 'interrupted' instead.
      if (this._currentTest && this._currentTest.status === 'passed')
        this._currentTest.status = 'skipped';
    }
    return this._runFinished;
  }

  async cleanup() {
    // We have to load the project to get the right deadline below.
    await this._loadIfNeeded();
    await this._teardownScopes();
    if (this._fatalErrors.length) {
      const diagnostics = this._createWorkerTeardownDiagnostics();
      if (diagnostics)
        this._fatalErrors.unshift(diagnostics);
      const payload: TeardownErrorsPayload = { fatalErrors: this._fatalErrors };
      this.emit('teardownErrors', payload);
    }
  }

  private _createWorkerTeardownDiagnostics(): TestError | undefined {
    if (!this._lastRunningTests.length)
      return;
    const count = this._totalRunningTests === 1 ? '1 test' : `${this._totalRunningTests} tests`;
    let lastMessage = '';
    if (this._lastRunningTests.length < this._totalRunningTests)
      lastMessage = `, last ${this._lastRunningTests.length} tests were`;
    const message = [
      colors.red(`Worker teardown error. This worker ran ${count}${lastMessage}:`),
      ...this._lastRunningTests.map(testInfo => formatTestTitle(testInfo._test, testInfo.project.name)),
    ].join('\n');
    return { message };
  }

  private async _teardownScopes() {
    // TODO: separate timeout for teardown?
    const timeoutManager = new TimeoutManager(this._project.config.timeout);
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
    this.stop();
  }

  private async _loadIfNeeded() {
    if (this._loader)
      return;

    this._loader = await Loader.deserialize(this._params.loader);
    this._project = this._loader.projects()[this._params.projectIndex];
  }

  async runTestGroup(runPayload: RunPayload) {
    this._runFinished = new ManualPromise<void>();
    const entries = new Map(runPayload.entries.map(e => [ e.testId, e ]));
    try {
      await this._loadIfNeeded();
      const fileSuite = await this._loader.loadTestFile(runPayload.file, 'worker');
      const suite = this._project.cloneFileSuite(fileSuite, this._params.repeatEachIndex, test => {
        if (!entries.has(test._id))
          return false;
        return true;
      });
      if (suite) {
        this._extraSuiteAnnotations = new Map();
        this._activeSuites = new Set();
        this._didRunFullCleanup = false;
        const tests = suite.allTests().filter(test => entries.has(test._id));
        for (let i = 0; i < tests.length; i++) {
          // Do not run tests after full cleanup, because we are entirely done.
          if (this._isStopped && this._didRunFullCleanup)
            break;
          const entry = entries.get(tests[i]._id)!;
          entries.delete(tests[i]._id);
          await this._runTest(tests[i], entry.retry, tests[i + 1]);
        }
      }
    } catch (e) {
      // In theory, we should run above code without any errors.
      // However, in the case we screwed up, or loadTestFile failed in the worker
      // but not in the runner, let's do a fatal error.
      this.unhandledError(e);
    } finally {
      const donePayload: DonePayload = {
        fatalErrors: this._fatalErrors,
        skipTestsDueToSetupFailure: [],
      };
      for (const test of this._skipRemainingTestsInSuite?.allTests() || []) {
        if (entries.has(test._id))
          donePayload.skipTestsDueToSetupFailure.push(test._id);
      }
      this.emit('done', donePayload);
      this._fatalErrors = [];
      this._skipRemainingTestsInSuite = undefined;
      this._runFinished.resolve();
    }
  }

  private async _runTest(test: TestCase, retry: number, nextTest: TestCase | undefined) {
    let lastStepId = 0;
    const testInfo = new TestInfoImpl(this._loader, this._params, test, retry, data => {
      const stepId = `${data.category}@${data.title}@${++lastStepId}`;
      let callbackHandled = false;
      const step: TestStepInternal = {
        ...data,
        complete: result => {
          if (callbackHandled)
            return;
          callbackHandled = true;
          const error = result.error instanceof Error ? serializeError(result.error) : result.error;
          const payload: StepEndPayload = {
            testId: test._id,
            refinedTitle: step.refinedTitle,
            stepId,
            wallTime: Date.now(),
            error,
          };
          this.emit('stepEnd', payload);
        }
      };
      const hasLocation = data.location && !data.location.file.includes('@playwright');
      // Sanitize location that comes from user land, it might have extra properties.
      const location = data.location && hasLocation ? { file: data.location.file, line: data.location.line, column: data.location.column } : undefined;
      const payload: StepBeginPayload = {
        testId: test._id,
        stepId,
        ...data,
        location,
        wallTime: Date.now(),
      };
      this.emit('stepBegin', payload);
      return step;
    });

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

    if (!this._isStopped) {
      // Update the fixture pool - it may differ between tests, but only in test-scoped fixtures.
      this._fixtureRunner.setPool(test._pool!);
    }

    const suites = getSuites(test);
    const reversedSuites = suites.slice().reverse();

    // Inherit test.setTimeout() from parent suites, deepest has the priority.
    for (const suite of reversedSuites) {
      if (suite._timeout !== undefined) {
        testInfo._timeoutManager.setTimeout(suite._timeout);
        break;
      }
    }

    // Process existing annotations defined on parent suites.
    for (const suite of suites) {
      for (const annotation of suite._annotations)
        processAnnotation(annotation);
      const extraAnnotations = this._extraSuiteAnnotations.get(suite) || [];
      for (const annotation of extraAnnotations)
        processAnnotation(annotation);
    }

    this._currentTest = testInfo;
    setCurrentTestInfo(testInfo);
    this.emit('testBegin', buildTestBeginPayload(testInfo));

    if (testInfo.expectedStatus === 'skipped') {
      testInfo.status = 'skipped';
      this.emit('testEnd', buildTestEndPayload(testInfo));
      return;
    }

    this._totalRunningTests++;
    this._lastRunningTests.push(testInfo);
    if (this._lastRunningTests.length > 10)
      this._lastRunningTests.shift();
    let didFailBeforeAllForSuite: Suite | undefined;
    let shouldRunAfterEachHooks = false;

    await testInfo._runWithTimeout(async () => {
      if (this._isStopped) {
        // Getting here means that worker is requested to stop, but was not able to
        // run full cleanup yet. Skip the test, but run the cleanup.
        testInfo.status = 'skipped';
        didFailBeforeAllForSuite = undefined;
        return;
      }

      const beforeHooksStep = testInfo._addStep({
        category: 'hook',
        title: 'Before Hooks',
        canHaveChildren: true,
        forceNoParent: true
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
          const timeSlot = { timeout: this._project.config.timeout, elapsed: 0 };
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
        const params = await this._fixtureRunner.resolveParametersForFunction(test.fn, testInfo);
        beforeHooksStep.complete({}); // Report fixture hooks step as completed.

        // Now run the test itself.
        const fn = test.fn; // Extract a variable to get a better stack trace ("myTest" vs "TestCase.myTest [as fn]").
        await fn(params, testInfo);
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
      forceNoParent: true
    });
    let firstAfterHooksError: TestError | undefined;

    let afterHooksSlot: TimeSlot | undefined;
    if (testInfo.status === 'timedOut') {
      // A timed-out test gets a full additional timeout to run after hooks.
      afterHooksSlot = { timeout: this._project.config.timeout, elapsed: 0 };
    }
    await testInfo._runWithTimeout(async () => {
      // Note: do not wrap all teardown steps together, because failure in any of them
      // does not prevent further teardown steps from running.

      // Run "afterEach" hooks, unless we failed at beforeAll stage.
      if (shouldRunAfterEachHooks) {
        const afterEachError = await testInfo._runFn(() => this._runEachHooksForSuites(reversedSuites, 'afterEach', testInfo, afterHooksSlot));
        firstAfterHooksError = firstAfterHooksError || afterEachError;
      }

      // Run "afterAll" hooks for suites that are not shared with the next test.
      const nextSuites = new Set(getSuites(nextTest));
      for (const suite of reversedSuites) {
        if (!nextSuites.has(suite)) {
          const afterAllError = await this._runAfterAllHooksForSuite(suite, testInfo);
          firstAfterHooksError = firstAfterHooksError || afterAllError;
        }
      }

      // Teardown test-scoped fixtures.
      testInfo._timeoutManager.setCurrentRunnable({ type: 'teardown', slot: afterHooksSlot });
      const testScopeError = await testInfo._runFn(() => this._fixtureRunner.teardownScope('test', testInfo._timeoutManager));
      firstAfterHooksError = firstAfterHooksError || testScopeError;
    });

    const isFailure = testInfo.status !== 'skipped' && testInfo.status !== testInfo.expectedStatus;
    if (isFailure)
      this._isStopped = true;

    if (this._isStopped) {
      // Run all remaining "afterAll" hooks and teardown all fixtures when worker is shutting down.
      // Mark as "cleaned up" early to avoid running cleanup twice.
      this._didRunFullCleanup = true;

      // Give it more time for the full cleanup.
      await testInfo._runWithTimeout(async () => {
        for (const suite of reversedSuites) {
          const afterAllError = await this._runAfterAllHooksForSuite(suite, testInfo);
          firstAfterHooksError = firstAfterHooksError || afterAllError;
        }
        const teardownSlot = { timeout: this._project.config.timeout, elapsed: 0 };
        testInfo._timeoutManager.setCurrentRunnable({ type: 'teardown', slot: teardownSlot });
        const testScopeError = await testInfo._runFn(() => this._fixtureRunner.teardownScope('test', testInfo._timeoutManager));
        firstAfterHooksError = firstAfterHooksError || testScopeError;
        const workerScopeError = await testInfo._runFn(() => this._fixtureRunner.teardownScope('worker', testInfo._timeoutManager));
        firstAfterHooksError = firstAfterHooksError || workerScopeError;
      });
    }

    afterHooksStep.complete({ error: firstAfterHooksError });
    this._currentTest = null;
    setCurrentTestInfo(null);
    this.emit('testEnd', buildTestEndPayload(testInfo));

    const preserveOutput = this._loader.fullConfig().preserveOutput === 'always' ||
      (this._loader.fullConfig().preserveOutput === 'failures-only' && isFailure);
    if (!preserveOutput)
      await removeFolderAsync(testInfo.outputDir).catch(e => {});
  }

  private async _runModifiersForSuite(suite: Suite, testInfo: TestInfoImpl, scope: 'worker' | 'test', timeSlot: TimeSlot | undefined, extraAnnotations?: Annotation[]) {
    for (const modifier of suite._modifiers) {
      const actualScope = this._fixtureRunner.dependsOnWorkerFixturesOnly(modifier.fn, modifier.location) ? 'worker' : 'test';
      if (actualScope !== scope)
        continue;
      testInfo._timeoutManager.setCurrentRunnable({ type: modifier.type, location: modifier.location, slot: timeSlot });
      const result = await testInfo._runAsStep(() => this._fixtureRunner.resolveParametersAndRunFunction(modifier.fn, testInfo), {
        category: 'hook',
        title: `${modifier.type} modifier`,
        canHaveChildren: true,
        forceNoParent: false,
        location: modifier.location,
      });
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
      try {
        // Separate time slot for each "beforeAll" hook.
        const timeSlot = { timeout: this._project.config.timeout, elapsed: 0 };
        testInfo._timeoutManager.setCurrentRunnable({ type: 'beforeAll', location: hook.location, slot: timeSlot });
        await testInfo._runAsStep(() => this._fixtureRunner.resolveParametersAndRunFunction(hook.fn, testInfo), {
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
    }
    if (beforeAllError)
      throw beforeAllError;
  }

  private async _runAfterAllHooksForSuite(suite: Suite, testInfo: TestInfoImpl) {
    if (!this._activeSuites.has(suite))
      return;
    this._activeSuites.delete(suite);
    let firstError: TestError | undefined;
    for (const hook of suite._hooks) {
      if (hook.type !== 'afterAll')
        continue;
      const afterAllError = await testInfo._runFn(async () => {
        // Separate time slot for each "afterAll" hook.
        const timeSlot = { timeout: this._project.config.timeout, elapsed: 0 };
        testInfo._timeoutManager.setCurrentRunnable({ type: 'afterAll', location: hook.location, slot: timeSlot });
        await testInfo._runAsStep(() => this._fixtureRunner.resolveParametersAndRunFunction(hook.fn, testInfo), {
          category: 'hook',
          title: `${hook.type} hook`,
          canHaveChildren: true,
          forceNoParent: false,
          location: hook.location,
        });
      });
      firstError = firstError || afterAllError;
    }
    return firstError;
  }

  private async _runEachHooksForSuites(suites: Suite[], type: 'beforeEach' | 'afterEach', testInfo: TestInfoImpl, timeSlot: TimeSlot | undefined) {
    const hooks = suites.map(suite => suite._hooks.filter(hook => hook.type === type)).flat();
    let error: Error | undefined;
    for (const hook of hooks) {
      try {
        testInfo._timeoutManager.setCurrentRunnable({ type, location: hook.location, slot: timeSlot });
        await testInfo._runAsStep(() => this._fixtureRunner.resolveParametersAndRunFunction(hook.fn, testInfo), {
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
    testId: testInfo._test._id,
    startWallTime: testInfo._startWallTime,
  };
}

function buildTestEndPayload(testInfo: TestInfoImpl): TestEndPayload {
  return {
    testId: testInfo._test._id,
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
