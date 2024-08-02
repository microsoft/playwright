"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FileChooser = void 0;
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

class FileChooser {
  constructor(page, elementHandle, isMultiple) {
    this._page = void 0;
    this._elementHandle = void 0;
    this._isMultiple = void 0;
    this._page = page;
    this._elementHandle = elementHandle;
    this._isMultiple = isMultiple;
  }
  element() {
    return this._elementHandle;
  }
  isMultiple() {
    return this._isMultiple;
  }
  page() {
    return this._page;
  }
}
exports.FileChooser = FileChooser;