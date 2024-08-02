"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.MultiMap = void 0;
let _Symbol$iterator;
_Symbol$iterator = Symbol.iterator;
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

class MultiMap {
  constructor() {
    this._map = void 0;
    this._map = new Map();
  }
  set(key, value) {
    let values = this._map.get(key);
    if (!values) {
      values = [];
      this._map.set(key, values);
    }
    values.push(value);
  }
  get(key) {
    return this._map.get(key) || [];
  }
  has(key) {
    return this._map.has(key);
  }
  delete(key, value) {
    const values = this._map.get(key);
    if (!values) return;
    if (values.includes(value)) this._map.set(key, values.filter(v => value !== v));
  }
  deleteAll(key) {
    this._map.delete(key);
  }
  hasValue(key, value) {
    const values = this._map.get(key);
    if (!values) return false;
    return values.includes(value);
  }
  get size() {
    return this._map.size;
  }
  [_Symbol$iterator]() {
    return this._map[Symbol.iterator]();
  }
  keys() {
    return this._map.keys();
  }
  values() {
    const result = [];
    for (const key of this.keys()) result.push(...this.get(key));
    return result;
  }
  clear() {
    this._map.clear();
  }
}
exports.MultiMap = MultiMap;