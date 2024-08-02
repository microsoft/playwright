"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Semaphore = void 0;
var _manualPromise = require("./manualPromise");
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

class Semaphore {
  constructor(max) {
    this._max = void 0;
    this._acquired = 0;
    this._queue = [];
    this._max = max;
  }
  setMax(max) {
    this._max = max;
  }
  acquire() {
    const lock = new _manualPromise.ManualPromise();
    this._queue.push(lock);
    this._flush();
    return lock;
  }
  release() {
    --this._acquired;
    this._flush();
  }
  _flush() {
    while (this._acquired < this._max && this._queue.length) {
      ++this._acquired;
      this._queue.shift().resolve();
    }
  }
}
exports.Semaphore = Semaphore;