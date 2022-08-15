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

/* eslint-disable no-console */
import { colors, ms as milliseconds } from 'playwright-core/lib/utilsBundle';
import { BaseReporter, formatError, formatTestTitle, stripAnsiEscapes } from './base';
import type { FullConfig, FullResult, Suite, TestCase, TestError, TestResult, TestStep } from '../../types/testReporter';

// Allow it in the Visual Studio Code Terminal and the new Windows Terminal
const DOES_NOT_SUPPORT_UTF8_IN_TERMINAL = process.platform === 'win32' && process.env.TERM_PROGRAM !== 'vscode' && !process.env.WT_SESSION;
const POSITIVE_STATUS_MARK = DOES_NOT_SUPPORT_UTF8_IN_TERMINAL ? 'ok' : '✓';
const NEGATIVE_STATUS_MARK = DOES_NOT_SUPPORT_UTF8_IN_TERMINAL ? 'x' : '✘';

class ListReporter extends BaseReporter {
  private _lastRow = 0;
  private _testRows = new Map<TestCase, number>();
  private _resultIndex = new Map<TestResult, number>();
  private _needNewLine = false;
  private readonly _liveTerminal: string | boolean | undefined;

  constructor(options: { omitFailures?: boolean } = {}) {
    super(options);
    this._liveTerminal = process.stdout.isTTY || !!process.env.PWTEST_TTY_WIDTH;
  }

  printsToStdio() {
    return true;
  }

  override onBegin(config: FullConfig, suite: Suite) {
    super.onBegin(config, suite);
    console.log(this.generateStartingMessage());
    console.log();
  }

  onTestBegin(test: TestCase, result: TestResult) {
    if (this._liveTerminal)
      this._maybeWriteNewLine();
    this._resultIndex.set(result, this._resultIndex.size + 1);
    this._testRows.set(test, this._lastRow++);
    if (this._liveTerminal) {
      const prefix = this._testPrefix(result, '');
      const line = colors.dim(formatTestTitle(this.config, test)) + this._retrySuffix(result);
      process.stdout.write(prefix + this.fitToScreen(line, prefix) + '\n');
    }
  }

  override onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    super.onStdOut(chunk, test, result);
    this._dumpToStdio(test, chunk, process.stdout);
  }

  override onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    super.onStdErr(chunk, test, result);
    this._dumpToStdio(test, chunk, process.stderr);
  }

  onStepBegin(test: TestCase, result: TestResult, step: TestStep) {
    if (!this._liveTerminal)
      return;
    if (step.category !== 'test.step')
      return;
    this._updateTestLine(test, colors.dim(formatTestTitle(this.config, test, step)) + this._retrySuffix(result), this._testPrefix(result, ''));
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep) {
    if (!this._liveTerminal)
      return;
    if (step.category !== 'test.step')
      return;
    this._updateTestLine(test, colors.dim(formatTestTitle(this.config, test, step.parent)) + this._retrySuffix(result), this._testPrefix(result, ''));
  }

  private _maybeWriteNewLine() {
    if (this._needNewLine) {
      this._needNewLine = false;
      process.stdout.write('\n');
    }
  }

  private _updateLineCountAndNewLineFlagForOutput(text: string) {
    this._needNewLine = text[text.length - 1] !== '\n';
    if (this._liveTerminal) {
      const newLineCount = text.split('\n').length - 1;
      this._lastRow += newLineCount;
    }
  }

  private _dumpToStdio(test: TestCase | undefined, chunk: string | Buffer, stream: NodeJS.WriteStream) {
    if (this.config.quiet)
      return;
    const text = chunk.toString('utf-8');
    this._updateLineCountAndNewLineFlagForOutput(text);
    stream.write(chunk);
  }

  override onTestEnd(test: TestCase, result: TestResult) {
    super.onTestEnd(test, result);

    const title = formatTestTitle(this.config, test);
    let prefix = '';
    let text = '';
    if (result.status === 'skipped') {
      prefix = this._testPrefix(result, colors.green('-'));
      // Do not show duration for skipped.
      text = colors.cyan(title) + this._retrySuffix(result);
    } else {
      const statusMark = result.status === 'passed' ? POSITIVE_STATUS_MARK : NEGATIVE_STATUS_MARK;
      if (result.status === test.expectedStatus) {
        prefix = this._testPrefix(result, colors.green(statusMark));
        text = colors.dim(title);
      } else {
        prefix = this._testPrefix(result, colors.red(statusMark));
        text = colors.red(title);
      }
      text += this._retrySuffix(result) + colors.dim(` (${milliseconds(result.duration)})`);
    }

    if (this._liveTerminal) {
      this._updateTestLine(test, text, prefix);
    } else {
      this._maybeWriteNewLine();
      process.stdout.write(prefix + text);
      process.stdout.write('\n');
    }
  }

  private _updateTestLine(test: TestCase, line: string, prefix: string) {
    if (process.env.PW_TEST_DEBUG_REPORTERS)
      this._updateTestLineForTest(test, line, prefix);
    else
      this._updateTestLineForTTY(test, line, prefix);
  }

  private _updateTestLineForTTY(test: TestCase, line: string, prefix: string) {
    const testRow = this._testRows.get(test)!;
    // Go up if needed
    if (testRow !== this._lastRow)
      process.stdout.write(`\u001B[${this._lastRow - testRow}A`);
    // Erase line, go to the start
    process.stdout.write('\u001B[2K\u001B[0G');
    process.stdout.write(prefix + this.fitToScreen(line, prefix));
    // Go down if needed.
    if (testRow !== this._lastRow)
      process.stdout.write(`\u001B[${this._lastRow - testRow}E`);
    if (process.env.PWTEST_TTY_WIDTH)
      process.stdout.write('\n');  // For testing.
  }

  private _testPrefix(result: TestResult, statusMark: string) {
    const index = this._resultIndex.get(result)!;
    const statusMarkLength = stripAnsiEscapes(statusMark).length;
    return '  ' + statusMark + ' '.repeat(3 - statusMarkLength) + colors.dim(String(index) + ' ');
  }

  private _retrySuffix(result: TestResult) {
    return (result.retry ? colors.yellow(` (retry #${result.retry})`) : '');
  }

  private _updateTestLineForTest(test: TestCase, line: string, prefix: string) {
    const testRow = this._testRows.get(test)!;
    process.stdout.write(testRow + ' : ' + prefix + line + '\n');
  }

  override onError(error: TestError): void {
    super.onError(error);
    this._maybeWriteNewLine();
    const message = formatError(this.config, error, colors.enabled).message + '\n';
    this._updateLineCountAndNewLineFlagForOutput(message);
    process.stdout.write(message);
  }

  override async onEnd(result: FullResult) {
    await super.onEnd(result);
    process.stdout.write('\n');
    this.epilogue(true);
  }
}

export default ListReporter;
