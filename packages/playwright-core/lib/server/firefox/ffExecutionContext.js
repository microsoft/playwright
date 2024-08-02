"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FFExecutionContext = void 0;
var js = _interopRequireWildcard(require("../javascript"));
var _stackTrace = require("../../utils/stackTrace");
var _utilityScriptSerializers = require("../isomorphic/utilityScriptSerializers");
var _protocolError = require("../protocolError");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
/**
 * Copyright 2019 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

class FFExecutionContext {
  constructor(session, executionContextId) {
    this._session = void 0;
    this._executionContextId = void 0;
    this._session = session;
    this._executionContextId = executionContextId;
  }
  async rawEvaluateJSON(expression) {
    const payload = await this._session.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      executionContextId: this._executionContextId
    }).catch(rewriteError);
    checkException(payload.exceptionDetails);
    return payload.result.value;
  }
  async rawEvaluateHandle(expression) {
    const payload = await this._session.send('Runtime.evaluate', {
      expression,
      returnByValue: false,
      executionContextId: this._executionContextId
    }).catch(rewriteError);
    checkException(payload.exceptionDetails);
    return payload.result.objectId;
  }
  rawCallFunctionNoReply(func, ...args) {
    this._session.send('Runtime.callFunction', {
      functionDeclaration: func.toString(),
      args: args.map(a => a instanceof js.JSHandle ? {
        objectId: a._objectId
      } : {
        value: a
      }),
      returnByValue: true,
      executionContextId: this._executionContextId
    }).catch(() => {});
  }
  async evaluateWithArguments(expression, returnByValue, utilityScript, values, objectIds) {
    const payload = await this._session.send('Runtime.callFunction', {
      functionDeclaration: expression,
      args: [{
        objectId: utilityScript._objectId,
        value: undefined
      }, ...values.map(value => ({
        value
      })), ...objectIds.map(objectId => ({
        objectId,
        value: undefined
      }))],
      returnByValue,
      executionContextId: this._executionContextId
    }).catch(rewriteError);
    checkException(payload.exceptionDetails);
    if (returnByValue) return (0, _utilityScriptSerializers.parseEvaluationResultValue)(payload.result.value);
    return utilityScript._context.createHandle(payload.result);
  }
  async getProperties(context, objectId) {
    const response = await this._session.send('Runtime.getObjectProperties', {
      executionContextId: this._executionContextId,
      objectId
    });
    const result = new Map();
    for (const property of response.properties) result.set(property.name, context.createHandle(property.value));
    return result;
  }
  createHandle(context, remoteObject) {
    return new js.JSHandle(context, remoteObject.subtype || remoteObject.type || '', renderPreview(remoteObject), remoteObject.objectId, potentiallyUnserializableValue(remoteObject));
  }
  async releaseHandle(objectId) {
    await this._session.send('Runtime.disposeObject', {
      executionContextId: this._executionContextId,
      objectId
    });
  }
  objectCount(objectId) {
    throw new Error('Method not implemented in Firefox.');
  }
}
exports.FFExecutionContext = FFExecutionContext;
function checkException(exceptionDetails) {
  if (!exceptionDetails) return;
  if (exceptionDetails.value) throw new js.JavaScriptErrorInEvaluate(JSON.stringify(exceptionDetails.value));else throw new js.JavaScriptErrorInEvaluate(exceptionDetails.text + (exceptionDetails.stack ? '\n' + exceptionDetails.stack : ''));
}
function rewriteError(error) {
  if (error.message.includes('cyclic object value') || error.message.includes('Object is not serializable')) return {
    result: {
      type: 'undefined',
      value: undefined
    }
  };
  if (error instanceof TypeError && error.message.startsWith('Converting circular structure to JSON')) (0, _stackTrace.rewriteErrorMessage)(error, error.message + ' Are you passing a nested JSHandle?');
  if (!js.isJavaScriptErrorInEvaluate(error) && !(0, _protocolError.isSessionClosedError)(error)) throw new Error('Execution context was destroyed, most likely because of a navigation.');
  throw error;
}
function potentiallyUnserializableValue(remoteObject) {
  const value = remoteObject.value;
  const unserializableValue = remoteObject.unserializableValue;
  return unserializableValue ? js.parseUnserializableValue(unserializableValue) : value;
}
function renderPreview(object) {
  if (object.type === 'undefined') return 'undefined';
  if (object.unserializableValue) return String(object.unserializableValue);
  if (object.type === 'symbol') return 'Symbol()';
  if (object.subtype === 'regexp') return 'RegExp';
  if (object.subtype === 'weakmap') return 'WeakMap';
  if (object.subtype === 'weakset') return 'WeakSet';
  if (object.subtype) return object.subtype[0].toUpperCase() + object.subtype.slice(1);
  if ('value' in object) return String(object.value);
}