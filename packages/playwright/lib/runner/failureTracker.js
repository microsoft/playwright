"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FailureTracker = void 0;
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

class FailureTracker {
  constructor(_config) {
    this._failureCount = 0;
    this._hasWorkerErrors = false;
    this._rootSuite = void 0;
    this._config = _config;
  }
  onRootSuite(rootSuite) {
    this._rootSuite = rootSuite;
  }
  onTestEnd(test, result) {
    if (result.status !== 'skipped' && result.status !== test.expectedStatus) ++this._failureCount;
  }
  onWorkerError() {
    this._hasWorkerErrors = true;
  }
  hasReachedMaxFailures() {
    return this.maxFailures() > 0 && this._failureCount >= this.maxFailures();
  }
  hasWorkerErrors() {
    return this._hasWorkerErrors;
  }
  result() {
    return this._hasWorkerErrors || this.hasReachedMaxFailures() || this.hasFailedTests() || this._config.cliFailOnFlakyTests && this.hasFlakyTests() ? 'failed' : 'passed';
  }
  hasFailedTests() {
    var _this$_rootSuite;
    return (_this$_rootSuite = this._rootSuite) === null || _this$_rootSuite === void 0 ? void 0 : _this$_rootSuite.allTests().some(test => !test.ok());
  }
  hasFlakyTests() {
    var _this$_rootSuite2;
    return (_this$_rootSuite2 = this._rootSuite) === null || _this$_rootSuite2 === void 0 ? void 0 : _this$_rootSuite2.allTests().some(test => test.outcome() === 'flaky');
  }
  maxFailures() {
    return this._config.config.maxFailures;
  }
}
exports.FailureTracker = FailureTracker;