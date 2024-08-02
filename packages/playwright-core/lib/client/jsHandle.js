"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.JSHandle = void 0;
exports.assertMaxArguments = assertMaxArguments;
exports.parseResult = parseResult;
exports.serializeArgument = serializeArgument;
var _channelOwner = require("./channelOwner");
var _serializers = require("../protocol/serializers");
var _errors = require("./errors");
let _Symbol$asyncDispose;
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
_Symbol$asyncDispose = Symbol.asyncDispose;
class JSHandle extends _channelOwner.ChannelOwner {
  static from(handle) {
    return handle._object;
  }
  constructor(parent, type, guid, initializer) {
    super(parent, type, guid, initializer);
    this._preview = void 0;
    this._preview = this._initializer.preview;
    this._channel.on('previewUpdated', ({
      preview
    }) => this._preview = preview);
  }
  async evaluate(pageFunction, arg) {
    const result = await this._channel.evaluateExpression({
      expression: String(pageFunction),
      isFunction: typeof pageFunction === 'function',
      arg: serializeArgument(arg)
    });
    return parseResult(result.value);
  }
  async evaluateHandle(pageFunction, arg) {
    const result = await this._channel.evaluateExpressionHandle({
      expression: String(pageFunction),
      isFunction: typeof pageFunction === 'function',
      arg: serializeArgument(arg)
    });
    return JSHandle.from(result.handle);
  }
  async getProperty(propertyName) {
    const result = await this._channel.getProperty({
      name: propertyName
    });
    return JSHandle.from(result.handle);
  }
  async getProperties() {
    const map = new Map();
    for (const {
      name,
      value
    } of (await this._channel.getPropertyList()).properties) map.set(name, JSHandle.from(value));
    return map;
  }
  async jsonValue() {
    return parseResult((await this._channel.jsonValue()).value);
  }
  asElement() {
    return null;
  }
  async [_Symbol$asyncDispose]() {
    await this.dispose();
  }
  async dispose() {
    try {
      await this._channel.dispose();
    } catch (e) {
      if ((0, _errors.isTargetClosedError)(e)) return;
      throw e;
    }
  }
  async _objectCount() {
    return await this._wrapApiCall(async () => {
      const {
        count
      } = await this._channel.objectCount();
      return count;
    });
  }
  toString() {
    return this._preview;
  }
}

// This function takes care of converting all JSHandles to their channels,
// so that generic channel serializer converts them to guids.
exports.JSHandle = JSHandle;
function serializeArgument(arg) {
  const handles = [];
  const pushHandle = channel => {
    handles.push(channel);
    return handles.length - 1;
  };
  const value = (0, _serializers.serializeValue)(arg, value => {
    if (value instanceof JSHandle) return {
      h: pushHandle(value._channel)
    };
    return {
      fallThrough: value
    };
  });
  return {
    value,
    handles
  };
}
function parseResult(value) {
  return (0, _serializers.parseSerializedValue)(value, undefined);
}
function assertMaxArguments(count, max) {
  if (count > max) throw new Error('Too many arguments. If you need to pass more than 1 argument to the function wrap them in an object.');
}