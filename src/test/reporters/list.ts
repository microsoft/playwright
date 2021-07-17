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
// @ts-ignore
import milliseconds from 'ms';
import { BaseReporter, formatTestTitle } from './base';
import { FullConfig, FullResult, Suite, Test, TestResult } from '../../../types/testReporter';

// Allow it in the Visual Studio Code Terminal and the new Windows Terminal
const DOES_NOT_SUPPORT_UTF8_IN_TERMINAL = process.platform === 'win32' && process.env.TERM_PROGRAM !== 'vscode' && !process.env.WT_SESSION;
const POSITIVE_STATUS_MARK = DOES_NOT_SUPPORT_UTF8_IN_TERMINAL ? 'ok' : '✓';
const NEGATIVE_STATUS_MARK = DOES_NOT_SUPPORT_UTF8_IN_TERMINAL ? 'x' : '✘';

class ListReporter extends BaseReporter {
  private _failure = 0;
  private _lastRow = 0;
  private _testRows = new Map<Test, number>();
  private _needNewLine = false;

  onBegin(config: FullConfig, suite: Suite) {
    super.onBegin(config, suite);
    console.log();
  }

  onTestBegin(test: Test) {
    if (process.stdout.isTTY) {
      if (this._needNewLine) {
        this._needNewLine = false;
        process.stdout.write('\n');
        this._lastRow++;
      }
      process.stdout.write('     ' + colors.gray(formatTestTitle(this.config, test) + ': ') + '\n');
    }
    this._testRows.set(test, this._lastRow++);
  }

  onStdOut(chunk: string | Buffer, test?: Test) {
    this._dumpToStdio(test, chunk, process.stdout);
  }

  onStdErr(chunk: string | Buffer, test?: Test) {
    this._dumpToStdio(test, chunk, process.stdout);
  }

  private _dumpToStdio(test: Test | undefined, chunk: string | Buffer, stream: NodeJS.WriteStream) {
    if (this.config.quiet)
      return;
    const text = chunk.toString('utf-8');
    this._needNewLine = text[text.length - 1] !== '\n';
    if (process.stdout.isTTY) {
      const newLineCount = text.split('\n').length - 1;
      this._lastRow += newLineCount;
    }
    stream.write(chunk);
  }

  onTestEnd(test: Test, result: TestResult) {
    super.onTestEnd(test, result);

    const duration = colors.dim(` (${milliseconds(result.duration)})`);
    const title = formatTestTitle(this.config, test);
    let text = '';
    if (result.status === 'skipped') {
      text = colors.green('  - ') + colors.cyan(title);
    } else {
      const statusMark = ('  ' + (result.status === 'passed' ? POSITIVE_STATUS_MARK : NEGATIVE_STATUS_MARK)).padEnd(5);
      if (result.status === test.expectedStatus)
        text = '\u001b[2K\u001b[0G' + colors.green(statusMark) + colors.gray(title) + duration;
      else
        text = '\u001b[2K\u001b[0G' + colors.red(`${statusMark}${++this._failure}) ` + title) + duration;
    }

    const testRow = this._testRows.get(test)!;
    // Go up if needed
    if (process.stdout.isTTY && testRow !== this._lastRow)
      process.stdout.write(`\u001B[${this._lastRow - testRow}A`);
    // Erase line
    if (process.stdout.isTTY)
      process.stdout.write('\u001B[2K');
    if (!process.stdout.isTTY && this._needNewLine) {
      this._needNewLine = false;
      process.stdout.write('\n');
    }
    process.stdout.write(text);
    // Go down if needed.
    if (testRow !== this._lastRow) {
      if (process.stdout.isTTY)
        process.stdout.write(`\u001B[${this._lastRow - testRow}E`);
      else
        process.stdout.write('\n');
    }
  }

  async onEnd(result: FullResult) {
    await super.onEnd(result);
    process.stdout.write('\n');
    this.epilogue(true);
  }
}

export default ListReporter;
