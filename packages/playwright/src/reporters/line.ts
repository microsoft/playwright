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

import { colors, BaseReporter, formatError, formatFailure, formatTestTitle } from './base';
import type { TestCase, Suite, TestResult, FullResult, TestStep, TestError } from '../../types/testReporter';

class LineReporter extends BaseReporter {
  private _current = 0;
  private _failures = 0;
  private _lastTest: TestCase | undefined;
  private _didBegin = false;

  override onBegin(suite: Suite) {
    super.onBegin(suite);
    const startingMessage = this.generateStartingMessage();
    if (startingMessage) {
      console.log(startingMessage);
      console.log();
    }
    this._didBegin = true;
  }

  override onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    super.onStdOut(chunk, test, result);
    this._dumpToStdio(test, chunk, process.stdout);
  }

  override onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    super.onStdErr(chunk, test, result);
    this._dumpToStdio(test, chunk, process.stderr);
  }

  private _dumpToStdio(test: TestCase | undefined, chunk: string | Buffer, stream: NodeJS.WriteStream) {
    if (this.config.quiet)
      return;
    if (!process.env.PW_TEST_DEBUG_REPORTERS)
      stream.write(`\u001B[1A\u001B[2K`);
    if (test && this._lastTest !== test) {
      // Write new header for the output.
      const title = colors.dim(formatTestTitle(this.config, test));
      stream.write(this.fitToScreen(title) + `\n`);
      this._lastTest = test;
    }

    stream.write(chunk);
    if (chunk[chunk.length - 1] !== '\n')
      console.log();

    console.log();
  }

  onTestBegin(test: TestCase, result: TestResult) {
    ++this._current;
    this._updateLine(test, result, undefined);
  }

  onStepBegin(test: TestCase, result: TestResult, step: TestStep) {
    if (step.category === 'test.step')
      this._updateLine(test, result, step);
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep) {
    if (step.category === 'test.step')
      this._updateLine(test, result, step.parent);
  }

  override onTestEnd(test: TestCase, result: TestResult) {
    super.onTestEnd(test, result);
    if (!this.willRetry(test) && (test.outcome() === 'flaky' || test.outcome() === 'unexpected' || result.status === 'interrupted')) {
      if (!process.env.PW_TEST_DEBUG_REPORTERS)
        process.stdout.write(`\u001B[1A\u001B[2K`);
      console.log(formatFailure(this.config, test, {
        index: ++this._failures
      }).message);
      console.log();
    }
  }

  private _updateLine(test: TestCase, result: TestResult, step?: TestStep) {
    const retriesPrefix = this.totalTestCount < this._current ? ` (retries)` : ``;
    const prefix = `[${this._current}/${this.totalTestCount}]${retriesPrefix} `;
    const currentRetrySuffix = result.retry ? colors.yellow(` (retry #${result.retry})`) : '';
    const title = formatTestTitle(this.config, test, step) + currentRetrySuffix;
    if (process.env.PW_TEST_DEBUG_REPORTERS)
      process.stdout.write(`${prefix + title}\n`);
    else
      process.stdout.write(`\u001B[1A\u001B[2K${prefix + this.fitToScreen(title, prefix)}\n`);
  }

  override onError(error: TestError): void {
    super.onError(error);

    const message = formatError(error, colors.enabled).message + '\n';
    if (!process.env.PW_TEST_DEBUG_REPORTERS && this._didBegin)
      process.stdout.write(`\u001B[1A\u001B[2K`);
    process.stdout.write(message);
    console.log();
  }

  override async onEnd(result: FullResult) {
    if (!process.env.PW_TEST_DEBUG_REPORTERS && this._didBegin)
      process.stdout.write(`\u001B[1A\u001B[2K`);
    await super.onEnd(result);
    this.epilogue(false);
  }
}

export default LineReporter;
