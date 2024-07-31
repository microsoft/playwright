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
    { u: string } |
    { bi: string } |
    { e: { n: string, m: string, s: string } } |
    { r: { p: string, f: string } } |
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
    try {
      return obj instanceof RegExp || Object.prototype.toString.call(obj) === '[object RegExp]';
    } catch (error) {
      return false;
    }
  }

  function isDate(obj: any): obj is Date {
    try {
      return obj instanceof Date || Object.prototype.toString.call(obj) === '[object Date]';
    } catch (error) {
      return false;
    }
  }

  function isURL(obj: any): obj is URL {
    try {
      return obj instanceof URL || Object.prototype.toString.call(obj) === '[object URL]';
    } catch (error) {
      return false;
    }
  }

  function isError(obj: any): obj is Error {
    try {
      return obj instanceof Error || (obj && Object.getPrototypeOf(obj)?.name === 'Error');
    } catch (error) {
      return false;
    }
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
      if ('u' in value)
        return new URL(value.u);
      if ('bi' in value)
        return BigInt(value.bi);
      if ('e' in value) {
        const error = new Error(value.e.m);
        error.name = value.e.n;
        error.stack = value.e.s;
        return error;
      }
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
      if (typeof globalThis.Window === 'function' && value instanceof globalThis.Window)
        return 'ref: <Window>';
      if (typeof globalThis.Document === 'function' && value instanceof globalThis.Document)
        return 'ref: <Document>';
      if (typeof globalThis.Node === 'function' && value instanceof globalThis.Node)
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
    if (typeof value === 'bigint')
      return { bi: value.toString() };

    if (isError(value)) {
      let stack;
      if (value.stack?.startsWith(value.name + ': ' + value.message)) {
        // v8
        stack = value.stack;
      } else {
        stack = `${value.name}: ${value.message}\n${value.stack}`;
      }
      return { e: { n: value.name, m: value.message, s: stack } };
    }
    if (isDate(value))
      return { d: value.toJSON() };
    if (isURL(value))
      return { u: value.toJSON() };
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

      let jsonWrapper;
      try {
        // If Object.keys().length === 0 we fall back to toJSON if it exists
        if (o.length === 0 && value.toJSON && typeof value.toJSON === 'function')
          jsonWrapper = { value: value.toJSON() };
      } catch (e) {
      }
      if (jsonWrapper)
        return innerSerialize(jsonWrapper.value, handleSerializer, visitorInfo);

      return { o, id };
    }
  }

  return { parseEvaluationResultValue, serializeAsCallArgument };
}

const result = source();
export const parseEvaluationResultValue = result.parseEvaluationResultValue;
export const serializeAsCallArgument = result.serializeAsCallArgument;
