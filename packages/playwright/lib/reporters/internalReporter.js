"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.InternalReporter = void 0;
var _fs = _interopRequireDefault(require("fs"));
var _babelBundle = require("../transform/babelBundle");
var _test = require("../common/test");
var _base = require("./base");
var _utils = require("playwright-core/lib/utils");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
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

class InternalReporter {
  constructor(reporter) {
    this._reporter = void 0;
    this._didBegin = false;
    this._config = void 0;
    this._startTime = void 0;
    this._monotonicStartTime = void 0;
    this._reporter = reporter;
  }
  version() {
    return 'v2';
  }
  onConfigure(config) {
    this._config = config;
    this._startTime = new Date();
    this._monotonicStartTime = (0, _utils.monotonicTime)();
    this._reporter.onConfigure(config);
  }
  onBegin(suite) {
    this._didBegin = true;
    this._reporter.onBegin(suite);
  }
  onTestBegin(test, result) {
    this._reporter.onTestBegin(test, result);
  }
  onStdOut(chunk, test, result) {
    this._reporter.onStdOut(chunk, test, result);
  }
  onStdErr(chunk, test, result) {
    this._reporter.onStdErr(chunk, test, result);
  }
  onTestEnd(test, result) {
    this._addSnippetToTestErrors(test, result);
    this._reporter.onTestEnd(test, result);
  }
  async onEnd(result) {
    if (!this._didBegin) {
      // onBegin was not reported, emit it.
      this.onBegin(new _test.Suite('', 'root'));
    }
    return await this._reporter.onEnd({
      ...result,
      startTime: this._startTime,
      duration: (0, _utils.monotonicTime)() - this._monotonicStartTime
    });
  }
  async onExit() {
    await this._reporter.onExit();
  }
  onError(error) {
    addLocationAndSnippetToError(this._config, error);
    this._reporter.onError(error);
  }
  onStepBegin(test, result, step) {
    this._reporter.onStepBegin(test, result, step);
  }
  onStepEnd(test, result, step) {
    this._addSnippetToStepError(test, step);
    this._reporter.onStepEnd(test, result, step);
  }
  printsToStdio() {
    return this._reporter.printsToStdio();
  }
  _addSnippetToTestErrors(test, result) {
    for (const error of result.errors) addLocationAndSnippetToError(this._config, error, test.location.file);
  }
  _addSnippetToStepError(test, step) {
    if (step.error) addLocationAndSnippetToError(this._config, step.error, test.location.file);
  }
}
exports.InternalReporter = InternalReporter;
function addLocationAndSnippetToError(config, error, file) {
  if (error.stack && !error.location) error.location = (0, _base.prepareErrorStack)(error.stack).location;
  const location = error.location;
  if (!location) return;
  try {
    const tokens = [];
    const source = _fs.default.readFileSync(location.file, 'utf8');
    const codeFrame = (0, _babelBundle.codeFrameColumns)(source, {
      start: location
    }, {
      highlightCode: true
    });
    // Convert /var/folders to /private/var/folders on Mac.
    if (!file || _fs.default.realpathSync(file) !== location.file) {
      tokens.push(_base.colors.gray(`   at `) + `${(0, _base.relativeFilePath)(config, location.file)}:${location.line}`);
      tokens.push('');
    }
    tokens.push(codeFrame);
    error.snippet = tokens.join('\n');
  } catch (e) {
    // Failed to read the source file - that's ok.
  }
}