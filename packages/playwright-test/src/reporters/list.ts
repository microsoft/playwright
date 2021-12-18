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
import colors from 'colors/safe';
import milliseconds from 'ms';
import { BaseReporter, fitToScreen, formatTestTitle } from './base';
import { FullConfig, FullResult, Suite, TestCase, TestResult, TestStep } from '../../types/testReporter';

// Allow it in the Visual Studio Code Terminal and the new Windows Terminal
const DOES_NOT_SUPPORT_UTF8_IN_TERMINAL = process.platform === 'win32' && process.env.TERM_PROGRAM !== 'vscode' && !process.env.WT_SESSION;
const POSITIVE_STATUS_MARK = DOES_NOT_SUPPORT_UTF8_IN_TERMINAL ? 'ok' : '✓';
const NEGATIVE_STATUS_MARK = DOES_NOT_SUPPORT_UTF8_IN_TERMINAL ? 'x' : '✘';

class ListReporter extends BaseReporter {
  private _lastRow = 0;
  private _testRows = new Map<TestCase, number>();
  private _needNewLine = false;
  private readonly _liveTerminal: string | boolean | undefined;

  constructor(options: { omitFailures?: boolean } = {}) {
    super(options);
    this._liveTerminal = process.stdout.isTTY || process.env.PWTEST_SKIP_TEST_OUTPUT || !!process.env.PWTEST_TTY_WIDTH;
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
    if (this._liveTerminal) {
      if (this._needNewLine) {
        this._needNewLine = false;
        process.stdout.write('\n');
        this._lastRow++;
      }
      const line = '     ' + colors.gray(formatTestTitle(this.config, test));
      const suffix = this._retrySuffix(result);
      process.stdout.write(this._fitToScreen(line, suffix) + suffix + '\n');
    }
    this._testRows.set(test, this._lastRow++);
  }

  override onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    super.onStdOut(chunk, test, result);
    this._dumpToStdio(test, chunk, process.stdout);
  }

  override onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    super.onStdErr(chunk, test, result);
    this._dumpToStdio(test, chunk, process.stdout);
  }

  onStepBegin(test: TestCase, result: TestResult, step: TestStep) {
    if (!this._liveTerminal)
      return;
    if (step.category !== 'test.step')
      return;
    this._updateTestLine(test, '     ' + colors.gray(formatTestTitle(this.config, test, step)), this._retrySuffix(result));
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep) {
    if (!this._liveTerminal)
      return;
    if (step.category !== 'test.step')
      return;
    this._updateTestLine(test, '     ' + colors.gray(formatTestTitle(this.config, test, step.parent)), this._retrySuffix(result));
  }

  private _dumpToStdio(test: TestCase | undefined, chunk: string | Buffer, stream: NodeJS.WriteStream) {
    if (this.config.quiet)
      return;
    const text = chunk.toString('utf-8');
    this._needNewLine = text[text.length - 1] !== '\n';
    if (this._liveTerminal) {
      const newLineCount = text.split('\n').length - 1;
      this._lastRow += newLineCount;
    }
    stream.write(chunk);
  }

  override onTestEnd(test: TestCase, result: TestResult) {
    super.onTestEnd(test, result);

    let duration = colors.dim(` (${milliseconds(result.duration)})`);
    const title = formatTestTitle(this.config, test);
    let text = '';
    if (result.status === 'skipped') {
      text = colors.green('  -  ') + colors.cyan(title);
      duration = ''; // Do not show duration for skipped.
    } else {
      const statusMark = ('  ' + (result.status === 'passed' ? POSITIVE_STATUS_MARK : NEGATIVE_STATUS_MARK)).padEnd(5);
      if (result.status === test.expectedStatus)
        text = colors.green(statusMark) + colors.gray(title);
      else
        text = colors.red(statusMark + title);
    }
    const suffix = this._retrySuffix(result) + duration;

    if (this._liveTerminal) {
      this._updateTestLine(test, text, suffix);
    } else {
      if (this._needNewLine) {
        this._needNewLine = false;
        process.stdout.write('\n');
      }
      process.stdout.write(text + suffix);
      process.stdout.write('\n');
    }
  }

  private _updateTestLine(test: TestCase, line: string, suffix: string) {
    if (process.env.PWTEST_SKIP_TEST_OUTPUT)
      this._updateTestLineForTest(test, line, suffix);
    else
      this._updateTestLineForTTY(test, line, suffix);
  }

  private _updateTestLineForTTY(test: TestCase, line: string, suffix: string) {
    const testRow = this._testRows.get(test)!;
    // Go up if needed
    if (testRow !== this._lastRow)
      process.stdout.write(`\u001B[${this._lastRow - testRow}A`);
    // Erase line, go to the start
    process.stdout.write('\u001B[2K\u001B[0G');
    process.stdout.write(this._fitToScreen(line, suffix) + suffix);
    // Go down if needed.
    if (testRow !== this._lastRow)
      process.stdout.write(`\u001B[${this._lastRow - testRow}E`);
  }

  private _retrySuffix(result: TestResult) {
    return (result.retry ? colors.yellow(` (retry #${result.retry})`) : '');
  }

  private _fitToScreen(line: string, suffix?: string): string {
    const ttyWidth = this.ttyWidth();
    if (!ttyWidth)
      return line;
    return fitToScreen(line, ttyWidth, suffix);
  }

  private _updateTestLineForTest(test: TestCase, line: string, suffix: string) {
    const testRow = this._testRows.get(test)!;
    process.stdout.write(testRow + ' : ' + line + suffix + '\n');
  }

  override async onEnd(result: FullResult) {
    await super.onEnd(result);
    process.stdout.write('\n');
    this.epilogue(true);
  }
}

export default ListReporter;
