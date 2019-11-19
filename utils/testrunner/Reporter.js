/**
 * Copyright 2017 Google Inc. All rights reserved.
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

const RED_COLOR = '\x1b[31m';
const GREEN_COLOR = '\x1b[32m';
const YELLOW_COLOR = '\x1b[33m';
const MAGENTA_COLOR = '\x1b[35m';
const RESET_COLOR = '\x1b[0m';

class Reporter {
  constructor(runner, options = {}) {
    const {
      projectFolder = null,
      showSlowTests = 3,
      verbose = false,
      summary = true,
    } = options;
    this._runner = runner;
    this._projectFolder = projectFolder;
    this._showSlowTests = showSlowTests;
    this._verbose = verbose;
    this._summary = summary;
    this._testCounter = 0;
    runner.on('started', this._onStarted.bind(this));
    runner.on('finished', this._onFinished.bind(this));
    runner.on('teststarted', this._onTestStarted.bind(this));
    runner.on('testfinished', this._onTestFinished.bind(this));
    this._workersState = new Map();
  }

  _onStarted(runnableTests) {
    this._testCounter = 0;
    this._timestamp = Date.now();
    const allTests = this._runner.tests();
    if (allTests.length === runnableTests.length)
      console.log(`Running all ${YELLOW_COLOR}${runnableTests.length}${RESET_COLOR} tests on ${YELLOW_COLOR}${this._runner.parallel()}${RESET_COLOR} worker(s):\n`);
    else
      console.log(`Running ${YELLOW_COLOR}${runnableTests.length}${RESET_COLOR} focused tests out of total ${YELLOW_COLOR}${allTests.length}${RESET_COLOR} on ${YELLOW_COLOR}${this._runner.parallel()}${RESET_COLOR} worker(s):\n`);
  }

  _printTermination(result, message, error) {
    console.log(`${RED_COLOR}## ${result.toUpperCase()} ##${RESET_COLOR}`);
    console.log('Message:');
    console.log(`  ${RED_COLOR}${message}${RESET_COLOR}`);
    if (error && error.stack) {
      console.log('Stack:');
      console.log(error.stack.split('\n').map(line => '  ' + line).join('\n'));
    }
    console.log('WORKERS STATE');
    const workerIds = Array.from(this._workersState.keys());
    workerIds.sort((a, b) => a - b);
    for (const workerId of workerIds) {
      const {isRunning, test} = this._workersState.get(workerId);
      let description = '';
      if (isRunning)
        description = `${YELLOW_COLOR}RUNNING${RESET_COLOR}`;
      else if (test.result === 'ok')
        description = `${GREEN_COLOR}OK${RESET_COLOR}`;
      else if (test.result === 'skipped')
        description = `${YELLOW_COLOR}SKIPPED${RESET_COLOR}`;
      else if (test.result === 'failed')
        description = `${RED_COLOR}FAILED${RESET_COLOR}`;
      else if (test.result === 'crashed')
        description = `${RED_COLOR}CRASHED${RESET_COLOR}`;
      else if (test.result === 'timedout')
        description = `${RED_COLOR}TIMEDOUT${RESET_COLOR}`;
      else if (test.result === 'terminated')
        description = `${MAGENTA_COLOR}TERMINATED${RESET_COLOR}`;
      else
        description = `${RED_COLOR}<UNKNOWN>${RESET_COLOR}`;
      console.log(`  ${workerId}: [${description}] ${test.fullName} (${formatTestLocation(test)})`);
    }
    process.exitCode = 2;
  }

  _onFinished({result, terminationError, terminationMessage}) {
    this._printTestResults();
    if (terminationMessage || terminationError)
      this._printTermination(result, terminationMessage, terminationError);
    process.exitCode = result === 'ok' ? 0 : 1;
  }

  _printTestResults() {
    // 2 newlines after completing all tests.
    console.log('\n');

    const failedTests = this._runner.failedTests();
    if (this._summary && failedTests.length > 0) {
      console.log('\nFailures:');
      for (let i = 0; i < failedTests.length; ++i) {
        const test = failedTests[i];
        console.log(`${i + 1}) ${test.fullName} (${formatTestLocation(test)})`);
        if (test.result === 'timedout') {
          console.log('  Message:');
          console.log(`    ${RED_COLOR}Timeout Exceeded ${this._runner.timeout()}ms${RESET_COLOR}`);
        } else if (test.result === 'crashed') {
          console.log('  Message:');
          console.log(`    ${RED_COLOR}CRASHED${RESET_COLOR}`);
        } else {
          console.log('  Message:');
          console.log(`    ${RED_COLOR}${test.error.message || test.error}${RESET_COLOR}`);
          console.log('  Stack:');
          if (test.error.stack)
            console.log(this._beautifyStack(test.error.stack));
        }
        if (test.output) {
          console.log('  Output:');
          console.log(test.output.split('\n').map(line => '    ' + line).join('\n'));
        }
        console.log('');
      }
    }

    const skippedTests = this._runner.skippedTests();
    if (this._summary && skippedTests.length > 0) {
      console.log('\nSkipped:');
      for (let i = 0; i < skippedTests.length; ++i) {
        const test = skippedTests[i];
        console.log(`${i + 1}) ${test.fullName} (${formatTestLocation(test)})`);
        console.log(`  ${YELLOW_COLOR}Temporary disabled with xit${RESET_COLOR}`);
      }
    }

    if (this._showSlowTests) {
      const slowTests = this._runner.passedTests().sort((a, b) => {
        const aDuration = a.endTimestamp - a.startTimestamp;
        const bDuration = b.endTimestamp - b.startTimestamp;
        return bDuration - aDuration;
      }).slice(0, this._showSlowTests);
      console.log(`\nSlowest tests:`);
      for (let i = 0; i < slowTests.length; ++i) {
        const test = slowTests[i];
        const duration = test.endTimestamp - test.startTimestamp;
        console.log(`  (${i + 1}) ${YELLOW_COLOR}${duration / 1000}s${RESET_COLOR} - ${test.fullName} (${formatTestLocation(test)})`);
      }
    }

    const tests = this._runner.tests();
    const executedTests = tests.filter(test => test.result);
    const okTestsLength = executedTests.length - failedTests.length - skippedTests.length;
    let summaryText = '';
    if (failedTests.length || skippedTests.length) {
      const summary = [`ok - ${GREEN_COLOR}${okTestsLength}${RESET_COLOR}`];
      if (failedTests.length)
        summary.push(`failed - ${RED_COLOR}${failedTests.length}${RESET_COLOR}`);
      if (skippedTests.length)
        summary.push(`skipped - ${YELLOW_COLOR}${skippedTests.length}${RESET_COLOR}`);
      summaryText = `(${summary.join(', ')})`;
    }

    console.log(`\nRan ${executedTests.length} ${summaryText} of ${tests.length} test(s)`);
    const milliseconds = Date.now() - this._timestamp;
    const seconds = milliseconds / 1000;
    console.log(`Finished in ${YELLOW_COLOR}${seconds}${RESET_COLOR} seconds`);
  }

  _beautifyStack(stack) {
    if (!this._projectFolder)
      return stack;
    const lines = stack.split('\n').map(line => '    ' + line);
    // Find last stack line that include testrunner code.
    let index = 0;
    while (index < lines.length && !lines[index].includes(__dirname))
      ++index;
    while (index < lines.length && lines[index].includes(__dirname))
      ++index;
    if (index >= lines.length)
      return stack;
    const line = lines[index];
    const fromIndex = line.lastIndexOf(this._projectFolder) + this._projectFolder.length;
    const toIndex = line.lastIndexOf(')');
    lines[index] = line.substring(0, fromIndex) + YELLOW_COLOR + line.substring(fromIndex, toIndex) + RESET_COLOR + line.substring(toIndex);
    return lines.join('\n');
  }

  _onTestStarted(test, workerId) {
    this._workersState.set(workerId, {test, isRunning: true});
  }

  _onTestFinished(test, workerId) {
    this._workersState.set(workerId, {test, isRunning: false});
    if (this._verbose) {
      ++this._testCounter;
      if (test.result === 'ok') {
        console.log(`${this._testCounter}) ${GREEN_COLOR}[ OK ]${RESET_COLOR} ${test.fullName} (${formatTestLocation(test)})`);
      } else if (test.result === 'terminated') {
        console.log(`${this._testCounter}) ${MAGENTA_COLOR}[ TERMINATED ]${RESET_COLOR} ${test.fullName} (${formatTestLocation(test)})`);
      } else if (test.result === 'crashed') {
        console.log(`${this._testCounter}) ${RED_COLOR}[ CRASHED ]${RESET_COLOR} ${test.fullName} (${formatTestLocation(test)})`);
      } else if (test.result === 'skipped') {
        console.log(`${this._testCounter}) ${YELLOW_COLOR}[SKIP]${RESET_COLOR} ${test.fullName} (${formatTestLocation(test)})`);
      } else if (test.result === 'failed') {
        console.log(`${this._testCounter}) ${RED_COLOR}[FAIL]${RESET_COLOR} ${test.fullName} (${formatTestLocation(test)})`);
        console.log('  Message:');
        console.log(`    ${RED_COLOR}${test.error.message || test.error}${RESET_COLOR}`);
        console.log('  Stack:');
        if (test.error.stack)
          console.log(this._beautifyStack(test.error.stack));
        if (test.output) {
          console.log('  Output:');
          console.log(test.output.split('\n').map(line => '    ' + line).join('\n'));
        }
      } else if (test.result === 'timedout') {
        console.log(`${this._testCounter}) ${RED_COLOR}[TIME]${RESET_COLOR} ${test.fullName} (${formatTestLocation(test)})`);
        console.log('  Message:');
        console.log(`    ${RED_COLOR}Timeout Exceeded ${this._runner.timeout()}ms${RESET_COLOR}`);
      }
    } else {
      if (test.result === 'ok')
        process.stdout.write(`${GREEN_COLOR}.${RESET_COLOR}`);
      else if (test.result === 'skipped')
        process.stdout.write(`${YELLOW_COLOR}*${RESET_COLOR}`);
      else if (test.result === 'failed')
        process.stdout.write(`${RED_COLOR}F${RESET_COLOR}`);
      else if (test.result === 'crashed')
        process.stdout.write(`${RED_COLOR}C${RESET_COLOR}`);
      else if (test.result === 'terminated')
        process.stdout.write(`${MAGENTA_COLOR}.${RESET_COLOR}`);
      else if (test.result === 'timedout')
        process.stdout.write(`${RED_COLOR}T${RESET_COLOR}`);
    }
  }
}

function formatTestLocation(test) {
  const location = test.location;
  if (!location)
    return '';
  return `${YELLOW_COLOR}${location.fileName}:${location.lineNumber}:${location.columnNumber}${RESET_COLOR}`;
}

module.exports = Reporter;
