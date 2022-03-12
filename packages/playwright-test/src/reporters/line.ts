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

import colors from 'colors/safe';
import { BaseReporter, formatFailure, formatTestTitle } from './base';
import { FullConfig, TestCase, Suite, TestResult, FullResult } from '../../types/testReporter';

const lineUp = process.env.PW_TEST_DEBUG_REPORTERS ? '<lineup>' : '\u001B[1A';
const erase = process.env.PW_TEST_DEBUG_REPORTERS ? '<erase>' : '\u001B[2K';

class LineReporter extends BaseReporter {
  private _failures = 0;
  private _lastTest: TestCase | undefined;
  private _lastPercent = -1;

  printsToStdio() {
    return true;
  }

  override onBegin(config: FullConfig, suite: Suite) {
    super.onBegin(config, suite);
    console.log(this.generateStartingMessage());
    if (this.liveTerminal)
      console.log('\n');
  }

  override onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    super.onStdOut(chunk, test, result);
    this._dumpToStdio(test, chunk, result, process.stdout);
  }

  override onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    super.onStdErr(chunk, test, result);
    this._dumpToStdio(test, chunk, result, process.stderr);
  }

  private _testTitleLine(test: TestCase, result: TestResult | undefined) {
    const title = formatTestTitle(this.config, test);
    const titleSuffix = result?.retry ? ` (retry #${result.retry})` : '';
    return this.fitToScreen(title, titleSuffix) + colors.yellow(titleSuffix);
  }

  private _dumpToStdio(test: TestCase | undefined, chunk: string | Buffer, result: TestResult | undefined, stream: NodeJS.WriteStream) {
    if (this.config.quiet)
      return;
    if (this.liveTerminal)
      stream.write(lineUp + erase + lineUp + erase);
    if (test && this._lastTest !== test) {
      // Write new header for the output.
      stream.write(this._testTitleLine(test, result) + `\n`);
      this._lastTest = test;
    }

    stream.write(chunk);
    console.log('\n');
  }

  override onTestEnd(test: TestCase, result: TestResult) {
    super.onTestEnd(test, result);
    const stats = this.generateStatsMessage(false);
    if (this.liveTerminal) {
      process.stdout.write(lineUp + erase + lineUp + erase + `${this._testTitleLine(test, result)}\n${this.fitToScreen(stats.message)}\n`);
    } else {
      if (stats.percent !== this._lastPercent)
        process.stdout.write(this.fitToScreen(stats.message) + '\n');
    }
    this._lastPercent = stats.percent;

    if (!this.willRetry(test) && (test.outcome() === 'flaky' || test.outcome() === 'unexpected')) {
      if (this.liveTerminal)
        process.stdout.write(lineUp + erase + lineUp + erase);
      console.log(formatFailure(this.config, test, {
        index: ++this._failures
      }).message);
      console.log();
    }
  }

  override async onEnd(result: FullResult) {
    await super.onEnd(result);
    if (this.liveTerminal)
      process.stdout.write(lineUp + erase + lineUp + erase);
    this.epilogue(false);
  }
}

export default LineReporter;
