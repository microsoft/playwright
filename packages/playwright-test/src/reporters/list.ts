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
import { BaseReporter, formatTestTitle } from './base';
import type { FullConfig, FullResult, Suite, TestCase, TestResult, TestStep } from '../../types/testReporter';

// Allow it in the Visual Studio Code Terminal and the new Windows Terminal
const DOES_NOT_SUPPORT_UTF8_IN_TERMINAL = process.platform === 'win32' && process.env.TERM_PROGRAM !== 'vscode' && !process.env.WT_SESSION;
const USE_SIMPLE_MARKS = process.env.PW_TEST_DEBUG_REPORTERS || DOES_NOT_SUPPORT_UTF8_IN_TERMINAL;
const POSITIVE_STATUS_MARK = USE_SIMPLE_MARKS ? 'ok' : '✓';
const NEGATIVE_STATUS_MARK = USE_SIMPLE_MARKS ? 'x' : '✘';

const lineUp = (count: number) => process.env.PW_TEST_DEBUG_REPORTERS ? `<lineup${count}>` : `\u001B[${count}A`;
const lineDown = (count: number) => process.env.PW_TEST_DEBUG_REPORTERS ? `<linedown${count}>` : `\u001B[${count}E`;
const erase = () => process.env.PW_TEST_DEBUG_REPORTERS ? '<erase>' : '\u001B[2K\u001B[0G';

class ListReporter extends BaseReporter {
  private _lastRow = 0;
  private _testRows = new Map<TestCase, number>();

  constructor(options: { omitFailures?: boolean } = {}) {
    super(options);
  }

  printsToStdio() {
    return true;
  }

  override onBegin(config: FullConfig, suite: Suite) {
    super.onBegin(config, suite);
    console.log(this.generateStartingMessage());
    console.log();
  }

  override onTestBegin(test: TestCase, result: TestResult) {
    super.onTestBegin(test, result);
    if (this.liveTerminal) {
      this._eraseStats();
      const prefix = '     ';
      const line = colors.gray(formatTestTitle(this.config, test)) + this._retrySuffix(result);
      const formatted = prefix + this.fitToScreen(line, prefix);
      process.stdout.write(formatted);
      if (!this.fillsEntireScreen(formatted) || process.env.PW_TEST_DEBUG_REPORTERS)
        process.stdout.write('\n');
      this._testRows.set(test, this._lastRow++);
      this._writeStats();
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
    if (!this.liveTerminal)
      return;
    if (step.category !== 'test.step')
      return;
    this._updateTestLine(test, colors.gray(formatTestTitle(this.config, test, step)) + this._retrySuffix(result), '     ');
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep) {
    if (!this.liveTerminal)
      return;
    if (step.category !== 'test.step')
      return;
    this._updateTestLine(test, colors.gray(formatTestTitle(this.config, test, step.parent)) + this._retrySuffix(result), '     ');
  }

  private _eraseStats() {
    if (process.env.PW_TEST_DEBUG_REPORTERS)
      process.stdout.write('<erase stats>\n');
    else
      process.stdout.write(lineUp(1) + erase());
  }

  private _writeStats() {
    const stats = this.fitToScreen(this.generateStatsMessage('completed', false).message);
    if (process.env.PW_TEST_DEBUG_REPORTERS)
      process.stdout.write(stats + '\n');
    else
      process.stdout.write(erase() + stats + '\n');
  }

  private _dumpToStdio(test: TestCase | undefined, chunk: string | Buffer, stream: NodeJS.WriteStream) {
    if (this.config.quiet)
      return;
    const text = chunk.toString('utf-8');
    const addNewLine = text[chunk.length - 1] !== '\n';
    if (this.liveTerminal) {
      this._eraseStats();
      const newLineCount = text.split('\n').length - 1;
      this._lastRow += newLineCount + (addNewLine ? 1 : 0);
    }
    stream.write(chunk);
    if (addNewLine)
      stream.write('\n');
    if (this.liveTerminal)
      this._writeStats();
  }

  override onTestEnd(test: TestCase, result: TestResult) {
    super.onTestEnd(test, result);

    const title = formatTestTitle(this.config, test);
    let prefix = '';
    let text = '';
    if (result.status === 'skipped') {
      prefix = colors.green('  -  ');
      // Do not show duration for skipped.
      text = colors.cyan(title) + this._retrySuffix(result);
    } else {
      const statusMark = ('  ' + (result.status === 'passed' ? POSITIVE_STATUS_MARK : NEGATIVE_STATUS_MARK)).padEnd(5);
      if (result.status === test.expectedStatus) {
        prefix = colors.green(statusMark);
        text = colors.gray(title);
      } else {
        prefix = colors.red(statusMark);
        text = colors.red(title);
      }
      const ms = process.env.PW_TEST_DEBUG_REPORTERS ? 'XXms' : milliseconds(result.duration);
      text += this._retrySuffix(result) + colors.dim(` (${ms})`);
    }

    if (this.liveTerminal) {
      this._updateTestLine(test, text, prefix);
    } else {
      process.stdout.write(prefix + text);
      process.stdout.write('\n');
    }
  }

  private _updateTestLine(test: TestCase, line: string, prefix: string) {
    const testRow = this._testRows.get(test)!;
    const formatted = prefix + this.fitToScreen(line, prefix);
    this._eraseStats();
    if (process.env.PW_TEST_DEBUG_REPORTERS) {
      process.stdout.write(testRow + ' : ' + formatted + '\n');
    } else {
      // Go up to the test line and erase it.
      process.stdout.write(lineUp(this._lastRow - testRow) + erase());
      // Write the test line.
      process.stdout.write(formatted);
      if (this.fillsEntireScreen(formatted))
        process.stdout.write(lineUp(1));
      // Go down to the stats line.
      process.stdout.write(lineDown(this._lastRow - testRow));
    }
    this._writeStats();
  }

  private _retrySuffix(result: TestResult) {
    return result.retry ? colors.yellow(` (retry #${result.retry})`) : '';
  }

  override async onEnd(result: FullResult) {
    await super.onEnd(result);
    if (this.liveTerminal)
      this._eraseStats();
    process.stdout.write('\n');
    this.epilogue(true);
  }
}

export default ListReporter;
