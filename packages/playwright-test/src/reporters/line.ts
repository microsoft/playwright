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

import { colors } from 'playwright-core/lib/utilsBundle';
import { BaseReporter, formatFailure, formatTestTitle } from './base';
import type { FullConfig, TestCase, Suite, TestResult, FullResult, TestStep } from '../../types/testReporter';

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
    this._dumpToStdio(test, result, chunk, process.stdout);
  }

  override onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    super.onStdErr(chunk, test, result);
    this._dumpToStdio(test, result, chunk, process.stderr);
  }

  private _retrySuffix(result: TestResult | undefined) {
    return result?.retry ? colors.yellow(` (retry #${result.retry})`) : '';
  }

  private _dumpToStdio(test: TestCase | undefined, result: TestResult | undefined, chunk: string | Buffer, stream: NodeJS.WriteStream) {
    if (this.config.quiet)
      return;
    if (this.liveTerminal)
      stream.write(lineUp + erase + lineUp + erase);
    if (test && this._lastTest !== test) {
      // Write new header for the output.
      const title = colors.gray(formatTestTitle(this.config, test)) + this._retrySuffix(result);
      stream.write(this.fitToScreen(title) + `\n`);
      this._lastTest = test;
    }

    stream.write(chunk);
    if (chunk[chunk.length - 1] !== '\n')
      console.log();

    if (this.liveTerminal)
      console.log('\n');
  }

  override onTestBegin(test: TestCase, result: TestResult) {
    super.onTestBegin(test, result);
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
    if (!this.willRetry(test) && (test.outcome() === 'flaky' || test.outcome() === 'unexpected')) {
      if (this.liveTerminal)
        process.stdout.write(lineUp + erase + lineUp + erase);
      console.log(formatFailure(this.config, test, {
        index: ++this._failures
      }).message);
      console.log();
      if (this.liveTerminal)
        process.stdout.write(this.fitToScreen(this.generateStatsMessage('started', false).message) + '\n');
    }
  }

  private _updateLine(test: TestCase, result: TestResult, step?: TestStep) {
    const stats = this.generateStatsMessage('started', false);
    const title = formatTestTitle(this.config, test, step) + this._retrySuffix(result);
    if (this.liveTerminal) {
      process.stdout.write(lineUp + erase + lineUp + erase + this.fitToScreen(title) + '\n' + this.fitToScreen(stats.message) + '\n');
    } else {
      if (stats.percent !== this._lastPercent)
        process.stdout.write(this.fitToScreen(stats.message) + '\n');
    }
    this._lastPercent = stats.percent;
  }

  override async onEnd(result: FullResult) {
    await super.onEnd(result);
    if (this.liveTerminal)
      process.stdout.write(lineUp + erase + lineUp + erase);
    else
      process.stdout.write(this.fitToScreen(this.generateStatsMessage('started', true).message) + '\n');
    this.epilogue(false);
  }
}

export default LineReporter;
