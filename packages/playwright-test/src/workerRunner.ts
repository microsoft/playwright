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
import * as mime from 'mime';
import util from 'util';
import colors from 'colors/safe';
import { EventEmitter } from 'events';
import { monotonicTime, serializeError, sanitizeForFilePath, getContainedPath, addSuffixToFilePath, prependToTestError, trimLongString, formatLocation } from './util';
import { TestBeginPayload, TestEndPayload, RunPayload, TestEntry, DonePayload, WorkerInitParams, StepBeginPayload, StepEndPayload } from './ipc';
import { setCurrentTestInfo } from './globals';
import { Loader } from './loader';
import { Modifier, Suite, TestCase } from './test';
import { Annotations, TestCaseType, TestError, TestInfo, TestInfoImpl, TestStepInternal, WorkerInfo } from './types';
import { ProjectImpl } from './project';
import { FixtureRunner } from './fixtures';
import { DeadlineRunner, raceAgainstDeadline } from 'playwright-core/lib/utils/async';
import { calculateSha1, isString } from 'playwright-core/lib/utils/utils';

const removeFolderAsync = util.promisify(rimraf);

type TestData = { testId: string, testInfo: TestInfoImpl, type: TestCaseType };

export class WorkerRunner extends EventEmitter {
  private _params: WorkerInitParams;
  private _loader!: Loader;
  private _project!: ProjectImpl;
  private _workerInfo!: WorkerInfo;
  private _projectNamePathSegment = '';
  private _uniqueProjectNamePathSegment = '';
  private _fixtureRunner: FixtureRunner;

  private _failedTest: TestData | undefined;
  private _fatalError: TestError | undefined;
  private _entries = new Map<string, TestEntry>();
  private _isStopped = false;
  private _runFinished = Promise.resolve();
  private _currentDeadlineRunner: DeadlineRunner<any> | undefined;
  _currentTest: TestData | null = null;

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
    await this._teardownScopes();
    if (this._fatalError)
      this.emit('teardownError', { error: this._fatalError });
  }

  private async _teardownScopes() {
    // TODO: separate timeout for teardown?
    const result = await raceAgainstDeadline((async () => {
      await this._fixtureRunner.teardownScope('test');
      await this._fixtureRunner.teardownScope('worker');
    })(), this._deadline());
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
    if (this._currentTest && this._currentTest.type === 'test' && this._currentTest.testInfo.expectedStatus !== 'failed') {
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
      const fileSuite = await this._loader.loadTestFile(runPayload.file);
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
      const result = await raceAgainstDeadline(this._fixtureRunner.resolveParametersAndRunFunction(beforeAllModifier.fn, this._workerInfo, undefined), this._deadline());
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
    const startTime = monotonicTime();
    const startWallTime = Date.now();
    let deadlineRunner: DeadlineRunner<any> | undefined;
    const testId = test._id;

    const baseOutputDir = (() => {
      const relativeTestFilePath = path.relative(this._project.config.testDir, test._requireFile.replace(/\.(spec|test)\.(js|ts|mjs)$/, ''));
      const sanitizedRelativePath = relativeTestFilePath.replace(process.platform === 'win32' ? new RegExp('\\\\', 'g') : new RegExp('/', 'g'), '-');
      const fullTitleWithoutSpec = test.titlePath().slice(1).join(' ') + (test._type === 'test' ? '' : '-worker' + this._params.workerIndex);

      let testOutputDir = sanitizedRelativePath + '-' + sanitizeForFilePath(trimLongString(fullTitleWithoutSpec));
      if (this._uniqueProjectNamePathSegment)
        testOutputDir += '-' + this._uniqueProjectNamePathSegment;
      if (retry)
        testOutputDir += '-retry' + retry;
      if (this._params.repeatEachIndex)
        testOutputDir += '-repeat' + this._params.repeatEachIndex;
      return path.join(this._project.config.outputDir, testOutputDir);
    })();

    const snapshotDir = (() => {
      const relativeTestFilePath = path.relative(this._project.config.testDir, test._requireFile);
      return path.join(this._project.config.snapshotDir, relativeTestFilePath + '-snapshots');
    })();

    let lastStepId = 0;
    const testInfo: TestInfoImpl = {
      workerIndex: this._params.workerIndex,
      parallelIndex: this._params.parallelIndex,
      project: this._project.config,
      config: this._loader.fullConfig(),
      title: test.title,
      titlePath: test.titlePath(),
      file: test.location.file,
      line: test.location.line,
      column: test.location.column,
      fn: test.fn,
      repeatEachIndex: this._params.repeatEachIndex,
      retry,
      expectedStatus: test.expectedStatus,
      annotations: [],
      attachments: [],
      attach: async (name: string, options: { path?: string, body?: string | Buffer, contentType?: string } = {}) => {
        if ((options.path !== undefined ? 1 : 0) + (options.body !== undefined ? 1 : 0) !== 1)
          throw new Error(`Exactly one of "path" and "body" must be specified`);
        if (isString(options.path)) {
          const hash = calculateSha1(options.path);
          const dest = testInfo.outputPath('attachments', hash + path.extname(options.path));
          await fs.promises.mkdir(path.dirname(dest), { recursive: true });
          await fs.promises.copyFile(options.path, dest);
          const contentType = options.contentType ?? (mime.getType(path.basename(options.path)) || 'application/octet-stream');
          testInfo.attachments.push({ name, contentType, path: dest });
        } else {
          const contentType = options.contentType ?? (typeof options.body === 'string' ? 'text/plain' : 'application/octet-stream');
          testInfo.attachments.push({ name, contentType, body: typeof options.body === 'string' ? Buffer.from(options.body) : options.body });
        }
      },
      duration: 0,
      status: 'passed',
      stdout: [],
      stderr: [],
      timeout: this._project.config.timeout,
      snapshotSuffix: '',
      outputDir: baseOutputDir,
      snapshotDir,
      outputPath: (...pathSegments: string[]): string => {
        fs.mkdirSync(baseOutputDir, { recursive: true });
        const joinedPath = path.join(...pathSegments);
        const outputPath = getContainedPath(baseOutputDir, joinedPath);
        if (outputPath) return outputPath;
        throw new Error(`The outputPath is not allowed outside of the parent directory. Please fix the defined path.\n\n\toutputPath: ${joinedPath}`);
      },
      snapshotPath: (...pathSegments: string[]): string => {
        let suffix = '';
        if (this._projectNamePathSegment)
          suffix += '-' + this._projectNamePathSegment;
        if (testInfo.snapshotSuffix)
          suffix += '-' + testInfo.snapshotSuffix;
        const subPath = addSuffixToFilePath(path.join(...pathSegments), suffix);
        const snapshotPath =  getContainedPath(snapshotDir, subPath);
        if (snapshotPath) return snapshotPath;
        throw new Error(`The snapshotPath is not allowed outside of the parent directory. Please fix the defined path.\n\n\tsnapshotPath: ${subPath}`);
      },
      skip: (...args: [arg?: any, description?: string]) => modifier(testInfo, 'skip', args),
      fixme: (...args: [arg?: any, description?: string]) => modifier(testInfo, 'fixme', args),
      fail: (...args: [arg?: any, description?: string]) => modifier(testInfo, 'fail', args),
      slow: (...args: [arg?: any, description?: string]) => modifier(testInfo, 'slow', args),
      setTimeout: (timeout: number) => {
        if (!testInfo.timeout)
          return; // Zero timeout means some debug mode - do not set a timeout.
        testInfo.timeout = timeout;
        if (deadlineRunner)
          deadlineRunner.updateDeadline(deadline());
      },
      _addStep: data => {
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
              testId,
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
          testId,
          stepId,
          ...data,
          location,
          wallTime: Date.now(),
        };
        this.emit('stepBegin', payload);
        return step;
      },
    };

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

    const testData: TestData = { testInfo, testId, type: test._type };
    this._currentTest = testData;
    setCurrentTestInfo(testInfo);

    const deadline = () => {
      return testInfo.timeout ? startTime + testInfo.timeout : 0;
    };

    this.emit('testBegin', buildTestBeginPayload(testData, startWallTime));

    if (testInfo.expectedStatus === 'skipped') {
      testInfo.status = 'skipped';
      this.emit('testEnd', buildTestEndPayload(testData));
      return;
    }

    // Update the fixture pool - it may differ between tests, but only in test-scoped fixtures.
    this._fixtureRunner.setPool(test._pool!);

    this._currentDeadlineRunner = deadlineRunner = new DeadlineRunner(this._runTestWithBeforeHooks(test, testInfo), deadline());
    const result = await deadlineRunner.result;
    // Do not overwrite test failure upon hook timeout.
    if (result.timedOut && testInfo.status === 'passed')
      testInfo.status = 'timedOut';
    testInfo.duration = monotonicTime() - startTime;

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

    testInfo.duration = monotonicTime() - startTime;
    this._currentDeadlineRunner = undefined;
    this._currentTest = null;
    setCurrentTestInfo(null);

    const isFailure = testInfo.status !== 'skipped' && testInfo.status !== testInfo.expectedStatus;
    if (isFailure) {
      // Delay reporting testEnd result until after teardownScopes is done.
      this._failedTest = testData;
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
      this.emit('testEnd', buildTestEndPayload(testData));
    }

    const preserveOutput = this._loader.fullConfig().preserveOutput === 'always' ||
      (this._loader.fullConfig().preserveOutput === 'failures-only' && isFailure);
    if (!preserveOutput)
      await removeFolderAsync(testInfo.outputDir).catch(e => {});
  }

  private async _runBeforeHooks(test: TestCase, testInfo: TestInfoImpl) {
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

  private async _runTestWithBeforeHooks(test: TestCase, testInfo: TestInfoImpl) {
    const step = testInfo._addStep({
      category: 'hook',
      title: 'Before Hooks',
      canHaveChildren: true,
      forceNoParent: true
    });
    let error1: TestError | undefined;
    if (test._type === 'test')
      error1 = await this._runFn(() => this._runBeforeHooks(test, testInfo), testInfo, 'allowSkips');

    // Do not run the test when beforeEach hook fails.
    if (testInfo.status === 'failed' || testInfo.status === 'skipped') {
      step.complete(error1);
      return;
    }

    const error2 = await this._runFn(async () => {
      const params = await this._fixtureRunner.resolveParametersForFunction(test.fn, this._workerInfo, testInfo);
      step.complete(); // Report fixture hooks step as completed.
      const fn = test.fn; // Extract a variable to get a better stack trace ("myTest" vs "TestCase.myTest [as fn]").
      await fn(params, testInfo);
    }, testInfo, 'allowSkips');

    step.complete(error2); // Second complete is a no-op.
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
      teardownError1 = await this._runFn(() => this._runHooks(test.parent!, 'afterEach', testInfo), testInfo, 'disallowSkips');
    // Continue teardown even after the failure.

    const teardownError2 = await this._runFn(() => this._fixtureRunner.teardownScope('test'), testInfo, 'disallowSkips');
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

  private async _runFn(fn: Function, testInfo: TestInfoImpl, skips: 'allowSkips' | 'disallowSkips'): Promise<TestError | undefined> {
    try {
      await fn();
    } catch (error) {
      if (skips === 'allowSkips' && error instanceof SkipError) {
        if (testInfo.status === 'passed')
          testInfo.status = 'skipped';
      } else {
        const serialized = serializeError(error);
        // Do not overwrite any previous error and error status.
        // Some (but not all) scenarios include:
        //   - expect() that fails after uncaught exception.
        //   - fail after the timeout, e.g. due to fixture teardown.
        if (testInfo.status === 'passed')
          testInfo.status = 'failed';
        if (!('error' in  testInfo))
          testInfo.error = serialized;
        return serialized;
      }
    }
  }

  private _reportDone() {
    const donePayload: DonePayload = { fatalError: this._fatalError };
    this.emit('done', donePayload);
    this._fatalError = undefined;
    this._failedTest = undefined;
  }
}

function buildTestBeginPayload(testData: TestData, startWallTime: number): TestBeginPayload {
  return {
    testId: testData.testId,
    startWallTime,
  };
}

function buildTestEndPayload(testData: TestData): TestEndPayload {
  const { testId, testInfo } = testData;
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
