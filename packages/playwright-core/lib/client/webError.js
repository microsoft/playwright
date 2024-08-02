"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WebError = void 0;
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

class WebError {
  constructor(page, error) {
    this._page = void 0;
    this._error = void 0;
    this._page = page;
    this._error = error;
  }
  page() {
    return this._page;
  }
  error() {
    return this._error;
  }
}
exports.WebError = WebError;