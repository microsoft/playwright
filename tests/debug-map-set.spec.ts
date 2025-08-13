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

test('debug Map/Set serialization', async ({ page }) => {
  await page.goto('data:text/html,<script>document.body.innerHTML="<div id=root></div>"</script>');
  
  // Add the serialization functions to the page
  await page.evaluate(() => {
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
  });
  
  // Test serialization of Map and Set
  const result = await page.evaluate(() => {
    const map = new Map([['key1', 'value1'], ['key2', 'value2']]);
    const set = new Set(['item1', 'item2', 'item3']);
    
    const serializedMap = window.__pwTransformObject(map, () => undefined);
    const serializedSet = window.__pwTransformObject(set, () => undefined);
    
    return {
      map: serializedMap,
      set: serializedSet
    };
  });
  
  console.log('Serialized Map:', result.map);
  console.log('Serialized Set:', result.set);
  
  // Test deserialization
  await page.evaluate((serialized) => {
    window.__pwTransformObject = function(value, mapping) {
      const result = mapping(value);
      if (result)
        return result.result;
      if (value === null || typeof value !== 'object')
        return value;
      if (value instanceof Date || value instanceof RegExp || value instanceof URL)
        return value;
      if (value && typeof value === 'object' && value.__pw_type === 'map') {
        const map = new Map();
        for (const [k, v] of value.value)
          map.set(k, window.__pwTransformObject(v, mapping));
        return map;
      }
      if (value && typeof value === 'object' && value.__pw_type === 'set') {
        const set = new Set();
        for (const v of value.value)
          set.add(window.__pwTransformObject(v, mapping));
        return set;
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
    
    const deserializedMap = window.__pwTransformObject(serialized.map, () => undefined);
    const deserializedSet = window.__pwTransformObject(serialized.set, () => undefined);
    
    console.log('Deserialized Map:', deserializedMap);
    console.log('Deserialized Set:', deserializedSet);
    
    return {
      map: deserializedMap instanceof Map,
      set: deserializedSet instanceof Set,
      mapSize: deserializedMap.size,
      setSize: deserializedSet.size
    };
  }, result);
});