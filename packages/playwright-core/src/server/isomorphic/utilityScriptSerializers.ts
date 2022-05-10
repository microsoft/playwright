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

export type SerializedValue =
    undefined | boolean | number | string |
    { v: 'null' | 'undefined' | 'NaN' | 'Infinity' | '-Infinity' | '-0' } |
    { d: string } |
    { r: { p: string, f: string} } |
    { a: SerializedValue[], id: number } |
    { o: { k: string, v: SerializedValue }[], id: number } |
    { ref: number } |
    { h: number };

export type HandleOrValue = { h: number } | { fallThrough: any };

type VisitorInfo = {
  visited: Map<object, number>;
  lastId: number;
};

export function source() {

  function isRegExp(obj: any): obj is RegExp {
    return obj instanceof RegExp || Object.prototype.toString.call(obj) === '[object RegExp]';
  }

  function isDate(obj: any): obj is Date {
    return obj instanceof Date || Object.prototype.toString.call(obj) === '[object Date]';
  }

  function isError(obj: any): obj is Error {
    return obj instanceof Error || (obj && obj.__proto__ && obj.__proto__.name === 'Error');
  }

  function parseEvaluationResultValue(value: SerializedValue, handles: any[] = [], refs: Map<number, object> = new Map()): any {
    if (Object.is(value, undefined))
      return undefined;
    if (typeof value === 'object' && value) {
      if ('ref' in value)
        return refs.get(value.ref);
      if ('v' in value) {
        if (value.v === 'undefined')
          return undefined;
        if (value.v === 'null')
          return null;
        if (value.v === 'NaN')
          return NaN;
        if (value.v === 'Infinity')
          return Infinity;
        if (value.v === '-Infinity')
          return -Infinity;
        if (value.v === '-0')
          return -0;
        return undefined;
      }
      if ('d' in value)
        return new Date(value.d);
      if ('r' in value)
        return new RegExp(value.r.p, value.r.f);
      if ('a' in value) {
        const result: any[] = [];
        refs.set(value.id, result);
        for (const a of value.a)
          result.push(parseEvaluationResultValue(a, handles, refs));
        return result;
      }
      if ('o' in value) {
        const result: any = {};
        refs.set(value.id, result);
        for (const { k, v } of value.o)
          result[k] = parseEvaluationResultValue(v, handles, refs);
        return result;
      }
      if ('h' in value)
        return handles[value.h];
    }
    return value;
  }

  function serializeAsCallArgument(value: any, handleSerializer: (value: any) => HandleOrValue): SerializedValue {
    return serialize(value, handleSerializer, { visited: new Map(), lastId: 0 });
  }

  function serialize(value: any, handleSerializer: (value: any) => HandleOrValue, visitorInfo: VisitorInfo): SerializedValue {
    if (value && typeof value === 'object') {
      if (globalThis.Window && value instanceof globalThis.Window)
        return 'ref: <Window>';
      if (globalThis.Document && value instanceof globalThis.Document)
        return 'ref: <Document>';
      if (globalThis.Node && value instanceof globalThis.Node)
        return 'ref: <Node>';
    }
    return innerSerialize(value, handleSerializer, visitorInfo);
  }

  function innerSerialize(value: any, handleSerializer: (value: any) => HandleOrValue, visitorInfo: VisitorInfo): SerializedValue {
    const result = handleSerializer(value);
    if ('fallThrough' in result)
      value = result.fallThrough;
    else
      return result;

    if (typeof value === 'symbol')
      return { v: 'undefined' };
    if (Object.is(value, undefined))
      return { v: 'undefined' };
    if (Object.is(value, null))
      return { v: 'null' };
    if (Object.is(value, NaN))
      return { v: 'NaN' };
    if (Object.is(value, Infinity))
      return { v: 'Infinity' };
    if (Object.is(value, -Infinity))
      return { v: '-Infinity' };
    if (Object.is(value, -0))
      return { v: '-0' };

    if (typeof value === 'boolean')
      return value;
    if (typeof value === 'number')
      return value;
    if (typeof value === 'string')
      return value;

    if (isError(value)) {
      const error = value;
      if ('captureStackTrace' in globalThis.Error) {
        // v8
        return error.stack || '';
      }
      return `${error.name}: ${error.message}\n${error.stack}`;
    }
    if (isDate(value))
      return { d: value.toJSON() };
    if (isRegExp(value))
      return { r: { p: value.source, f: value.flags } };

    const id = visitorInfo.visited.get(value);
    if (id)
      return { ref: id };

    if (Array.isArray(value)) {
      const a = [];
      const id = ++visitorInfo.lastId;
      visitorInfo.visited.set(value, id);
      for (let i = 0; i < value.length; ++i)
        a.push(serialize(value[i], handleSerializer, visitorInfo));
      return { a, id };
    }

    if (typeof value === 'object') {
      const o: { k: string, v: SerializedValue }[] = [];
      const id = ++visitorInfo.lastId;
      visitorInfo.visited.set(value, id);
      for (const name of Object.keys(value)) {
        let item;
        try {
          item = value[name];
        } catch (e) {
          continue;  // native bindings will throw sometimes
        }
        if (name === 'toJSON' && typeof item === 'function')
          o.push({ k: name, v: { o: [], id: 0 } });
        else
          o.push({ k: name, v: serialize(item, handleSerializer, visitorInfo) });
      }
      return { o, id };
    }
  }

  return { parseEvaluationResultValue, serializeAsCallArgument };
}

const result = source();
export const parseEvaluationResultValue = result.parseEvaluationResultValue;
export const serializeAsCallArgument = result.serializeAsCallArgument;
