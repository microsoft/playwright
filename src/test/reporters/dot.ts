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
import { BaseReporter } from './base';
import { FullResult, Test, TestResult } from '../../../types/testReporter';

class DotReporter extends BaseReporter {
  private _counter = 0;

  onTestEnd(test: Test, result: TestResult) {
    super.onTestEnd(test, result);
    if (++this._counter === 81) {
      process.stdout.write('\n');
      return;
    }
    if (result.status === 'skipped') {
      process.stdout.write(colors.yellow('°'));
      return;
    }
    if (this.willRetry(test, result)) {
      process.stdout.write(colors.gray('×'));
      return;
    }
    switch (test.status()) {
      case 'expected': process.stdout.write(colors.green('·')); break;
      case 'unexpected': process.stdout.write(colors.red(test.results[test.results.length - 1].status === 'timedOut' ? 'T' : 'F')); break;
      case 'flaky': process.stdout.write(colors.yellow('±')); break;
    }
  }

  async onEnd(result: FullResult) {
    await super.onEnd(result);
    process.stdout.write('\n');
    this.epilogue(true);
  }
}

export default DotReporter;
