"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SelectorsDispatcher = void 0;
var _dispatcher = require("./dispatcher");
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

class SelectorsDispatcher extends _dispatcher.Dispatcher {
  constructor(scope, selectors) {
    super(scope, selectors, 'Selectors', {});
    this._type_Selectors = true;
  }
  async register(params) {
    await this._object.register(params.name, params.source, params.contentScript);
  }
  async setTestIdAttributeName(params) {
    this._object.setTestIdAttributeName(params.testIdAttributeName);
  }
}
exports.SelectorsDispatcher = SelectorsDispatcher;