"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.JSHandleDispatcher = void 0;
exports.parseArgument = parseArgument;
exports.parseValue = parseValue;
exports.serializeResult = serializeResult;
var _dispatcher = require("./dispatcher");
var _elementHandlerDispatcher = require("./elementHandlerDispatcher");
var _serializers = require("../../protocol/serializers");
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

class JSHandleDispatcher extends _dispatcher.Dispatcher {
  constructor(scope, jsHandle) {
    // Do not call this directly, use createHandle() instead.
    super(scope, jsHandle, jsHandle.asElement() ? 'ElementHandle' : 'JSHandle', {
      preview: jsHandle.toString()
    });
    this._type_JSHandle = true;
    jsHandle._setPreviewCallback(preview => this._dispatchEvent('previewUpdated', {
      preview
    }));
  }
  async evaluateExpression(params) {
    return {
      value: serializeResult(await this._object.evaluateExpression(params.expression, {
        isFunction: params.isFunction
      }, parseArgument(params.arg)))
    };
  }
  async evaluateExpressionHandle(params) {
    const jsHandle = await this._object.evaluateExpressionHandle(params.expression, {
      isFunction: params.isFunction
    }, parseArgument(params.arg));
    return {
      handle: _elementHandlerDispatcher.ElementHandleDispatcher.fromJSHandle(this.parentScope(), jsHandle)
    };
  }
  async getProperty(params) {
    const jsHandle = await this._object.getProperty(params.name);
    return {
      handle: _elementHandlerDispatcher.ElementHandleDispatcher.fromJSHandle(this.parentScope(), jsHandle)
    };
  }
  async getPropertyList() {
    const map = await this._object.getProperties();
    const properties = [];
    for (const [name, value] of map) properties.push({
      name,
      value: _elementHandlerDispatcher.ElementHandleDispatcher.fromJSHandle(this.parentScope(), value)
    });
    return {
      properties
    };
  }
  async jsonValue() {
    return {
      value: serializeResult(await this._object.jsonValue())
    };
  }
  async objectCount(params) {
    return {
      count: await this._object.objectCount()
    };
  }
  async dispose(_, metadata) {
    metadata.potentiallyClosesScope = true;
    this._object.dispose();
    this._dispose();
  }
}

// Generic channel parser converts guids to JSHandleDispatchers,
// and this function takes care of converting them into underlying JSHandles.
exports.JSHandleDispatcher = JSHandleDispatcher;
function parseArgument(arg) {
  return (0, _serializers.parseSerializedValue)(arg.value, arg.handles.map(a => a._object));
}
function parseValue(v) {
  return (0, _serializers.parseSerializedValue)(v, []);
}
function serializeResult(arg) {
  return (0, _serializers.serializeValue)(arg, value => ({
    fallThrough: value
  }));
}