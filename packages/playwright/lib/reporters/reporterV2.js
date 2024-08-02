"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.wrapReporterAsV2 = wrapReporterAsV2;
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

function wrapReporterAsV2(reporter) {
  try {
    if ('version' in reporter && reporter.version() === 'v2') return reporter;
  } catch (e) {}
  return new ReporterV2Wrapper(reporter);
}
class ReporterV2Wrapper {
  constructor(reporter) {
    this._reporter = void 0;
    this._deferred = [];
    this._config = void 0;
    this._reporter = reporter;
  }
  version() {
    return 'v2';
  }
  onConfigure(config) {
    this._config = config;
  }
  onBegin(suite) {
    var _this$_reporter$onBeg, _this$_reporter;
    (_this$_reporter$onBeg = (_this$_reporter = this._reporter).onBegin) === null || _this$_reporter$onBeg === void 0 || _this$_reporter$onBeg.call(_this$_reporter, this._config, suite);
    const deferred = this._deferred;
    this._deferred = null;
    for (const item of deferred) {
      if (item.error) this.onError(item.error);
      if (item.stdout) this.onStdOut(item.stdout.chunk, item.stdout.test, item.stdout.result);
      if (item.stderr) this.onStdErr(item.stderr.chunk, item.stderr.test, item.stderr.result);
    }
  }
  onTestBegin(test, result) {
    var _this$_reporter$onTes, _this$_reporter2;
    (_this$_reporter$onTes = (_this$_reporter2 = this._reporter).onTestBegin) === null || _this$_reporter$onTes === void 0 || _this$_reporter$onTes.call(_this$_reporter2, test, result);
  }
  onStdOut(chunk, test, result) {
    var _this$_reporter$onStd, _this$_reporter3;
    if (this._deferred) {
      this._deferred.push({
        stdout: {
          chunk,
          test,
          result
        }
      });
      return;
    }
    (_this$_reporter$onStd = (_this$_reporter3 = this._reporter).onStdOut) === null || _this$_reporter$onStd === void 0 || _this$_reporter$onStd.call(_this$_reporter3, chunk, test, result);
  }
  onStdErr(chunk, test, result) {
    var _this$_reporter$onStd2, _this$_reporter4;
    if (this._deferred) {
      this._deferred.push({
        stderr: {
          chunk,
          test,
          result
        }
      });
      return;
    }
    (_this$_reporter$onStd2 = (_this$_reporter4 = this._reporter).onStdErr) === null || _this$_reporter$onStd2 === void 0 || _this$_reporter$onStd2.call(_this$_reporter4, chunk, test, result);
  }
  onTestEnd(test, result) {
    var _this$_reporter$onTes2, _this$_reporter5;
    (_this$_reporter$onTes2 = (_this$_reporter5 = this._reporter).onTestEnd) === null || _this$_reporter$onTes2 === void 0 || _this$_reporter$onTes2.call(_this$_reporter5, test, result);
  }
  async onEnd(result) {
    var _this$_reporter$onEnd, _this$_reporter6;
    return await ((_this$_reporter$onEnd = (_this$_reporter6 = this._reporter).onEnd) === null || _this$_reporter$onEnd === void 0 ? void 0 : _this$_reporter$onEnd.call(_this$_reporter6, result));
  }
  async onExit() {
    var _this$_reporter$onExi, _this$_reporter7;
    await ((_this$_reporter$onExi = (_this$_reporter7 = this._reporter).onExit) === null || _this$_reporter$onExi === void 0 ? void 0 : _this$_reporter$onExi.call(_this$_reporter7));
  }
  onError(error) {
    var _this$_reporter$onErr, _this$_reporter8;
    if (this._deferred) {
      this._deferred.push({
        error
      });
      return;
    }
    (_this$_reporter$onErr = (_this$_reporter8 = this._reporter).onError) === null || _this$_reporter$onErr === void 0 || _this$_reporter$onErr.call(_this$_reporter8, error);
  }
  onStepBegin(test, result, step) {
    var _this$_reporter$onSte, _this$_reporter9;
    (_this$_reporter$onSte = (_this$_reporter9 = this._reporter).onStepBegin) === null || _this$_reporter$onSte === void 0 || _this$_reporter$onSte.call(_this$_reporter9, test, result, step);
  }
  onStepEnd(test, result, step) {
    var _this$_reporter$onSte2, _this$_reporter10;
    (_this$_reporter$onSte2 = (_this$_reporter10 = this._reporter).onStepEnd) === null || _this$_reporter$onSte2 === void 0 || _this$_reporter$onSte2.call(_this$_reporter10, test, result, step);
  }
  printsToStdio() {
    return this._reporter.printsToStdio ? this._reporter.printsToStdio() : true;
  }
}