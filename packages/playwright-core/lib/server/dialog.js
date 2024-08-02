"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Dialog = void 0;
var _utils = require("../utils");
var _instrumentation = require("./instrumentation");
/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

class Dialog extends _instrumentation.SdkObject {
  constructor(page, type, message, onHandle, defaultValue) {
    super(page, 'dialog');
    this._page = void 0;
    this._type = void 0;
    this._message = void 0;
    this._onHandle = void 0;
    this._handled = false;
    this._defaultValue = void 0;
    this._page = page;
    this._type = type;
    this._message = message;
    this._onHandle = onHandle;
    this._defaultValue = defaultValue || '';
    this._page._frameManager.dialogDidOpen(this);
  }
  page() {
    return this._page;
  }
  type() {
    return this._type;
  }
  message() {
    return this._message;
  }
  defaultValue() {
    return this._defaultValue;
  }
  async accept(promptText) {
    (0, _utils.assert)(!this._handled, 'Cannot accept dialog which is already handled!');
    this._handled = true;
    this._page._frameManager.dialogWillClose(this);
    await this._onHandle(true, promptText);
  }
  async dismiss() {
    (0, _utils.assert)(!this._handled, 'Cannot dismiss dialog which is already handled!');
    this._handled = true;
    this._page._frameManager.dialogWillClose(this);
    await this._onHandle(false);
  }
  async close() {
    if (this._type === 'beforeunload') await this.accept();else await this.dismiss();
  }
}
exports.Dialog = Dialog;