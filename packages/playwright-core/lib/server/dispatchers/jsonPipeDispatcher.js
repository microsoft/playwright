"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.JsonPipeDispatcher = void 0;
var _dispatcher = require("./dispatcher");
var _utils = require("../../utils");
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

class JsonPipeDispatcher extends _dispatcher.Dispatcher {
  constructor(scope) {
    super(scope, {
      guid: 'jsonPipe@' + (0, _utils.createGuid)()
    }, 'JsonPipe', {});
    this._type_JsonPipe = true;
  }
  async send(params) {
    this.emit('message', params.message);
  }
  async close() {
    this.emit('close');
    if (!this._disposed) {
      this._dispatchEvent('closed', {});
      this._dispose();
    }
  }
  dispatch(message) {
    if (!this._disposed) this._dispatchEvent('message', {
      message
    });
  }
  wasClosed(reason) {
    if (!this._disposed) {
      this._dispatchEvent('closed', {
        reason
      });
      this._dispose();
    }
  }
  dispose() {
    this._dispose();
  }
}
exports.JsonPipeDispatcher = JsonPipeDispatcher;