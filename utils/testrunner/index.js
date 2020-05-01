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

const path = require('path');
const { TestRunner, Result, TestResult } = require('./TestRunner');
const { TestCollector, FocusedFilter, Repeater } = require('./TestCollector');
const Reporter = require('./Reporter');
const { Matchers } = require('./Matchers');

class DefaultTestRunner {
  constructor(options = {}) {
    const {
      // Our options.
      crashIfTestsAreFocusedOnCI = true,
      exit = true,
      reporter = true,
      // Collector options.
      timeout,
      // Runner options.
      parallel = 1,
      breakOnFailure,
      totalTimeout,
      hookTimeout = timeout,
      // Reporting options.
      showSlowTests,
      showMarkedAsFailingTests,
      verbose,
      summary,
    } = options;

    this._crashIfTestsAreFocusedOnCI = crashIfTestsAreFocusedOnCI;
    this._exit = exit;
    this._parallel = parallel;
    this._breakOnFailure = breakOnFailure;
    this._totalTimeout = totalTimeout;
    this._hookTimeout = hookTimeout;
    this._needReporter = reporter;
    this._showSlowTests = showSlowTests;
    this._showMarkedAsFailingTests = showMarkedAsFailingTests;
    this._verbose = verbose;
    this._summary = summary;

    this._filter = new FocusedFilter();
    this._repeater = new Repeater();
    this._collector = new TestCollector({ timeout });

    this._api = {
      ...this._collector.api(),
      expect: new Matchers().expect,
    };
    this._collector.addSuiteAttribute('only', s => this._filter.focusSuite(s));
    this._collector.addSuiteAttribute('skip', s => s.setSkipped(true));
    this._collector.addSuiteModifier('repeat', (s, count) => this._repeater.repeat(s, count));
    this._collector.addTestAttribute('only', t => this._filter.focusTest(t));
    this._collector.addTestAttribute('skip', t => t.setSkipped(true));
    this._collector.addTestAttribute('todo', t => t.setSkipped(true));
    this._collector.addTestAttribute('slow', t => t.setTimeout(t.timeout() * 3));
    this._collector.addTestModifier('repeat', (t, count) => this._repeater.repeat(t, count));
    this._api.fdescribe = this._api.describe.only;
    this._api.xdescribe = this._api.describe.skip;
    this._api.fit = this._api.it.only;
    this._api.xit = this._api.it.skip;
  }

  collector() {
    return this._collector;
  }

  api() {
    return this._api;
  }

  focusMatchingNameTests(fullNameRegex) {
    const focusedTests = [];
    for (const test of this._collector.tests()) {
      if (fullNameRegex.test(test.fullName())) {
        this._filter.focusTest(test);
        focusedTests.push(test);
      }
    }
    return focusedTests;
  }

  focusMatchingFileName(filenameRegex) {
    const focusedFilePaths = [];
    for (const filePath of this._collector.filePaths()) {
      if (filenameRegex.test(path.basename(filePath))) {
        this._filter.focusFilePath(filePath);
        focusedFilePaths.push(filePath);
      }
    }
    return focusedFilePaths;
  }

  repeatAll(repeatCount) {
    this._repeater.repeat(this._collector.rootSuite(), repeatCount);
  }

  async run() {
    let reporter = null;

    if (this._needReporter) {
      const reporterDelegate = {
        focusedSuites: () => this._filter.focusedSuites(this._collector.suites()),
        focusedTests: () => this._filter.focusedTests(this._collector.tests()),
        focusedFilePaths: () => this._filter.focusedFilePaths(this._collector.filePaths()),
        hasFocusedTestsOrSuitesOrFiles: () => this._filter.hasFocusedTestsOrSuitesOrFiles(),
        parallel: () => this._parallel,
        testCount: () => this._collector.tests().length,
      };
      const reporterOptions = {
        showSlowTests: this._showSlowTests,
        showMarkedAsFailingTests: this._showMarkedAsFailingTests,
        verbose: this._verbose,
        summary: this._summary,
      };
      reporter = new Reporter(reporterDelegate, reporterOptions);
    }

    if (this._crashIfTestsAreFocusedOnCI && process.env.CI && this._filter.hasFocusedTestsOrSuitesOrFiles()) {
      if (reporter)
        await reporter.onStarted([]);
      const result = new Result();
      result.setResult(TestResult.Crashed, '"focused" tests or suites are probitted on CI');
      if (reporter)
        await reporter.onFinished(result);
      if (this._exit)
        process.exit(result.exitCode);
      return result;
    }

    const testRuns = this._repeater.createTestRuns(this._filter.filter(this._collector.tests()));
    const testRunner = new TestRunner();
    const result = await testRunner.run(testRuns, {
      parallel: this._parallel,
      breakOnFailure: this._breakOnFailure,
      totalTimeout: this._totalTimeout,
      hookTimeout: this._hookTimeout,
      onStarted: (...args) => reporter && reporter.onStarted(...args),
      onFinished: (...args) => reporter && reporter.onFinished(...args),
      onTestRunStarted: (...args) => reporter && reporter.onTestRunStarted(...args),
      onTestRunFinished: (...args) => reporter && reporter.onTestRunFinished(...args),
    });
    if (this._exit)
      process.exit(result.exitCode);
    return result;
  }
}

module.exports = DefaultTestRunner;
