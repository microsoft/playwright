"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.serializeAsCallArgument = exports.parseEvaluationResultValue = void 0;
exports.source = source;
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

function source() {
  function isRegExp(obj) {
    try {
      return obj instanceof RegExp || Object.prototype.toString.call(obj) === '[object RegExp]';
    } catch (error) {
      return false;
    }
  }
  function isDate(obj) {
    try {
      return obj instanceof Date || Object.prototype.toString.call(obj) === '[object Date]';
    } catch (error) {
      return false;
    }
  }
  function isURL(obj) {
    try {
      return obj instanceof URL || Object.prototype.toString.call(obj) === '[object URL]';
    } catch (error) {
      return false;
    }
  }
  function isError(obj) {
    try {
      var _Object$getPrototypeO;
      return obj instanceof Error || obj && ((_Object$getPrototypeO = Object.getPrototypeOf(obj)) === null || _Object$getPrototypeO === void 0 ? void 0 : _Object$getPrototypeO.name) === 'Error';
    } catch (error) {
      return false;
    }
  }
  function parseEvaluationResultValue(value, handles = [], refs = new Map()) {
    if (Object.is(value, undefined)) return undefined;
    if (typeof value === 'object' && value) {
      if ('ref' in value) return refs.get(value.ref);
      if ('v' in value) {
        if (value.v === 'undefined') return undefined;
        if (value.v === 'null') return null;
        if (value.v === 'NaN') return NaN;
        if (value.v === 'Infinity') return Infinity;
        if (value.v === '-Infinity') return -Infinity;
        if (value.v === '-0') return -0;
        return undefined;
      }
      if ('d' in value) return new Date(value.d);
      if ('u' in value) return new URL(value.u);
      if ('bi' in value) return BigInt(value.bi);
      if ('r' in value) return new RegExp(value.r.p, value.r.f);
      if ('a' in value) {
        const result = [];
        refs.set(value.id, result);
        for (const a of value.a) result.push(parseEvaluationResultValue(a, handles, refs));
        return result;
      }
      if ('o' in value) {
        const result = {};
        refs.set(value.id, result);
        for (const {
          k,
          v
        } of value.o) result[k] = parseEvaluationResultValue(v, handles, refs);
        return result;
      }
      if ('h' in value) return handles[value.h];
    }
    return value;
  }
  function serializeAsCallArgument(value, handleSerializer) {
    return serialize(value, handleSerializer, {
      visited: new Map(),
      lastId: 0
    });
  }
  function serialize(value, handleSerializer, visitorInfo) {
    if (value && typeof value === 'object') {
      if (typeof globalThis.Window === 'function' && value instanceof globalThis.Window) return 'ref: <Window>';
      if (typeof globalThis.Document === 'function' && value instanceof globalThis.Document) return 'ref: <Document>';
      if (typeof globalThis.Node === 'function' && value instanceof globalThis.Node) return 'ref: <Node>';
    }
    return innerSerialize(value, handleSerializer, visitorInfo);
  }
  function innerSerialize(value, handleSerializer, visitorInfo) {
    const result = handleSerializer(value);
    if ('fallThrough' in result) value = result.fallThrough;else return result;
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
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return value;
    if (typeof value === 'bigint') return {
      bi: value.toString()
    };
    if (isError(value)) {
      var _error$stack;
      const error = value;
      if ((_error$stack = error.stack) !== null && _error$stack !== void 0 && _error$stack.startsWith(error.name + ': ' + error.message)) {
        // v8
        return error.stack;
      }
      return `${error.name}: ${error.message}\n${error.stack}`;
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
      for (let i = 0; i < value.length; ++i) a.push(serialize(value[i], handleSerializer, visitorInfo));
      return {
        a,
        id
      };
    }
    if (typeof value === 'object') {
      const o = [];
      const id = ++visitorInfo.lastId;
      visitorInfo.visited.set(value, id);
      for (const name of Object.keys(value)) {
        let item;
        try {
          item = value[name];
        } catch (e) {
          continue; // native bindings will throw sometimes
        }
        if (name === 'toJSON' && typeof item === 'function') o.push({
          k: name,
          v: {
            o: [],
            id: 0
          }
        });else o.push({
          k: name,
          v: serialize(item, handleSerializer, visitorInfo)
        });
      }
      let jsonWrapper;
      try {
        // If Object.keys().length === 0 we fall back to toJSON if it exists
        if (o.length === 0 && value.toJSON && typeof value.toJSON === 'function') jsonWrapper = {
          value: value.toJSON()
        };
      } catch (e) {}
      if (jsonWrapper) return innerSerialize(jsonWrapper.value, handleSerializer, visitorInfo);
      return {
        o,
        id
      };
    }
  }
  return {
    parseEvaluationResultValue,
    serializeAsCallArgument
  };
}
const result = source();
const parseEvaluationResultValue = exports.parseEvaluationResultValue = result.parseEvaluationResultValue;
const serializeAsCallArgument = exports.serializeAsCallArgument = result.serializeAsCallArgument;