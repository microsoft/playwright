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

function isRegExp(obj: any): obj is RegExp {
  return obj instanceof RegExp || Object.prototype.toString.call(obj) === '[object RegExp]';
}

function isDate(obj: any): obj is Date {
  return obj instanceof Date || Object.prototype.toString.call(obj) === '[object Date]';
}

function isError(obj: any): obj is Error {
  return obj instanceof Error || (obj && obj.__proto__ && obj.__proto__.name === 'Error');
}

export function parseEvaluationResultValue(value: any, handles: any[] = []): any {
  if (value === undefined)
    return undefined;
  if (typeof value === 'object') {
    if (value.v === 'undefined')
      return undefined;
    if (value.v === null)
      return null;
    if (value.v === 'NaN')
      return NaN;
    if (value.v === 'Infinity')
      return Infinity;
    if (value.v === '-Infinity')
      return -Infinity;
    if (value.v === '-0')
      return -0;
    if (value.d)
      return new Date(value.d);
    if (value.r)
      return new RegExp(value.r[0], value.r[1]);
    if (value.a)
      return value.a.map((a: any) => parseEvaluationResultValue(a, handles));
    if (value.o) {
      for (const name of Object.keys(value.o))
        value.o[name] = parseEvaluationResultValue(value.o[name], handles);
      return value.o;
    }
    if (typeof value.h === 'number')
      return handles[value.h];
  }
  return value;
}

export function serializeAsCallArgument(value: any, jsHandleSerializer: (value: any) => { fallThrough?: any }): any {
  return serialize(value, jsHandleSerializer, new Set());
}

function serialize(value: any, jsHandleSerializer: (value: any) => { fallThrough?: any }, visited: Set<any>): any {
  const result = jsHandleSerializer(value);
  if ('fallThrough' in result)
    value = result.fallThrough;
  else
    return result;

  if (visited.has(value))
    throw new Error('Argument is a circular structure');
  if (typeof value === 'symbol')
    return { v: 'undefined' };
  if (Object.is(value, undefined))
    return { v: 'undefined' };
  if (Object.is(value, null))
    return { v: null };
  if (Object.is(value, NaN))
    return { v: 'NaN' };
  if (Object.is(value, Infinity))
    return { v: 'Infinity' };
  if (Object.is(value, -Infinity))
    return { v: '-Infinity' };
  if (Object.is(value, -0))
    return { v: '-0' };
  if (isPrimitiveValue(value))
    return value;

  if (isError(value)) {
    const error = value;
    if ('captureStackTrace' in global.Error) {
      // v8
      return error.stack;
    }
    return `${error.name}: ${error.message}\n${error.stack}`;
  }
  if (isDate(value))
    return { d: value.toJSON() };
  if (isRegExp(value))
    return { r: [ value.source, value.flags ] };

  if (Array.isArray(value)) {
    const result = [];
    visited.add(value);
    for (let i = 0; i < value.length; ++i)
      result.push(serialize(value[i], jsHandleSerializer, visited));
    visited.delete(value);
    return { a: result };
  }

  if (typeof value === 'object') {
    const result: any = {};
    visited.add(value);
    for (const name of Object.keys(value)) {
      let item;
      try {
        item = value[name];
      } catch (e) {
        continue;  // native bindings will throw sometimes
      }
      if (name === 'toJSON' && typeof item === 'function')
        result[name] = {};
      else
        result[name] = serialize(item, jsHandleSerializer, visited);
    }
    visited.delete(value);
    return { o: result };
  }
}

export function isPrimitiveValue(value: any): boolean {
  switch (typeof value) {
    case 'boolean':
    case 'number':
    case 'string':
      return true;
    default:
      return false;
  }
}
