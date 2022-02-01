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

import rimraf from 'rimraf';
import util from 'util';
import colors from 'colors/safe';
import { EventEmitter } from 'events';
import { serializeError, prependToTestError, formatLocation } from './util';
import { TestBeginPayload, TestEndPayload, RunPayload, TestEntry, DonePayload, WorkerInitParams, StepBeginPayload, StepEndPayload } from './ipc';
import { setCurrentTestInfo } from './globals';
import { Loader } from './loader';
import { Modifier, Suite, TestCase } from './test';
import { Annotations, TestError, TestInfo, TestStepInternal, WorkerInfo } from './types';
import { ProjectImpl } from './project';
import { FixtureRunner } from './fixtures';
import { raceAgainstTimeout } from 'playwright-core/lib/utils/async';
import { TestInfoImpl } from './testInfo';

const removeFolderAsync = util.promisify(rimraf);

export class WorkerRunner extends EventEmitter {
  private _params: WorkerInitParams;
  private _loader!: Loader;
  private _project!: ProjectImpl;
  private _workerInfo!: WorkerInfo;
  private _fixtureRunner: FixtureRunner;

  private _failedTest: TestInfoImpl | undefined;
  private _fatalError: TestError | undefined;
  private _entries = new Map<string, TestEntry>();
  private _isStopped = false;
  private _runFinished = Promise.resolve();
  _currentTest: TestInfoImpl | null = null;

  constructor(params: WorkerInitParams) {
    super();
    this._params = params;
    this._fixtureRunner = new FixtureRunner();
  }

  stop(): Promise<void> {
    if (!this._isStopped) {
      this._isStopped = true;

      // Interrupt current action.
      this._currentTest?._timeoutRunner.interrupt();

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
    if (this._fatalError)
      this.emit('teardownError', { error: this._fatalError });
  }

  private async _teardownScopes() {
    // TODO: separate timeout for teardown?
    const result = await raceAgainstTimeout(async () => {
      await this._fixtureRunner.teardownScope('test');
      await this._fixtureRunner.teardownScope('worker');
    }, this._project.config.timeout);
    if (result.timedOut && !this._fatalError)
      this._fatalError = { message: colors.red(`Timeout of ${this._project.config.timeout}ms exceeded while shutting down environment`) };
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
    if (this._currentTest && this._currentTest._test._type === 'test' && this._currentTest.expectedStatus !== 'failed') {
      this._currentTest._failWithError(serializeError(error));
    } else {
      // No current test - fatal error.
      if (!this._fatalError)
        this._fatalError = serializeError(error);
    }
    this.stop();
  }

  private async _loadIfNeeded() {
    if (this._loader)
      return;

    this._loader = await Loader.deserialize(this._params.loader);
    this._project = this._loader.projects()[this._params.projectIndex];

    this._workerInfo = {
      workerIndex: this._params.workerIndex,
      parallelIndex: this._params.parallelIndex,
      project: this._project.config,
      config: this._loader.fullConfig(),
    };
  }

  async run(runPayload: RunPayload) {
    let runFinishedCallback = () => {};
    this._runFinished = new Promise(f => runFinishedCallback = f);
    try {
      this._entries = new Map(runPayload.entries.map(e => [ e.testId, e ]));
      await this._loadIfNeeded();
      const fileSuite = await this._loader.loadTestFile(runPayload.file, 'worker');
      const suite = this._project.cloneFileSuite(fileSuite, this._params.repeatEachIndex, test => {
        if (!this._entries.has(test._id))
          return false;
        return true;
      });
      if (suite) {
        const firstPool = suite.allTests()[0]._pool!;
        this._fixtureRunner.setPool(firstPool);
        await this._runSuite(suite, []);
      }
      if (this._failedTest)
        await this._teardownScopes();
    } catch (e) {
      // In theory, we should run above code without any errors.
      // However, in the case we screwed up, or loadTestFile failed in the worker
      // but not in the runner, let's do a fatal error.
      this.unhandledError(e);
    } finally {
      if (this._failedTest) {
        // Now that we did run all hooks and teared down scopes, we can
        // report the failure, possibly with any error details revealed by teardown.
        this.emit('testEnd', buildTestEndPayload(this._failedTest));
      }
      this._reportDone();
      runFinishedCallback();
    }
  }

  private async _runSuite(suite: Suite, annotations: Annotations) {
    // When stopped, do not run a suite. But if we have started running the suite with hooks,
    // always finish the hooks.
    if (this._isStopped)
      return;
    annotations = annotations.concat(suite._annotations);

    for (const beforeAllModifier of suite._modifiers) {
      if (!this._fixtureRunner.dependsOnWorkerFixturesOnly(beforeAllModifier.fn, beforeAllModifier.location))
        continue;
      // TODO: separate timeout for beforeAll modifiers?
      const result = await raceAgainstTimeout(() => this._fixtureRunner.resolveParametersAndRunFunction(beforeAllModifier.fn, this._workerInfo, undefined), this._project.config.timeout);
      if (result.timedOut) {
        if (!this._fatalError)
          this._fatalError = serializeError(new Error(`Timeout of ${this._project.config.timeout}ms exceeded while running ${beforeAllModifier.type} modifier\n    at ${formatLocation(beforeAllModifier.location)}`));
        this.stop();
      } else if (!!result.result) {
        annotations.push({ type: beforeAllModifier.type, description: beforeAllModifier.description });
      }
    }

    for (const hook of suite.hooks) {
      if (hook._type !== 'beforeAll')
        continue;
      const firstTest = suite.allTests()[0];
      await this._runTestOrAllHook(hook, annotations, this._entries.get(firstTest._id)?.retry || 0);
    }
    for (const entry of suite._entries) {
      if (entry instanceof Suite) {
        await this._runSuite(entry, annotations);
      } else {
        const runEntry = this._entries.get(entry._id);
        if (runEntry && !this._isStopped)
          await this._runTestOrAllHook(entry, annotations, runEntry.retry);
      }
    }
    for (const hook of suite.hooks) {
      if (hook._type !== 'afterAll')
        continue;
      await this._runTestOrAllHook(hook, annotations, 0);
    }
  }

  private async _runTestOrAllHook(test: TestCase, annotations: Annotations, retry: number) {
    let lastStepId = 0;
    const testInfo = new TestInfoImpl(this._loader, this._params, test, retry, data => {
      const stepId = `${data.category}@${data.title}@${++lastStepId}`;
      let callbackHandled = false;
      const step: TestStepInternal = {
        ...data,
        complete: (error?: Error | TestError) => {
          if (callbackHandled)
            return;
          callbackHandled = true;
          if (error instanceof Error)
            error = serializeError(error);
          const payload: StepEndPayload = {
            testId: test._id,
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

    // Inherit test.setTimeout() from parent suites.
    for (let suite: Suite | undefined = test.parent; suite; suite = suite.parent) {
      if (suite._timeout !== undefined) {
        testInfo.setTimeout(suite._timeout);
        break;
      }
    }

    // Process annotations defined on parent suites.
    for (const annotation of annotations) {
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
          testInfo.setTimeout(testInfo.timeout * 3);
          break;
      }
    }

    this._currentTest = testInfo;
    setCurrentTestInfo(testInfo);

    this.emit('testBegin', buildTestBeginPayload(testInfo));

    if (testInfo.expectedStatus === 'skipped') {
      testInfo.status = 'skipped';
      this.emit('testEnd', buildTestEndPayload(testInfo));
      return;
    }

    // Update the fixture pool - it may differ between tests, but only in test-scoped fixtures.
    this._fixtureRunner.setPool(test._pool!);

    await testInfo._runWithTimeout(() => this._runTestWithBeforeHooks(test, testInfo));

    if (testInfo.status === 'timedOut') {
      // A timed-out test gets a full additional timeout to run after hooks.
      testInfo._timeoutRunner.resetTimeout(testInfo.timeout);
    }
    await testInfo._runWithTimeout(() => this._runAfterHooks(test, testInfo));

    this._currentTest = null;
    setCurrentTestInfo(null);

    const isFailure = testInfo.status !== 'skipped' && testInfo.status !== testInfo.expectedStatus;
    if (isFailure) {
      // Delay reporting testEnd result until after teardownScopes is done.
      this._failedTest = testInfo;
      if (test._type !== 'test') {
        // beforeAll/afterAll hook failure skips any remaining tests in the worker.
        if (!this._fatalError)
          this._fatalError = testInfo.error;
        // Keep any error we have, and add "timeout" message.
        if (testInfo.status === 'timedOut')
          this._fatalError = prependToTestError(this._fatalError, colors.red(`Timeout of ${testInfo.timeout}ms exceeded in ${test._type} hook.\n`), test.location);
      }
      this.stop();
    } else {
      this.emit('testEnd', buildTestEndPayload(testInfo));
    }

    const preserveOutput = this._loader.fullConfig().preserveOutput === 'always' ||
      (this._loader.fullConfig().preserveOutput === 'failures-only' && isFailure);
    if (!preserveOutput)
      await removeFolderAsync(testInfo.outputDir).catch(e => {});
  }

  private async _runTestWithBeforeHooks(test: TestCase, testInfo: TestInfoImpl) {
    const step = testInfo._addStep({
      category: 'hook',
      title: 'Before Hooks',
      canHaveChildren: true,
      forceNoParent: true
    });
    const maybeError = await testInfo._runFn(async () => {
      if (test._type === 'test') {
        const beforeEachModifiers: Modifier[] = [];
        for (let s: Suite | undefined = test.parent; s; s = s.parent) {
          const modifiers = s._modifiers.filter(modifier => !this._fixtureRunner.dependsOnWorkerFixturesOnly(modifier.fn, modifier.location));
          beforeEachModifiers.push(...modifiers.reverse());
        }
        beforeEachModifiers.reverse();
        for (const modifier of beforeEachModifiers) {
          const result = await this._fixtureRunner.resolveParametersAndRunFunction(modifier.fn, this._workerInfo, testInfo);
          testInfo[modifier.type](!!result, modifier.description!);
        }
        await this._runHooks(test.parent!, 'beforeEach', testInfo);
      }

      const params = await this._fixtureRunner.resolveParametersForFunction(test.fn, this._workerInfo, testInfo);
      step.complete(); // Report fixture hooks step as completed.
      const fn = test.fn; // Extract a variable to get a better stack trace ("myTest" vs "TestCase.myTest [as fn]").
      await fn(params, testInfo);
    }, 'allowSkips');
    step.complete(maybeError); // Second complete is a no-op.
  }

  private async _runAfterHooks(test: TestCase, testInfo: TestInfoImpl) {
    const step = testInfo._addStep({
      category: 'hook',
      title: 'After Hooks',
      canHaveChildren: true,
      forceNoParent: true
    });

    let teardownError1: TestError | undefined;
    if (test._type === 'test')
      teardownError1 = await testInfo._runFn(() => this._runHooks(test.parent!, 'afterEach', testInfo));
    // Continue teardown even after the failure.

    const teardownError2 = await testInfo._runFn(() => this._fixtureRunner.teardownScope('test'));
    step.complete(teardownError1 || teardownError2);
  }

  private async _runHooks(suite: Suite, type: 'beforeEach' | 'afterEach', testInfo: TestInfo) {
    const all = [];
    for (let s: Suite | undefined = suite; s; s = s.parent) {
      const funcs = s._eachHooks.filter(e => e.type === type).map(e => e.fn);
      all.push(...funcs.reverse());
    }
    if (type === 'beforeEach')
      all.reverse();
    let error: Error | undefined;
    for (const hook of all) {
      try {
        await this._fixtureRunner.resolveParametersAndRunFunction(hook, this._workerInfo, testInfo);
      } catch (e) {
        // Always run all the hooks, and capture the first error.
        error = error || e;
      }
    }
    if (error)
      throw error;
  }

  private _reportDone() {
    const donePayload: DonePayload = { fatalError: this._fatalError };
    this.emit('done', donePayload);
    this._fatalError = undefined;
    this._failedTest = undefined;
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
    error: testInfo.error,
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
