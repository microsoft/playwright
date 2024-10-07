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

import { ms as milliseconds } from 'playwright-core/lib/utilsBundle';
import { colors, BaseReporter, formatError, formatTestTitle, isTTY, stepSuffix, stripAnsiEscapes, ttyWidth } from './base';
import type { FullResult, Suite, TestCase, TestError, TestResult, TestStep } from '../../types/testReporter';
import { getAsBooleanFromENV } from 'playwright-core/lib/utils';

// Allow it in the Visual Studio Code Terminal and the new Windows Terminal
const DOES_NOT_SUPPORT_UTF8_IN_TERMINAL = process.platform === 'win32' && process.env.TERM_PROGRAM !== 'vscode' && !process.env.WT_SESSION;
const POSITIVE_STATUS_MARK = DOES_NOT_SUPPORT_UTF8_IN_TERMINAL ? 'ok' : '✓';
const NEGATIVE_STATUS_MARK = DOES_NOT_SUPPORT_UTF8_IN_TERMINAL ? 'x' : '✘';

class ListReporter extends BaseReporter {
  private _lastRow = 0;
  private _lastColumn = 0;
  private _testRows = new Map<TestCase, number>();
  private _stepRows = new Map<TestStep, number>();
  private _resultIndex = new Map<TestResult, string>();
  private _stepIndex = new Map<TestStep, string>();
  private _needNewLine = false;
  private _printSteps: boolean;

  constructor(options: { printSteps?: boolean } = {}) {
    super();
    this._printSteps = getAsBooleanFromENV('PLAYWRIGHT_LIST_PRINT_STEPS', options.printSteps);
  }

  override onBegin(suite: Suite) {
    super.onBegin(suite);
    const startingMessage = this.generateStartingMessage();
    if (startingMessage) {
      console.log(startingMessage);
      console.log();
    }
  }

  onTestBegin(test: TestCase, result: TestResult) {
    const index = String(this._resultIndex.size + 1);
    this._resultIndex.set(result, index);

    if (!isTTY)
      return;
    this._maybeWriteNewLine();
    this._testRows.set(test, this._lastRow);
    const prefix = this._testPrefix(index, '');
    const line = colors.dim(formatTestTitle(this.config, test)) + this._retrySuffix(result);
    this._appendLine(line, prefix);
  }

  override onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    super.onStdOut(chunk, test, result);
    this._dumpToStdio(test, chunk, process.stdout);
  }

  override onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    super.onStdErr(chunk, test, result);
    this._dumpToStdio(test, chunk, process.stderr);
  }

  private getStepIndex(testIndex: string, result: TestResult, step: TestStep): string {
    if (this._stepIndex.has(step))
      return this._stepIndex.get(step)!;

    const ordinal = ((result as any)[lastStepOrdinalSymbol] || 0) + 1;
    (result as any)[lastStepOrdinalSymbol] = ordinal;
    const stepIndex = `${testIndex}.${ordinal}`;
    this._stepIndex.set(step, stepIndex);
    return stepIndex;
  }

  onStepBegin(test: TestCase, result: TestResult, step: TestStep) {
    if (step.category !== 'test.step')
      return;
    const testIndex = this._resultIndex.get(result) || '';

    if (!isTTY)
      return;

    if (this._printSteps) {
      this._maybeWriteNewLine();
      this._stepRows.set(step, this._lastRow);
      const prefix = this._testPrefix(this.getStepIndex(testIndex, result, step), '');
      const line = test.title + colors.dim(stepSuffix(step));
      this._appendLine(line, prefix);
    } else {
      this._updateLine(this._testRows.get(test)!, colors.dim(formatTestTitle(this.config, test, step)) + this._retrySuffix(result), this._testPrefix(testIndex, ''));
    }
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep) {
    if (step.category !== 'test.step')
      return;

    const testIndex = this._resultIndex.get(result) || '';
    if (!this._printSteps) {
      if (isTTY)
        this._updateLine(this._testRows.get(test)!, colors.dim(formatTestTitle(this.config, test, step.parent)) + this._retrySuffix(result), this._testPrefix(testIndex, ''));
      return;
    }

    const index = this.getStepIndex(testIndex, result, step);
    const title = isTTY ? test.title + colors.dim(stepSuffix(step)) : formatTestTitle(this.config, test, step);
    const prefix = this._testPrefix(index, '');
    let text = '';
    if (step.error)
      text = colors.red(title);
    else
      text = title;
    text += colors.dim(` (${milliseconds(step.duration)})`);

    this._updateOrAppendLine(this._stepRows.get(step)!, text, prefix);
  }

  private _maybeWriteNewLine() {
    if (this._needNewLine) {
      this._needNewLine = false;
      process.stdout.write('\n');
    }
  }

  private _updateLineCountAndNewLineFlagForOutput(text: string) {
    this._needNewLine = text[text.length - 1] !== '\n';
    if (!ttyWidth)
      return;
    for (const ch of text) {
      if (ch === '\n') {
        this._lastColumn = 0;
        ++this._lastRow;
        continue;
      }
      ++this._lastColumn;
      if (this._lastColumn > ttyWidth) {
        this._lastColumn = 0;
        ++this._lastRow;
      }
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

    // In TTY mode test index is incremented in onTestStart
    // and in non-TTY mode it is incremented onTestEnd.
    let index = this._resultIndex.get(result);
    if (!index) {
      index = String(this._resultIndex.size + 1);
      this._resultIndex.set(result, index);
    }

    if (result.status === 'skipped') {
      prefix = this._testPrefix(index, colors.green('-'));
      // Do not show duration for skipped.
      text = colors.cyan(title) + this._retrySuffix(result);
    } else {
      const statusMark = result.status === 'passed' ? POSITIVE_STATUS_MARK : NEGATIVE_STATUS_MARK;
      if (result.status === test.expectedStatus) {
        prefix = this._testPrefix(index, colors.green(statusMark));
        text = title;
      } else {
        prefix = this._testPrefix(index, colors.red(statusMark));
        text = colors.red(title);
      }
      text += this._retrySuffix(result) + colors.dim(` (${milliseconds(result.duration)})`);
    }

    this._updateOrAppendLine(this._testRows.get(test)!, text, prefix);
  }

  private _updateOrAppendLine(row: number, text: string, prefix: string) {
    if (isTTY) {
      this._updateLine(row, text, prefix);
    } else {
      this._maybeWriteNewLine();
      this._appendLine(text, prefix);
    }
  }

  private _appendLine(text: string, prefix: string) {
    const line = prefix + this.fitToScreen(text, prefix);
    if (process.env.PW_TEST_DEBUG_REPORTERS) {
      process.stdout.write('#' + this._lastRow + ' : ' + line + '\n');
    } else {
      process.stdout.write(line);
      process.stdout.write('\n');
    }
    ++this._lastRow;
  }

  private _updateLine(row: number, text: string, prefix: string) {
    const line = prefix + this.fitToScreen(text, prefix);
    if (process.env.PW_TEST_DEBUG_REPORTERS)
      process.stdout.write('#' + row + ' : ' + line + '\n');
    else
      this._updateLineForTTY(row, line);
  }

  private _updateLineForTTY(row: number, line: string) {
    // Go up if needed
    if (row !== this._lastRow)
      process.stdout.write(`\u001B[${this._lastRow - row}A`);
    // Erase line, go to the start
    process.stdout.write('\u001B[2K\u001B[0G');
    process.stdout.write(line);
    // Go down if needed.
    if (row !== this._lastRow)
      process.stdout.write(`\u001B[${this._lastRow - row}E`);
  }

  private _testPrefix(index: string, statusMark: string) {
    const statusMarkLength = stripAnsiEscapes(statusMark).length;
    return '  ' + statusMark + ' '.repeat(3 - statusMarkLength) + colors.dim(index + ' ');
  }

  private _retrySuffix(result: TestResult) {
    return (result.retry ? colors.yellow(` (retry #${result.retry})`) : '');
  }

  override onError(error: TestError): void {
    super.onError(error);
    this._maybeWriteNewLine();
    const message = formatError(error, colors.enabled).message + '\n';
    this._updateLineCountAndNewLineFlagForOutput(message);
    process.stdout.write(message);
  }

  override async onEnd(result: FullResult) {
    await super.onEnd(result);
    process.stdout.write('\n');
    this.epilogue(true);
  }
}

const lastStepOrdinalSymbol = Symbol('lastStepOrdinal');

export default ListReporter;
