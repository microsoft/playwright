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
const path = require('path');
const colors = require('colors/safe');
const {MatchError} = require('./Matchers.js');

class Reporter {
  constructor(delegate, options = {}) {
    const {
      showSlowTests = 3,
      showMarkedAsFailingTests = Infinity,
      verbose = false,
      summary = true,
    } = options;
    this._filePathToLines = new Map();
    this._delegate = delegate;
    this._showSlowTests = showSlowTests;
    this._showMarkedAsFailingTests = showMarkedAsFailingTests;
    this._verbose = verbose;
    this._summary = summary;
    this._testCounter = 0;
  }

  onStarted(testRuns) {
    this._testCounter = 0;
    this._timestamp = Date.now();
    if (!this._delegate.hasFocusedTestsOrSuitesOrFiles()) {
      console.log(`Running all ${colors.yellow(testRuns.length)} tests on ${colors.yellow(this._delegate.parallel())} worker${this._delegate.parallel() > 1 ? 's' : ''}:\n`);
    } else {
      console.log(`Running ${colors.yellow(testRuns.length)} focused tests out of total ${colors.yellow(this._delegate.testCount())} on ${colors.yellow(this._delegate.parallel())} worker${this._delegate.parallel() > 1 ? 's' : ''}`);
      console.log('');
      const focusedFilePaths = this._delegate.focusedFilePaths();
      if (focusedFilePaths.length) {
        console.log('Focused Files:');
        for (let i = 0; i < focusedFilePaths.length; ++i)
          console.log(`  ${i + 1}) ${colors.yellow(path.basename(focusedFilePaths[i]))}`);
        console.log('');
      }
      const focusedEntities = [
        ...this._delegate.focusedSuites(),
        ...this._delegate.focusedTests(),
      ];

      if (focusedEntities.length) {
        console.log('Focused Suites and Tests:');
        for (let i = 0; i < focusedEntities.length; ++i)
          console.log(`  ${i + 1}) ${focusedEntities[i].fullName()} (${formatLocation(focusedEntities[i].location())})`);
        console.log('');
      }
    }
  }

  _printFailedResult(result) {
    console.log(colors.red(`## ${result.result.toUpperCase()} ##`));
    if (result.message) {
      console.log('Message:');
      console.log(`  ${colors.red(result.message)}`);
    }

    for (let i = 0; i < result.errors.length; i++) {
      const { message, error, runs } = result.errors[i];
      console.log(`\n${colors.magenta('NON-TEST ERROR #' + i)}: ${message}`);
      if (error && error.stack)
        console.log(padLines(error.stack, 2));
      const lastRuns = runs.slice(runs.length - Math.min(10, runs.length));
      if (lastRuns.length)
        console.log(`WORKER STATE`);
      for (let j = 0; j < lastRuns.length; j++)
        this._printVerboseTestRunResult(j, lastRuns[j]);
    }
    console.log('');
    console.log('');
  }

  onFinished(result) {
    this._printTestResults(result);
    if (!result.ok())
      this._printFailedResult(result);
    process.exitCode = result.exitCode;
  }

  _printTestResults(result) {
    // 2 newlines after completing all tests.
    console.log('\n');

    const runs = result.runs;
    const failedRuns = runs.filter(run => run.isFailure());
    const executedRuns = runs.filter(run => run.result());
    const okRuns = runs.filter(run => run.ok());
    const skippedRuns = runs.filter(run => run.result() === 'skipped');
    const markedAsFailingRuns = runs.filter(run => run.result() === 'markedAsFailing');

    if (this._summary && failedRuns.length > 0) {
      console.log('\nFailures:');
      for (let i = 0; i < failedRuns.length; ++i) {
        this._printVerboseTestRunResult(i + 1, failedRuns[i]);
        console.log('');
      }
    }

    if (this._showMarkedAsFailingTests && this._summary && markedAsFailingRuns.length) {
      if (markedAsFailingRuns.length > 0) {
        console.log('\nMarked as failing:');
        markedAsFailingRuns.slice(0, this._showMarkedAsFailingTests).forEach((testRun, index) => {
          console.log(`${index + 1}) ${testRun.test().fullName()} (${formatLocation(testRun.test().location())})`);
        });
      }
      if (this._showMarkedAsFailingTests < markedAsFailingRuns.length) {
        console.log('');
        console.log(`... and ${colors.yellow(markedAsFailingRuns.length - this._showMarkedAsFailingTests)} more marked as failing tests ...`);
      }
    }

    if (this._showSlowTests) {
      const slowRuns = okRuns.sort((a, b) => b.duration() - a.duration()).slice(0, this._showSlowTests);
      console.log(`\nSlowest tests:`);
      for (let i = 0; i < slowRuns.length; ++i) {
        const run = slowRuns[i];
        console.log(`  (${i + 1}) ${colors.yellow((run.duration() / 1000) + 's')} - ${run.test().fullName()} (${formatLocation(run.test().location())})`);
      }
    }

    let summaryText = '';
    if (failedRuns.length || markedAsFailingRuns.length) {
      const summary = [`ok - ${colors.green(okRuns.length)}`];
      if (failedRuns.length)
        summary.push(`failed - ${colors.red(failedRuns.length)}`);
      if (markedAsFailingRuns.length)
        summary.push(`marked as failing - ${colors.yellow(markedAsFailingRuns.length)}`);
      if (skippedRuns.length)
        summary.push(`skipped - ${colors.yellow(skippedRuns.length)}`);
      summaryText = ` (${summary.join(', ')})`;
    }

    console.log(`\nRan ${executedRuns.length}${summaryText} of ${runs.length} test${runs.length > 1 ? 's' : ''}`);
    const milliseconds = Date.now() - this._timestamp;
    const seconds = milliseconds / 1000;
    console.log(`Finished in ${colors.yellow(seconds)} seconds`);
  }

  onTestRunStarted(testRun) {
  }

  onTestRunFinished(testRun) {
    if (this._verbose) {
      ++this._testCounter;
      this._printVerboseTestRunResult(this._testCounter, testRun);
    } else {
      if (testRun.result() === 'ok')
        process.stdout.write(colors.green('\u00B7'));
      else if (testRun.result() === 'skipped')
        process.stdout.write(colors.yellow('\u00B7'));
      else if (testRun.result() === 'markedAsFailing')
        process.stdout.write(colors.yellow('\u00D7'));
      else if (testRun.result() === 'failed')
        process.stdout.write(colors.red('F'));
      else if (testRun.result() === 'crashed')
        process.stdout.write(colors.red('C'));
      else if (testRun.result() === 'terminated')
        process.stdout.write(colors.magenta('.'));
      else if (testRun.result() === 'timedout')
        process.stdout.write(colors.red('T'));
    }
  }

  _printVerboseTestRunResult(resultIndex, testRun) {
    const test = testRun.test();
    let prefix = `${resultIndex})`;
    if (this._delegate.parallel() > 1)
      prefix += ' ' + colors.gray(`[worker = ${testRun.workerId()}]`);
    if (testRun.result() === 'ok') {
      console.log(`${prefix} ${colors.green('[OK]')} ${test.fullName()} (${formatLocation(test.location())})`);
    } else if (testRun.result() === 'terminated') {
      console.log(`${prefix} ${colors.magenta('[TERMINATED]')} ${test.fullName()} (${formatLocation(test.location())})`);
    } else if (testRun.result() === 'crashed') {
      console.log(`${prefix} ${colors.red('[CRASHED]')} ${test.fullName()} (${formatLocation(test.location())})`);
    } else if (testRun.result() === 'skipped') {
    } else if (testRun.result() === 'markedAsFailing') {
      console.log(`${prefix} ${colors.yellow('[MARKED AS FAILING]')} ${test.fullName()} (${formatLocation(test.location())})`);
    } else if (testRun.result() === 'timedout') {
      console.log(`${prefix} ${colors.red(`[TIMEOUT ${test.timeout()}ms]`)} ${test.fullName()} (${formatLocation(test.location())})`);
      const output = testRun.output();
      if (output.length) {
        console.log('  Output:');
        for (const line of output)
          console.log('  ' + line);
      }
    } else if (testRun.result() === 'failed') {
      console.log(`${prefix} ${colors.red('[FAIL]')} ${test.fullName()} (${formatLocation(test.location())})`);
      if (testRun.error() instanceof MatchError) {
        const location = testRun.error().location;
        let lines = this._filePathToLines.get(location.filePath());
        if (!lines) {
          try {
            lines = fs.readFileSync(location.filePath(), 'utf8').split('\n');
          } catch (e) {
            lines = [];
          }
          this._filePathToLines.set(location.filePath(), lines);
        }
        const lineNumber = location.lineNumber();
        if (lineNumber < lines.length) {
          const lineNumberLength = (lineNumber + 1 + '').length;
          const FROM = Math.max(test.location().lineNumber() - 1, lineNumber - 5);
          const snippet = lines.slice(FROM, lineNumber).map((line, index) => `    ${(FROM + index + 1 + '').padStart(lineNumberLength, ' ')} | ${line}`).join('\n');
          const pointer = `    ` + ' '.repeat(lineNumberLength) + '   ' + '~'.repeat(location.columnNumber() - 1) + '^';
          console.log('\n' + snippet + '\n' + colors.grey(pointer) + '\n');
        }
        console.log(padLines(testRun.error().formatter(), 4));
        console.log('');
      } else {
        console.log('  Message:');
        let message = '' + (testRun.error().message || testRun.error());
        if (testRun.error().stack && message.includes(testRun.error().stack))
          message = message.substring(0, message.indexOf(testRun.error().stack));
        if (message)
          console.log(`    ${colors.red(message)}`);
        if (testRun.error().stack) {
          console.log('  Stack:');
          let stack = testRun.error().stack;
          // Highlight first test location, if any.
          const match = stack.match(new RegExp(test.location().filePath() + ':(\\d+):(\\d+)'));
          if (match) {
            const [, line, column] = match;
            const fileName = `${test.location().fileName()}:${line}:${column}`;
            stack = stack.substring(0, match.index) + stack.substring(match.index).replace(fileName, colors.yellow(fileName));
          }
          console.log(padLines(stack, 4));
        }
      }
      const output = testRun.output();
      if (output.length) {
        console.log('  Output:');
        for (const line of output)
          console.log('  ' + line);
      }
    }
  }
}

function formatLocation(location) {
  if (!location)
    return '';
  return colors.yellow(`${location.toDetailedString()}`);
}

function padLines(text, spaces = 0) {
  const indent = ' '.repeat(spaces);
  return text.split('\n').map(line => indent + line).join('\n');
}

module.exports = Reporter;
