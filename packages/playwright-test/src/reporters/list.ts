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
import { BaseReporter, formatTestTitle } from './base';
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
  private readonly _ttyWidthForTest: number;

  constructor(options: { omitFailures?: boolean } = {}) {
    super(options);
    this._ttyWidthForTest = parseInt(process.env.PWTEST_TTY_WIDTH || '', 10);
    this._liveTerminal = process.stdout.isTTY || process.env.PWTEST_SKIP_TEST_OUTPUT || !!this._ttyWidthForTest;
  }

  printsToStdio() {
    return true;
  }

  override onBegin(config: FullConfig, suite: Suite) {
    super.onBegin(config, suite);
    console.log(this.generateStartingMessage());
    console.log();
  }

  onTestBegin(test: TestCase) {
    if (this._liveTerminal) {
      if (this._needNewLine) {
        this._needNewLine = false;
        process.stdout.write('\n');
        this._lastRow++;
      }
      const line = '     ' + colors.gray(formatTestTitle(this.config, test));
      process.stdout.write(this._fitToScreen(line, 0) + '\n');
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
    this._updateTestLine(test, '     ' + colors.gray(formatTestTitle(this.config, test, step)), '');
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep) {
    if (!this._liveTerminal)
      return;
    if (step.category !== 'test.step')
      return;
    this._updateTestLine(test, '     ' + colors.gray(formatTestTitle(this.config, test, step.parent)), '');
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
        text = '\u001b[2K\u001b[0G' + colors.green(statusMark) + colors.gray(title);
      else
        text = '\u001b[2K\u001b[0G' + colors.red(statusMark + title);
    }

    if (this._liveTerminal) {
      this._updateTestLine(test, text, duration);
    } else {
      if (this._needNewLine) {
        this._needNewLine = false;
        process.stdout.write('\n');
      }
      process.stdout.write(text + duration);
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
    // Erase line
    process.stdout.write('\u001B[2K');
    process.stdout.write(this._fitToScreen(line, visibleLength(suffix)) + suffix);
    // Go down if needed.
    if (testRow !== this._lastRow)
      process.stdout.write(`\u001B[${this._lastRow - testRow}E`);
  }

  private _fitToScreen(line: string, suffixLength: number): string {
    const ttyWidth = this._ttyWidth() - suffixLength;
    if (!this._ttyWidth() || line.length <= ttyWidth)
      return line;
    let m;
    let colorLen = 0;
    while ((m = kColorsRe.exec(line)) !== null) {
      const visibleLen = m.index - colorLen;
      if (visibleLen >= ttyWidth)
        break;
      colorLen += m[0].length;
    }
    // Truncate and reset all colors.
    return line.substr(0, ttyWidth + colorLen) + '\u001b[0m';
  }

  private _ttyWidth(): number {
    return this._ttyWidthForTest || process.stdout.columns || 0;
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

// Matches '\u001b[2K\u001b[0G' and all color codes.
const kColorsRe = /\u001b\[2K\u001b\[0G|\x1B\[\d+m/g;
function visibleLength(s: string): number {
  return s.replace(kColorsRe, '').length;
}

export default ListReporter;
