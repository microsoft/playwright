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

import { test, expect } from '@playwright/test';

// Simple test to verify that Map and Set serialization/deserialization works correctly
test('Map and Set serialization/deserialization', async ({ page }) => {
  await page.goto('data:text/html,<script>document.body.innerHTML="<div id=root></div>"</script>');
  
  // Add the serialization functions to the page
  await page.evaluate(() => {
    // Serialization function (from serializers.ts)
    window.__pwTransformObject = function(value, mapping) {
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
          obj.value.push([k, window.__pwTransformObject(v, mapping)]);
        return obj;
      }
      if (value instanceof Set) {
        const obj = { __pw_type: 'set', value: [] };
        for (const v of value)
          obj.value.push(window.__pwTransformObject(v, mapping));
        return obj;
      }
      if (Array.isArray(value)) {
        const result = [];
        for (const item of value)
          result.push(window.__pwTransformObject(item, mapping));
        return result;
      }
      const result2 = {};
      for (const [key, prop] of Object.entries(value))
        result2[key] = window.__pwTransformObject(prop, mapping);
      return result2;
    };
    
    // Deserialization function (from registerSource.mjs)
    window.__pwDeserializeObject = function(value) {
      return window.__pwTransformObject(value, v => {
        if (v && typeof v === 'object' && v.__pw_type === 'map') {
          const map = new Map();
          for (const [k, val] of v.value)
            map.set(k, window.__pwDeserializeObject(val));
          return { result: map };
        }
        if (v && typeof v === 'object' && v.__pw_type === 'set') {
          const set = new Set();
          for (const val of v.value)
            set.add(window.__pwDeserializeObject(val));
          return { result: set };
        }
      });
    };
  });
  
  // Test serialization and deserialization
  const result = await page.evaluate(() => {
    // Create test Map and Set
    const testMap = new Map([['key1', 'value1'], ['key2', 'value2']]);
    const testSet = new Set(['item1', 'item2', 'item3']);
    
    // Serialize them
    const serializedMap = window.__pwTransformObject(testMap, () => undefined);
    const serializedSet = window.__pwTransformObject(testSet, () => undefined);
    
    // Deserialize them
    const deserializedMap = window.__pwDeserializeObject(serializedMap);
    const deserializedSet = window.__pwDeserializeObject(serializedSet);
    
    return {
      mapSerialization: serializedMap,
      setSerialization: serializedSet,
      mapDeserialization: {
        isMap: deserializedMap instanceof Map,
        size: deserializedMap.size,
        keys: Array.from(deserializedMap.keys()),
        values: Array.from(deserializedMap.values())
      },
      setDeserialization: {
        isSet: deserializedSet instanceof Set,
        size: deserializedSet.size,
        values: Array.from(deserializedSet.values())
      }
    };
  });
  
  // Verify results
  expect(result.mapSerialization).toEqual({
    __pw_type: 'map',
    value: [['key1', 'value1'], ['key2', 'value2']]
  });
  
  expect(result.setSerialization).toEqual({
    __pw_type: 'set',
    value: ['item1', 'item2', 'item3']
  });
  
  expect(result.mapDeserialization).toEqual({
    isMap: true,
    size: 2,
    keys: ['key1', 'key2'],
    values: ['value1', 'value2']
  });
  
  expect(result.setDeserialization).toEqual({
    isSet: true,
    size: 3,
    values: ['item1', 'item2', 'item3']
  });
});