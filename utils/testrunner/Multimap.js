/**
 * Copyright 2017 Google Inc. All rights reserved.
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

class Multimap {
  constructor() {
    this._map = new Map();
  }

  set(key, value) {
    let set = this._map.get(key);
    if (!set) {
      set = new Set();
      this._map.set(key, set);
    }
    set.add(value);
  }

  get(key) {
    let result = this._map.get(key);
    if (!result)
      result = new Set();
    return result;
  }

  has(key) {
    return this._map.has(key);
  }

  hasValue(key, value) {
    const set = this._map.get(key);
    if (!set)
      return false;
    return set.has(value);
  }

  /**
   * @return {number}
   */
  get size() {
    return this._map.size;
  }

  delete(key, value) {
    const values = this.get(key);
    const result = values.delete(value);
    if (!values.size)
      this._map.delete(key);
    return result;
  }

  deleteAll(key) {
    this._map.delete(key);
  }

  firstValue(key) {
    const set = this._map.get(key);
    if (!set)
      return null;
    return set.values().next().value;
  }

  firstKey() {
    return this._map.keys().next().value;
  }

  valuesArray() {
    const result = [];
    for (const key of this._map.keys())
      result.push(...Array.from(this._map.get(key).values()));
    return result;
  }

  keysArray() {
    return Array.from(this._map.keys());
  }

  clear() {
    this._map.clear();
  }
}

module.exports = Multimap;
