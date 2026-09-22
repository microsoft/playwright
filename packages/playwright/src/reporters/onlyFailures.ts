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

import { markErrorsAsReported, TerminalReporter } from './base';

import type { FullResult, TestCase, TestError, TestResult } from '../../types/testReporter';
import type { TerminalReporterOptions } from './base';

class OnlyFailuresTestReporter extends TerminalReporter {
  private _failureIndex = new Map<TestCase, number>();
  private _needNewLine = false;

  constructor(options: TerminalReporterOptions = {}) {
    super({ ...options, lastResult: true });
  }

  override onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    super.onStdOut(chunk, test, result);
    this._dumpToStdio(chunk, this.screen.stdout);
  }

  override onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    super.onStdErr(chunk, test, result);
    this._dumpToStdio(chunk, this.screen.stderr);
  }

  private _dumpToStdio(chunk: string | Buffer, stream: NodeJS.WriteStream) {
    if (this.config.quiet)
      return;
    stream.write(chunk);
    if (chunk.length)
      this._needNewLine = !chunk.toString().endsWith('\n');
  }

  override onTestEnd(test: TestCase, result: TestResult) {
    super.onTestEnd(test, result);
    if (result.status !== 'skipped' && result.status !== test.expectedStatus)
      this._printFailure(test);
  }

  private _printFailure(test: TestCase) {
    let index = this._failureIndex.get(test);
    if (index === undefined) {
      index = this._failureIndex.size + 1;
      this._failureIndex.set(test, index);
    }
    const message = this.formatFailure(test, index);
    if (message.trim()) {
      this._maybeWriteNewLine();
      this.writeLine(message);
    }
  }

  override onError(error: TestError) {
    super.onError(error);
    this._maybeWriteNewLine();
    this.writeLine(this.formatError(error).message);
  }

  async onTestPaused(test: TestCase, result: TestResult) {
    // Without TTY, the user cannot interrupt the pause.
    if (!process.stdin.isTTY && !process.env.PW_TEST_DEBUG_REPORTERS)
      return;

    this._maybeWriteNewLine();
    if (test.outcome() === 'unexpected') {
      this._printFailure(test);
      markErrorsAsReported(result);
      this.writeLine(this.screen.colors.yellow('    Paused on error. Press Ctrl+C to end.'));
    } else {
      this.writeLine(this.screen.colors.yellow(this.formatTestHeader(test, { indent: '  ' })));
      this.writeLine(this.screen.colors.yellow('    Paused at test end. Press Ctrl+C to end.'));
    }
    await new Promise<void>(() => {});
  }

  override async onEnd(result: FullResult) {
    await super.onEnd(result);
    this._maybeWriteNewLine();
    this.epilogue(false);
  }

  private _maybeWriteNewLine() {
    if (this._needNewLine) {
      this.writeLine();
      this._needNewLine = false;
    }
  }
}

export default OnlyFailuresTestReporter;
