"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ProtocolError = void 0;
exports.isProtocolError = isProtocolError;
exports.isSessionClosedError = isSessionClosedError;
var _stackTrace = require("../utils/stackTrace");
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

class ProtocolError extends Error {
  constructor(type, method, logs) {
    super();
    this.type = void 0;
    this.method = void 0;
    this.logs = void 0;
    this.type = type;
    this.method = method;
    this.logs = logs;
  }
  setMessage(message) {
    (0, _stackTrace.rewriteErrorMessage)(this, `Protocol error (${this.method}): ${message}`);
  }
  browserLogMessage() {
    return this.logs ? '\nBrowser logs:\n' + this.logs : '';
  }
}
exports.ProtocolError = ProtocolError;
function isProtocolError(e) {
  return e instanceof ProtocolError;
}
function isSessionClosedError(e) {
  return e instanceof ProtocolError && (e.type === 'closed' || e.type === 'crashed');
}