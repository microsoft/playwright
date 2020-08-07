/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const colors = require('colors/safe');
const { runTestsByPath } = require('../../jest.config');
const failures = [];

module.exports = function Reporter() {
  this.onRunStart = (results, options) => {
    process.stdout.write('\n');
  }

  this.onRunComplete = (test, runResults) => {
    process.stdout.write('\n');

    const ranTests = runResults.numFailedTests + runResults.numPassedTests;
    const summary = [`ok - ${colors.green(runResults.numPassedTests)}`];
    if (runResults.numFailedTests)
      summary.push(`failed - ${colors.red(runResults.numFailedTests)}`);
    if (ranTests < runResults.numTotalTests)
      summary.push(`skipped - ${colors.yellow(runResults.numTotalTests - ranTests)}`);
    const summaryText = `Ran ${ranTests} of ${runResults.numTotalTests} (${summary.join(', ')})`;
    process.stdout.write('\n');
    process.stdout.write(summaryText);
    process.stdout.write('\n');

    for (let i = 0; i < failures.length; ++i) {
      const [test, testCaseResult] = failures[i];
      const path = test.path.replace(/.*test/, 'test');
      const name = colors.yellow(path) + ' — ' + colors.bold(colors.yellow(testCaseResult.fullName));
      process.stderr.write(`\n${i + 1}) ${colors.red('[FAIL]')} ${name}\n\n`);
      process.stderr.write(testCaseResult.failureMessages + '\n');
    }

  };

  this.onTestCaseResult = (test, testCaseResult) => {
    const status = testCaseResult.status;
    if (status === 'passed')
      process.stdout.write(colors.green('\u00B7'));
    if (status === 'failed')
      process.stdout.write(colors.red('F'));
    if (testCaseResult.status === 'failed')
      failures.push([test, testCaseResult]);
  }
}

process.on('SIGINT', async () => {
  for (let i = 0; i < failures.length; ++i) {
    const [test, testCaseResult] = failures[i];
    const path = test.path.replace(/.*test/, 'test');
    const name = colors.yellow(path) + ' — ' + colors.bold(colors.yellow(testCaseResult.fullName));
    process.stderr.write(`\n${i + 1}) ${colors.red('[FAIL]')} ${name}\n\n`);
    process.stderr.write(testCaseResult.failureMessages + '\n');
  }
  process.exit(130);
});
