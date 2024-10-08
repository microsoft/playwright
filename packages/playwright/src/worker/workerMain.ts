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

import { colors } from 'playwright-core/lib/utilsBundle';
import { debugTest, relativeFilePath, serializeError } from '../util';
import { type TestBeginPayload, type TestEndPayload, type RunPayload, type DonePayload, type WorkerInitParams, type TeardownErrorsPayload, stdioChunkToParams } from '../common/ipc';
import { setCurrentTestInfo, setIsWorkerProcess } from '../common/globals';
import { deserializeConfig } from '../common/configLoader';
import type { Suite, TestCase } from '../common/test';
import type { Annotation, FullConfigInternal, FullProjectInternal } from '../common/config';
import { FixtureRunner } from './fixtureRunner';
import { ManualPromise, gracefullyCloseAll, removeFolders } from 'playwright-core/lib/utils';
import { SkipError, TestInfoImpl } from './testInfo';
import { ProcessRunner } from '../common/process';
import { loadTestFile } from '../common/testLoader';
import { applyRepeatEachIndex, bindFileSuiteToProject, filterTestsRemoveEmptySuites } from '../common/suiteUtils';
import { PoolBuilder } from '../common/poolBuilder';
import type { TestInfoError } from '../../types/test';
import type { Location } from '../../types/testReporter';
import { inheritFixtureNames } from '../common/fixtures';
import { type TimeSlot } from './timeoutManager';

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
  private _lastRunningTests: TestCase[] = [];
  private _totalRunningTests = 0;
  // Suites that had their beforeAll hooks, but not afterAll hooks executed.
  // These suites still need afterAll hooks to be executed for the proper cleanup.
  // Contains dynamic annotations originated by modifiers with a callback, e.g. `test.skip(() => true)`.
  private _activeSuites = new Map<Suite, Annotation[]>();

  constructor(params: WorkerInitParams) {
    super();
    process.env.TEST_WORKER_INDEX = String(params.workerIndex);
    process.env.TEST_PARALLEL_INDEX = String(params.parallelIndex);
    setIsWorkerProcess();

    this._params = params;
    this._fixtureRunner = new FixtureRunner();

    // Resolve this promise, so worker does not stall waiting for the non-existent run to finish,
    // when it was sopped before running any test group.
    this._runFinished.resolve();

    process.on('unhandledRejection', reason => this.unhandledError(reason));
    process.on('uncaughtException', error => this.unhandledError(error));
    process.stdout.write = (chunk: string | Buffer) => {
      this.dispatchEvent('stdOut', stdioChunkToParams(chunk));
      this._currentTest?._tracing.appendStdioToTrace('stdout', chunk);
      return true;
    };

    if (!process.env.PW_RUNNER_DEBUG) {
      process.stderr.write = (chunk: string | Buffer) => {
        this.dispatchEvent('stdErr', stdioChunkToParams(chunk));
        this._currentTest?._tracing.appendStdioToTrace('stderr', chunk);
        return true;
      };
    }
  }

  private _stop(): Promise<void> {
    if (!this._isStopped) {
      this._isStopped = true;
      this._currentTest?._interrupt();
    }
    return this._runFinished;
  }

  override async gracefullyClose() {
    try {
      await this._stop();
      // Ignore top-level errors, they are already inside TestInfo.errors.
      const fakeTestInfo = new TestInfoImpl(this._config, this._project, this._params, undefined, 0, () => {}, () => {}, () => {});
      const runnable = { type: 'teardown' } as const;
      // We have to load the project to get the right deadline below.
      await fakeTestInfo._runAsStage({ title: 'worker cleanup', runnable }, () => this._loadIfNeeded()).catch(() => {});
      await this._fixtureRunner.teardownScope('test', fakeTestInfo, runnable).catch(() => {});
      await this._fixtureRunner.teardownScope('worker', fakeTestInfo, runnable).catch(() => {});
      // Close any other browsers launched in this process. This includes anything launched
      // manually in the test/hooks and internal browsers like Playwright Inspector.
      await fakeTestInfo._runAsStage({ title: 'worker cleanup', runnable }, () => gracefullyCloseAll()).catch(() => {});
      this._fatalErrors.push(...fakeTestInfo.errors);
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
      ...this._lastRunningTests.map(test => formatTestTitle(test, this._project.project.name)),
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

  unhandledError(error: Error | any) {
    // No current test - fatal error.
    if (!this._currentTest) {
      if (!this._fatalErrors.length)
        this._fatalErrors.push(serializeError(error));
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
    const isExpectError = (error instanceof Error) && !!(error as any).matcherResult;
    const shouldContinueInThisWorker = this._currentTest.expectedStatus === 'failed' && isExpectError;
    if (!shouldContinueInThisWorker)
      void this._stop();
  }

  private async _loadIfNeeded() {
    if (this._config)
      return;

    this._config = await deserializeConfig(this._params.config);
    this._project = this._config.projects.find(p => p.id === this._params.projectId)!;
    this._poolBuilder = PoolBuilder.createForWorker(this._project);
  }

  async runTestGroup(runPayload: RunPayload) {
    this._runFinished = new ManualPromise<void>();
    const entries = new Map(runPayload.entries.map(e => [e.testId, e]));
    let fatalUnknownTestIds;
    try {
      await this._loadIfNeeded();
      const fileSuite = await loadTestFile(runPayload.file, this._config.config.rootDir);
      const suite = bindFileSuiteToProject(this._project, fileSuite);
      if (this._params.repeatEachIndex)
        applyRepeatEachIndex(this._project, suite, this._params.repeatEachIndex);
      const hasEntries = filterTestsRemoveEmptySuites(suite, test => entries.has(test.id));
      if (hasEntries) {
        this._poolBuilder.buildPools(suite);
        this._activeSuites = new Map();
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
        void this._stop();
      }
    } catch (e) {
      // In theory, we should run above code without any errors.
      // However, in the case we screwed up, or loadTestFile failed in the worker
      // but not in the runner, let's do a fatal error.
      this._fatalErrors.push(serializeError(e));
      void this._stop();
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
        stepEndPayload => this.dispatchEvent('stepEnd', stepEndPayload),
        attachment => this.dispatchEvent('attach', attachment));

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
          testInfo._timeoutManager.slow();
          break;
      }
    };

    if (!this._isStopped)
      this._fixtureRunner.setPool(test._pool!);

    const suites = getSuites(test);
    const reversedSuites = suites.slice().reverse();
    const nextSuites = new Set(getSuites(nextTest));

    testInfo._timeoutManager.setTimeout(test.timeout);
    for (const annotation of test.annotations)
      processAnnotation(annotation);

    // Process existing annotations dynamically set for parent suites.
    for (const suite of suites) {
      const extraAnnotations = this._activeSuites.get(suite) || [];
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
    this._lastRunningTests.push(test);
    if (this._lastRunningTests.length > 10)
      this._lastRunningTests.shift();
    let shouldRunAfterEachHooks = false;

    testInfo._allowSkips = true;
    await testInfo._runAsStage({ title: 'setup and test' }, async () => {
      await testInfo._runAsStage({ title: 'start tracing', runnable: { type: 'test' } }, async () => {
        // Ideally, "trace" would be an config-level option belonging to the
        // test runner instead of a fixture belonging to Playwright.
        // However, for backwards compatibility, we have to read it from a fixture today.
        // We decided to not introduce the config-level option just yet.
        const traceFixtureRegistration = test._pool!.resolve('trace');
        if (!traceFixtureRegistration)
          return;
        if (typeof traceFixtureRegistration.fn === 'function')
          throw new Error(`"trace" option cannot be a function`);
        await testInfo._tracing.startIfNeeded(traceFixtureRegistration.fn);
      });

      if (this._isStopped || isSkipped) {
        // Two reasons to get here:
        // - Last test is skipped, so we should not run the test, but run the cleanup.
        // - Worker is requested to stop, but was not able to run full cleanup yet.
        //   We should skip the test, but run the cleanup.
        testInfo.status = 'skipped';
        return;
      }

      await removeFolders([testInfo.outputDir]);

      let testFunctionParams: object | null = null;
      await testInfo._runAsStage({ title: 'Before Hooks', stepInfo: { category: 'hook' } }, async () => {
        // Run "beforeAll" hooks, unless already run during previous tests.
        for (const suite of suites)
          await this._runBeforeAllHooksForSuite(suite, testInfo);

        // Run "beforeEach" hooks. Once started with "beforeEach", we must run all "afterEach" hooks as well.
        shouldRunAfterEachHooks = true;
        await this._runEachHooksForSuites(suites, 'beforeEach', testInfo);

        // Setup fixtures required by the test.
        testFunctionParams = await this._fixtureRunner.resolveParametersForFunction(test.fn, testInfo, 'test', { type: 'test' });
      });

      if (testFunctionParams === null) {
        // Fixture setup failed or was skipped, we should not run the test now.
        return;
      }

      await testInfo._runAsStage({ title: 'test function', runnable: { type: 'test' } }, async () => {
        // Now run the test itself.
        const fn = test.fn; // Extract a variable to get a better stack trace ("myTest" vs "TestCase.myTest [as fn]").
        await fn(testFunctionParams, testInfo);
      });
    }).catch(() => {});  // Ignore the top-level error, it is already inside TestInfo.errors.

    // Update duration, so it is available in fixture teardown and afterEach hooks.
    testInfo.duration = testInfo._timeoutManager.defaultSlot().elapsed | 0;

    // No skips in after hooks.
    testInfo._allowSkips = true;

    // After hooks get an additional timeout.
    const afterHooksTimeout = calculateMaxTimeout(this._project.project.timeout, testInfo.timeout);
    const afterHooksSlot = { timeout: afterHooksTimeout, elapsed: 0 };
    await testInfo._runAsStage({ title: 'After Hooks', stepInfo: { category: 'hook' } }, async () => {
      let firstAfterHooksError: Error | undefined;

      try {
        // Run "immediately upon test function finish" callback.
        await testInfo._runAsStage({ title: 'on-test-function-finish', runnable: { type: 'test', slot: afterHooksSlot } }, async () => testInfo._onDidFinishTestFunction?.());
      } catch (error) {
        firstAfterHooksError = firstAfterHooksError ?? error;
      }

      try {
        // Run "afterEach" hooks, unless we failed at beforeAll stage.
        if (shouldRunAfterEachHooks)
          await this._runEachHooksForSuites(reversedSuites, 'afterEach', testInfo, afterHooksSlot);
      } catch (error) {
        firstAfterHooksError = firstAfterHooksError ?? error;
      }

      try {
        // Teardown test-scoped fixtures. Attribute to 'test' so that users understand
        // they should probably increase the test timeout to fix this issue.
        await this._fixtureRunner.teardownScope('test', testInfo, { type: 'test', slot: afterHooksSlot });
      } catch (error) {
        firstAfterHooksError = firstAfterHooksError ?? error;
      }

      // Run "afterAll" hooks for suites that are not shared with the next test.
      // In case of failure the worker will be stopped and we have to make sure that afterAll
      // hooks run before worker fixtures teardown.
      for (const suite of reversedSuites) {
        if (!nextSuites.has(suite) || testInfo._isFailure()) {
          try {
            await this._runAfterAllHooksForSuite(suite, testInfo);
          } catch (error) {
            // Continue running "afterAll" hooks even after some of them timeout.
            firstAfterHooksError = firstAfterHooksError ?? error;
          }
        }
      }
      if (firstAfterHooksError)
        throw firstAfterHooksError;
    }).catch(() => {});  // Ignore the top-level error, it is already inside TestInfo.errors.

    if (testInfo._isFailure())
      this._isStopped = true;

    if (this._isStopped) {
      // Run all remaining "afterAll" hooks and teardown all fixtures when worker is shutting down.
      // Mark as "cleaned up" early to avoid running cleanup twice.
      this._didRunFullCleanup = true;

      await testInfo._runAsStage({ title: 'Worker Cleanup', stepInfo: { category: 'hook' } }, async () => {
        let firstWorkerCleanupError: Error | undefined;

        // Give it more time for the full cleanup.
        const teardownSlot = { timeout: this._project.project.timeout, elapsed: 0 };
        try {
          // Attribute to 'test' so that users understand they should probably increate the test timeout to fix this issue.
          await this._fixtureRunner.teardownScope('test', testInfo, { type: 'test', slot: teardownSlot });
        } catch (error) {
          firstWorkerCleanupError = firstWorkerCleanupError ?? error;
        }

        for (const suite of reversedSuites) {
          try {
            await this._runAfterAllHooksForSuite(suite, testInfo);
          } catch (error) {
            firstWorkerCleanupError = firstWorkerCleanupError ?? error;
          }
        }

        try {
          // Attribute to 'teardown' because worker fixtures are not perceived as a part of a test.
          await this._fixtureRunner.teardownScope('worker', testInfo, { type: 'teardown', slot: teardownSlot });
        } catch (error) {
          firstWorkerCleanupError = firstWorkerCleanupError ?? error;
        }

        if (firstWorkerCleanupError)
          throw firstWorkerCleanupError;
      }).catch(() => {});  // Ignore the top-level error, it is already inside TestInfo.errors.
    }

    const tracingSlot = { timeout: this._project.project.timeout, elapsed: 0 };
    await testInfo._runAsStage({ title: 'stop tracing', runnable: { type: 'test', slot: tracingSlot } }, async () => {
      await testInfo._tracing.stopIfNeeded();
    }).catch(() => {});  // Ignore the top-level error, it is already inside TestInfo.errors.

    testInfo.duration = (testInfo._timeoutManager.defaultSlot().elapsed + afterHooksSlot.elapsed) | 0;

    this._currentTest = null;
    setCurrentTestInfo(null);
    this.dispatchEvent('testEnd', buildTestEndPayload(testInfo));

    const preserveOutput = this._config.config.preserveOutput === 'always' ||
      (this._config.config.preserveOutput === 'failures-only' && testInfo._isFailure());
    if (!preserveOutput)
      await removeFolders([testInfo.outputDir]);
  }

  private _collectHooksAndModifiers(suite: Suite, type: 'beforeAll' | 'beforeEach' | 'afterAll' | 'afterEach', testInfo: TestInfoImpl) {
    type Runnable = { type: 'beforeEach' | 'afterEach' | 'beforeAll' | 'afterAll' | 'fixme' | 'skip' | 'slow' | 'fail', fn: Function, title: string, location: Location };
    const runnables: Runnable[] = [];
    for (const modifier of suite._modifiers) {
      const modifierType = this._fixtureRunner.dependsOnWorkerFixturesOnly(modifier.fn, modifier.location) ? 'beforeAll' : 'beforeEach';
      if (modifierType !== type)
        continue;
      const fn = async (fixtures: any) => {
        const result = await modifier.fn(fixtures);
        testInfo[modifier.type](!!result, modifier.description);
      };
      inheritFixtureNames(modifier.fn, fn);
      runnables.push({
        title: `${modifier.type} modifier`,
        location: modifier.location,
        type: modifier.type,
        fn,
      });
    }
    // Modifiers first, then hooks.
    runnables.push(...suite._hooks.filter(hook => hook.type === type));
    return runnables;
  }

  private async _runBeforeAllHooksForSuite(suite: Suite, testInfo: TestInfoImpl) {
    if (this._activeSuites.has(suite))
      return;
    const extraAnnotations: Annotation[] = [];
    this._activeSuites.set(suite, extraAnnotations);
    await this._runAllHooksForSuite(suite, testInfo, 'beforeAll', extraAnnotations);
  }

  private async _runAllHooksForSuite(suite: Suite, testInfo: TestInfoImpl, type: 'beforeAll' | 'afterAll', extraAnnotations?: Annotation[]) {
    // Always run all the hooks, and capture the first error.
    let firstError: Error | undefined;
    for (const hook of this._collectHooksAndModifiers(suite, type, testInfo)) {
      try {
        await testInfo._runAsStage({ title: hook.title, stepInfo: { category: 'hook', location: hook.location } }, async () => {
          // Separate time slot for each beforeAll/afterAll hook.
          const timeSlot = { timeout: this._project.project.timeout, elapsed: 0 };
          const runnable = { type: hook.type, slot: timeSlot, location: hook.location };
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
        firstError = firstError ?? error;
        // Skip in beforeAll/modifier prevents others from running.
        if (type === 'beforeAll' && (error instanceof SkipError))
          break;
        if (type === 'beforeAll' && !this._skipRemainingTestsInSuite) {
          // This will inform dispatcher that we should not run more tests from this group
          // because we had a beforeAll error.
          // This behavior avoids getting the same common error for each test.
          this._skipRemainingTestsInSuite = suite;
        }
      }
    }
    if (firstError)
      throw firstError;
  }

  private async _runAfterAllHooksForSuite(suite: Suite, testInfo: TestInfoImpl) {
    if (!this._activeSuites.has(suite))
      return;
    this._activeSuites.delete(suite);
    await this._runAllHooksForSuite(suite, testInfo, 'afterAll');
  }

  private async _runEachHooksForSuites(suites: Suite[], type: 'beforeEach' | 'afterEach', testInfo: TestInfoImpl, slot?: TimeSlot) {
    // Always run all the hooks, unless one of the times out, and capture the first error.
    let firstError: Error | undefined;
    const hooks = suites.map(suite => this._collectHooksAndModifiers(suite, type, testInfo)).flat();
    for (const hook of hooks) {
      const runnable = { type: hook.type, location: hook.location, slot };
      if (testInfo._timeoutManager.isTimeExhaustedFor(runnable)) {
        // Do not run hooks that will timeout right away.
        continue;
      }
      try {
        await testInfo._runAsStage({ title: hook.title, stepInfo: { category: 'hook', location: hook.location } }, async () => {
          await this._fixtureRunner.resolveParametersAndRunFunction(hook.fn, testInfo, 'test', runnable);
        });
      } catch (error) {
        firstError = firstError ?? error;
        // Skip in modifier prevents others from running.
        if (error instanceof SkipError)
          break;
      }
    }
    if (firstError)
      throw firstError;
  }
}

function buildTestBeginPayload(testInfo: TestInfoImpl): TestBeginPayload {
  return {
    testId: testInfo.testId,
    startWallTime: testInfo._startWallTime,
  };
}

function buildTestEndPayload(testInfo: TestInfoImpl): TestEndPayload {
  return {
    testId: testInfo.testId,
    duration: testInfo.duration,
    status: testInfo.status!,
    errors: testInfo.errors,
    hasNonRetriableError: testInfo._hasNonRetriableError,
    expectedStatus: testInfo.expectedStatus,
    annotations: testInfo.annotations,
    timeout: testInfo.timeout,
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

function calculateMaxTimeout(t1: number, t2: number) {
  // Zero means "no timeout".
  return (!t1 || !t2) ? 0 : Math.max(t1, t2);
}

export const create = (params: WorkerInitParams) => new WorkerMain(params);
