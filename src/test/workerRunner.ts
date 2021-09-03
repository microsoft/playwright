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

import fs from 'fs';
import path from 'path';
import rimraf from 'rimraf';
import util from 'util';
import colors from 'colors/safe';
import { EventEmitter } from 'events';
import { monotonicTime, serializeError, sanitizeForFilePath } from './util';
import { TestBeginPayload, TestEndPayload, RunPayload, TestEntry, DonePayload, WorkerInitParams, StepBeginPayload, StepEndPayload } from './ipc';
import { setCurrentTestInfo } from './globals';
import { Loader } from './loader';
import { Modifier, Suite, TestCase } from './test';
import { Annotations, TestError, TestInfo, TestInfoImpl, TestStepInternal, WorkerInfo } from './types';
import { ProjectImpl } from './project';
import { FixturePool, FixtureRunner } from './fixtures';
import { DeadlineRunner, raceAgainstDeadline } from '../utils/async';

const removeFolderAsync = util.promisify(rimraf);

export class WorkerRunner extends EventEmitter {
  private _params: WorkerInitParams;
  private _loader!: Loader;
  private _project!: ProjectImpl;
  private _workerInfo!: WorkerInfo;
  private _projectNamePathSegment = '';
  private _uniqueProjectNamePathSegment = '';
  private _fixtureRunner: FixtureRunner;

  private _failedTestId: string | undefined;
  private _fatalError: TestError | undefined;
  private _entries = new Map<string, TestEntry>();
  private _isStopped = false;
  private _runFinished = Promise.resolve();
  private _currentDeadlineRunner: DeadlineRunner<any> | undefined;
  _currentTest: { testId: string, testInfo: TestInfoImpl, type: 'test' | 'beforeAll' | 'afterAll' } | null = null;

  constructor(params: WorkerInitParams) {
    super();
    this._params = params;
    this._fixtureRunner = new FixtureRunner();
  }

  stop(): Promise<void> {
    if (!this._isStopped) {
      this._isStopped = true;

      // Interrupt current action.
      this._currentDeadlineRunner?.interrupt();

      // TODO: mark test as 'interrupted' instead.
      if (this._currentTest && this._currentTest.testInfo.status === 'passed')
        this._currentTest.testInfo.status = 'skipped';
    }
    return this._runFinished;
  }

  async cleanup() {
    // We have to load the project to get the right deadline below.
    await this._loadIfNeeded();
    // TODO: separate timeout for teardown?
    const result = await raceAgainstDeadline((async () => {
      await this._fixtureRunner.teardownScope('test');
      await this._fixtureRunner.teardownScope('worker');
    })(), this._deadline());
    if (result.timedOut && !this._fatalError)
      this._fatalError = { message: colors.red(`Timeout of ${this._project.config.timeout}ms exceeded while shutting down environment`) };
    if (this._fatalError)
      this.emit('teardownError', { error: this._fatalError });
  }

  unhandledError(error: Error | any) {
    if (this._currentTest && this._currentTest.type === 'test') {
      if (!this._currentTest.testInfo.error) {
        this._currentTest.testInfo.status = 'failed';
        this._currentTest.testInfo.error = serializeError(error);
      }
    } else {
      // No current test - fatal error.
      if (!this._fatalError)
        this._fatalError = serializeError(error);
    }
    this.stop();
  }

  private _deadline() {
    return this._project.config.timeout ? monotonicTime() + this._project.config.timeout : 0;
  }

  private async _loadIfNeeded() {
    if (this._loader)
      return;

    this._loader = await Loader.deserialize(this._params.loader);
    this._project = this._loader.projects()[this._params.projectIndex];

    this._projectNamePathSegment = sanitizeForFilePath(this._project.config.name);

    const sameName = this._loader.projects().filter(project => project.config.name === this._project.config.name);
    if (sameName.length > 1)
      this._uniqueProjectNamePathSegment = this._project.config.name + (sameName.indexOf(this._project) + 1);
    else
      this._uniqueProjectNamePathSegment = this._project.config.name;
    this._uniqueProjectNamePathSegment = sanitizeForFilePath(this._uniqueProjectNamePathSegment);

    this._workerInfo = {
      workerIndex: this._params.workerIndex,
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
      const fileSuite = await this._loader.loadTestFile(runPayload.file);
      let anyPool: FixturePool | undefined;
      const suite = this._project.cloneFileSuite(fileSuite, this._params.repeatEachIndex, test => {
        if (!this._entries.has(test._id))
          return false;
        anyPool = test._pool;
        return true;
      });
      if (suite && anyPool) {
        this._fixtureRunner.setPool(anyPool);
        await this._runSuite(suite, []);
      }
    } catch (e) {
      // In theory, we should run above code without any errors.
      // However, in the case we screwed up, or loadTestFile failed in the worker
      // but not in the runner, let's do a fatal error.
      this.unhandledError(e);
    } finally {
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
      const result = await raceAgainstDeadline(this._fixtureRunner.resolveParametersAndRunHookOrTest(beforeAllModifier.fn, this._workerInfo, undefined), this._deadline());
      if (result.timedOut) {
        if (!this._fatalError)
          this._fatalError = serializeError(new Error(`Timeout of ${this._project.config.timeout}ms exceeded while running ${beforeAllModifier.type} modifier`));
        this.stop();
      }
      if (!!result.result)
        annotations.push({ type: beforeAllModifier.type, description: beforeAllModifier.description });
    }

    for (const hook of suite._allHooks) {
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
    for (const hook of suite._allHooks) {
      if (hook._type !== 'afterAll')
        continue;
      await this._runTestOrAllHook(hook, annotations, 0);
    }
  }

  private async _runTestOrAllHook(test: TestCase, annotations: Annotations, retry: number) {
    const reportEvents = test._type === 'test';
    const startTime = monotonicTime();
    const startWallTime = Date.now();
    let deadlineRunner: DeadlineRunner<any> | undefined;
    const testId = test._id;

    const baseOutputDir = (() => {
      const relativeTestFilePath = path.relative(this._project.config.testDir, test._requireFile.replace(/\.(spec|test)\.(js|ts|mjs)$/, ''));
      const sanitizedRelativePath = relativeTestFilePath.replace(process.platform === 'win32' ? new RegExp('\\\\', 'g') : new RegExp('/', 'g'), '-');
      const fullTitleWithoutSpec = test.titlePath().slice(1).join(' ') + (test._type === 'test' ? '' : '-worker' + this._params.workerIndex);
      let testOutputDir = sanitizedRelativePath + '-' + sanitizeForFilePath(fullTitleWithoutSpec);
      if (this._uniqueProjectNamePathSegment)
        testOutputDir += '-' + this._uniqueProjectNamePathSegment;
      if (retry)
        testOutputDir += '-retry' + retry;
      if (this._params.repeatEachIndex)
        testOutputDir += '-repeat' + this._params.repeatEachIndex;
      return path.join(this._project.config.outputDir, testOutputDir);
    })();

    let testFinishedCallback = () => {};
    let lastStepId = 0;
    const stepStack = new Set<TestStepInternal>();
    const testInfo: TestInfoImpl = {
      workerIndex: this._params.workerIndex,
      project: this._project.config,
      config: this._loader.fullConfig(),
      title: test.title,
      file: test.location.file,
      line: test.location.line,
      column: test.location.column,
      fn: test.fn,
      repeatEachIndex: this._params.repeatEachIndex,
      retry,
      expectedStatus: test.expectedStatus,
      annotations: [],
      attachments: [],
      duration: 0,
      status: 'passed',
      stdout: [],
      stderr: [],
      timeout: this._project.config.timeout,
      snapshotSuffix: '',
      outputDir: baseOutputDir,
      outputPath: (...pathSegments: string[]): string => {
        fs.mkdirSync(baseOutputDir, { recursive: true });
        return path.join(baseOutputDir, ...pathSegments);
      },
      snapshotPath: (snapshotName: string): string => {
        let suffix = '';
        if (this._projectNamePathSegment)
          suffix += '-' + this._projectNamePathSegment;
        if (testInfo.snapshotSuffix)
          suffix += '-' + testInfo.snapshotSuffix;
        const ext = path.extname(snapshotName);
        if (ext)
          snapshotName = sanitizeForFilePath(snapshotName.substring(0, snapshotName.length - ext.length)) + suffix + ext;
        else
          snapshotName = sanitizeForFilePath(snapshotName) + suffix;
        return path.join(test._requireFile + '-snapshots', snapshotName);
      },
      skip: (...args: [arg?: any, description?: string]) => modifier(testInfo, 'skip', args),
      fixme: (...args: [arg?: any, description?: string]) => modifier(testInfo, 'fixme', args),
      fail: (...args: [arg?: any, description?: string]) => modifier(testInfo, 'fail', args),
      slow: (...args: [arg?: any, description?: string]) => modifier(testInfo, 'slow', args),
      setTimeout: (timeout: number) => {
        testInfo.timeout = timeout;
        if (deadlineRunner)
          deadlineRunner.updateDeadline(deadline());
      },
      _testFinished: new Promise(f => testFinishedCallback = f),
      _addStep: (category: string, title: string, data: { [key: string]: any } = {}) => {
        const stepId = `${category}@${title}@${++lastStepId}`;
        let callbackHandled = false;
        const step: TestStepInternal = {
          data,
          category,
          complete: (error?: Error | TestError) => {
            if (callbackHandled)
              return;
            callbackHandled = true;
            if (error instanceof Error)
              error = serializeError(error);
            stepStack.delete(step);
            const payload: StepEndPayload = {
              testId,
              stepId,
              wallTime: Date.now(),
              error,
              data,
            };
            if (reportEvents)
              this.emit('stepEnd', payload);
          }
        };
        stepStack.add(step);
        const payload: StepBeginPayload = {
          testId,
          stepId,
          category,
          title,
          wallTime: Date.now(),
        };
        if (reportEvents)
          this.emit('stepBegin', payload);
        return step;
      },
      _currentSteps: () => [...stepStack],
    };

    // Inherit test.setTimeout() from parent suites.
    for (let suite = test.parent; suite; suite = suite.parent) {
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

    this._currentTest = { testInfo, testId, type: test._type };
    setCurrentTestInfo(testInfo);

    const deadline = () => {
      return testInfo.timeout ? startTime + testInfo.timeout : 0;
    };

    if (reportEvents)
      this.emit('testBegin', buildTestBeginPayload(testId, testInfo, startWallTime));

    if (testInfo.expectedStatus === 'skipped') {
      testInfo.status = 'skipped';
      if (reportEvents)
        this.emit('testEnd', buildTestEndPayload(testId, testInfo));
      return;
    }

    // Update the fixture pool - it may differ between tests, but only in test-scoped fixtures.
    this._fixtureRunner.setPool(test._pool!);

    this._currentDeadlineRunner = deadlineRunner = new DeadlineRunner(this._runTestWithBeforeHooks(test, testInfo), deadline());
    const result = await deadlineRunner.result;
    // Do not overwrite test failure upon hook timeout.
    if (result.timedOut && testInfo.status === 'passed')
      testInfo.status = 'timedOut';
    testFinishedCallback();

    if (!result.timedOut) {
      this._currentDeadlineRunner = deadlineRunner = new DeadlineRunner(this._runAfterHooks(test, testInfo), deadline());
      deadlineRunner.updateDeadline(deadline());
      const hooksResult = await deadlineRunner.result;
      // Do not overwrite test failure upon hook timeout.
      if (hooksResult.timedOut && testInfo.status === 'passed')
        testInfo.status = 'timedOut';
    } else {
      // A timed-out test gets a full additional timeout to run after hooks.
      const newDeadline = this._deadline();
      this._currentDeadlineRunner = deadlineRunner = new DeadlineRunner(this._runAfterHooks(test, testInfo), newDeadline);
      await deadlineRunner.result;
    }

    this._currentDeadlineRunner = undefined;
    testInfo.duration = monotonicTime() - startTime;
    if (reportEvents)
      this.emit('testEnd', buildTestEndPayload(testId, testInfo));

    const isFailure = testInfo.status !== 'skipped' && testInfo.status !== testInfo.expectedStatus;
    const preserveOutput = this._loader.fullConfig().preserveOutput === 'always' ||
      (this._loader.fullConfig().preserveOutput === 'failures-only' && isFailure);
    if (!preserveOutput)
      await removeFolderAsync(testInfo.outputDir).catch(e => {});

    this._currentTest = null;
    setCurrentTestInfo(null);

    if (isFailure) {
      if (test._type === 'test') {
        this._failedTestId = testId;
      } else if (!this._fatalError) {
        if (testInfo.status === 'timedOut')
          this._fatalError = { message: colors.red(`Timeout of ${testInfo.timeout}ms exceeded in ${test._type} hook.`) };
        else
          this._fatalError = testInfo.error;
      }
      this.stop();
    }
  }

  private async _runBeforeHooks(test: TestCase, testInfo: TestInfoImpl) {
    try {
      const beforeEachModifiers: Modifier[] = [];
      for (let s = test.parent; s; s = s.parent) {
        const modifiers = s._modifiers.filter(modifier => !this._fixtureRunner.dependsOnWorkerFixturesOnly(modifier.fn, modifier.location));
        beforeEachModifiers.push(...modifiers.reverse());
      }
      beforeEachModifiers.reverse();
      for (const modifier of beforeEachModifiers) {
        const result = await this._fixtureRunner.resolveParametersAndRunHookOrTest(modifier.fn, this._workerInfo, testInfo);
        testInfo[modifier.type](!!result, modifier.description!);
      }
      await this._runHooks(test.parent!, 'beforeEach', testInfo);
    } catch (error) {
      if (error instanceof SkipError) {
        if (testInfo.status === 'passed')
          testInfo.status = 'skipped';
      } else {
        testInfo.status = 'failed';
        testInfo.error = serializeError(error);
      }
      // Continue running afterEach hooks even after the failure.
    }
  }

  private async _runTestWithBeforeHooks(test: TestCase, testInfo: TestInfoImpl) {
    const step = testInfo._addStep('hook', 'Before Hooks');
    if (test._type === 'test')
      await this._runBeforeHooks(test, testInfo);

    // Do not run the test when beforeEach hook fails.
    if (testInfo.status === 'failed' || testInfo.status === 'skipped') {
      step.complete(testInfo.error);
      return;
    }

    try {
      await this._fixtureRunner.resolveParametersAndRunHookOrTest(test.fn, this._workerInfo, testInfo, step);
    } catch (error) {
      if (error instanceof SkipError) {
        if (testInfo.status === 'passed')
          testInfo.status = 'skipped';
      } else {
        // We might fail after the timeout, e.g. due to fixture teardown.
        // Do not overwrite the timeout status.
        if (testInfo.status === 'passed')
          testInfo.status = 'failed';
        // Keep the error even in the case of timeout, if there was no error before.
        if (!('error' in  testInfo))
          testInfo.error = serializeError(error);
      }
    } finally {
      step.complete(testInfo.error);
    }
  }

  private async _runAfterHooks(test: TestCase, testInfo: TestInfoImpl) {
    let step: TestStepInternal | undefined;
    let teardownError: TestError | undefined;
    try {
      step = testInfo._addStep('hook', 'After Hooks');
      if (test._type === 'test')
        await this._runHooks(test.parent!, 'afterEach', testInfo);
    } catch (error) {
      if (!(error instanceof SkipError)) {
        if (testInfo.status === 'passed')
          testInfo.status = 'failed';
        // Do not overwrite test failure error.
        if (!('error' in  testInfo))
          testInfo.error = serializeError(error);
        // Continue running even after the failure.
      }
    }
    try {
      await this._fixtureRunner.teardownScope('test');
    } catch (error) {
      if (testInfo.status === 'passed')
        testInfo.status = 'failed';
      // Do not overwrite test failure error.
      if (!('error' in  testInfo)) {
        testInfo.error = serializeError(error);
        teardownError = testInfo.error;
      }
    }
    step?.complete(teardownError);
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
        await this._fixtureRunner.resolveParametersAndRunHookOrTest(hook, this._workerInfo, testInfo);
      } catch (e) {
        // Always run all the hooks, and capture the first error.
        error = error || e;
      }
    }
    if (error)
      throw error;
  }

  private _reportDone() {
    const donePayload: DonePayload = {
      failedTestId: this._failedTestId,
      fatalError: this._fatalError,
    };
    this.emit('done', donePayload);
    this._fatalError = undefined;
  }
}

function buildTestBeginPayload(testId: string, testInfo: TestInfo, startWallTime: number): TestBeginPayload {
  return {
    testId,
    workerIndex: testInfo.workerIndex,
    startWallTime,
  };
}

function buildTestEndPayload(testId: string, testInfo: TestInfo): TestEndPayload {
  return {
    testId,
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

function modifier(testInfo: TestInfo, type: 'skip' | 'fail' | 'fixme' | 'slow', modifierArgs: [arg?: any, description?: string]) {
  if (typeof modifierArgs[1] === 'function') {
    throw new Error([
      'It looks like you are calling test.skip() inside the test and pass a callback.',
      'Pass a condition instead and optional description instead:',
      `test('my test', async ({ page, isMobile }) => {`,
      `  test.skip(isMobile, 'This test is not applicable on mobile');`,
      `});`,
    ].join('\n'));
  }

  if (modifierArgs.length >= 1 && !modifierArgs[0])
    return;

  const description = modifierArgs[1];
  testInfo.annotations.push({ type, description });
  if (type === 'slow') {
    testInfo.setTimeout(testInfo.timeout * 3);
  } else if (type === 'skip' || type === 'fixme') {
    testInfo.expectedStatus = 'skipped';
    throw new SkipError('Test is skipped: ' + (description || ''));
  } else if (type === 'fail') {
    if (testInfo.expectedStatus !== 'skipped')
      testInfo.expectedStatus = 'failed';
  }
}

class SkipError extends Error {
}
