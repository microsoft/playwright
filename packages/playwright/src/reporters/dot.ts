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

import type { FullResult, Suite, TestCase, TestError, TestResult } from '../../types/testReporter';

class DotReporter extends TerminalReporter {
  private _counter = 0;

  override onBegin(suite: Suite) {
    super.onBegin(suite);
    this.writeLine(this.generateStartingMessage());
  }

  override onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    super.onStdOut(chunk, test, result);
    if (!this.config.quiet)
      this.screen.stdout.write(chunk);
  }

  override onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    super.onStdErr(chunk, test, result);
    if (!this.config.quiet)
      this.screen.stderr.write(chunk);
  }

  override onTestEnd(test: TestCase, result: TestResult) {
    super.onTestEnd(test, result);
    if (this._counter === 80) {
      this.screen.stdout.write('\n');
      this._counter = 0;
    }
    ++this._counter;
    if (result.status === 'skipped') {
      this.screen.stdout.write(this.screen.colors.yellow('°'));
      return;
    }
    if (this.willRetry(test)) {
      this.screen.stdout.write(this.screen.colors.gray('×'));
      return;
    }
    switch (test.outcome()) {
      case 'expected': this.screen.stdout.write(this.screen.colors.green('·')); break;
      case 'unexpected': this.screen.stdout.write(this.screen.colors.red(result.status === 'timedOut' ? 'T' : 'F')); break;
      case 'flaky': this.screen.stdout.write(this.screen.colors.yellow('±')); break;
    }
  }

  override onError(error: TestError): void {
    super.onError(error);
    this.writeLine('\n' + this.formatError(error).message);
    this._counter = 0;
  }

  async onTestPaused(test: TestCase, result: TestResult) {
    // Without TTY, user cannot interrupt the pause. Let's skip it.
    if (!process.stdin.isTTY && !process.env.PW_TEST_DEBUG_REPORTERS)
      return;

    this.screen.stdout.write('\n');
    if (test.outcome() === 'unexpected') {
      this.writeLine(this.screen.colors.red(this.formatTestHeader(test, { indent: '  ' })));
      this.writeLine(this.formatResultErrors(test, result));
      markErrorsAsReported(result);
      this.writeLine(this.screen.colors.yellow('    Paused on error. Press Ctrl+C to end.') + '\n');
    } else {
      this.writeLine(this.screen.colors.yellow(this.formatTestHeader(test, { indent: '  ' })));
      this.writeLine(this.screen.colors.yellow('    Paused at test end. Press Ctrl+C to end.') + '\n');
    }
    this._counter = 0;

    await new Promise<void>(() => {});
  }

  override async onEnd(result: FullResult) {
    await super.onEnd(result);
    this.screen.stdout.write('\n');
    this.epilogue(true);
  }
}

export default DotReporter;
