"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.baseFullConfig = exports.TeleTestResult = exports.TeleTestCase = exports.TeleSuite = exports.TeleReporterReceiver = void 0;
exports.computeTestCaseOutcome = computeTestCaseOutcome;
exports.parseRegexPatterns = parseRegexPatterns;
exports.serializeRegexPatterns = serializeRegexPatterns;
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

// -- Reuse boundary -- Everything below this line is reused in the vscode extension.

class TeleReporterReceiver {
  constructor(reporter, options = {}) {
    this.isListing = false;
    this._rootSuite = void 0;
    this._options = void 0;
    this._reporter = void 0;
    this._tests = new Map();
    this._rootDir = void 0;
    this._config = void 0;
    this._rootSuite = new TeleSuite('', 'root');
    this._options = options;
    this._reporter = reporter;
  }
  reset() {
    this._rootSuite._entries = [];
    this._tests.clear();
  }
  dispatch(message) {
    const {
      method,
      params
    } = message;
    if (method === 'onConfigure') {
      this._onConfigure(params.config);
      return;
    }
    if (method === 'onProject') {
      this._onProject(params.project);
      return;
    }
    if (method === 'onBegin') {
      this._onBegin();
      return;
    }
    if (method === 'onTestBegin') {
      this._onTestBegin(params.testId, params.result);
      return;
    }
    if (method === 'onTestEnd') {
      this._onTestEnd(params.test, params.result);
      return;
    }
    if (method === 'onStepBegin') {
      this._onStepBegin(params.testId, params.resultId, params.step);
      return;
    }
    if (method === 'onStepEnd') {
      this._onStepEnd(params.testId, params.resultId, params.step);
      return;
    }
    if (method === 'onError') {
      this._onError(params.error);
      return;
    }
    if (method === 'onStdIO') {
      this._onStdIO(params.type, params.testId, params.resultId, params.data, params.isBase64);
      return;
    }
    if (method === 'onEnd') return this._onEnd(params.result);
    if (method === 'onExit') return this._onExit();
  }
  _onConfigure(config) {
    var _this$_reporter$onCon, _this$_reporter;
    this._rootDir = config.rootDir;
    this._config = this._parseConfig(config);
    (_this$_reporter$onCon = (_this$_reporter = this._reporter).onConfigure) === null || _this$_reporter$onCon === void 0 || _this$_reporter$onCon.call(_this$_reporter, this._config);
  }
  _onProject(project) {
    let projectSuite = this._options.mergeProjects ? this._rootSuite.suites.find(suite => suite.project().name === project.name) : undefined;
    if (!projectSuite) {
      projectSuite = new TeleSuite(project.name, 'project');
      this._rootSuite._addSuite(projectSuite);
    }
    // Always update project in watch mode.
    projectSuite._project = this._parseProject(project);
    for (const suite of project.suites) this._mergeSuiteInto(suite, projectSuite);
  }
  _onBegin() {
    var _this$_reporter$onBeg, _this$_reporter2;
    (_this$_reporter$onBeg = (_this$_reporter2 = this._reporter).onBegin) === null || _this$_reporter$onBeg === void 0 || _this$_reporter$onBeg.call(_this$_reporter2, this._rootSuite);
  }
  _onTestBegin(testId, payload) {
    var _this$_reporter$onTes, _this$_reporter3;
    const test = this._tests.get(testId);
    if (this._options.clearPreviousResultsWhenTestBegins) test.results = [];
    const testResult = test._createTestResult(payload.id);
    testResult.retry = payload.retry;
    testResult.workerIndex = payload.workerIndex;
    testResult.parallelIndex = payload.parallelIndex;
    testResult.setStartTimeNumber(payload.startTime);
    (_this$_reporter$onTes = (_this$_reporter3 = this._reporter).onTestBegin) === null || _this$_reporter$onTes === void 0 || _this$_reporter$onTes.call(_this$_reporter3, test, testResult);
  }
  _onTestEnd(testEndPayload, payload) {
    var _result$errors, _this$_reporter$onTes2, _this$_reporter4;
    const test = this._tests.get(testEndPayload.testId);
    test.timeout = testEndPayload.timeout;
    test.expectedStatus = testEndPayload.expectedStatus;
    test.annotations = testEndPayload.annotations;
    const result = test.results.find(r => r._id === payload.id);
    result.duration = payload.duration;
    result.status = payload.status;
    result.errors = payload.errors;
    result.error = (_result$errors = result.errors) === null || _result$errors === void 0 ? void 0 : _result$errors[0];
    result.attachments = this._parseAttachments(payload.attachments);
    (_this$_reporter$onTes2 = (_this$_reporter4 = this._reporter).onTestEnd) === null || _this$_reporter$onTes2 === void 0 || _this$_reporter$onTes2.call(_this$_reporter4, test, result);
    // Free up the memory as won't see these step ids.
    result._stepMap = new Map();
  }
  _onStepBegin(testId, resultId, payload) {
    var _this$_reporter$onSte, _this$_reporter5;
    const test = this._tests.get(testId);
    const result = test.results.find(r => r._id === resultId);
    const parentStep = payload.parentStepId ? result._stepMap.get(payload.parentStepId) : undefined;
    const location = this._absoluteLocation(payload.location);
    const step = new TeleTestStep(payload, parentStep, location);
    if (parentStep) parentStep.steps.push(step);else result.steps.push(step);
    result._stepMap.set(payload.id, step);
    (_this$_reporter$onSte = (_this$_reporter5 = this._reporter).onStepBegin) === null || _this$_reporter$onSte === void 0 || _this$_reporter$onSte.call(_this$_reporter5, test, result, step);
  }
  _onStepEnd(testId, resultId, payload) {
    var _this$_reporter$onSte2, _this$_reporter6;
    const test = this._tests.get(testId);
    const result = test.results.find(r => r._id === resultId);
    const step = result._stepMap.get(payload.id);
    step.duration = payload.duration;
    step.error = payload.error;
    (_this$_reporter$onSte2 = (_this$_reporter6 = this._reporter).onStepEnd) === null || _this$_reporter$onSte2 === void 0 || _this$_reporter$onSte2.call(_this$_reporter6, test, result, step);
  }
  _onError(error) {
    var _this$_reporter$onErr, _this$_reporter7;
    (_this$_reporter$onErr = (_this$_reporter7 = this._reporter).onError) === null || _this$_reporter$onErr === void 0 || _this$_reporter$onErr.call(_this$_reporter7, error);
  }
  _onStdIO(type, testId, resultId, data, isBase64) {
    const chunk = isBase64 ? globalThis.Buffer ? Buffer.from(data, 'base64') : atob(data) : data;
    const test = testId ? this._tests.get(testId) : undefined;
    const result = test && resultId ? test.results.find(r => r._id === resultId) : undefined;
    if (type === 'stdout') {
      var _this$_reporter$onStd, _this$_reporter8;
      result === null || result === void 0 || result.stdout.push(chunk);
      (_this$_reporter$onStd = (_this$_reporter8 = this._reporter).onStdOut) === null || _this$_reporter$onStd === void 0 || _this$_reporter$onStd.call(_this$_reporter8, chunk, test, result);
    } else {
      var _this$_reporter$onStd2, _this$_reporter9;
      result === null || result === void 0 || result.stderr.push(chunk);
      (_this$_reporter$onStd2 = (_this$_reporter9 = this._reporter).onStdErr) === null || _this$_reporter$onStd2 === void 0 || _this$_reporter$onStd2.call(_this$_reporter9, chunk, test, result);
    }
  }
  async _onEnd(result) {
    var _this$_reporter$onEnd, _this$_reporter10;
    await ((_this$_reporter$onEnd = (_this$_reporter10 = this._reporter).onEnd) === null || _this$_reporter$onEnd === void 0 ? void 0 : _this$_reporter$onEnd.call(_this$_reporter10, {
      status: result.status,
      startTime: new Date(result.startTime),
      duration: result.duration
    }));
  }
  _onExit() {
    var _this$_reporter$onExi, _this$_reporter11;
    return (_this$_reporter$onExi = (_this$_reporter11 = this._reporter).onExit) === null || _this$_reporter$onExi === void 0 ? void 0 : _this$_reporter$onExi.call(_this$_reporter11);
  }
  _parseConfig(config) {
    const result = {
      ...baseFullConfig,
      ...config
    };
    if (this._options.configOverrides) {
      result.configFile = this._options.configOverrides.configFile;
      result.reportSlowTests = this._options.configOverrides.reportSlowTests;
      result.quiet = this._options.configOverrides.quiet;
      result.reporter = [...this._options.configOverrides.reporter];
    }
    return result;
  }
  _parseProject(project) {
    return {
      metadata: project.metadata,
      name: project.name,
      outputDir: this._absolutePath(project.outputDir),
      repeatEach: project.repeatEach,
      retries: project.retries,
      testDir: this._absolutePath(project.testDir),
      testIgnore: parseRegexPatterns(project.testIgnore),
      testMatch: parseRegexPatterns(project.testMatch),
      timeout: project.timeout,
      grep: parseRegexPatterns(project.grep),
      grepInvert: parseRegexPatterns(project.grepInvert),
      dependencies: project.dependencies,
      teardown: project.teardown,
      snapshotDir: this._absolutePath(project.snapshotDir),
      use: {}
    };
  }
  _parseAttachments(attachments) {
    return attachments.map(a => {
      return {
        ...a,
        body: a.base64 && globalThis.Buffer ? Buffer.from(a.base64, 'base64') : undefined
      };
    });
  }
  _mergeSuiteInto(jsonSuite, parent) {
    let targetSuite = parent.suites.find(s => s.title === jsonSuite.title);
    if (!targetSuite) {
      targetSuite = new TeleSuite(jsonSuite.title, parent.type === 'project' ? 'file' : 'describe');
      parent._addSuite(targetSuite);
    }
    targetSuite.location = this._absoluteLocation(jsonSuite.location);
    jsonSuite.entries.forEach(e => {
      if ('testId' in e) this._mergeTestInto(e, targetSuite);else this._mergeSuiteInto(e, targetSuite);
    });
  }
  _mergeTestInto(jsonTest, parent) {
    let targetTest = this._options.mergeTestCases ? parent.tests.find(s => s.title === jsonTest.title && s.repeatEachIndex === jsonTest.repeatEachIndex) : undefined;
    if (!targetTest) {
      targetTest = new TeleTestCase(jsonTest.testId, jsonTest.title, this._absoluteLocation(jsonTest.location), jsonTest.repeatEachIndex);
      parent._addTest(targetTest);
      this._tests.set(targetTest.id, targetTest);
    }
    this._updateTest(jsonTest, targetTest);
  }
  _updateTest(payload, test) {
    var _payload$tags, _payload$annotations;
    test.id = payload.testId;
    test.location = this._absoluteLocation(payload.location);
    test.retries = payload.retries;
    test.tags = (_payload$tags = payload.tags) !== null && _payload$tags !== void 0 ? _payload$tags : [];
    test.annotations = (_payload$annotations = payload.annotations) !== null && _payload$annotations !== void 0 ? _payload$annotations : [];
    return test;
  }
  _absoluteLocation(location) {
    if (!location) return location;
    return {
      ...location,
      file: this._absolutePath(location.file)
    };
  }
  _absolutePath(relativePath) {
    if (relativePath === undefined) return;
    return this._options.resolvePath ? this._options.resolvePath(this._rootDir, relativePath) : this._rootDir + '/' + relativePath;
  }
}
exports.TeleReporterReceiver = TeleReporterReceiver;
class TeleSuite {
  constructor(title, type) {
    this.title = void 0;
    this.location = void 0;
    this.parent = void 0;
    this._entries = [];
    this._requireFile = '';
    this._timeout = void 0;
    this._retries = void 0;
    this._project = void 0;
    this._parallelMode = 'none';
    this._type = void 0;
    this.title = title;
    this._type = type;
  }
  get type() {
    return this._type;
  }
  get suites() {
    return this._entries.filter(e => e.type !== 'test');
  }
  get tests() {
    return this._entries.filter(e => e.type === 'test');
  }
  entries() {
    return this._entries;
  }
  allTests() {
    const result = [];
    const visit = suite => {
      for (const entry of suite.entries()) {
        if (entry.type === 'test') result.push(entry);else visit(entry);
      }
    };
    visit(this);
    return result;
  }
  titlePath() {
    const titlePath = this.parent ? this.parent.titlePath() : [];
    // Ignore anonymous describe blocks.
    if (this.title || this._type !== 'describe') titlePath.push(this.title);
    return titlePath;
  }
  project() {
    var _this$_project, _this$parent;
    return (_this$_project = this._project) !== null && _this$_project !== void 0 ? _this$_project : (_this$parent = this.parent) === null || _this$parent === void 0 ? void 0 : _this$parent.project();
  }
  _addTest(test) {
    test.parent = this;
    this._entries.push(test);
  }
  _addSuite(suite) {
    suite.parent = this;
    this._entries.push(suite);
  }
}
exports.TeleSuite = TeleSuite;
class TeleTestCase {
  constructor(id, title, location, repeatEachIndex) {
    this.title = void 0;
    this.fn = () => {};
    this.results = [];
    this.location = void 0;
    this.parent = void 0;
    this.type = 'test';
    this.expectedStatus = 'passed';
    this.timeout = 0;
    this.annotations = [];
    this.retries = 0;
    this.tags = [];
    this.repeatEachIndex = 0;
    this.id = void 0;
    this.id = id;
    this.title = title;
    this.location = location;
    this.repeatEachIndex = repeatEachIndex;
  }
  titlePath() {
    const titlePath = this.parent ? this.parent.titlePath() : [];
    titlePath.push(this.title);
    return titlePath;
  }
  outcome() {
    return computeTestCaseOutcome(this);
  }
  ok() {
    const status = this.outcome();
    return status === 'expected' || status === 'flaky' || status === 'skipped';
  }
  _createTestResult(id) {
    const result = new TeleTestResult(this.results.length, id);
    this.results.push(result);
    return result;
  }
}
exports.TeleTestCase = TeleTestCase;
class TeleTestStep {
  constructor(payload, parentStep, location) {
    this.title = void 0;
    this.category = void 0;
    this.location = void 0;
    this.parent = void 0;
    this.duration = -1;
    this.steps = [];
    this._startTime = 0;
    this.title = payload.title;
    this.category = payload.category;
    this.location = location;
    this.parent = parentStep;
    this._startTime = payload.startTime;
  }
  titlePath() {
    var _this$parent2;
    const parentPath = ((_this$parent2 = this.parent) === null || _this$parent2 === void 0 ? void 0 : _this$parent2.titlePath()) || [];
    return [...parentPath, this.title];
  }
  get startTime() {
    return new Date(this._startTime);
  }
  set startTime(value) {
    this._startTime = +value;
  }
}
class TeleTestResult {
  constructor(retry, id) {
    this.retry = void 0;
    this.parallelIndex = -1;
    this.workerIndex = -1;
    this.duration = -1;
    this.stdout = [];
    this.stderr = [];
    this.attachments = [];
    this.status = 'skipped';
    this.steps = [];
    this.errors = [];
    this.error = void 0;
    this._stepMap = new Map();
    this._id = void 0;
    this._startTime = 0;
    this.retry = retry;
    this._id = id;
  }
  setStartTimeNumber(startTime) {
    this._startTime = startTime;
  }
  get startTime() {
    return new Date(this._startTime);
  }
  set startTime(value) {
    this._startTime = +value;
  }
}
exports.TeleTestResult = TeleTestResult;
const baseFullConfig = exports.baseFullConfig = {
  forbidOnly: false,
  fullyParallel: false,
  globalSetup: null,
  globalTeardown: null,
  globalTimeout: 0,
  grep: /.*/,
  grepInvert: null,
  maxFailures: 0,
  metadata: {},
  preserveOutput: 'always',
  projects: [],
  reporter: [[process.env.CI ? 'dot' : 'list']],
  reportSlowTests: {
    max: 5,
    threshold: 15000
  },
  configFile: '',
  rootDir: '',
  quiet: false,
  shard: null,
  updateSnapshots: 'missing',
  version: '',
  workers: 0,
  webServer: null
};
function serializeRegexPatterns(patterns) {
  if (!Array.isArray(patterns)) patterns = [patterns];
  return patterns.map(s => {
    if (typeof s === 'string') return {
      s
    };
    return {
      r: {
        source: s.source,
        flags: s.flags
      }
    };
  });
}
function parseRegexPatterns(patterns) {
  return patterns.map(p => {
    if (p.s) return p.s;
    return new RegExp(p.r.source, p.r.flags);
  });
}
function computeTestCaseOutcome(test) {
  let skipped = 0;
  let didNotRun = 0;
  let expected = 0;
  let interrupted = 0;
  let unexpected = 0;
  for (const result of test.results) {
    if (result.status === 'interrupted') {
      ++interrupted; // eslint-disable-line @typescript-eslint/no-unused-vars
    } else if (result.status === 'skipped' && test.expectedStatus === 'skipped') {
      // Only tests "expected to be skipped" are skipped. These were specifically
      // marked with test.skip or test.fixme.
      ++skipped;
    } else if (result.status === 'skipped') {
      // Tests that were expected to run, but were skipped are "did not run".
      // This happens when:
      // - testing finished early;
      // - test failure prevented other tests in the serial suite to run;
      // - probably more cases!
      ++didNotRun; // eslint-disable-line @typescript-eslint/no-unused-vars
    } else if (result.status === test.expectedStatus) {
      // Either passed and expected to pass, or failed and expected to fail.
      ++expected;
    } else {
      ++unexpected;
    }
  }

  // Tests that were "skipped as expected" are considered equal to "expected" below,
  // because that's the expected outcome.
  //
  // However, we specifically differentiate the case of "only skipped"
  // and show it as "skipped" in all reporters.
  //
  // More exotic cases like "failed on first run and skipped on retry" are flaky.
  if (expected === 0 && unexpected === 0) return 'skipped'; // all results were skipped or interrupted
  if (unexpected === 0) return 'expected'; // no failures, just expected+skipped
  if (expected === 0 && skipped === 0) return 'unexpected'; // only failures
  return 'flaky'; // expected+unexpected or skipped+unexpected
}