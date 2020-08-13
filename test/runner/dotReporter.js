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

const Base = require('mocha/lib/reporters/base');
const constants = require('mocha/lib/runner').constants;
const colors = require('colors/safe');

class DotReporter extends Base {
  constructor(runner, options) {
    super(runner, options);

    process.on('SIGINT', async () => {
      Base.list(this.failures);
      process.exit(130);
    });

    runner.on(constants.EVENT_TEST_PENDING, test => {
      process.stdout.write(colors.yellow('∘'))
    });

    runner.on(constants.EVENT_TEST_PASS, () => {
      process.stdout.write(colors.green('\u00B7'));
    });

    runner.on(constants.EVENT_TEST_FAIL, test => {
      if (test.duration >= test.timeout())
        process.stdout.write(colors.red('T'));
      else
        process.stdout.write(colors.red('F'));
    });

    runner.once(constants.EVENT_RUN_END, () => {
      process.stdout.write('\n');
      this.epilogue();
    });
  }
}

module.exports = DotReporter;
