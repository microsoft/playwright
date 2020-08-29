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
import { Test, TestResult } from '../test';

class DotReporter extends BaseReporter {
  onTestEnd(test: Test, result: TestResult) {
    super.onTestEnd(test, result);
    switch (result.status) {
      case 'skipped': process.stdout.write(colors.yellow('∘')); break;
      case 'passed': process.stdout.write(result.status === result.expectedStatus ? colors.green('·') : colors.red('P')); break;
      case 'failed': process.stdout.write(result.status === result.expectedStatus ? colors.green('f') : colors.red('F')); break;
      case 'timedOut': process.stdout.write(colors.red('T')); break;
    }
  }

  onTimeout(timeout) {
    super.onTimeout(timeout);
    this.onEnd();
  }

  onEnd() {
    super.onEnd();
    process.stdout.write('\n');
    this.epilogue();
  }
}

export default DotReporter;
