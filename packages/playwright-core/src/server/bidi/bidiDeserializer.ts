/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as bidi from './third_party/bidiProtocol';
import { parseUnserializableValue } from '../javascript';

export function deserializeBidiValue(result: bidi.Script.RemoteValue, internalIdMap = new Map<bidi.Script.InternalId, any>()): any {
  switch (result.type) {
    case 'undefined':
      return undefined;
    case 'null':
      return null;
    case 'number':
      return typeof result.value === 'number' ? result.value : parseUnserializableValue(result.value);
    case 'boolean':
      return Boolean(result.value);
    case 'string':
      return result.value;
    case 'bigint':
      return BigInt(result.value);
    case 'array':
      return deserializeBidiList(result, internalIdMap);
    case 'arraybuffer':
      return getValue(result, internalIdMap, () => ({}));
    case 'date':
      return getValue(result, internalIdMap, () => new Date(result.value));
    case 'error':
      return getValue(result, internalIdMap, () => { const error = new Error(); error.stack = ''; return error; });
    case 'function':
      return undefined;
    case 'generator':
      return getValue(result, internalIdMap, () => ({}));
    case 'htmlcollection':
      return { ...deserializeBidiList(result, internalIdMap) };
    case 'map':
      return getValue(result, internalIdMap, () => ({}));
    case 'node':
      return 'ref: <Node>';
    case 'nodelist':
      return { ...deserializeBidiList(result, internalIdMap) };
    case 'object':
      return deserializeBidiMapping(result, internalIdMap);
    case 'promise':
      return getValue(result, internalIdMap, () => ({}));
    case 'proxy':
      return getValue(result, internalIdMap, () => ({}));
    case 'regexp':
      return getValue(result, internalIdMap, () => new RegExp(result.value.pattern, result.value.flags));
    case 'set':
      return getValue(result, internalIdMap, () => ({}));
    case 'symbol':
      return undefined;
    case 'typedarray':
      return undefined;
    case 'weakmap':
      return getValue(result, internalIdMap, () => ({}));
    case 'weakset':
      return getValue(result, internalIdMap, () => ({}));
    case 'window':
      return 'ref: <Window>';
  }
}

function getValue(bidiValue: bidi.Script.RemoteValue, internalIdMap: Map<bidi.Script.InternalId, any>, defaultValue: () => any) {
  if ('internalId' in bidiValue && bidiValue.internalId) {
    if (internalIdMap.has(bidiValue.internalId)) {
      return internalIdMap.get(bidiValue.internalId);
    } else {
      const value = defaultValue();
      internalIdMap.set(bidiValue.internalId, value);
      return value;
    }
  } else {
    return defaultValue();
  }
}

function deserializeBidiList(
  bidiValue: bidi.Script.ArrayRemoteValue | bidi.Script.SetRemoteValue | bidi.Script.NodeListRemoteValue | bidi.Script.HtmlCollectionRemoteValue,
  internalIdMap: Map<bidi.Script.InternalId, any>
) {
  const result = getValue(bidiValue, internalIdMap, () => []);
  for (const val of bidiValue.value || [])
    result.push(deserializeBidiValue(val, internalIdMap));
  return result;
}

function deserializeBidiMapping(
  bidiValue: bidi.Script.ObjectRemoteValue | bidi.Script.MapRemoteValue,
  internalIdMap: Map<bidi.Script.InternalId, any>
) {
  const result = getValue(bidiValue, internalIdMap, () => ({}));
  for (const [serializedKey, serializedValue] of bidiValue.value || []) {
    const key =
      typeof serializedKey === 'string'
        ? serializedKey
        : deserializeBidiValue(serializedKey, internalIdMap);
    const value = deserializeBidiValue(serializedValue, internalIdMap);
    result[key] = value;
  }
  return result;
}
