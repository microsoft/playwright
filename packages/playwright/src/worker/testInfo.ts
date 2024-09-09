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
import { captureRawStack, monotonicTime, zones, sanitizeForFilePath, stringifyStackFrames } from 'playwright-core/lib/utils';
import type { TestInfoError, TestInfo, TestStatus, FullProject } from '../../types/test';
import type { AttachmentPayload, StepBeginPayload, StepEndPayload, WorkerInitParams } from '../common/ipc';
import type { TestCase } from '../common/test';
import { TimeoutManager, TimeoutManagerError, kMaxDeadline } from './timeoutManager';
import type { RunnableDescription } from './timeoutManager';
import type { Annotation, FullConfigInternal, FullProjectInternal } from '../common/config';
import type { FullConfig, Location } from '../../types/testReporter';
import { debugTest, filteredStackTrace, formatLocation, getContainedPath, normalizeAndSaveAttachment, serializeError, trimLongString, windowsFilesystemFriendlyLength } from '../util';
import { TestTracing } from './testTracing';
import type { Attachment } from './testTracing';
import type { StackFrame } from '@protocol/channels';

export interface TestStepInternal {
  complete(result: { error?: Error | unknown, attachments?: Attachment[] }): void;
  stepId: string;
  title: string;
  category: 'hook' | 'fixture' | 'test.step' | 'expect' | 'attach' | string;
  location?: Location;
  boxedStack?: StackFrame[];
  steps: TestStepInternal[];
  endWallTime?: number;
  apiName?: string;
  params?: Record<string, any>;
  error?: TestInfoError;
  infectParentStepsWithError?: boolean;
  box?: boolean;
  isStage?: boolean;
}

export type TestStage = {
  title: string;
  stepInfo?: { category: 'hook' | 'fixture', location?: Location };
  runnable?: RunnableDescription;
  step?: TestStepInternal;
};

export class TestInfoImpl implements TestInfo {
  private _onStepBegin: (payload: StepBeginPayload) => void;
  private _onStepEnd: (payload: StepEndPayload) => void;
  private _onAttach: (payload: AttachmentPayload) => void;
  readonly _timeoutManager: TimeoutManager;
  readonly _startTime: number;
  readonly _startWallTime: number;
  readonly _tracing: TestTracing;

  _wasInterrupted = false;
  _lastStepId = 0;
  private readonly _requireFile: string;
  readonly _projectInternal: FullProjectInternal;
  readonly _configInternal: FullConfigInternal;
  private readonly _steps: TestStepInternal[] = [];
  _onDidFinishTestFunction: (() => Promise<void>) | undefined;
  _hasNonRetriableError = false;
  _hasUnhandledError = false;
  _allowSkips = false;

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
  readonly annotations: Annotation[] = [];
  readonly attachments: TestInfo['attachments'] = [];
  status: TestStatus = 'passed';
  snapshotSuffix: string = '';
  readonly outputDir: string;
  readonly snapshotDir: string;
  errors: TestInfoError[] = [];
  readonly _attachmentsPush: (...items: TestInfo['attachments']) => number;

  get error(): TestInfoError | undefined {
    return this.errors[0];
  }

  set error(e: TestInfoError | undefined) {
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
        this._attach(a.name, a);
      return this.attachments.length;
    };

    this._tracing = new TestTracing(this, workerParams.artifactsDir);
  }

  private _modifier(type: 'skip' | 'fail' | 'fixme' | 'slow', modifierArgs: [arg?: any, description?: string]) {
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
    this.annotations.push({ type, description });
    if (type === 'slow') {
      this._timeoutManager.slow();
    } else if (type === 'skip' || type === 'fixme') {
      this.expectedStatus = 'skipped';
      throw new SkipError('Test is skipped: ' + (description || ''));
    } else if (type === 'fail') {
      if (this.expectedStatus !== 'skipped')
        this.expectedStatus = 'failed';
    }
  }

  private _findLastStageStep(steps: TestStepInternal[]): TestStepInternal | undefined {
    // Find the deepest step that is marked as isStage and has not finished yet.
    for (let i = steps.length - 1; i >= 0; i--) {
      const child = this._findLastStageStep(steps[i].steps);
      if (child)
        return child;
      if (steps[i].isStage && !steps[i].endWallTime)
        return steps[i];
    }
  }

  _addStep(data: Omit<TestStepInternal, 'complete' | 'stepId' | 'steps'>): TestStepInternal {
    const stepId = `${data.category}@${++this._lastStepId}`;

    let parentStep: TestStepInternal | undefined;
    if (data.isStage) {
      // Predefined stages form a fixed hierarchy - use the current one as parent.
      parentStep = this._findLastStageStep(this._steps);
    } else {
      parentStep = zones.zoneData<TestStepInternal>('stepZone');
      if (!parentStep) {
        // If no parent step on stack, assume the current stage as parent.
        parentStep = this._findLastStageStep(this._steps);
      }
    }

    const filteredStack = filteredStackTrace(captureRawStack());
    data.boxedStack = parentStep?.boxedStack;
    if (!data.boxedStack && data.box) {
      data.boxedStack = filteredStack.slice(1);
      data.location = data.location || data.boxedStack[0];
    }
    data.location = data.location || filteredStack[0];

    const step: TestStepInternal = {
      stepId,
      ...data,
      steps: [],
      complete: result => {
        if (step.endWallTime)
          return;

        step.endWallTime = Date.now();
        if (result.error) {
          if (typeof result.error === 'object' && !(result.error as any)?.[stepSymbol])
            (result.error as any)[stepSymbol] = step;
          const error = serializeError(result.error);
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
        };
        this._onStepEnd(payload);
        const errorForTrace = step.error ? { name: '', message: step.error.message || '', stack: step.error.stack } : undefined;
        this._tracing.appendAfterActionForStep(stepId, errorForTrace, result.attachments);
      }
    };
    const parentStepList = parentStep ? parentStep.steps : this._steps;
    parentStepList.push(step);
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
    this._tracing.appendBeforeActionForStep(stepId, parentStep?.stepId, data.apiName || data.title, data.params, data.location ? [data.location] : []);
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
    const serialized = serializeError(error);
    const step: TestStepInternal | undefined = typeof error === 'object' ? (error as any)?.[stepSymbol] : undefined;
    if (step && step.boxedStack)
      serialized.stack = `${(error as Error).name}: ${(error as Error).message}\n${stringifyStackFrames(step.boxedStack).join('\n')}`;
    this.errors.push(serialized);
    this._tracing.appendForError(serialized);
  }

  async _runAsStage(stage: TestStage, cb: () => Promise<any>) {
    if (debugTest.enabled) {
      const location = stage.runnable?.location ? ` at "${formatLocation(stage.runnable.location)}"` : ``;
      debugTest(`started stage "${stage.title}"${location}`);
    }
    stage.step = stage.stepInfo ? this._addStep({ ...stage.stepInfo, title: stage.title, isStage: true }) : undefined;

    try {
      await this._timeoutManager.withRunnable(stage.runnable, async () => {
        try {
          await cb();
        } catch (e) {
          // Only handle errors directly thrown by the user code.
          if (!stage.runnable)
            throw e;
          if (this._allowSkips && (e instanceof SkipError)) {
            if (this.status === 'passed')
              this.status = 'skipped';
          } else {
            // Unfortunately, we have to handle user errors and timeout errors differently.
            // Consider the following scenario:
            // - locator.click times out
            // - all stages containing the test function finish with TimeoutManagerError
            // - test finishes, the page is closed and this triggers locator.click error
            // - we would like to present the locator.click error to the user
            // - therefore, we need a try/catch inside the "run with timeout" block and capture the error
            this._failWithError(e);
          }
          throw e;
        }
      });
      stage.step?.complete({});
    } catch (error) {
      // When interrupting, we arrive here with a TimeoutManagerError, but we should not
      // consider it a timeout.
      if (!this._wasInterrupted && (error instanceof TimeoutManagerError) && stage.runnable)
        this._failWithError(error);
      stage.step?.complete({ error });
      throw error;
    } finally {
      debugTest(`finished stage "${stage.title}"`);
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
    this._attach(name, await normalizeAndSaveAttachment(this.outputPath(), name, options));
  }

  private _attach(name: string, attachment: TestInfo['attachments'][0]) {
    const step = this._addStep({
      title: `attach "${name}"`,
      category: 'attach',
    });
    this._attachmentsPush(attachment);
    this._onAttach({
      testId: this.testId,
      name: attachment.name,
      contentType: attachment.contentType,
      path: attachment.path,
      body: attachment.body?.toString('base64')
    });
    step.complete({ attachments: [attachment] });
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

  snapshotPath(...pathSegments: string[]) {
    const subPath = path.join(...pathSegments);
    const parsedSubPath = path.parse(subPath);
    const relativeTestFilePath = path.relative(this.project.testDir, this._requireFile);
    const parsedRelativeTestFilePath = path.parse(relativeTestFilePath);
    const projectNamePathSegment = sanitizeForFilePath(this.project.name);

    const snapshotPath = (this._projectInternal.snapshotPathTemplate || '')
        .replace(/\{(.)?testDir\}/g, '$1' + this.project.testDir)
        .replace(/\{(.)?snapshotDir\}/g, '$1' + this.project.snapshotDir)
        .replace(/\{(.)?snapshotSuffix\}/g, this.snapshotSuffix ? '$1' + this.snapshotSuffix : '')
        .replace(/\{(.)?testFileDir\}/g, '$1' + parsedRelativeTestFilePath.dir)
        .replace(/\{(.)?platform\}/g, '$1' + process.platform)
        .replace(/\{(.)?projectName\}/g, projectNamePathSegment ? '$1' + projectNamePathSegment : '')
        .replace(/\{(.)?testName\}/g, '$1' + this._fsSanitizedTestName())
        .replace(/\{(.)?testFileName\}/g, '$1' + parsedRelativeTestFilePath.base)
        .replace(/\{(.)?testFilePath\}/g, '$1' + relativeTestFilePath)
        .replace(/\{(.)?arg\}/g, '$1' + path.join(parsedSubPath.dir, parsedSubPath.name))
        .replace(/\{(.)?ext\}/g, parsedSubPath.ext ? '$1' + parsedSubPath.ext : '');

    return path.normalize(path.resolve(this._configInternal.configDir, snapshotPath));
  }

  skip(...args: [arg?: any, description?: string]) {
    this._modifier('skip', args);
  }

  fixme(...args: [arg?: any, description?: string]) {
    this._modifier('fixme', args);
  }

  fail(...args: [arg?: any, description?: string]) {
    this._modifier('fail', args);
  }

  slow(...args: [arg?: any, description?: string]) {
    this._modifier('slow', args);
  }

  setTimeout(timeout: number) {
    this._timeoutManager.setTimeout(timeout);
  }
}

export class SkipError extends Error {
}

const stepSymbol = Symbol('step');
