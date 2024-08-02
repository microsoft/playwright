"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Artifact = void 0;
var _fs = _interopRequireDefault(require("fs"));
var _utils = require("../utils");
var _manualPromise = require("../utils/manualPromise");
var _instrumentation = require("./instrumentation");
var _errors = require("./errors");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright (c) Microsoft Corporation.
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

class Artifact extends _instrumentation.SdkObject {
  constructor(parent, localPath, unaccessibleErrorMessage, cancelCallback) {
    super(parent, 'artifact');
    this._localPath = void 0;
    this._unaccessibleErrorMessage = void 0;
    this._cancelCallback = void 0;
    this._finishedPromise = new _manualPromise.ManualPromise();
    this._saveCallbacks = [];
    this._finished = false;
    this._deleted = false;
    this._failureError = void 0;
    this._localPath = localPath;
    this._unaccessibleErrorMessage = unaccessibleErrorMessage;
    this._cancelCallback = cancelCallback;
  }
  finishedPromise() {
    return this._finishedPromise;
  }
  localPath() {
    return this._localPath;
  }
  async localPathAfterFinished() {
    if (this._unaccessibleErrorMessage) throw new Error(this._unaccessibleErrorMessage);
    await this._finishedPromise;
    if (this._failureError) throw this._failureError;
    return this._localPath;
  }
  saveAs(saveCallback) {
    if (this._unaccessibleErrorMessage) throw new Error(this._unaccessibleErrorMessage);
    if (this._deleted) throw new Error(`File already deleted. Save before deleting.`);
    if (this._failureError) throw this._failureError;
    if (this._finished) {
      saveCallback(this._localPath).catch(() => {});
      return;
    }
    this._saveCallbacks.push(saveCallback);
  }
  async failureError() {
    var _this$_failureError;
    if (this._unaccessibleErrorMessage) return this._unaccessibleErrorMessage;
    await this._finishedPromise;
    return ((_this$_failureError = this._failureError) === null || _this$_failureError === void 0 ? void 0 : _this$_failureError.message) || null;
  }
  async cancel() {
    (0, _utils.assert)(this._cancelCallback !== undefined);
    return this._cancelCallback();
  }
  async delete() {
    if (this._unaccessibleErrorMessage) return;
    const fileName = await this.localPathAfterFinished();
    if (this._deleted) return;
    this._deleted = true;
    if (fileName) await _fs.default.promises.unlink(fileName).catch(e => {});
  }
  async deleteOnContextClose() {
    // Compared to "delete", this method does not wait for the artifact to finish.
    // We use it when closing the context to avoid stalling.
    if (this._deleted) return;
    this._deleted = true;
    if (!this._unaccessibleErrorMessage) await _fs.default.promises.unlink(this._localPath).catch(e => {});
    await this.reportFinished(new _errors.TargetClosedError());
  }
  async reportFinished(error) {
    if (this._finished) return;
    this._finished = true;
    this._failureError = error;
    if (error) {
      for (const callback of this._saveCallbacks) await callback('', error);
    } else {
      for (const callback of this._saveCallbacks) await callback(this._localPath);
    }
    this._saveCallbacks = [];
    this._finishedPromise.resolve();
  }
}
exports.Artifact = Artifact;