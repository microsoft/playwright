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

class LineReporter extends BaseReporter {
  private _current = 0;
  private _failures = 0;
  private _lastTest: TestCase | undefined;

  printsToStdio() {
    return true;
  }

  override onBegin(config: FullConfig, suite: Suite) {
    super.onBegin(config, suite);
    console.log(this.generateStartingMessage());
    console.log();
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
    if (!process.env.PWTEST_SKIP_TEST_OUTPUT)
      stream.write(`\u001B[1A\u001B[2K`);
    if (test && this._lastTest !== test) {
      // Write new header for the output.
      stream.write(colors.gray(formatTestTitle(this.config, test) + `\n`));
      this._lastTest = test;
    }

    stream.write(chunk);
    console.log();
  }

  override onTestEnd(test: TestCase, result: TestResult) {
    super.onTestEnd(test, result);
    const width = process.env.PWTEST_SKIP_TEST_OUTPUT ? 79 : process.stdout.columns! - 1;
    if (!test.title.startsWith('beforeAll') && !test.title.startsWith('afterAll'))
      ++this._current;
    const retriesSuffix = this.totalTestCount < this._current ? ` (retries)` : ``;
    const title = `[${this._current}/${this.totalTestCount}]${retriesSuffix} ${formatTestTitle(this.config, test)}`.substring(0, width);
    if (process.env.PWTEST_SKIP_TEST_OUTPUT)
      process.stdout.write(`${title}\n`);
    else
      process.stdout.write(`\u001B[1A\u001B[2K${title}\n`);

    if (!this.willRetry(test) && (test.outcome() === 'flaky' || test.outcome() === 'unexpected')) {
      if (!process.env.PWTEST_SKIP_TEST_OUTPUT)
        process.stdout.write(`\u001B[1A\u001B[2K`);
      console.log(formatFailure(this.config, test, {
        index: ++this._failures
      }).message);
      console.log();
    }
  }

  override async onEnd(result: FullResult) {
    if (!process.env.PWTEST_SKIP_TEST_OUTPUT)
      process.stdout.write(`\u001B[1A\u001B[2K`);
    await super.onEnd(result);
    this.epilogue(false);
  }
}

export default LineReporter;
