/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'fs';
import { codeFrameColumns } from '../transform/babelBundle';
import type { FullConfig, TestCase, TestError, TestResult, FullResult, TestStep } from '../../types/testReporter';
import { Suite } from '../common/test';
import { colors, prepareErrorStack, relativeFilePath } from './base';
import type { ReporterV2 } from './reporterV2';
import { monotonicTime } from 'playwright-core/lib/utils';
import { Multiplexer } from './multiplexer';

export class InternalReporter implements ReporterV2 {
  private _reporter: ReporterV2;
  private _didBegin = false;
  private _config!: FullConfig;
  private _startTime: Date | undefined;
  private _monotonicStartTime: number | undefined;

  constructor(reporters: ReporterV2[]) {
    this._reporter = new Multiplexer(reporters);
  }

  version(): 'v2' {
    return 'v2';
  }

  onConfigure(config: FullConfig) {
    this._config = config;
    this._startTime = new Date();
    this._monotonicStartTime = monotonicTime();
    this._reporter.onConfigure?.(config);
  }

  onBegin(suite: Suite) {
    this._didBegin = true;
    this._reporter.onBegin?.(suite);
  }

  onTestBegin(test: TestCase, result: TestResult) {
    this._reporter.onTestBegin?.(test, result);
  }

  onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    this._reporter.onStdOut?.(chunk, test, result);
  }

  onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    this._reporter.onStdErr?.(chunk, test, result);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    this._addSnippetToTestErrors(test, result);
    this._reporter.onTestEnd?.(test, result);
  }

  async onEnd(result: { status: FullResult['status'] }) {
    if (!this._didBegin) {
      // onBegin was not reported, emit it.
      this.onBegin(new Suite('', 'root'));
    }
    return await this._reporter.onEnd?.({
      ...result,
      startTime: this._startTime!,
      duration: monotonicTime() - this._monotonicStartTime!,
    });
  }

  async onExit() {
    await this._reporter.onExit?.();
  }

  onError(error: TestError) {
    addLocationAndSnippetToError(this._config, error);
    this._reporter.onError?.(error);
  }

  onStepBegin(test: TestCase, result: TestResult, step: TestStep) {
    this._reporter.onStepBegin?.(test, result, step);
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep) {
    this._addSnippetToStepError(test, step);
    this._reporter.onStepEnd?.(test, result, step);
  }

  printsToStdio() {
    return this._reporter.printsToStdio ? this._reporter.printsToStdio() : true;
  }

  private _addSnippetToTestErrors(test: TestCase, result: TestResult) {
    for (const error of result.errors)
      addLocationAndSnippetToError(this._config, error, test.location.file);
  }

  private _addSnippetToStepError(test: TestCase, step: TestStep) {
    if (step.error)
      addLocationAndSnippetToError(this._config, step.error, test.location.file);
  }
}

function addLocationAndSnippetToError(config: FullConfig, error: TestError, file?: string) {
  if (error.stack && !error.location)
    error.location = prepareErrorStack(error.stack).location;
  const location = error.location;
  if (!location)
    return;

  try {
    const tokens = [];
    const source = fs.readFileSync(location.file, 'utf8');
    const codeFrame = codeFrameColumns(source, { start: location }, { highlightCode: true });
    // Convert /var/folders to /private/var/folders on Mac.
    if (!file || fs.realpathSync(file) !== location.file) {
      tokens.push(colors.gray(`   at `) + `${relativeFilePath(config, location.file)}:${location.line}`);
      tokens.push('');
    }
    tokens.push(codeFrame);
    error.snippet = tokens.join('\n');
  } catch (e) {
    // Failed to read the source file - that's ok.
  }
}
