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

const fs = require('fs');
const colors = require('colors/safe');
const {MatchError} = require('./Matchers.js');

class Reporter {
  constructor(runner, options = {}) {
    const {
      showSlowTests = 3,
      showSkippedTests = Infinity,
      verbose = false,
      summary = true,
    } = options;
    this._filePathToLines = new Map();
    this._runner = runner;
    this._showSlowTests = showSlowTests;
    this._showSkippedTests = showSkippedTests;
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
    if (allTests.length === runnableTests.length) {
      console.log(`Running all ${colors.yellow(runnableTests.length)} tests on ${colors.yellow(this._runner.parallel())} worker${this._runner.parallel() > 1 ? 's' : ''}:\n`);
    } else {
      console.log(`Running ${colors.yellow(runnableTests.length)} focused tests out of total ${colors.yellow(allTests.length)} on ${colors.yellow(this._runner.parallel())} worker${this._runner.parallel() > 1 ? 's' : ''}:\n`);
    }
  }

  _printTermination(result, message, error) {
    console.log(colors.red(`## ${result.toUpperCase()} ##`));
    console.log('Message:');
    console.log(`  ${colors.red(message)}`);
    if (error && error.stack) {
      console.log('Stack:');
      console.log(padLines(error.stack, 2));
    }
    console.log('WORKERS STATE');
    const workerIds = Array.from(this._workersState.keys());
    workerIds.sort((a, b) => a - b);
    for (const workerId of workerIds) {
      const {isRunning, test} = this._workersState.get(workerId);
      let description = '';
      if (isRunning)
        description = colors.yellow('RUNNING');
      else if (test.result === 'ok')
        description = colors.green('OK');
      else if (test.result === 'skipped')
        description = colors.yellow('SKIPPED');
      else if (test.result === 'failed')
        description = colors.red('FAILED');
      else if (test.result === 'crashed')
        description = colors.red('CRASHED');
      else if (test.result === 'timedout')
        description = colors.red('TIMEDOUT');
      else if (test.result === 'terminated')
        description = colors.magenta('TERMINATED');
      else
        description = colors.red('<UNKNOWN>');
      console.log(`  ${workerId}: [${description}] ${test.fullName} (${formatLocation(test.location)})`);
    }
    console.log('');
    console.log('');
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
        this._printVerboseTestResult(i + 1, test);
        console.log('');
      }
    }

    const skippedTests = this._runner.skippedTests();
    if (this._showSkippedTests && this._summary && skippedTests.length) {
      if (skippedTests.length > 0) {
        console.log('\nSkipped:');
        skippedTests.slice(0, this._showSkippedTests).forEach((test, index) => {
          console.log(`${index + 1}) ${test.fullName} (${formatLocation(test.location)})`);
        });
      }
      if (this._showSkippedTests < skippedTests.length) {
        console.log('');
        console.log(`... and ${colors.yellow(skippedTests.length - this._showSkippedTests)} more skipped tests ...`);
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
        console.log(`  (${i + 1}) ${colors.yellow((duration / 1000) + 's')} - ${test.fullName} (${formatLocation(test.location)})`);
      }
    }

    const tests = this._runner.tests();
    const executedTests = tests.filter(test => test.result);
    const okTestsLength = executedTests.length - failedTests.length - skippedTests.length;
    let summaryText = '';
    if (failedTests.length || skippedTests.length) {
      const summary = [`ok - ${colors.green(okTestsLength)}`];
      if (failedTests.length)
        summary.push(`failed - ${colors.red(failedTests.length)}`);
      if (skippedTests.length)
        summary.push(`skipped - ${colors.yellow(skippedTests.length)}`);
      summaryText = ` (${summary.join(', ')})`;
    }

    console.log(`\nRan ${executedTests.length}${summaryText} of ${tests.length} test${tests.length > 1 ? 's' : ''}`);
    const milliseconds = Date.now() - this._timestamp;
    const seconds = milliseconds / 1000;
    console.log(`Finished in ${colors.yellow(seconds)} seconds`);
  }

  _onTestStarted(test, workerId) {
    this._workersState.set(workerId, {test, isRunning: true});
  }

  _onTestFinished(test, workerId) {
    this._workersState.set(workerId, {test, isRunning: false});
    if (this._verbose) {
      ++this._testCounter;
      this._printVerboseTestResult(this._testCounter, test, workerId);
    } else {
      if (test.result === 'ok')
        process.stdout.write(colors.green('.'));
      else if (test.result === 'skipped')
        process.stdout.write(colors.yellow('*'));
      else if (test.result === 'failed')
        process.stdout.write(colors.red('F'));
      else if (test.result === 'crashed')
        process.stdout.write(colors.red('C'));
      else if (test.result === 'terminated')
        process.stdout.write(colors.magenta('.'));
      else if (test.result === 'timedout')
        process.stdout.write(colors.red('T'));
    }
  }

  _printVerboseTestResult(resultIndex, test, workerId = undefined) {
    let prefix = `${resultIndex})`;
    if (this._runner.parallel() > 1 && workerId !== undefined)
      prefix += ' ' + colors.gray(`[worker = ${workerId}]`);
    if (test.result === 'ok') {
      console.log(`${prefix} ${colors.green('[OK]')} ${test.fullName} (${formatLocation(test.location)})`);
    } else if (test.result === 'terminated') {
      console.log(`${prefix} ${colors.magenta('[TERMINATED]')} ${test.fullName} (${formatLocation(test.location)})`);
    } else if (test.result === 'crashed') {
      console.log(`${prefix} ${colors.red('[CRASHED]')} ${test.fullName} (${formatLocation(test.location)})`);
    } else if (test.result === 'skipped') {
      console.log(`${prefix} ${colors.yellow('[SKIP]')} ${test.fullName} (${formatLocation(test.location)})`);
    } else if (test.result === 'timedout') {
      console.log(`${prefix} ${colors.red(`[TIMEOUT ${test.timeout}ms]`)} ${test.fullName} (${formatLocation(test.location)})`);
    } else if (test.result === 'failed') {
      console.log(`${prefix} ${colors.red('[FAIL]')} ${test.fullName} (${formatLocation(test.location)})`);
      if (test.error instanceof MatchError) {
        let lines = this._filePathToLines.get(test.error.location.filePath);
        if (!lines) {
          try {
            lines = fs.readFileSync(test.error.location.filePath, 'utf8').split('\n');
          } catch (e) {
            lines = [];
          }
          this._filePathToLines.set(test.error.location.filePath, lines);
        }
        const lineNumber = test.error.location.lineNumber;
        if (lineNumber < lines.length) {
          const lineNumberLength = (lineNumber + 1 + '').length;
          const FROM = Math.max(test.location.lineNumber - 1, lineNumber - 5);
          const snippet = lines.slice(FROM, lineNumber).map((line, index) => `    ${(FROM + index + 1 + '').padStart(lineNumberLength, ' ')} | ${line}`).join('\n');
          const pointer = `    ` + ' '.repeat(lineNumberLength) + '   ' + '~'.repeat(test.error.location.columnNumber - 1) + '^';
          console.log('\n' + snippet + '\n' + colors.grey(pointer) + '\n');
        }
        console.log(padLines(test.error.formatter(), 4));
        console.log('');
      } else {
        console.log('  Message:');
        console.log(`    ${colors.red(test.error.message || test.error)}`);
        if (test.error.stack) {
          console.log('  Stack:');
          let stack = test.error.stack;
          // Highlight first test location, if any.
          const match = stack.match(new RegExp(test.location.filePath + ':(\\d+):(\\d+)'));
          if (match) {
            const [, line, column] = match;
            const fileName = `${test.location.fileName}:${line}:${column}`;
            stack = stack.substring(0, match.index) + stack.substring(match.index).replace(fileName, colors.yellow(fileName));
          }
          console.log(padLines(stack, 4));
        }
      }
      if (test.output) {
        console.log('  Output:');
        console.log(padLines(test.output, 4));
      }
    }
  }
}

function formatLocation(location) {
  if (!location)
    return '';
  return colors.yellow(`${location.fileName}:${location.lineNumber}:${location.columnNumber}`);
}

function padLines(text, spaces = 0) {
  const indent = ' '.repeat(spaces);
  return text.split('\n').map(line => indent + line).join('\n');
}

module.exports = Reporter;
