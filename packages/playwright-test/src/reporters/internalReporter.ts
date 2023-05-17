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
import { codeFrameColumns } from '../common/babelBundle';
import type { FullConfig, TestCase, TestError, TestResult, FullResult, TestStep, Reporter } from '../../types/testReporter';
import { Suite } from '../common/test';
import type { FullConfigInternal } from '../common/config';
import { Multiplexer } from './multiplexer';
import { prepareErrorStack, relativeFilePath } from './base';

type StdIOChunk = {
  chunk: string | Buffer;
  test?: TestCase;
  result?: TestResult;
};

export class InternalReporter {
  private _multiplexer: Multiplexer;
  private _deferred: { error?: TestError, stdout?: StdIOChunk, stderr?: StdIOChunk }[] | null = [];
  private _config!: FullConfigInternal;

  constructor(reporters: Reporter[]) {
    this._multiplexer = new Multiplexer(reporters);
  }

  onConfigure(config: FullConfigInternal) {
    this._config = config;
  }

  onBegin(config: FullConfig, suite: Suite) {
    this._multiplexer.onBegin(config, suite);

    const deferred = this._deferred!;
    this._deferred = null;
    for (const item of deferred) {
      if (item.error)
        this.onError(item.error);
      if (item.stdout)
        this.onStdOut(item.stdout.chunk, item.stdout.test, item.stdout.result);
      if (item.stderr)
        this.onStdErr(item.stderr.chunk, item.stderr.test, item.stderr.result);
    }
  }

  onTestBegin(test: TestCase, result: TestResult) {
    this._multiplexer.onTestBegin(test, result);
  }

  onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    if (this._deferred) {
      this._deferred.push({ stdout: { chunk, test, result } });
      return;
    }
    this._multiplexer.onStdOut(chunk, test, result);
  }

  onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    if (this._deferred) {
      this._deferred.push({ stderr: { chunk, test, result } });
      return;
    }

    this._multiplexer.onStdErr(chunk, test, result);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    this._addSnippetToTestErrors(test, result);
    this._multiplexer.onTestEnd(test, result);
  }

  async onEnd() { }

  async onExit(result: FullResult) {
    if (this._deferred) {
      // onBegin was not reported, emit it.
      this.onBegin(this._config.config, new Suite('', 'root'));
    }
    await this._multiplexer.onEnd(result);
    await this._multiplexer.onExit();
  }

  onError(error: TestError) {
    if (this._deferred) {
      this._deferred.push({ error });
      return;
    }
    addLocationAndSnippetToError(this._config.config, error);
    this._multiplexer.onError(error);
  }

  onStepBegin(test: TestCase, result: TestResult, step: TestStep) {
    this._multiplexer.onStepBegin(test, result, step);
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep) {
    this._addSnippetToStepError(test, step);
    this._multiplexer.onStepEnd(test, result, step);
  }

  private _addSnippetToTestErrors(test: TestCase, result: TestResult) {
    for (const error of result.errors)
      addLocationAndSnippetToError(this._config.config, error, test.location.file);
  }

  private _addSnippetToStepError(test: TestCase, step: TestStep) {
    if (step.error)
      addLocationAndSnippetToError(this._config.config, step.error, test.location.file);
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
