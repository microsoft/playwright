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
import { Test } from '../test';

class DotReporter extends BaseReporter {
  onSkippedTest(test: Test) {
    super.onSkippedTest(test);
    process.stdout.write(colors.yellow('∘'))
  }
  
  onTestPassed(test: Test) {
    super.onTestPassed(test);
    process.stdout.write(colors.green('·'));
  }
  
  onTestFailed(test: Test) {
    super.onTestFailed(test);
    if (test.duration >= test.timeout)
      process.stdout.write(colors.red('T'));
    else
      process.stdout.write(colors.red('F'));
  } 
 
  onEnd() {
    super.onEnd();
    process.stdout.write('\n');
    this.epilogue();
  }
}

export default DotReporter;
