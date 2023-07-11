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
import { captureRawStack, createAfterActionTraceEventForStep, createBeforeActionTraceEventForStep, monotonicTime, zones } from 'playwright-core/lib/utils';
import type { TestInfoError, TestInfo, TestStatus, FullProject, FullConfig } from '../../types/test';
import type { AttachmentPayload, StepBeginPayload, StepEndPayload, WorkerInitParams } from '../common/ipc';
import type { TestCase } from '../common/test';
import { TimeoutManager } from './timeoutManager';
import type { Annotation, FullConfigInternal, FullProjectInternal } from '../common/config';
import type { Location } from '../../types/testReporter';
import { getContainedPath, normalizeAndSaveAttachment, sanitizeForFilePath, serializeError, trimLongString } from '../util';
import type * as trace from '@trace/trace';

export interface TestStepInternal {
  complete(result: { error?: Error | TestInfoError }): void;
  stepId: string;
  title: string;
  category: string;
  wallTime: number;
  location?: Location;
  steps: TestStepInternal[];
  laxParent?: boolean;
  endWallTime?: number;
  apiName?: string;
  params?: Record<string, any>;
  error?: TestInfoError;
  infectParentStepsWithError?: boolean;
}

export class TestInfoImpl implements TestInfo {
  private _onStepBegin: (payload: StepBeginPayload) => void;
  private _onStepEnd: (payload: StepEndPayload) => void;
  private _onAttach: (payload: AttachmentPayload) => void;
  readonly _test: TestCase;
  readonly _timeoutManager: TimeoutManager;
  readonly _startTime: number;
  readonly _startWallTime: number;
  private _hasHardError: boolean = false;
  readonly _traceEvents: trace.TraceEvent[] = [];
  _didTimeout = false;
  _wasInterrupted = false;
  _lastStepId = 0;
  readonly _projectInternal: FullProjectInternal;
  readonly _configInternal: FullConfigInternal;
  readonly _steps: TestStepInternal[] = [];
  _beforeHooksStep: TestStepInternal | undefined;
  _afterHooksStep: TestStepInternal | undefined;
  _onDidFinishTestFunction: (() => Promise<void>) | undefined;

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
  readonly column: number;
  readonly fn: Function;
  expectedStatus: TestStatus;
  duration: number = 0;
  readonly annotations: Annotation[] = [];
  readonly attachments: TestInfo['attachments'] = [];
  status: TestStatus = 'passed';
  readonly stdout: TestInfo['stdout'] = [];
  readonly stderr: TestInfo['stderr'] = [];
  snapshotSuffix: string = '';
  readonly outputDir: string;
  readonly snapshotDir: string;
  errors: TestInfoError[] = [];
  private _attachmentsPush: (...items: TestInfo['attachments']) => number;

  get error(): TestInfoError | undefined {
    return this.errors[0];
  }

  set error(e: TestInfoError | undefined) {
    if (e === undefined)
      throw new Error('Cannot assign testInfo.error undefined value!');
    this.errors[0] = e;
  }

  get timeout(): number {
    return this._timeoutManager.defaultSlotTimings().timeout;
  }

  set timeout(timeout: number) {
    // Ignored.
  }

  constructor(
    configInternal: FullConfigInternal,
    projectInternal: FullProjectInternal,
    workerParams: WorkerInitParams,
    test: TestCase,
    retry: number,
    onStepBegin: (payload: StepBeginPayload) => void,
    onStepEnd: (payload: StepEndPayload) => void,
    onAttach: (payload: AttachmentPayload) => void,
  ) {
    this._test = test;
    this.testId = test.id;
    this._onStepBegin = onStepBegin;
    this._onStepEnd = onStepEnd;
    this._onAttach = onAttach;
    this._startTime = monotonicTime();
    this._startWallTime = Date.now();

    this.repeatEachIndex = workerParams.repeatEachIndex;
    this.retry = retry;
    this.workerIndex = workerParams.workerIndex;
    this.parallelIndex =  workerParams.parallelIndex;
    this._projectInternal = projectInternal;
    this.project = projectInternal.project;
    this._configInternal = configInternal;
    this.config = configInternal.config;
    this.title = test.title;
    this.titlePath = test.titlePath();
    this.file = test.location.file;
    this.line = test.location.line;
    this.column = test.location.column;
    this.fn = test.fn;
    this.expectedStatus = test.expectedStatus;

    this._timeoutManager = new TimeoutManager(this.project.timeout);

    this.outputDir = (() => {
      const relativeTestFilePath = path.relative(this.project.testDir, test._requireFile.replace(/\.(spec|test)\.(js|ts|mjs)$/, ''));
      const sanitizedRelativePath = relativeTestFilePath.replace(process.platform === 'win32' ? new RegExp('\\\\', 'g') : new RegExp('/', 'g'), '-');
      const fullTitleWithoutSpec = test.titlePath().slice(1).join(' ');

      let testOutputDir = trimLongString(sanitizedRelativePath + '-' + sanitizeForFilePath(fullTitleWithoutSpec));
      if (projectInternal.id)
        testOutputDir += '-' + sanitizeForFilePath(projectInternal.id);
      if (this.retry)
        testOutputDir += '-retry' + this.retry;
      if (this.repeatEachIndex)
        testOutputDir += '-repeat' + this.repeatEachIndex;
      return path.join(this.project.outputDir, testOutputDir);
    })();

    this.snapshotDir = (() => {
      const relativeTestFilePath = path.relative(this.project.testDir, test._requireFile);
      return path.join(this.project.snapshotDir, relativeTestFilePath + '-snapshots');
    })();

    this._attachmentsPush = this.attachments.push.bind(this.attachments);
    this.attachments.push = (...attachments: TestInfo['attachments']) => {
      for (const a of attachments)
        this._attach(a.name, a);
      return this.attachments.length;
    };
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

  async _runWithTimeout(cb: () => Promise<any>): Promise<void> {
    const timeoutError = await this._timeoutManager.runWithTimeout(cb);
    // When interrupting, we arrive here with a timeoutError, but we should not
    // consider it a timeout.
    if (!this._wasInterrupted && timeoutError && !this._didTimeout) {
      this._didTimeout = true;
      this.errors.push(timeoutError);
      // Do not overwrite existing failure upon hook/teardown timeout.
      if (this.status === 'passed' || this.status === 'skipped')
        this.status = 'timedOut';
    }
    this.duration = this._timeoutManager.defaultSlotTimings().elapsed | 0;
  }

  async _runAndFailOnError(fn: () => Promise<void>, skips?: 'allowSkips'): Promise<TestInfoError | undefined> {
    try {
      await fn();
    } catch (error) {
      if (skips === 'allowSkips' && error instanceof SkipError) {
        if (this.status === 'passed')
          this.status = 'skipped';
      } else {
        const serialized = serializeError(error);
        this._failWithError(serialized, true /* isHardError */);
        return serialized;
      }
    }
  }

  _addStep(data: Omit<TestStepInternal, 'complete' | 'stepId' | 'steps'>, parentStep?: TestStepInternal): TestStepInternal {
    const stepId = `${data.category}@${++this._lastStepId}`;
    if (!parentStep)
      parentStep = zones.zoneData<TestStepInternal>('stepZone', captureRawStack()) || undefined;

    // For out-of-stack calls, locate the enclosing step.
    let isLaxParent = false;
    if (!parentStep && data.laxParent) {
      const visit = (step: TestStepInternal) => {
        // Never nest into under another lax element, it could be a series
        // of no-reply actions, ala page.continue().
        const canNest = step.category === data.category || step.category === 'expect' && data.category === 'attach';
        if (!step.endWallTime && canNest && !step.laxParent)
          parentStep = step;
        step.steps.forEach(visit);
      };
      this._steps.forEach(visit);
      isLaxParent = !!parentStep;
    }

    const initialAttachments = new Set(this.attachments);

    const step: TestStepInternal = {
      stepId,
      ...data,
      laxParent: isLaxParent,
      steps: [],
      complete: result => {
        if (step.endWallTime)
          return;
        step.endWallTime = Date.now();
        let error: TestInfoError | undefined;
        if (result.error instanceof Error) {
          // Step function threw an error.
          error = serializeError(result.error);
        } else if (result.error) {
          // Internal API step reported an error.
          error = result.error;
        }
        step.error = error;

        if (!error) {
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
          error = step.error;
        }

        const payload: StepEndPayload = {
          testId: this._test.id,
          stepId,
          wallTime: step.endWallTime,
          error,
        };
        this._onStepEnd(payload);
        const errorForTrace = error ? { name: '', message: error.message || '', stack: error.stack } : undefined;
        this._traceEvents.push(createAfterActionTraceEventForStep(stepId, serializeAttachments(this.attachments, initialAttachments), errorForTrace));
      }
    };
    const parentStepList = parentStep ? parentStep.steps : this._steps;
    parentStepList.push(step);
    const hasLocation = data.location && !data.location.file.includes('@playwright');
    // Sanitize location that comes from user land, it might have extra properties.
    const location = data.location && hasLocation ? { file: data.location.file, line: data.location.line, column: data.location.column } : undefined;
    const payload: StepBeginPayload = {
      testId: this._test.id,
      stepId,
      parentStepId: parentStep ? parentStep.stepId : undefined,
      title: data.title,
      category: data.category,
      wallTime: data.wallTime,
      location,
    };
    this._onStepBegin(payload);
    this._traceEvents.push(createBeforeActionTraceEventForStep(stepId, parentStep?.stepId, data.apiName || data.title, data.params, data.wallTime, data.location ? [data.location] : []));
    return step;
  }

  _appendStdioToTrace(type: 'stdout' | 'stderr', chunk: string | Buffer) {
    this._traceEvents.push({
      type,
      timestamp: monotonicTime(),
      text: typeof chunk === 'string' ? chunk : undefined,
      base64: typeof chunk === 'string' ? undefined : chunk.toString('base64'),
    });
  }

  _interrupt() {
    // Mark as interrupted so we can ignore TimeoutError thrown by interrupt() call.
    this._wasInterrupted = true;
    this._timeoutManager.interrupt();
    // Do not overwrite existing failure (for example, unhandled rejection) with "interrupted".
    if (this.status === 'passed')
      this.status = 'interrupted';
  }

  _failWithError(error: TestInfoError, isHardError: boolean) {
    // Do not overwrite any previous hard errors.
    // Some (but not all) scenarios include:
    //   - expect() that fails after uncaught exception.
    //   - fail after the timeout, e.g. due to fixture teardown.
    if (isHardError && this._hasHardError)
      return;
    if (isHardError)
      this._hasHardError = true;
    if (this.status === 'passed' || this.status === 'skipped')
      this.status = 'failed';
    this.errors.push(error);
  }

  async _runAsStep<T>(stepInfo: Omit<TestStepInternal, 'complete' | 'wallTime' | 'parentStepId' | 'stepId' | 'steps'>, cb: (step: TestStepInternal) => Promise<T>): Promise<T> {
    const step = this._addStep({ ...stepInfo, wallTime: Date.now() });
    return await zones.run('stepZone', step, async () => {
      try {
        const result = await cb(step);
        step.complete({});
        return result;
      } catch (e) {
        step.complete({ error: e instanceof SkipError ? undefined : serializeError(e) });
        throw e;
      }
    });
  }

  _isFailure() {
    return this.status !== 'skipped' && this.status !== this.expectedStatus;
  }

  // ------------ TestInfo methods ------------

  async attach(name: string, options: { path?: string, body?: string | Buffer, contentType?: string } = {}) {
    this._attach(name, await normalizeAndSaveAttachment(this.outputPath(), name, options));
  }

  private _attach(name: string, attachment: TestInfo['attachments'][0]) {
    const step = this._addStep({
      title: `attach "${name}"`,
      category: 'attach',
      wallTime: Date.now(),
      laxParent: true,
    });
    this._attachWithoutStep(attachment);
    step.complete({});
  }

  _attachWithoutStep(attachment: TestInfo['attachments'][0]) {
    this._attachmentsPush(attachment);
    this._onAttach({
      testId: this._test.id,
      name: attachment.name,
      contentType: attachment.contentType,
      path: attachment.path,
      body: attachment.body?.toString('base64')
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

  snapshotPath(...pathSegments: string[]) {
    const subPath = path.join(...pathSegments);
    const parsedSubPath = path.parse(subPath);
    const relativeTestFilePath = path.relative(this.project.testDir, this._test._requireFile);
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

function serializeAttachments(attachments: TestInfo['attachments'], initialAttachments: Set<TestInfo['attachments'][0]>): trace.AfterActionTraceEvent['attachments'] {
  return attachments.filter(a => a.name !== 'trace' && !initialAttachments.has(a)).map(a => {
    return {
      name: a.name,
      contentType: a.contentType,
      path: a.path,
      base64: a.body?.toString('base64'),
    };
  });
}

class SkipError extends Error {
}
