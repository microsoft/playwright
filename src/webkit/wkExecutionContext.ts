/**
 * Copyright 2017 Google Inc. All rights reserved.
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

import { WKTargetSession, isSwappedOutError } from './wkConnection';
import { helper } from '../helper';
import { valueFromRemoteObject, releaseObject } from './wkProtocolHelper';
import { Protocol } from './protocol';
import * as js from '../javascript';

export const EVALUATION_SCRIPT_URL = '__playwright_evaluation_script__';
const SOURCE_URL_REGEX = /^[\040\t]*\/\/[@#] sourceURL=\s*(\S*?)\s*$/m;

export class WKExecutionContext implements js.ExecutionContextDelegate {
  private _globalObjectId?: Promise<string>;
  _session: WKTargetSession;
  _contextId: number;
  private _contextDestroyedCallback: () => void;
  private _executionContextDestroyedPromise: Promise<unknown>;

  constructor(client: WKTargetSession, contextPayload: Protocol.Runtime.ExecutionContextDescription) {
    this._session = client;
    this._contextId = contextPayload.id;
    this._contextDestroyedCallback = null;
    this._executionContextDestroyedPromise = new Promise((resolve, reject) => {
      this._contextDestroyedCallback = resolve;
    });
  }

  _dispose() {
    this._contextDestroyedCallback();
  }

  async evaluate(context: js.ExecutionContext, returnByValue: boolean, pageFunction: Function | string, ...args: any[]): Promise<any> {
    if (helper.isString(pageFunction)) {
      const contextId = this._contextId;
      const expression: string = pageFunction as string;
      const expressionWithSourceUrl = SOURCE_URL_REGEX.test(expression) ? expression : expression + '\n' + suffix;
      return this._session.send('Runtime.evaluate', {
        expression: expressionWithSourceUrl,
        contextId,
        returnByValue: false,
        emulateUserGesture: true
      }).then(response => {
        if (response.result.type === 'object' && response.result.className === 'Promise') {
          return Promise.race([
            this._executionContextDestroyedPromise.then(() => contextDestroyedResult),
            this._awaitPromise(response.result.objectId),
          ]);
        }
        return response;
      }).then(response => {
        if (response.wasThrown)
          throw new Error('Evaluation failed: ' + response.result.description);
        if (!returnByValue)
          return context._createHandle(response.result);
        if (response.result.objectId)
          return this._returnObjectByValue(response.result.objectId);
        return valueFromRemoteObject(response.result);
      }).catch(rewriteError);
    }

    if (typeof pageFunction !== 'function')
      throw new Error(`Expected to get |string| or |function| as the first argument, but got "${pageFunction}" instead.`);

    let functionText = pageFunction.toString();
    try {
      new Function('(' + functionText + ')');
    } catch (e1) {
      // This means we might have a function shorthand. Try another
      // time prefixing 'function '.
      if (functionText.startsWith('async '))
        functionText = 'async function ' + functionText.substring('async '.length);
      else
        functionText = 'function ' + functionText;
      try {
        new Function('(' + functionText  + ')');
      } catch (e2) {
        // We tried hard to serialize, but there's a weird beast here.
        throw new Error('Passed function is not well-serializable!');
      }
    }

    let serializableArgs;
    if (args.some(isUnserializable)) {
      serializableArgs = [];
      const paramStrings = [];
      for (const arg of args) {
        if (isUnserializable(arg)) {
          paramStrings.push(unserializableToString(arg));
        } else {
          paramStrings.push('arguments[' + serializableArgs.length + ']');
          serializableArgs.push(arg);
        }
      }
      functionText = `() => (${functionText})(${paramStrings.join(',')})`;
    } else {
      serializableArgs = args;
    }

    const thisObjectId = await this._contextGlobalObjectId();
    let callFunctionOnPromise;
    try {
      callFunctionOnPromise = this._session.send('Runtime.callFunctionOn', {
        functionDeclaration: functionText + '\n' + suffix + '\n',
        objectId: thisObjectId,
        arguments: serializableArgs.map((arg: any) => this._convertArgument(arg)),
        returnByValue: false,
        emulateUserGesture: true
      });
    } catch (err) {
      if (err instanceof TypeError && err.message.startsWith('Converting circular structure to JSON'))
        err.message += ' Are you passing a nested JSHandle?';
      throw err;
    }
    return callFunctionOnPromise.then(response => {
      if (response.result.type === 'object' && response.result.className === 'Promise') {
        return Promise.race([
          this._executionContextDestroyedPromise.then(() => contextDestroyedResult),
          this._awaitPromise(response.result.objectId),
        ]);
      }
      return response;
    }).then(response => {
      if (response.wasThrown)
        throw new Error('Evaluation failed: ' + response.result.description);
      if (!returnByValue)
        return context._createHandle(response.result);
      if (response.result.objectId)
        return this._returnObjectByValue(response.result.objectId);
      return valueFromRemoteObject(response.result);
    }).catch(rewriteError);

    function unserializableToString(arg: any) {
      if (Object.is(arg, -0))
        return '-0';
      if (Object.is(arg, Infinity))
        return 'Infinity';
      if (Object.is(arg, -Infinity))
        return '-Infinity';
      if (Object.is(arg, NaN))
        return 'NaN';
      if (arg instanceof js.JSHandle) {
        const remoteObj = toRemoteObject(arg);
        if (!remoteObj.objectId)
          return valueFromRemoteObject(remoteObj);
      }
      throw new Error('Unsupported value: ' + arg + ' (' + (typeof arg) + ')');
    }

    function isUnserializable(arg: any) {
      if (typeof arg === 'bigint')
        return true;
      if (Object.is(arg, -0))
        return true;
      if (Object.is(arg, Infinity))
        return true;
      if (Object.is(arg, -Infinity))
        return true;
      if (Object.is(arg, NaN))
        return true;
      if (arg instanceof js.JSHandle) {
        const remoteObj = toRemoteObject(arg);
        if (!remoteObj.objectId)
          return !Object.is(valueFromRemoteObject(remoteObj), remoteObj.value);
      }
      return false;
    }

    function rewriteError(error: Error): Protocol.Runtime.evaluateReturnValue {
      if (error.message.includes('Object couldn\'t be returned by value'))
        return {result: {type: 'undefined'}};

      if (error.message.includes('Missing injected script for given'))
        throw new Error('Execution context was destroyed, most likely because of a navigation.');
      throw error;
    }
  }

  private _contextGlobalObjectId() {
    if (!this._globalObjectId) {
      this._globalObjectId = this._session.send('Runtime.evaluate', {
        expression: 'this',
        contextId: this._contextId
      }).catch(e => {
        if (isSwappedOutError(e))
          throw new Error('Execution context was destroyed, most likely because of a navigation.');
        throw e;
      }).then(response => {
        return response.result.objectId;
      });
    }
    return this._globalObjectId;
  }

  private _awaitPromise(objectId: Protocol.Runtime.RemoteObjectId) {
    return this._session.send('Runtime.awaitPromise', {
      promiseObjectId: objectId,
      returnByValue: false
    }).catch(e => {
      if (isSwappedOutError(e))
        return contextDestroyedResult;
      throw e;
    });
  }

  private _returnObjectByValue(objectId: Protocol.Runtime.RemoteObjectId) {
    const serializeFunction = function() {
      try {
        return JSON.stringify(this);
      } catch (e) {
        if (e instanceof TypeError)
          return void 0;
        throw e;
      }
    };
    return this._session.send('Runtime.callFunctionOn', {
      // Serialize object using standard JSON implementation to correctly pass 'undefined'.
      functionDeclaration: serializeFunction + '\n' + suffix + '\n',
      objectId: objectId,
      returnByValue: true
    }).catch(e => {
      if (isSwappedOutError(e))
        return contextDestroyedResult;
      throw e;
    }).then(serializeResponse => {
      if (serializeResponse.wasThrown)
        throw new Error('Serialization failed: ' + serializeResponse.result.description);
      // This is the case of too long property chain, not serializable to json string.
      if (serializeResponse.result.type === 'undefined')
        return undefined;
      if (serializeResponse.result.type !== 'string')
        throw new Error('Unexpected result of JSON.stringify: ' + JSON.stringify(serializeResponse, null, 2));
      return JSON.parse(serializeResponse.result.value);
    });
  }

  async getProperties(handle: js.JSHandle): Promise<Map<string, js.JSHandle>> {
    const response = await this._session.send('Runtime.getProperties', {
      objectId: toRemoteObject(handle).objectId,
      ownProperties: true
    });
    const result = new Map();
    for (const property of response.properties) {
      if (!property.enumerable)
        continue;
      result.set(property.name, handle._context._createHandle(property.value));
    }
    return result;
  }

  async releaseHandle(handle: js.JSHandle): Promise<void> {
    await releaseObject(this._session, toRemoteObject(handle));
  }

  async handleJSONValue<T>(handle: js.JSHandle<T>): Promise<T> {
    const remoteObject = toRemoteObject(handle);
    if (remoteObject.objectId) {
      const response = await this._session.send('Runtime.callFunctionOn', {
        functionDeclaration: 'function() { return this; }',
        objectId: remoteObject.objectId,
        returnByValue: true
      });
      return valueFromRemoteObject(response.result);
    }
    return valueFromRemoteObject(remoteObject);
  }

  handleToString(handle: js.JSHandle, includeType: boolean): string {
    const object = toRemoteObject(handle);
    if (object.objectId) {
      let type: string =  object.subtype || object.type;
      // FIXME: promise doesn't have special subtype in WebKit.
      if (object.className === 'Promise')
        type = 'promise';
      return 'JSHandle@' + type;
    }
    return (includeType ? 'JSHandle:' : '') + valueFromRemoteObject(object);
  }

  private _convertArgument(arg: js.JSHandle | any) : Protocol.Runtime.CallArgument {
    const objectHandle = arg && (arg instanceof js.JSHandle) ? arg : null;
    if (objectHandle) {
      if (objectHandle._context._delegate !== this)
        throw new Error('JSHandles can be evaluated only in the context they were created!');
      if (objectHandle._disposed)
        throw new Error('JSHandle is disposed!');
      const remoteObject = toRemoteObject(arg);
      if (!remoteObject.objectId)
        return { value: valueFromRemoteObject(remoteObject) };
      return { objectId: remoteObject.objectId };
    }
    return { value: arg };
  }
}

const suffix = `//# sourceURL=${EVALUATION_SCRIPT_URL}`;
const contextDestroyedResult = {
  wasThrown: true,
  result: {
    description: 'Protocol error: Execution context was destroyed, most likely because of a navigation.'
  } as Protocol.Runtime.RemoteObject
};

function toRemoteObject(handle: js.JSHandle): Protocol.Runtime.RemoteObject {
  return handle._remoteObject as Protocol.Runtime.RemoteObject;
}
