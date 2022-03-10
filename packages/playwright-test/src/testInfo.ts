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
import fs from 'fs';
import * as mime from 'mime';
import path from 'path';
import { TimeoutRunner, TimeoutRunnerError } from 'playwright-core/lib/utils/async';
import { calculateSha1 } from 'playwright-core/lib/utils/utils';
import type { FullConfig, FullProject, TestError, TestInfo, TestStatus } from '../types/test';
import { WorkerInitParams } from './ipc';
import { Loader } from './loader';
import { ProjectImpl } from './project';
import { TestCase } from './test';
import { Annotation, TestStepInternal, Location } from './types';
import { addSuffixToFilePath, getContainedPath, monotonicTime, sanitizeForFilePath, serializeError, trimLongString } from './util';

type RunnableDescription = {
  type: 'test' | 'beforeAll' | 'afterAll' | 'beforeEach' | 'afterEach' | 'slow' | 'skip' | 'fail' | 'fixme' | 'teardown';
  location?: Location;
  // When runnable has a separate timeout, it does not count into the "shared time pool" for the test.
  timeout?: number;
};

export class TestInfoImpl implements TestInfo {
  private _projectImpl: ProjectImpl;
  private _addStepImpl: (data: Omit<TestStepInternal, 'complete'>) => TestStepInternal;
  readonly _test: TestCase;
  readonly _timeoutRunner: TimeoutRunner;
  readonly _startTime: number;
  readonly _startWallTime: number;
  private _hasHardError: boolean = false;
  private _currentRunnable: RunnableDescription = { type: 'test' };
  // Holds elapsed time of the "time pool" shared between fixtures, each hooks and test itself.
  private _elapsedTestTime = 0;
  readonly _screenshotsDir: string;

  // ------------ TestInfo fields ------------
  readonly repeatEachIndex: number;
  readonly retry: number;
  readonly workerIndex: number;
  readonly parallelIndex: number;
  readonly project: FullProject;
  config: FullConfig;
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
  timeout: number;
  snapshotSuffix: string = '';
  readonly outputDir: string;
  readonly snapshotDir: string;
  errors: TestError[] = [];

  get error(): TestError | undefined {
    return this.errors.length > 0 ? this.errors[0] : undefined;
  }

  set error(e: TestError | undefined) {
    if (e === undefined)
      throw new Error('Cannot assign testInfo.error undefined value!');
    if (!this.errors.length)
      this.errors.push(e);
    else
      this.errors[0] = e;
  }

  constructor(
    loader: Loader,
    workerParams: WorkerInitParams,
    test: TestCase,
    retry: number,
    addStepImpl: (data: Omit<TestStepInternal, 'complete'>) => TestStepInternal,
  ) {
    this._projectImpl = loader.projects()[workerParams.projectIndex];
    this._test = test;
    this._addStepImpl = addStepImpl;
    this._startTime = monotonicTime();
    this._startWallTime = Date.now();

    this.repeatEachIndex = workerParams.repeatEachIndex;
    this.retry = retry;
    this.workerIndex = workerParams.workerIndex;
    this.parallelIndex =  workerParams.parallelIndex;
    this.project = this._projectImpl.config;
    this.config = loader.fullConfig();
    this.title = test.title;
    this.titlePath = test.titlePath();
    this.file = test.location.file;
    this.line = test.location.line;
    this.column = test.location.column;
    this.fn = test.fn;
    this.expectedStatus = test.expectedStatus;
    this.timeout = this.project.timeout;

    this._timeoutRunner = new TimeoutRunner(this.timeout);

    this.outputDir = (() => {
      const sameName = loader.projects().filter(project => project.config.name === this.project.name);
      let uniqueProjectNamePathSegment: string;
      if (sameName.length > 1)
        uniqueProjectNamePathSegment = this.project.name + (sameName.indexOf(this._projectImpl) + 1);
      else
        uniqueProjectNamePathSegment = this.project.name;

      const relativeTestFilePath = path.relative(this.project.testDir, test._requireFile.replace(/\.(spec|test)\.(js|ts|mjs)$/, ''));
      const sanitizedRelativePath = relativeTestFilePath.replace(process.platform === 'win32' ? new RegExp('\\\\', 'g') : new RegExp('/', 'g'), '-');
      const fullTitleWithoutSpec = test.titlePath().slice(1).join(' ');

      let testOutputDir = trimLongString(sanitizedRelativePath + '-' + sanitizeForFilePath(fullTitleWithoutSpec));
      if (uniqueProjectNamePathSegment)
        testOutputDir += '-' + sanitizeForFilePath(uniqueProjectNamePathSegment);
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
    this._screenshotsDir = (() => {
      const relativeTestFilePath = path.relative(this.project.testDir, test._requireFile);
      return path.join(this.project.screenshotsDir, relativeTestFilePath);
    })();
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
      this.setTimeout(this.timeout * 3);
    } else if (type === 'skip' || type === 'fixme') {
      this.expectedStatus = 'skipped';
      throw new SkipError('Test is skipped: ' + (description || ''));
    } else if (type === 'fail') {
      if (this.expectedStatus !== 'skipped')
        this.expectedStatus = 'failed';
    }
  }

  _setCurrentRunnable(runnable: RunnableDescription) {
    if (this._currentRunnable.timeout === undefined)
      this._elapsedTestTime = this._timeoutRunner.elapsed();
    this._currentRunnable = runnable;
    if (runnable.timeout === undefined)
      this._timeoutRunner.updateTimeout(this.timeout, this._elapsedTestTime);
    else
      this._timeoutRunner.updateTimeout(runnable.timeout, 0);
  }

  async _runWithTimeout(cb: () => Promise<any>): Promise<void> {
    try {
      await this._timeoutRunner.run(cb);
    } catch (error) {
      if (!(error instanceof TimeoutRunnerError))
        throw error;
      // Do not overwrite existing failure upon hook/teardown timeout.
      if (this.status === 'passed') {
        this.status = 'timedOut';
        const title = titleForRunnable(this._currentRunnable);
        const suffix = title ? ` in ${title}` : '';
        const message = colors.red(`Timeout of ${this._currentRunnable.timeout ?? this.timeout}ms exceeded${suffix}.`);
        const location = this._currentRunnable.location;
        this.errors.push({
          message,
          // Include location for hooks and modifiers to distinguish between them.
          stack: location ? message + `\n    at ${location.file}:${location.line}:${location.column}` : undefined,
        });
      }
    }
    this.duration = monotonicTime() - this._startTime;
  }

  async _runFn(fn: Function, skips?: 'allowSkips'): Promise<TestError | undefined> {
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

  _addStep(data: Omit<TestStepInternal, 'complete'>) {
    return this._addStepImpl(data);
  }

  _failWithError(error: TestError, isHardError: boolean) {
    // Do not overwrite any previous hard errors.
    // Some (but not all) scenarios include:
    //   - expect() that fails after uncaught exception.
    //   - fail after the timeout, e.g. due to fixture teardown.
    if (isHardError && this._hasHardError)
      return;
    if (isHardError)
      this._hasHardError = true;
    if (this.status === 'passed')
      this.status = 'failed';
    this.errors.push(error);
  }

  // ------------ TestInfo methods ------------

  async attach(name: string, options: { path?: string, body?: string | Buffer, contentType?: string } = {}) {
    if ((options.path !== undefined ? 1 : 0) + (options.body !== undefined ? 1 : 0) !== 1)
      throw new Error(`Exactly one of "path" and "body" must be specified`);
    if (options.path !== undefined) {
      const hash = calculateSha1(options.path);
      const dest = this.outputPath('attachments', hash + path.extname(options.path));
      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      await fs.promises.copyFile(options.path, dest);
      const contentType = options.contentType ?? (mime.getType(path.basename(options.path)) || 'application/octet-stream');
      this.attachments.push({ name, contentType, path: dest });
    } else {
      const contentType = options.contentType ?? (typeof options.body === 'string' ? 'text/plain' : 'application/octet-stream');
      this.attachments.push({ name, contentType, body: typeof options.body === 'string' ? Buffer.from(options.body) : options.body });
    }
  }

  outputPath(...pathSegments: string[]){
    fs.mkdirSync(this.outputDir, { recursive: true });
    const joinedPath = path.join(...pathSegments);
    const outputPath = getContainedPath(this.outputDir, joinedPath);
    if (outputPath)
      return outputPath;
    throw new Error(`The outputPath is not allowed outside of the parent directory. Please fix the defined path.\n\n\toutputPath: ${joinedPath}`);
  }

  snapshotPath(...pathSegments: string[]) {
    let suffix = '';
    const projectNamePathSegment = sanitizeForFilePath(this.project.name);
    if (projectNamePathSegment)
      suffix += '-' + projectNamePathSegment;
    if (this.snapshotSuffix)
      suffix += '-' + this.snapshotSuffix;
    const subPath = addSuffixToFilePath(path.join(...pathSegments), suffix);
    const snapshotPath =  getContainedPath(this.snapshotDir, subPath);
    if (snapshotPath)
      return snapshotPath;
    throw new Error(`The snapshotPath is not allowed outside of the parent directory. Please fix the defined path.\n\n\tsnapshotPath: ${subPath}`);
  }

  _screenshotPath(...pathSegments: string[]) {
    const subPath = path.join(...pathSegments);
    const screenshotPath = getContainedPath(this._screenshotsDir, subPath);
    if (screenshotPath)
      return screenshotPath;
    throw new Error(`The screenshotPath is not allowed outside of the parent directory. Please fix the defined path.\n\n\tscreenshotPath: ${subPath}`);
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
    if (this._currentRunnable.timeout !== undefined) {
      if (!this._currentRunnable.timeout)
        return; // Zero timeout means some debug mode - do not set a timeout.
      this._currentRunnable.timeout = timeout;
      this._timeoutRunner.updateTimeout(timeout);
    } else {
      if (!this.timeout)
        return; // Zero timeout means some debug mode - do not set a timeout.
      this.timeout = timeout;
      this._timeoutRunner.updateTimeout(timeout);
    }
  }
}

class SkipError extends Error {
}

function titleForRunnable(runnable: RunnableDescription): string {
  switch (runnable.type) {
    case 'test':
      return '';
    case 'beforeAll':
    case 'beforeEach':
    case 'afterAll':
    case 'afterEach':
      return runnable.type + ' hook';
    case 'teardown':
      return 'fixtures teardown';
    case 'skip':
    case 'slow':
    case 'fixme':
    case 'fail':
      return runnable.type + ' modifier';
  }
}
