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

export class LRUCache<K, V> {
  private _maxSize: number;
  private _map: Map<K, { value: V, size: number }>;
  private _size: number;

  constructor(maxSize: number) {
    this._maxSize = maxSize;
    this._map = new Map();
    this._size = 0;
  }

  getOrCompute(key: K, compute: () => { value: V, size: number }): V {
    if (this._map.has(key)) {
      const result = this._map.get(key)!;
      // reinserting makes this the least recently used entry
      this._map.delete(key);
      this._map.set(key, result);
      return result.value;
    }

    const result = compute();

    while (this._map.size && this._size + result.size > this._maxSize) {
      const [firstKey, firstValue] = this._map.entries().next().value!;
      this._size -= firstValue.size;
      this._map.delete(firstKey);
    }

    this._map.set(key, result);
    this._size += result.size;
    return result.value;
  }
}
