"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TimeoutError = exports.TargetClosedError = void 0;
exports.isTargetClosedError = isTargetClosedError;
exports.parseError = parseError;
exports.serializeError = serializeError;
var _utils = require("../utils");
var _serializers = require("../protocol/serializers");
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

class TimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TimeoutError';
  }
}
exports.TimeoutError = TimeoutError;
class TargetClosedError extends Error {
  constructor(cause) {
    super(cause || 'Target page, context or browser has been closed');
  }
}
exports.TargetClosedError = TargetClosedError;
function isTargetClosedError(error) {
  return error instanceof TargetClosedError;
}
function serializeError(e) {
  if ((0, _utils.isError)(e)) return {
    error: {
      message: e.message,
      stack: e.stack,
      name: e.name
    }
  };
  return {
    value: (0, _serializers.serializeValue)(e, value => ({
      fallThrough: value
    }))
  };
}
function parseError(error) {
  if (!error.error) {
    if (error.value === undefined) throw new Error('Serialized error must have either an error or a value');
    return (0, _serializers.parseSerializedValue)(error.value, undefined);
  }
  if (error.error.name === 'TimeoutError') {
    const e = new TimeoutError(error.error.message);
    e.stack = error.error.stack || '';
    return e;
  }
  if (error.error.name === 'TargetClosedError') {
    const e = new TargetClosedError(error.error.message);
    e.stack = error.error.stack || '';
    return e;
  }
  const e = new Error(error.error.message);
  e.stack = error.error.stack || '';
  e.name = error.error.name;
  return e;
}