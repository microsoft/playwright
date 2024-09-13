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

import { colors, BaseReporter, formatError } from './base';
import type { FullResult, TestCase, TestResult, Suite, TestError } from '../../types/testReporter';

class DotReporter extends BaseReporter {
  private _counter = 0;

  override onBegin(suite: Suite) {
    super.onBegin(suite);
    console.log(this.generateStartingMessage());
  }

  override onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    super.onStdOut(chunk, test, result);
    if (!this.config.quiet)
      process.stdout.write(chunk);
  }

  override onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    super.onStdErr(chunk, test, result);
    if (!this.config.quiet)
      process.stderr.write(chunk);
  }

  override onTestEnd(test: TestCase, result: TestResult) {
    super.onTestEnd(test, result);
    if (this._counter === 80) {
      process.stdout.write('\n');
      this._counter = 0;
    }
    ++this._counter;
    if (result.status === 'skipped') {
      process.stdout.write(colors.yellow('°'));
      return;
    }
    if (this.willRetry(test)) {
      process.stdout.write(colors.gray('×'));
      return;
    }
    switch (test.outcome()) {
      case 'expected': process.stdout.write(colors.green('·')); break;
      case 'unexpected': process.stdout.write(colors.red(result.status === 'timedOut' ? 'T' : 'F')); break;
      case 'flaky': process.stdout.write(colors.yellow('±')); break;
    }
  }

  override onError(error: TestError): void {
    super.onError(error);
    console.log('\n' + formatError(error, colors.enabled).message);
    this._counter = 0;
  }

  override async onEnd(result: FullResult) {
    await super.onEnd(result);
    process.stdout.write('\n');
    this.epilogue(true);
  }
}

export default DotReporter;
