"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.parseSerializedValue = parseSerializedValue;
exports.serializeValue = serializeValue;
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

function parseSerializedValue(value, handles) {
  return innerParseSerializedValue(value, handles, new Map());
}
function innerParseSerializedValue(value, handles, refs) {
  if (value.ref !== undefined) return refs.get(value.ref);
  if (value.n !== undefined) return value.n;
  if (value.s !== undefined) return value.s;
  if (value.b !== undefined) return value.b;
  if (value.v !== undefined) {
    if (value.v === 'undefined') return undefined;
    if (value.v === 'null') return null;
    if (value.v === 'NaN') return NaN;
    if (value.v === 'Infinity') return Infinity;
    if (value.v === '-Infinity') return -Infinity;
    if (value.v === '-0') return -0;
  }
  if (value.d !== undefined) return new Date(value.d);
  if (value.u !== undefined) return new URL(value.u);
  if (value.bi !== undefined) return BigInt(value.bi);
  if (value.r !== undefined) return new RegExp(value.r.p, value.r.f);
  if (value.a !== undefined) {
    const result = [];
    refs.set(value.id, result);
    for (const v of value.a) result.push(innerParseSerializedValue(v, handles, refs));
    return result;
  }
  if (value.o !== undefined) {
    const result = {};
    refs.set(value.id, result);
    for (const {
      k,
      v
    } of value.o) result[k] = innerParseSerializedValue(v, handles, refs);
    return result;
  }
  if (value.h !== undefined) {
    if (handles === undefined) throw new Error('Unexpected handle');
    return handles[value.h];
  }
  throw new Error('Unexpected value');
}
function serializeValue(value, handleSerializer) {
  return innerSerializeValue(value, handleSerializer, {
    lastId: 0,
    visited: new Map()
  });
}
function innerSerializeValue(value, handleSerializer, visitorInfo) {
  const handle = handleSerializer(value);
  if ('fallThrough' in handle) value = handle.fallThrough;else return handle;
  if (typeof value === 'symbol') return {
    v: 'undefined'
  };
  if (Object.is(value, undefined)) return {
    v: 'undefined'
  };
  if (Object.is(value, null)) return {
    v: 'null'
  };
  if (Object.is(value, NaN)) return {
    v: 'NaN'
  };
  if (Object.is(value, Infinity)) return {
    v: 'Infinity'
  };
  if (Object.is(value, -Infinity)) return {
    v: '-Infinity'
  };
  if (Object.is(value, -0)) return {
    v: '-0'
  };
  if (typeof value === 'boolean') return {
    b: value
  };
  if (typeof value === 'number') return {
    n: value
  };
  if (typeof value === 'string') return {
    s: value
  };
  if (typeof value === 'bigint') return {
    bi: value.toString()
  };
  if (isError(value)) {
    const error = value;
    if ('captureStackTrace' in globalThis.Error) {
      // v8
      return {
        s: error.stack || ''
      };
    }
    return {
      s: `${error.name}: ${error.message}\n${error.stack}`
    };
  }
  if (isDate(value)) return {
    d: value.toJSON()
  };
  if (isURL(value)) return {
    u: value.toJSON()
  };
  if (isRegExp(value)) return {
    r: {
      p: value.source,
      f: value.flags
    }
  };
  const id = visitorInfo.visited.get(value);
  if (id) return {
    ref: id
  };
  if (Array.isArray(value)) {
    const a = [];
    const id = ++visitorInfo.lastId;
    visitorInfo.visited.set(value, id);
    for (let i = 0; i < value.length; ++i) a.push(innerSerializeValue(value[i], handleSerializer, visitorInfo));
    return {
      a,
      id
    };
  }
  if (typeof value === 'object') {
    const o = [];
    const id = ++visitorInfo.lastId;
    visitorInfo.visited.set(value, id);
    for (const name of Object.keys(value)) o.push({
      k: name,
      v: innerSerializeValue(value[name], handleSerializer, visitorInfo)
    });
    return {
      o,
      id
    };
  }
  throw new Error('Unexpected value');
}
function isRegExp(obj) {
  return obj instanceof RegExp || Object.prototype.toString.call(obj) === '[object RegExp]';
}
function isDate(obj) {
  return obj instanceof Date || Object.prototype.toString.call(obj) === '[object Date]';
}
function isURL(obj) {
  return obj instanceof URL || Object.prototype.toString.call(obj) === '[object URL]';
}
function isError(obj) {
  const proto = obj ? Object.getPrototypeOf(obj) : null;
  return obj instanceof Error || (proto === null || proto === void 0 ? void 0 : proto.name) === 'Error' || proto && isError(proto);
}