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
import { colors } from 'playwright-core/lib/utilsBundle';
import { codeFrameColumns } from '../transform/babelBundle';
import type { FullConfig, TestCase, TestError, TestResult, FullResult, TestStep } from '../../types/testReporter';
import { Suite } from '../common/test';
import { Multiplexer } from './multiplexer';
import { prepareErrorStack, relativeFilePath } from './base';
import type { ReporterV2 } from './reporterV2';

export class InternalReporter implements ReporterV2 {
  private _multiplexer: Multiplexer;
  private _didBegin = false;
  private _config!: FullConfig;

  constructor(reporters: ReporterV2[]) {
    this._multiplexer = new Multiplexer(reporters);
  }

  onConfigure(config: FullConfig) {
    this._config = config;
    this._multiplexer.onConfigure(config);
  }

  onBegin(suite: Suite) {
    this._didBegin = true;
    this._multiplexer.onBegin(suite);
  }

  onTestBegin(test: TestCase, result: TestResult) {
    this._multiplexer.onTestBegin(test, result);
  }

  onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    this._multiplexer.onStdOut(chunk, test, result);
  }

  onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    this._multiplexer.onStdErr(chunk, test, result);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    this._addSnippetToTestErrors(test, result);
    this._multiplexer.onTestEnd(test, result);
  }

  async onEnd(result: FullResult) {
    if (!this._didBegin) {
      // onBegin was not reported, emit it.
      this.onBegin(new Suite('', 'root'));
    }
    await this._multiplexer.onEnd(result);
  }

  async onExit() {
    await this._multiplexer.onExit();
  }

  onError(error: TestError) {
    addLocationAndSnippetToError(this._config, error);
    this._multiplexer.onError(error);
  }

  onStepBegin(test: TestCase, result: TestResult, step: TestStep) {
    this._multiplexer.onStepBegin(test, result, step);
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep) {
    this._addSnippetToStepError(test, step);
    this._multiplexer.onStepEnd(test, result, step);
  }

  printsToStdio() {
    return this._multiplexer.printsToStdio();
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
