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

import { captureRawStack, monotonicTime, sanitizeForFilePath, stringifyStackFrames, currentZone, createGuid } from 'playwright-core/lib/utils';

import { TimeoutManager, TimeoutManagerError, kMaxDeadline } from './timeoutManager';
import { addSuffixToFilePath, filteredStackTrace, getContainedPath, normalizeAndSaveAttachment, sanitizeFilePathBeforeExtension, trimLongString, windowsFilesystemFriendlyLength } from '../util';
import { TestTracing } from './testTracing';
import { testInfoError } from './util';
import { wrapFunctionWithLocation } from '../transform/transform';

import type { RunnableDescription } from './timeoutManager';
import type { FullProject, TestInfo, TestStatus, TestStepInfo, TestAnnotation } from '../../types/test';
import type { FullConfig, Location } from '../../types/testReporter';
import type { FullConfigInternal, FullProjectInternal } from '../common/config';
import type { AttachmentPayload, StepBeginPayload, StepEndPayload, TestInfoErrorImpl, WorkerInitParams } from '../common/ipc';
import type { TestCase } from '../common/test';
import type { StackFrame } from '@protocol/channels';
import type { TestStepCategory } from '../util';

export interface TestStepInternal {
  complete(result: { error?: Error | unknown, suggestedRebaseline?: string }): void;
  info: TestStepInfoImpl
  attachmentIndices: number[];
  stepId: string;
  title: string;
  category: TestStepCategory;
  location?: Location;
  boxedStack?: StackFrame[];
  steps: TestStepInternal[];
  endWallTime?: number;
  apiName?: string;
  params?: Record<string, any>;
  error?: TestInfoErrorImpl;
  infectParentStepsWithError?: boolean;
  box?: boolean;
}

type SnapshotNames = {
  lastAnonymousSnapshotIndex: number;
  lastNamedSnapshotIndex: { [key: string]: number };
};

export class TestInfoImpl implements TestInfo {
  private _onStepBegin: (payload: StepBeginPayload) => void;
  private _onStepEnd: (payload: StepEndPayload) => void;
  private _onAttach: (payload: AttachmentPayload) => void;
  private _snapshotNames: SnapshotNames = { lastAnonymousSnapshotIndex: 0, lastNamedSnapshotIndex: {} };
  private _ariaSnapshotNames: SnapshotNames = { lastAnonymousSnapshotIndex: 0, lastNamedSnapshotIndex: {} };
  readonly _timeoutManager: TimeoutManager;
  readonly _startTime: number;
  readonly _startWallTime: number;
  readonly _tracing: TestTracing;
  readonly _uniqueSymbol;

  _wasInterrupted = false;
  _lastStepId = 0;
  private readonly _requireFile: string;
  readonly _projectInternal: FullProjectInternal;
  readonly _configInternal: FullConfigInternal;
  private readonly _steps: TestStepInternal[] = [];
  private readonly _stepMap = new Map<string, TestStepInternal>();
  _onDidFinishTestFunction: (() => Promise<void>) | undefined;
  _hasNonRetriableError = false;
  _hasUnhandledError = false;
  _allowSkips = false;

  // ------------ Main methods ------------
  skip: (arg?: any, description?: string) => void;
  fixme: (arg?: any, description?: string) => void;
  fail: (arg?: any, description?: string) => void;
  slow: (arg?: any, description?: string) => void;

  // ------------ TestInfo fields ------------
  readonly testId: string;
  readonly repeatEachIndex: number;
  readonly retry: number;
  readonly workerIndex: number;
  readonly parallelIndex: number;
  readonly project: FullProject;
  readonly config: FullConfig;
  readonly title: string;
  readonly titlePath: string[];
  readonly file: string;
  readonly line: number;
  readonly tags: string[];
  readonly column: number;
  readonly fn: Function;
  expectedStatus: TestStatus;
  duration: number = 0;
  readonly annotations: TestAnnotation[] = [];
  readonly attachments: TestInfo['attachments'] = [];
  status: TestStatus = 'passed';
  snapshotSuffix: string = '';
  readonly outputDir: string;
  readonly snapshotDir: string;
  errors: TestInfoErrorImpl[] = [];
  readonly _attachmentsPush: (...items: TestInfo['attachments']) => number;

  get error(): TestInfoErrorImpl | undefined {
    return this.errors[0];
  }

  set error(e: TestInfoErrorImpl | undefined) {
    if (e === undefined)
      throw new Error('Cannot assign testInfo.error undefined value!');
    this.errors[0] = e;
  }

  get timeout(): number {
    return this._timeoutManager.defaultSlot().timeout;
  }

  set timeout(timeout: number) {
    // Ignored.
  }

  _deadlineForMatcher(timeout: number): { deadline: number, timeoutMessage: string } {
    const startTime = monotonicTime();
    const matcherDeadline = timeout ? startTime + timeout : kMaxDeadline;
    const testDeadline = this._timeoutManager.currentSlotDeadline() - 250;
    const matcherMessage = `Timeout ${timeout}ms exceeded while waiting on the predicate`;
    const testMessage = `Test timeout of ${this.timeout}ms exceeded`;
    return { deadline: Math.min(testDeadline, matcherDeadline), timeoutMessage: testDeadline < matcherDeadline ? testMessage : matcherMessage };
  }

  static _defaultDeadlineForMatcher(timeout: number): { deadline: any; timeoutMessage: any; } {
    return { deadline: (timeout ? monotonicTime() + timeout : 0), timeoutMessage: `Timeout ${timeout}ms exceeded while waiting on the predicate` };
  }

  constructor(
    configInternal: FullConfigInternal,
    projectInternal: FullProjectInternal,
    workerParams: WorkerInitParams,
    test: TestCase | undefined,
    retry: number,
    onStepBegin: (payload: StepBeginPayload) => void,
    onStepEnd: (payload: StepEndPayload) => void,
    onAttach: (payload: AttachmentPayload) => void,
  ) {
    this.testId = test?.id ?? '';
    this._onStepBegin = onStepBegin;
    this._onStepEnd = onStepEnd;
    this._onAttach = onAttach;
    this._startTime = monotonicTime();
    this._startWallTime = Date.now();
    this._requireFile = test?._requireFile ?? '';
    this._uniqueSymbol = Symbol('testInfoUniqueSymbol');

    this.repeatEachIndex = workerParams.repeatEachIndex;
    this.retry = retry;
    this.workerIndex = workerParams.workerIndex;
    this.parallelIndex =  workerParams.parallelIndex;
    this._projectInternal = projectInternal;
    this.project = projectInternal.project;
    this._configInternal = configInternal;
    this.config = configInternal.config;
    this.title = test?.title ?? '';
    this.titlePath = test?.titlePath() ?? [];
    this.file = test?.location.file ?? '';
    this.line = test?.location.line ?? 0;
    this.column = test?.location.column ?? 0;
    this.tags = test?.tags ?? [];
    this.fn = test?.fn ?? (() => {});
    this.expectedStatus = test?.expectedStatus ?? 'skipped';

    this._timeoutManager = new TimeoutManager(this.project.timeout);
    if (configInternal.configCLIOverrides.debug)
      this._setDebugMode();

    this.outputDir = (() => {
      const relativeTestFilePath = path.relative(this.project.testDir, this._requireFile.replace(/\.(spec|test)\.(js|ts|jsx|tsx|mjs|mts|cjs|cts)$/, ''));
      const sanitizedRelativePath = relativeTestFilePath.replace(process.platform === 'win32' ? new RegExp('\\\\', 'g') : new RegExp('/', 'g'), '-');
      const fullTitleWithoutSpec = this.titlePath.slice(1).join(' ');

      let testOutputDir = trimLongString(sanitizedRelativePath + '-' + sanitizeForFilePath(fullTitleWithoutSpec), windowsFilesystemFriendlyLength);
      if (projectInternal.id)
        testOutputDir += '-' + sanitizeForFilePath(projectInternal.id);
      if (this.retry)
        testOutputDir += '-retry' + this.retry;
      if (this.repeatEachIndex)
        testOutputDir += '-repeat' + this.repeatEachIndex;
      return path.join(this.project.outputDir, testOutputDir);
    })();

    this.snapshotDir = (() => {
      const relativeTestFilePath = path.relative(this.project.testDir, this._requireFile);
      return path.join(this.project.snapshotDir, relativeTestFilePath + '-snapshots');
    })();

    this._attachmentsPush = this.attachments.push.bind(this.attachments);
    this.attachments.push = (...attachments: TestInfo['attachments']) => {
      for (const a of attachments)
        this._attach(a, this._parentStep()?.stepId);
      return this.attachments.length;
    };

    this._tracing = new TestTracing(this, workerParams.artifactsDir);

    this.skip = wrapFunctionWithLocation((location, ...args) => this._modifier('skip', location, args));
    this.fixme = wrapFunctionWithLocation((location, ...args) => this._modifier('fixme', location, args));
    this.fail = wrapFunctionWithLocation((location, ...args) => this._modifier('fail', location, args));
    this.slow = wrapFunctionWithLocation((location, ...args) => this._modifier('slow', location, args));
  }

  _modifier(type: 'skip' | 'fail' | 'fixme' | 'slow', location: Location, modifierArgs: [arg?: any, description?: string]) {
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
    this.annotations.push({ type, description, location });
    if (type === 'slow') {
      this._timeoutManager.slow();
    } else if (type === 'skip' || type === 'fixme') {
      this.expectedStatus = 'skipped';
      throw new TestSkipError('Test is skipped: ' + (description || ''));
    } else if (type === 'fail') {
      if (this.expectedStatus !== 'skipped')
        this.expectedStatus = 'failed';
    }
  }

  private _findLastPredefinedStep(steps: TestStepInternal[]): TestStepInternal | undefined {
    // Find the deepest predefined step that has not finished yet.
    for (let i = steps.length - 1; i >= 0; i--) {
      const child = this._findLastPredefinedStep(steps[i].steps);
      if (child)
        return child;
      if ((steps[i].category === 'hook' || steps[i].category === 'fixture') && !steps[i].endWallTime)
        return steps[i];
    }
  }

  private _parentStep() {
    return currentZone().data<TestStepInternal>('stepZone') ?? this._findLastPredefinedStep(this._steps);
  }

  _addStep(data: Omit<TestStepInternal, 'complete' | 'stepId' | 'steps' | 'attachmentIndices' | 'info'>, parentStep?: TestStepInternal): TestStepInternal {
    const stepId = `${data.category}@${++this._lastStepId}`;

    if (data.category === 'hook' || data.category === 'fixture') {
      // Predefined steps form a fixed hierarchy - use the current one as parent.
      parentStep = this._findLastPredefinedStep(this._steps);
    } else {
      if (!parentStep)
        parentStep = this._parentStep();
    }

    const filteredStack = filteredStackTrace(captureRawStack());
    data.boxedStack = parentStep?.boxedStack;
    if (!data.boxedStack && data.box) {
      data.boxedStack = filteredStack.slice(1);
      data.location = data.location || data.boxedStack[0];
    }
    data.location = data.location || filteredStack[0];

    const attachmentIndices: number[] = [];
    const step: TestStepInternal = {
      stepId,
      ...data,
      steps: [],
      attachmentIndices,
      info: new TestStepInfoImpl(this, stepId),
      complete: result => {
        if (step.endWallTime)
          return;

        step.endWallTime = Date.now();
        if (result.error) {
          if (typeof result.error === 'object' && !(result.error as any)?.[stepSymbol])
            (result.error as any)[stepSymbol] = step;
          const error = testInfoError(result.error);
          if (data.boxedStack)
            error.stack = `${error.message}\n${stringifyStackFrames(data.boxedStack).join('\n')}`;
          step.error = error;
        }

        if (!step.error) {
          // Soft errors inside try/catch will make the test fail.
          // In order to locate the failing step, we are marking all the parent
          // steps as failing unconditionally.
          for (const childStep of step.steps) {
            if (childStep.error && childStep.infectParentStepsWithError) {
              step.error = childStep.error;
              step.infectParentStepsWithError = true;
              break;
            }
          }
        }

        const payload: StepEndPayload = {
          testId: this.testId,
          stepId,
          wallTime: step.endWallTime,
          error: step.error,
          suggestedRebaseline: result.suggestedRebaseline,
          annotations: step.info.annotations,
        };
        this._onStepEnd(payload);
        const errorForTrace = step.error ? { name: '', message: step.error.message || '', stack: step.error.stack } : undefined;
        const attachments = attachmentIndices.map(i => this.attachments[i]);
        this._tracing.appendAfterActionForStep(stepId, errorForTrace, attachments, step.info.annotations);
      }
    };
    const parentStepList = parentStep ? parentStep.steps : this._steps;
    parentStepList.push(step);
    this._stepMap.set(stepId, step);
    const payload: StepBeginPayload = {
      testId: this.testId,
      stepId,
      parentStepId: parentStep ? parentStep.stepId : undefined,
      title: data.title,
      category: data.category,
      wallTime: Date.now(),
      location: data.location,
    };
    this._onStepBegin(payload);
    this._tracing.appendBeforeActionForStep(stepId, parentStep?.stepId, {
      title: data.title,
      category: data.category,
      params: data.params,
      stack: data.location ? [data.location] : []
    });
    return step;
  }

  _interrupt() {
    // Mark as interrupted so we can ignore TimeoutError thrown by interrupt() call.
    this._wasInterrupted = true;
    this._timeoutManager.interrupt();
    // Do not overwrite existing failure (for example, unhandled rejection) with "interrupted".
    if (this.status === 'passed')
      this.status = 'interrupted';
  }

  _failWithError(error: Error | unknown) {
    if (this.status === 'passed' || this.status === 'skipped')
      this.status = error instanceof TimeoutManagerError ? 'timedOut' : 'failed';
    const serialized = testInfoError(error);
    const step: TestStepInternal | undefined = typeof error === 'object' ? (error as any)?.[stepSymbol] : undefined;
    if (step && step.boxedStack)
      serialized.stack = `${(error as Error).name}: ${(error as Error).message}\n${stringifyStackFrames(step.boxedStack).join('\n')}`;
    this.errors.push(serialized);
    this._tracing.appendForError(serialized);
  }

  async _runAsStep(stepInfo: { title: string, category: 'hook' | 'fixture', location?: Location }, cb: () => Promise<any>) {
    const step = this._addStep(stepInfo);
    try {
      await cb();
      step.complete({});
    } catch (error) {
      step.complete({ error });
      throw error;
    }
  }

  async _runWithTimeout(runnable: RunnableDescription, cb: () => Promise<any>) {
    try {
      await this._timeoutManager.withRunnable(runnable, async () => {
        try {
          await cb();
        } catch (e) {
          if (this._allowSkips && (e instanceof TestSkipError)) {
            if (this.status === 'passed')
              this.status = 'skipped';
          } else {
            // Unfortunately, we have to handle user errors and timeout errors differently.
            // Consider the following scenario:
            // - locator.click times out
            // - all steps containing the test function finish with TimeoutManagerError
            // - test finishes, the page is closed and this triggers locator.click error
            // - we would like to present the locator.click error to the user
            // - therefore, we need a try/catch inside the "run with timeout" block and capture the error
            this._failWithError(e);
          }
          throw e;
        }
      });
    } catch (error) {
      // When interrupting, we arrive here with a TimeoutManagerError, but we should not
      // consider it a timeout.
      if (!this._wasInterrupted && (error instanceof TimeoutManagerError))
        this._failWithError(error);
      throw error;
    }
  }

  _isFailure() {
    return this.status !== 'skipped' && this.status !== this.expectedStatus;
  }

  _currentHookType() {
    const type = this._timeoutManager.currentSlotType();
    return ['beforeAll', 'afterAll', 'beforeEach', 'afterEach'].includes(type) ? type : undefined;
  }

  _setDebugMode() {
    this._timeoutManager.setIgnoreTimeouts();
  }

  // ------------ TestInfo methods ------------

  async attach(name: string, options: { path?: string, body?: string | Buffer, contentType?: string } = {}) {
    const step = this._addStep({
      title: name,
      category: 'test.attach',
    });
    this._attach(await normalizeAndSaveAttachment(this.outputPath(), name, options), step.stepId);
    step.complete({});
  }

  _attach(attachment: TestInfo['attachments'][0], stepId: string | undefined) {
    const index = this._attachmentsPush(attachment) - 1;
    if (stepId) {
      this._stepMap.get(stepId)!.attachmentIndices.push(index);
    } else {
      const callId = `attach@${createGuid()}`;
      this._tracing.appendBeforeActionForStep(callId, undefined, { title: attachment.name, category: 'test.attach', stack: [] });
      this._tracing.appendAfterActionForStep(callId, undefined, [attachment]);
    }

    this._onAttach({
      testId: this.testId,
      name: attachment.name,
      contentType: attachment.contentType,
      path: attachment.path,
      body: attachment.body?.toString('base64'),
      stepId,
    });
  }

  outputPath(...pathSegments: string[]){
    const outputPath = this._getOutputPath(...pathSegments);
    fs.mkdirSync(this.outputDir, { recursive: true });
    return outputPath;
  }

  _getOutputPath(...pathSegments: string[]){
    const joinedPath = path.join(...pathSegments);
    const outputPath = getContainedPath(this.outputDir, joinedPath);
    if (outputPath)
      return outputPath;
    throw new Error(`The outputPath is not allowed outside of the parent directory. Please fix the defined path.\n\n\toutputPath: ${joinedPath}`);
  }

  _fsSanitizedTestName() {
    const fullTitleWithoutSpec = this.titlePath.slice(1).join(' ');
    return sanitizeForFilePath(trimLongString(fullTitleWithoutSpec));
  }

  _resolveSnapshotPaths(kind: 'snapshot' | 'screenshot' | 'aria', name: string | string[] | undefined, updateSnapshotIndex: 'updateSnapshotIndex' | 'dontUpdateSnapshotIndex', anonymousExtension?: string) {
    // NOTE: snapshot path must not ever change for backwards compatibility!

    const snapshotNames = kind === 'aria' ? this._ariaSnapshotNames : this._snapshotNames;
    const defaultExtensions = { 'aria': '.aria.yml', 'screenshot': '.png', 'snapshot': '.txt' };
    const ariaAwareExtname = (filePath: string) => kind === 'aria' && filePath.endsWith('.aria.yml') ? '.aria.yml' : path.extname(filePath);

    let subPath: string;
    let ext: string;
    let relativeOutputPath: string;

    if (!name) {
      // Consider the use case below. We should save actual to different paths, so we use |nextAnonymousSnapshotIndex|.
      //
      //   expect.toMatchSnapshot('a.png')
      //   // noop
      //   expect.toMatchSnapshot('a.png')
      const index = snapshotNames.lastAnonymousSnapshotIndex + 1;
      if (updateSnapshotIndex === 'updateSnapshotIndex')
        snapshotNames.lastAnonymousSnapshotIndex = index;
      const fullTitleWithoutSpec = [...this.titlePath.slice(1), index].join(' ');
      ext = anonymousExtension ?? defaultExtensions[kind];
      subPath = sanitizeFilePathBeforeExtension(trimLongString(fullTitleWithoutSpec) + ext, ext);
      // Trim the output file paths more aggressively to avoid hitting Windows filesystem limits.
      relativeOutputPath = sanitizeFilePathBeforeExtension(trimLongString(fullTitleWithoutSpec, windowsFilesystemFriendlyLength) + ext, ext);
    } else {
      if (Array.isArray(name)) {
        // We intentionally do not sanitize user-provided array of segments,
        // assuming it is a file system path.
        // See https://github.com/microsoft/playwright/pull/9156.
        subPath = path.join(...name);
        relativeOutputPath = path.join(...name);
        ext = ariaAwareExtname(subPath);
      } else {
        ext = ariaAwareExtname(name);
        subPath = sanitizeFilePathBeforeExtension(name, ext);
        // Trim the output file paths more aggressively to avoid hitting Windows filesystem limits.
        relativeOutputPath = sanitizeFilePathBeforeExtension(trimLongString(name, windowsFilesystemFriendlyLength), ext);
      }
      const index = (snapshotNames.lastNamedSnapshotIndex[relativeOutputPath] || 0) + 1;
      if (updateSnapshotIndex === 'updateSnapshotIndex')
        snapshotNames.lastNamedSnapshotIndex[relativeOutputPath] = index;
      if (index > 1)
        relativeOutputPath = addSuffixToFilePath(relativeOutputPath, `-${index - 1}`);
    }

    const absoluteSnapshotPath = this._applyPathTemplate(kind, subPath, ext);
    return { absoluteSnapshotPath, relativeOutputPath };
  }

  private _applyPathTemplate(kind: 'snapshot' | 'screenshot' | 'aria', relativePath: string, ext: string) {
    const legacyTemplate = '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}{-snapshotSuffix}{ext}';
    let template: string;
    if (kind === 'screenshot') {
      template = this._projectInternal.expect?.toHaveScreenshot?.pathTemplate || this._projectInternal.snapshotPathTemplate || legacyTemplate;
    } else if (kind === 'aria') {
      const ariaDefaultTemplate = '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}';
      template = this._projectInternal.expect?.toMatchAriaSnapshot?.pathTemplate || this._projectInternal.snapshotPathTemplate || ariaDefaultTemplate;
    } else {
      template = this._projectInternal.snapshotPathTemplate || legacyTemplate;
    }

    const dir = path.dirname(relativePath);
    const name = path.basename(relativePath, ext);
    const relativeTestFilePath = path.relative(this.project.testDir, this._requireFile);
    const parsedRelativeTestFilePath = path.parse(relativeTestFilePath);
    const projectNamePathSegment = sanitizeForFilePath(this.project.name);

    const snapshotPath = template
        .replace(/\{(.)?testDir\}/g, '$1' + this.project.testDir)
        .replace(/\{(.)?snapshotDir\}/g, '$1' + this.project.snapshotDir)
        .replace(/\{(.)?snapshotSuffix\}/g, this.snapshotSuffix ? '$1' + this.snapshotSuffix : '')
        .replace(/\{(.)?testFileDir\}/g, '$1' + parsedRelativeTestFilePath.dir)
        .replace(/\{(.)?platform\}/g, '$1' + process.platform)
        .replace(/\{(.)?projectName\}/g, projectNamePathSegment ? '$1' + projectNamePathSegment : '')
        .replace(/\{(.)?testName\}/g, '$1' + this._fsSanitizedTestName())
        .replace(/\{(.)?testFileName\}/g, '$1' + parsedRelativeTestFilePath.base)
        .replace(/\{(.)?testFilePath\}/g, '$1' + relativeTestFilePath)
        .replace(/\{(.)?arg\}/g, '$1' + path.join(dir, name))
        .replace(/\{(.)?ext\}/g, ext ? '$1' + ext : '');

    return path.normalize(path.resolve(this._configInternal.configDir, snapshotPath));
  }

  snapshotPath(...name: string[]): string;
  snapshotPath(name: string, options: { kind: 'snapshot' | 'screenshot' | 'aria' }): string;
  snapshotPath(...args: any[]) {
    let name: string[] = args;
    let kind: 'snapshot' | 'screenshot' | 'aria' = 'snapshot';

    const options = args[args.length - 1];
    if (options && typeof options === 'object') {
      kind = options.kind ?? kind;
      name = args.slice(0, -1);
    }

    if (!['snapshot', 'screenshot', 'aria'].includes(kind))
      throw new Error(`testInfo.snapshotPath: unknown kind "${kind}", must be one of "snapshot", "screenshot" or "aria"`);

    // Assume a zero/single path segment corresponds to `toHaveScreenshot(name)`,
    // while multiple path segments correspond to `toHaveScreenshot([...name])`.
    return this._resolveSnapshotPaths(kind, name.length <= 1 ? name[0] : name, 'dontUpdateSnapshotIndex').absoluteSnapshotPath;
  }

  setTimeout(timeout: number) {
    this._timeoutManager.setTimeout(timeout);
  }
}

export class TestStepInfoImpl implements TestStepInfo {
  annotations: TestAnnotation[] = [];

  private _testInfo: TestInfoImpl;
  private _stepId: string;

  skip: (arg?: any, description?: string) => void;

  constructor(testInfo: TestInfoImpl, stepId: string) {
    this._testInfo = testInfo;
    this._stepId = stepId;
    this.skip = wrapFunctionWithLocation((location: Location, ...args: unknown[]) => {
      // skip();
      // skip(condition: boolean, description: string);
      if (args.length > 0 && !args[0])
        return;
      const description = args[1] as (string|undefined);
      this.annotations.push({ type: 'skip', description, location });
      throw new StepSkipError(description);
    });
  }

  async _runStepBody<T>(skip: boolean, body: (step: TestStepInfo) => T | Promise<T>, location?: Location) {
    if (skip) {
      this.annotations.push({ type: 'skip', location });
      return undefined as T;
    }
    try {
      return await body(this);
    } catch (e) {
      if (e instanceof StepSkipError)
        return undefined as T;
      throw e;
    }
  }

  _attachToStep(attachment: TestInfo['attachments'][0]): void {
    this._testInfo._attach(attachment, this._stepId);
  }

  async attach(name: string, options?: { body?: string | Buffer; contentType?: string; path?: string; }): Promise<void> {
    this._attachToStep(await normalizeAndSaveAttachment(this._testInfo.outputPath(), name, options));
  }
}

export class TestSkipError extends Error {
}

export class StepSkipError extends Error {
}

const stepSymbol = Symbol('step');
