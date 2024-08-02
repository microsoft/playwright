"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ValidationError = void 0;
exports.createMetadataValidator = createMetadataValidator;
exports.findValidator = findValidator;
exports.maybeFindValidator = maybeFindValidator;
exports.tUndefined = exports.tType = exports.tString = exports.tOptional = exports.tObject = exports.tNumber = exports.tEnum = exports.tChannel = exports.tBoolean = exports.tBinary = exports.tArray = exports.tAny = exports.scheme = void 0;
var _utils = require("../utils");
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

class ValidationError extends Error {}
exports.ValidationError = ValidationError;
const scheme = exports.scheme = {};
function findValidator(type, method, kind) {
  const validator = maybeFindValidator(type, method, kind);
  if (!validator) throw new ValidationError(`Unknown scheme for ${kind}: ${type}.${method}`);
  return validator;
}
function maybeFindValidator(type, method, kind) {
  const schemeName = type + (kind === 'Initializer' ? '' : method[0].toUpperCase() + method.substring(1)) + kind;
  return scheme[schemeName];
}
function createMetadataValidator() {
  return tOptional(scheme['Metadata']);
}
const tNumber = (arg, path, context) => {
  if (arg instanceof Number) return arg.valueOf();
  if (typeof arg === 'number') return arg;
  throw new ValidationError(`${path}: expected number, got ${typeof arg}`);
};
exports.tNumber = tNumber;
const tBoolean = (arg, path, context) => {
  if (arg instanceof Boolean) return arg.valueOf();
  if (typeof arg === 'boolean') return arg;
  throw new ValidationError(`${path}: expected boolean, got ${typeof arg}`);
};
exports.tBoolean = tBoolean;
const tString = (arg, path, context) => {
  if (arg instanceof String) return arg.valueOf();
  if (typeof arg === 'string') return arg;
  throw new ValidationError(`${path}: expected string, got ${typeof arg}`);
};
exports.tString = tString;
const tBinary = (arg, path, context) => {
  if (context.binary === 'fromBase64') {
    if (arg instanceof String) return Buffer.from(arg.valueOf(), 'base64');
    if (typeof arg === 'string') return Buffer.from(arg, 'base64');
    throw new ValidationError(`${path}: expected base64-encoded buffer, got ${typeof arg}`);
  }
  if (context.binary === 'toBase64') {
    if (!(arg instanceof Buffer)) throw new ValidationError(`${path}: expected Buffer, got ${typeof arg}`);
    return arg.toString('base64');
  }
  if (context.binary === 'buffer') {
    if (!(arg instanceof Buffer)) throw new ValidationError(`${path}: expected Buffer, got ${typeof arg}`);
    return arg;
  }
  throw new ValidationError(`Unsupported binary behavior "${context.binary}"`);
};
exports.tBinary = tBinary;
const tUndefined = (arg, path, context) => {
  if (Object.is(arg, undefined)) return arg;
  throw new ValidationError(`${path}: expected undefined, got ${typeof arg}`);
};
exports.tUndefined = tUndefined;
const tAny = (arg, path, context) => {
  return arg;
};
exports.tAny = tAny;
const tOptional = v => {
  return (arg, path, context) => {
    if (Object.is(arg, undefined)) return arg;
    return v(arg, path, context);
  };
};
exports.tOptional = tOptional;
const tArray = v => {
  return (arg, path, context) => {
    if (!Array.isArray(arg)) throw new ValidationError(`${path}: expected array, got ${typeof arg}`);
    return arg.map((x, index) => v(x, path + '[' + index + ']', context));
  };
};
exports.tArray = tArray;
const tObject = s => {
  return (arg, path, context) => {
    if (Object.is(arg, null)) throw new ValidationError(`${path}: expected object, got null`);
    if (typeof arg !== 'object') throw new ValidationError(`${path}: expected object, got ${typeof arg}`);
    const result = {};
    for (const [key, v] of Object.entries(s)) {
      const value = v(arg[key], path ? path + '.' + key : key, context);
      if (!Object.is(value, undefined)) result[key] = value;
    }
    if ((0, _utils.isUnderTest)()) {
      for (const [key, value] of Object.entries(arg)) {
        if (key.startsWith('__testHook')) result[key] = value;
      }
    }
    return result;
  };
};
exports.tObject = tObject;
const tEnum = e => {
  return (arg, path, context) => {
    if (!e.includes(arg)) throw new ValidationError(`${path}: expected one of (${e.join('|')})`);
    return arg;
  };
};
exports.tEnum = tEnum;
const tChannel = names => {
  return (arg, path, context) => {
    return context.tChannelImpl(names, arg, path, context);
  };
};
exports.tChannel = tChannel;
const tType = name => {
  return (arg, path, context) => {
    const v = scheme[name];
    if (!v) throw new ValidationError(path + ': unknown type "' + name + '"');
    return v(arg, path, context);
  };
};
exports.tType = tType;