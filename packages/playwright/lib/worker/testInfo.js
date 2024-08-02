"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TestInfoImpl = exports.SkipError = void 0;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _utils = require("playwright-core/lib/utils");
var _timeoutManager = require("./timeoutManager");
var _util = require("../util");
var _testTracing = require("./testTracing");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
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

class TestInfoImpl {
  get error() {
    return this.errors[0];
  }
  set error(e) {
    if (e === undefined) throw new Error('Cannot assign testInfo.error undefined value!');
    this.errors[0] = e;
  }
  get timeout() {
    return this._timeoutManager.defaultSlot().timeout;
  }
  set timeout(timeout) {
    // Ignored.
  }
  _deadlineForMatcher(timeout) {
    const startTime = (0, _utils.monotonicTime)();
    const matcherDeadline = timeout ? startTime + timeout : _timeoutManager.kMaxDeadline;
    const testDeadline = this._timeoutManager.currentSlotDeadline() - 250;
    const matcherMessage = `Timeout ${timeout}ms exceeded while waiting on the predicate`;
    const testMessage = `Test timeout of ${this.timeout}ms exceeded`;
    return {
      deadline: Math.min(testDeadline, matcherDeadline),
      timeoutMessage: testDeadline < matcherDeadline ? testMessage : matcherMessage
    };
  }
  static _defaultDeadlineForMatcher(timeout) {
    return {
      deadline: timeout ? (0, _utils.monotonicTime)() + timeout : 0,
      timeoutMessage: `Timeout ${timeout}ms exceeded while waiting on the predicate`
    };
  }
  constructor(configInternal, projectInternal, workerParams, test, retry, onStepBegin, onStepEnd, onAttach) {
    var _test$id, _test$_requireFile, _test$title, _test$titlePath, _test$location$file, _test$location$line, _test$location$column, _test$tags, _test$fn, _test$expectedStatus;
    this._onStepBegin = void 0;
    this._onStepEnd = void 0;
    this._onAttach = void 0;
    this._timeoutManager = void 0;
    this._startTime = void 0;
    this._startWallTime = void 0;
    this._tracing = void 0;
    this._wasInterrupted = false;
    this._lastStepId = 0;
    this._requireFile = void 0;
    this._projectInternal = void 0;
    this._configInternal = void 0;
    this._steps = [];
    this._stages = [];
    this._hasNonRetriableError = false;
    this._hasUnhandledError = false;
    this._allowSkips = false;
    // ------------ TestInfo fields ------------
    this.testId = void 0;
    this.repeatEachIndex = void 0;
    this.retry = void 0;
    this.workerIndex = void 0;
    this.parallelIndex = void 0;
    this.project = void 0;
    this.config = void 0;
    this.title = void 0;
    this.titlePath = void 0;
    this.file = void 0;
    this.line = void 0;
    this.tags = void 0;
    this.column = void 0;
    this.fn = void 0;
    this.expectedStatus = void 0;
    this.duration = 0;
    this.annotations = [];
    this.attachments = [];
    this.status = 'passed';
    this.snapshotSuffix = '';
    this.outputDir = void 0;
    this.snapshotDir = void 0;
    this.errors = [];
    this._attachmentsPush = void 0;
    this.testId = (_test$id = test === null || test === void 0 ? void 0 : test.id) !== null && _test$id !== void 0 ? _test$id : '';
    this._onStepBegin = onStepBegin;
    this._onStepEnd = onStepEnd;
    this._onAttach = onAttach;
    this._startTime = (0, _utils.monotonicTime)();
    this._startWallTime = Date.now();
    this._requireFile = (_test$_requireFile = test === null || test === void 0 ? void 0 : test._requireFile) !== null && _test$_requireFile !== void 0 ? _test$_requireFile : '';
    this.repeatEachIndex = workerParams.repeatEachIndex;
    this.retry = retry;
    this.workerIndex = workerParams.workerIndex;
    this.parallelIndex = workerParams.parallelIndex;
    this._projectInternal = projectInternal;
    this.project = projectInternal.project;
    this._configInternal = configInternal;
    this.config = configInternal.config;
    this.title = (_test$title = test === null || test === void 0 ? void 0 : test.title) !== null && _test$title !== void 0 ? _test$title : '';
    this.titlePath = (_test$titlePath = test === null || test === void 0 ? void 0 : test.titlePath()) !== null && _test$titlePath !== void 0 ? _test$titlePath : [];
    this.file = (_test$location$file = test === null || test === void 0 ? void 0 : test.location.file) !== null && _test$location$file !== void 0 ? _test$location$file : '';
    this.line = (_test$location$line = test === null || test === void 0 ? void 0 : test.location.line) !== null && _test$location$line !== void 0 ? _test$location$line : 0;
    this.column = (_test$location$column = test === null || test === void 0 ? void 0 : test.location.column) !== null && _test$location$column !== void 0 ? _test$location$column : 0;
    this.tags = (_test$tags = test === null || test === void 0 ? void 0 : test.tags) !== null && _test$tags !== void 0 ? _test$tags : [];
    this.fn = (_test$fn = test === null || test === void 0 ? void 0 : test.fn) !== null && _test$fn !== void 0 ? _test$fn : () => {};
    this.expectedStatus = (_test$expectedStatus = test === null || test === void 0 ? void 0 : test.expectedStatus) !== null && _test$expectedStatus !== void 0 ? _test$expectedStatus : 'skipped';
    this._timeoutManager = new _timeoutManager.TimeoutManager(this.project.timeout);
    this.outputDir = (() => {
      const relativeTestFilePath = _path.default.relative(this.project.testDir, this._requireFile.replace(/\.(spec|test)\.(js|ts|jsx|tsx|mjs|mts|cjs|cts)$/, ''));
      const sanitizedRelativePath = relativeTestFilePath.replace(process.platform === 'win32' ? new RegExp('\\\\', 'g') : new RegExp('/', 'g'), '-');
      const fullTitleWithoutSpec = this.titlePath.slice(1).join(' ');
      let testOutputDir = (0, _util.trimLongString)(sanitizedRelativePath + '-' + (0, _utils.sanitizeForFilePath)(fullTitleWithoutSpec), _util.windowsFilesystemFriendlyLength);
      if (projectInternal.id) testOutputDir += '-' + (0, _utils.sanitizeForFilePath)(projectInternal.id);
      if (this.retry) testOutputDir += '-retry' + this.retry;
      if (this.repeatEachIndex) testOutputDir += '-repeat' + this.repeatEachIndex;
      return _path.default.join(this.project.outputDir, testOutputDir);
    })();
    this.snapshotDir = (() => {
      const relativeTestFilePath = _path.default.relative(this.project.testDir, this._requireFile);
      return _path.default.join(this.project.snapshotDir, relativeTestFilePath + '-snapshots');
    })();
    this._attachmentsPush = this.attachments.push.bind(this.attachments);
    this.attachments.push = (...attachments) => {
      for (const a of attachments) this._attach(a.name, a);
      return this.attachments.length;
    };
    this._tracing = new _testTracing.TestTracing(this, workerParams.artifactsDir);
  }
  _modifier(type, modifierArgs) {
    if (typeof modifierArgs[1] === 'function') {
      throw new Error(['It looks like you are calling test.skip() inside the test and pass a callback.', 'Pass a condition instead and optional description instead:', `test('my test', async ({ page, isMobile }) => {`, `  test.skip(isMobile, 'This test is not applicable on mobile');`, `});`].join('\n'));
    }
    if (modifierArgs.length >= 1 && !modifierArgs[0]) return;
    const description = modifierArgs[1];
    this.annotations.push({
      type,
      description
    });
    if (type === 'slow') {
      this._timeoutManager.slow();
    } else if (type === 'skip' || type === 'fixme') {
      this.expectedStatus = 'skipped';
      throw new SkipError('Test is skipped: ' + (description || ''));
    } else if (type === 'fail') {
      if (this.expectedStatus !== 'skipped') this.expectedStatus = 'failed';
    }
  }
  _findLastNonFinishedStep(filter) {
    let result;
    const visit = step => {
      if (!step.endWallTime && filter(step)) result = step;
      step.steps.forEach(visit);
    };
    this._steps.forEach(visit);
    return result;
  }
  _findLastStageStep() {
    for (let i = this._stages.length - 1; i >= 0; i--) {
      if (this._stages[i].step) return this._stages[i].step;
    }
  }
  _addStep(data) {
    var _parentStep, _parentStep2;
    const stepId = `${data.category}@${++this._lastStepId}`;
    let parentStep;
    if (data.isStage) {
      // Predefined stages form a fixed hierarchy - use the current one as parent.
      parentStep = this._findLastStageStep();
    } else {
      parentStep = _utils.zones.zoneData('stepZone');
      if (!parentStep && data.category !== 'test.step') {
        // API steps (but not test.step calls) can be nested by time, instead of by stack.
        // However, do not nest chains of route.continue by checking the title.
        parentStep = this._findLastNonFinishedStep(step => step.title !== data.title);
      }
      if (!parentStep) {
        // If no parent step on stack, assume the current stage as parent.
        parentStep = this._findLastStageStep();
      }
    }
    const filteredStack = (0, _util.filteredStackTrace)((0, _utils.captureRawStack)());
    data.boxedStack = (_parentStep = parentStep) === null || _parentStep === void 0 ? void 0 : _parentStep.boxedStack;
    if (!data.boxedStack && data.box) {
      data.boxedStack = filteredStack.slice(1);
      data.location = data.location || data.boxedStack[0];
    }
    data.location = data.location || filteredStack[0];
    const step = {
      stepId,
      ...data,
      steps: [],
      complete: result => {
        if (step.endWallTime) return;
        step.endWallTime = Date.now();
        if (result.error) {
          if (!result.error[stepSymbol]) result.error[stepSymbol] = step;
          const error = (0, _util.serializeError)(result.error);
          if (data.boxedStack) error.stack = `${error.message}\n${(0, _utils.stringifyStackFrames)(data.boxedStack).join('\n')}`;
          step.error = error;
        }
        if (!step.error) {
          // Soft errors inside try/catch will make the test fail.
          // In order to locate the failing step, we are marking all the parent
          // steps as failing unconditionally.
          for (const childStep of step.steps) {
            if (childStep.error && childStep.infectParentStepsWithError) {
              step.error = childStep.error;
              step.infectParentStepsWithError = true;
              break;
            }
          }
        }
        const payload = {
          testId: this.testId,
          stepId,
          wallTime: step.endWallTime,
          error: step.error
        };
        this._onStepEnd(payload);
        const errorForTrace = step.error ? {
          name: '',
          message: step.error.message || '',
          stack: step.error.stack
        } : undefined;
        this._tracing.appendAfterActionForStep(stepId, errorForTrace, result.attachments);
      }
    };
    const parentStepList = parentStep ? parentStep.steps : this._steps;
    parentStepList.push(step);
    const payload = {
      testId: this.testId,
      stepId,
      parentStepId: parentStep ? parentStep.stepId : undefined,
      title: data.title,
      category: data.category,
      wallTime: Date.now(),
      location: data.location
    };
    this._onStepBegin(payload);
    this._tracing.appendBeforeActionForStep(stepId, (_parentStep2 = parentStep) === null || _parentStep2 === void 0 ? void 0 : _parentStep2.stepId, data.apiName || data.title, data.params, data.location ? [data.location] : []);
    return step;
  }
  _interrupt() {
    // Mark as interrupted so we can ignore TimeoutError thrown by interrupt() call.
    this._wasInterrupted = true;
    this._timeoutManager.interrupt();
    // Do not overwrite existing failure (for example, unhandled rejection) with "interrupted".
    if (this.status === 'passed') this.status = 'interrupted';
  }
  _failWithError(error) {
    if (this.status === 'passed' || this.status === 'skipped') this.status = error instanceof _timeoutManager.TimeoutManagerError ? 'timedOut' : 'failed';
    const serialized = (0, _util.serializeError)(error);
    const step = error[stepSymbol];
    if (step && step.boxedStack) serialized.stack = `${error.name}: ${error.message}\n${(0, _utils.stringifyStackFrames)(step.boxedStack).join('\n')}`;
    this.errors.push(serialized);
    this._tracing.appendForError(serialized);
  }
  async _runAsStage(stage, cb) {
    if (_util.debugTest.enabled) {
      var _stage$runnable;
      const location = (_stage$runnable = stage.runnable) !== null && _stage$runnable !== void 0 && _stage$runnable.location ? ` at "${(0, _util.formatLocation)(stage.runnable.location)}"` : ``;
      (0, _util.debugTest)(`started stage "${stage.title}"${location}`);
    }
    stage.step = stage.stepInfo ? this._addStep({
      ...stage.stepInfo,
      title: stage.title,
      isStage: true
    }) : undefined;
    this._stages.push(stage);
    try {
      var _stage$step;
      await this._timeoutManager.withRunnable(stage.runnable, async () => {
        try {
          await cb();
        } catch (e) {
          // Only handle errors directly thrown by the user code.
          if (!stage.runnable) throw e;
          if (this._allowSkips && e instanceof SkipError) {
            if (this.status === 'passed') this.status = 'skipped';
          } else {
            // Unfortunately, we have to handle user errors and timeout errors differently.
            // Consider the following scenario:
            // - locator.click times out
            // - all stages containing the test function finish with TimeoutManagerError
            // - test finishes, the page is closed and this triggers locator.click error
            // - we would like to present the locator.click error to the user
            // - therefore, we need a try/catch inside the "run with timeout" block and capture the error
            this._failWithError(e);
          }
          throw e;
        }
      });
      (_stage$step = stage.step) === null || _stage$step === void 0 || _stage$step.complete({});
    } catch (error) {
      var _stage$step2;
      // When interrupting, we arrive here with a TimeoutManagerError, but we should not
      // consider it a timeout.
      if (!this._wasInterrupted && error instanceof _timeoutManager.TimeoutManagerError && stage.runnable) this._failWithError(error);
      (_stage$step2 = stage.step) === null || _stage$step2 === void 0 || _stage$step2.complete({
        error
      });
      throw error;
    } finally {
      if (this._stages[this._stages.length - 1] !== stage) throw new Error(`Internal error: inconsistent stages!`);
      this._stages.pop();
      (0, _util.debugTest)(`finished stage "${stage.title}"`);
    }
  }
  _isFailure() {
    return this.status !== 'skipped' && this.status !== this.expectedStatus;
  }
  _currentHookType() {
    for (let i = this._stages.length - 1; i >= 0; i--) {
      var _this$_stages$i$runna;
      const type = (_this$_stages$i$runna = this._stages[i].runnable) === null || _this$_stages$i$runna === void 0 ? void 0 : _this$_stages$i$runna.type;
      if (type && ['beforeAll', 'afterAll', 'beforeEach', 'afterEach'].includes(type)) return type;
    }
  }

  // ------------ TestInfo methods ------------

  async attach(name, options = {}) {
    this._attach(name, await (0, _util.normalizeAndSaveAttachment)(this.outputPath(), name, options));
  }
  _attach(name, attachment) {
    var _attachment$body;
    const step = this._addStep({
      title: `attach "${name}"`,
      category: 'attach'
    });
    this._attachmentsPush(attachment);
    this._onAttach({
      testId: this.testId,
      name: attachment.name,
      contentType: attachment.contentType,
      path: attachment.path,
      body: (_attachment$body = attachment.body) === null || _attachment$body === void 0 ? void 0 : _attachment$body.toString('base64')
    });
    step.complete({
      attachments: [attachment]
    });
  }
  outputPath(...pathSegments) {
    const outputPath = this._getOutputPath(...pathSegments);
    _fs.default.mkdirSync(this.outputDir, {
      recursive: true
    });
    return outputPath;
  }
  _getOutputPath(...pathSegments) {
    const joinedPath = _path.default.join(...pathSegments);
    const outputPath = (0, _util.getContainedPath)(this.outputDir, joinedPath);
    if (outputPath) return outputPath;
    throw new Error(`The outputPath is not allowed outside of the parent directory. Please fix the defined path.\n\n\toutputPath: ${joinedPath}`);
  }
  _fsSanitizedTestName() {
    const fullTitleWithoutSpec = this.titlePath.slice(1).join(' ');
    return (0, _utils.sanitizeForFilePath)((0, _util.trimLongString)(fullTitleWithoutSpec));
  }
  snapshotPath(...pathSegments) {
    const subPath = _path.default.join(...pathSegments);
    const parsedSubPath = _path.default.parse(subPath);
    const relativeTestFilePath = _path.default.relative(this.project.testDir, this._requireFile);
    const parsedRelativeTestFilePath = _path.default.parse(relativeTestFilePath);
    const projectNamePathSegment = (0, _utils.sanitizeForFilePath)(this.project.name);
    const snapshotPath = (this._projectInternal.snapshotPathTemplate || '').replace(/\{(.)?testDir\}/g, '$1' + this.project.testDir).replace(/\{(.)?snapshotDir\}/g, '$1' + this.project.snapshotDir).replace(/\{(.)?snapshotSuffix\}/g, this.snapshotSuffix ? '$1' + this.snapshotSuffix : '').replace(/\{(.)?testFileDir\}/g, '$1' + parsedRelativeTestFilePath.dir).replace(/\{(.)?platform\}/g, '$1' + process.platform).replace(/\{(.)?projectName\}/g, projectNamePathSegment ? '$1' + projectNamePathSegment : '').replace(/\{(.)?testName\}/g, '$1' + this._fsSanitizedTestName()).replace(/\{(.)?testFileName\}/g, '$1' + parsedRelativeTestFilePath.base).replace(/\{(.)?testFilePath\}/g, '$1' + relativeTestFilePath).replace(/\{(.)?arg\}/g, '$1' + _path.default.join(parsedSubPath.dir, parsedSubPath.name)).replace(/\{(.)?ext\}/g, parsedSubPath.ext ? '$1' + parsedSubPath.ext : '');
    return _path.default.normalize(_path.default.resolve(this._configInternal.configDir, snapshotPath));
  }
  skip(...args) {
    this._modifier('skip', args);
  }
  fixme(...args) {
    this._modifier('fixme', args);
  }
  fail(...args) {
    this._modifier('fail', args);
  }
  slow(...args) {
    this._modifier('slow', args);
  }
  setTimeout(timeout) {
    this._timeoutManager.setTimeout(timeout);
  }
}
exports.TestInfoImpl = TestInfoImpl;
class SkipError extends Error {}
exports.SkipError = SkipError;
const stepSymbol = Symbol('step');