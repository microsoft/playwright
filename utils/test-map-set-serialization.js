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

// Test the serialization/deserialization logic for Map and Set

function transformObject(value, mapping) {
  const result = mapping(value);
  if (result)
    return result.result;
  if (value === null || typeof value !== 'object')
    return value;
  if (value instanceof Date || value instanceof RegExp || value instanceof URL)
    return value;
  if (value instanceof Map) {
    const obj = { __pw_type: 'map', value: [] };
    for (const [k, v] of value)
      obj.value.push([k, transformObject(v, mapping)]);
    return obj;
  }
  if (value instanceof Set) {
    const obj = { __pw_type: 'set', value: [] };
    for (const v of value)
      obj.value.push(transformObject(v, mapping));
    return obj;
  }
  if (Array.isArray(value)) {
    const result = [];
    for (const item of value)
      result.push(transformObject(item, mapping));
    return result;
  }
  const result2 = {};
  for (const [key, prop] of Object.entries(value))
    result2[key] = transformObject(prop, mapping);
  return result2;
}

// Test serialization
const map = new Map([['key1', 'value1'], ['key2', 'value2']]);
const set = new Set(['item1', 'item2', 'item3']);

console.log('Original Map:', map);
console.log('Original Set:', set);

const serializedMap = transformObject(map, () => undefined);
const serializedSet = transformObject(set, () => undefined);

console.log('Serialized Map:', serializedMap);
console.log('Serialized Set:', serializedSet);

// Test deserialization
function deserializeMapping(v) {
  if (v && typeof v === 'object' && v.__pw_type === 'map') {
    const newMap = new Map();
    for (const [k, val] of v.value)
      newMap.set(k, transformObject(val, deserializeMapping));
    return { result: newMap };
  }
  if (v && typeof v === 'object' && v.__pw_type === 'set') {
    const newSet = new Set();
    for (const val of v.value)
      newSet.add(transformObject(val, deserializeMapping));
    return { result: newSet };
  }
}

const deserializedMap = transformObject(serializedMap, deserializeMapping);
const deserializedSet = transformObject(serializedSet, deserializeMapping);

console.log('Deserialized Map:', deserializedMap);
console.log('Deserialized Set:', deserializedSet);

console.log('Map instanceof Map:', deserializedMap instanceof Map);
console.log('Set instanceof Set:', deserializedSet instanceof Set);
console.log('Map size:', deserializedMap.size);
console.log('Set size:', deserializedSet.size);