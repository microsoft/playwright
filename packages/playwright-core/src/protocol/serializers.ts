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

import type { SerializedValue } from '@protocol/channels';

export function parseSerializedValue(value: SerializedValue, handles: any[] | undefined): any {
  return innerParseSerializedValue(value, handles, new Map(), []);
}

function innerParseSerializedValue(value: SerializedValue, handles: any[] | undefined, refs: Map<number, object>, accessChain: Array<string | number>): any {
  if (value.ref !== undefined)
    return refs.get(value.ref);
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
  if (value.u !== undefined)
    return new URL(value.u);
  if (value.bi !== undefined)
    return BigInt(value.bi);
  if (value.e !== undefined) {
    const error = new Error(value.e.m);
    error.name = value.e.n;
    error.stack = value.e.s;
    return error;
  }
  if (value.r !== undefined)
    return new RegExp(value.r.p, value.r.f);
  if (value.ta !== undefined) {
    const ctor = typedArrayKindToConstructor[value.ta.k] as any;
    return new ctor(value.ta.b.buffer, value.ta.b.byteOffset, value.ta.b.length / ctor.BYTES_PER_ELEMENT);
  }

  if (value.a !== undefined) {
    const result: any[] = [];
    refs.set(value.id!, result);
    for (let i = 0; i < value.a.length; i++)
      result.push(innerParseSerializedValue(value.a[i], handles, refs, [...accessChain, i]));
    return result;
  }
  if (value.o !== undefined) {
    const result: any = {};
    refs.set(value.id!, result);
    for (const { k, v } of value.o)
      result[k] = innerParseSerializedValue(v, handles, refs, [...accessChain, k]);
    return result;
  }
  if (value.h !== undefined) {
    if (handles === undefined)
      throw new Error('Unexpected handle');
    return handles[value.h];
  }
  throw new Error(`Attempting to deserialize unexpected value${accessChainToDisplayString(accessChain)}: ${value}`);
}

export type HandleOrValue = { h: number } | { fallThrough: any };
type VisitorInfo = {
  visited: Map<object, number>;
  lastId: number;
};

export function serializeValue(value: any, handleSerializer: (value: any) => HandleOrValue): SerializedValue {
  return innerSerializeValue(value, handleSerializer, { lastId: 0, visited: new Map() }, []);
}

function innerSerializeValue(value: any, handleSerializer: (value: any) => HandleOrValue, visitorInfo: VisitorInfo, accessChain: Array<string | number>): SerializedValue {
  const handle = handleSerializer(value);
  if ('fallThrough' in handle)
    value = handle.fallThrough;
  else
    return handle;

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
  if (typeof value === 'bigint')
    return { bi: value.toString() };
  if (isError(value))
    return { e: { n: value.name, m: value.message, s: value.stack || '' } };
  if (isDate(value))
    return { d: value.toJSON() };
  if (isURL(value))
    return { u: value.toJSON() };
  if (isRegExp(value))
    return { r: { p: value.source, f: value.flags } };

  const typedArrayKind = constructorToTypedArrayKind.get(value.constructor);
  if (typedArrayKind)
    return { ta: { b: Buffer.from(value.buffer, value.byteOffset, value.byteLength), k: typedArrayKind } };

  const id = visitorInfo.visited.get(value);
  if (id)
    return { ref: id };

  if (Array.isArray(value)) {
    const a = [];
    const id = ++visitorInfo.lastId;
    visitorInfo.visited.set(value, id);
    for (let i = 0; i < value.length; ++i)
      a.push(innerSerializeValue(value[i], handleSerializer, visitorInfo, [...accessChain, i]));
    return { a, id };
  }
  if (typeof value === 'object') {
    const o: { k: string, v: SerializedValue }[] = [];
    const id = ++visitorInfo.lastId;
    visitorInfo.visited.set(value, id);
    for (const name of Object.keys(value))
      o.push({ k: name, v: innerSerializeValue(value[name], handleSerializer, visitorInfo, [...accessChain, name]) });
    return { o, id };
  }
  // Likely only functions can reach here.
  throw new Error(`Attempting to serialize unexpected value${accessChainToDisplayString(accessChain)}: ${value}`);
}

function accessChainToDisplayString(accessChain: Array<string | number>): string {
  const chainString = accessChain.map((accessor, i) => {
    if (typeof accessor === 'string')
      return i ? `.${accessor}` : accessor;
    return `[${accessor}]`;
  }).join('');

  return chainString.length > 0 ? ` at position "${chainString}"` : '';
}

function isRegExp(obj: any): obj is RegExp {
  return obj instanceof RegExp || Object.prototype.toString.call(obj) === '[object RegExp]';
}

function isDate(obj: any): obj is Date {
  return obj instanceof Date || Object.prototype.toString.call(obj) === '[object Date]';
}

function isURL(obj: any): obj is URL {
  return obj instanceof URL || Object.prototype.toString.call(obj) === '[object URL]';
}

function isError(obj: any): obj is Error {
  const proto = obj ? Object.getPrototypeOf(obj) : null;
  return obj instanceof Error || proto?.name === 'Error' || (proto && isError(proto));
}


type TypedArrayKind = NonNullable<SerializedValue['ta']>['k'];
const typedArrayKindToConstructor: Record<TypedArrayKind, Function> = {
  i8: Int8Array,
  ui8: Uint8Array,
  ui8c: Uint8ClampedArray,
  i16: Int16Array,
  ui16: Uint16Array,
  i32: Int32Array,
  ui32: Uint32Array,
  f32: Float32Array,
  f64: Float64Array,
  bi64: BigInt64Array,
  bui64: BigUint64Array,
};
const constructorToTypedArrayKind: Map<Function, TypedArrayKind> = new Map(Object.entries(typedArrayKindToConstructor).map(([k, v]) => [v, k as TypedArrayKind]));
