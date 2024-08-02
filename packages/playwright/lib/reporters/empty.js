"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
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

class EmptyReporter {
  onConfigure(config) {}
  onBegin(suite) {}
  onTestBegin(test, result) {}
  onStdOut(chunk, test, result) {}
  onStdErr(chunk, test, result) {}
  onTestEnd(test, result) {}
  async onEnd(result) {}
  async onExit() {}
  onError(error) {}
  onStepBegin(test, result, step) {}
  onStepEnd(test, result, step) {}
  printsToStdio() {
    return false;
  }
  version() {
    return 'v2';
  }
}
var _default = exports.default = EmptyReporter;