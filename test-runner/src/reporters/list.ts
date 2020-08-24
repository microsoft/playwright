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
import { RunnerConfig } from '../runnerConfig';
import { Suite, Test } from '../test';

class ListReporter extends BaseReporter {
  _failure = 0;

  onBegin(config: RunnerConfig, suite: Suite) {
    super.onBegin(config, suite);
    console.log();
  }

  onTest(test: Test) {
    super.onTest(test);
    process.stdout.write('    ' + colors.gray(test.fullTitle() + ': '));
  }

  onPending(test: Test) {
    super.onPending(test);
    process.stdout.write(colors.green('  - ') + colors.cyan(test.fullTitle()));
    process.stdout.write('\n');
  }

  onPass(test: Test) {
    super.onPass(test);
    process.stdout.write('\u001b[2K\u001b[0G');
    process.stdout.write(colors.green('  ✓ ') + colors.gray(test.fullTitle()));
    process.stdout.write('\n');
  }

  onFail(test: Test) {
    super.onFail(test);
    process.stdout.write('\u001b[2K\u001b[0G');
    process.stdout.write(colors.red(`  ${++this._failure}) ` + test.fullTitle()));
    process.stdout.write('\n');
  }

  onEnd() {
    super.onEnd();
    process.stdout.write('\n');
    this.epilogue();
  }
}

export default ListReporter;
