"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.StringInternPool = exports.JsonStringInternalizer = void 0;
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

class StringInternPool {
  constructor() {
    this._stringCache = new Map();
  }
  internString(s) {
    let result = this._stringCache.get(s);
    if (!result) {
      this._stringCache.set(s, s);
      result = s;
    }
    return result;
  }
}
exports.StringInternPool = StringInternPool;
class JsonStringInternalizer {
  constructor(pool) {
    this._pool = void 0;
    this._pool = pool;
  }
  traverse(value) {
    if (typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] === 'string') value[i] = this.intern(value[i]);else this.traverse(value[i]);
      }
    } else {
      for (const name in value) {
        if (typeof value[name] === 'string') value[name] = this.intern(value[name]);else this.traverse(value[name]);
      }
    }
  }
  intern(value) {
    return this._pool.internString(value);
  }
}
exports.JsonStringInternalizer = JsonStringInternalizer;