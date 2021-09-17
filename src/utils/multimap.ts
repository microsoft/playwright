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

export class MultiMap<K, V> {
  private _map: Map<K, V[]>;

  constructor() {
    this._map = new Map<K, V[]>();
  }

  set(key: K, value: V) {
    let values = this._map.get(key);
    if (!values) {
      values = [];
      this._map.set(key, values);
    }
    values.push(value);
  }

  get(key: K): V[] {
    return this._map.get(key) || [];
  }

  has(key: K): boolean {
    return this._map.has(key);
  }

  hasValue(key: K, value: V): boolean {
    const values = this._map.get(key);
    if (!values)
      return false;
    return values.includes(value);
  }

  get size(): number {
    return this._map.size;
  }

  keys(): IterableIterator<K> {
    return this._map.keys();
  }

  values(): Iterable<V> {
    const result: V[] = [];
    for (const key of this.keys())
      result.push(...this.get(key));
    return result;
  }

  clear() {
    this._map.clear();
  }
}
