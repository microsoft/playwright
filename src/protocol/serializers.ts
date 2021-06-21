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

import { TimeoutError } from '../utils/errors';
import { SerializedError, SerializedValue } from './channels';

export function serializeError(e: any): SerializedError {
  if (isError(e))
    return { error: { message: e.message, stack: e.stack, name: e.name } };
  return { value: serializeValue(e, value => ({ fallThrough: value }), new Set()) };
}

export function parseError(error: SerializedError): Error {
  if (!error.error) {
    if (error.value === undefined)
      throw new Error('Serialized error must have either an error or a value');
    return parseSerializedValue(error.value, undefined);
  }
  if (error.error.name === 'TimeoutError') {
    const e = new TimeoutError(error.error.message);
    e.stack = error.error.stack || '';
    return e;
  }
  const e = new Error(error.error.message);
  e.stack = error.error.stack || '';
  e.name = error.error.name;
  return e;
}

export function parseSerializedValue(value: SerializedValue, handles: any[] | undefined): any {
  if (value.n !== undefined)
    return value.n;
  if (value.s !== undefined)
    return value.s;
  if (value.b !== undefined)
    return value.b;
  if (value.v !== undefined) {
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
  }
  if (value.d !== undefined)
    return new Date(value.d);
  if (value.r !== undefined)
    return new RegExp(value.r.p, value.r.f);
  if (value.a !== undefined)
    return value.a.map((a: any) => parseSerializedValue(a, handles));
  if (value.o !== undefined) {
    const result: any = {};
    for (const { k, v } of value.o)
      result[k] = parseSerializedValue(v, handles);
    return result;
  }
  if (value.h !== undefined) {
    if (handles === undefined)
      throw new Error('Unexpected handle');
    return handles[value.h];
  }
  throw new Error('Unexpected value');
}

export type HandleOrValue = { h: number } | { fallThrough: any };
export function serializeValue(value: any, handleSerializer: (value: any) => HandleOrValue, visited: Set<any>): SerializedValue {
  const handle = handleSerializer(value);
  if ('fallThrough' in handle)
    value = handle.fallThrough;
  else
    return handle;

  if (visited.has(value))
    throw new Error('Argument is a circular structure');
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
    return { b: value };
  if (typeof value === 'number')
    return { n: value };
  if (typeof value === 'string')
    return { s: value };
  if (isError(value)) {
    const error = value;
    if ('captureStackTrace' in global.Error) {
      // v8
      return { s: error.stack || '' };
    }
    return { s: `${error.name}: ${error.message}\n${error.stack}` };
  }
  if (isDate(value))
    return { d: value.toJSON() };
  if (isRegExp(value))
    return { r: { p: value.source, f: value.flags } };
  if (Array.isArray(value)) {
    const a = [];
    visited.add(value);
    for (let i = 0; i < value.length; ++i)
      a.push(serializeValue(value[i], handleSerializer, visited));
    visited.delete(value);
    return { a };
  }
  if (typeof value === 'object') {
    const o: { k: string, v: SerializedValue }[] = [];
    visited.add(value);
    for (const name of Object.keys(value))
      o.push({ k: name, v: serializeValue(value[name], handleSerializer, visited) });
    visited.delete(value);
    return { o };
  }
  throw new Error('Unexpected value');
}

function isRegExp(obj: any): obj is RegExp {
  return obj instanceof RegExp || Object.prototype.toString.call(obj) === '[object RegExp]';
}

function isDate(obj: any): obj is Date {
  return obj instanceof Date || Object.prototype.toString.call(obj) === '[object Date]';
}

function isError(obj: any): obj is Error {
  return obj instanceof Error || obj?.__proto__?.name === 'Error' || (obj?.__proto__ && isError(obj.__proto__));
}
