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

import { WKSession, isSwappedOutError } from './wkConnection';
import { helper } from '../helper';
import { valueFromRemoteObject, releaseObject } from './wkProtocolHelper';
import { Protocol } from './protocol';
import * as js from '../javascript';

type MaybeCallArgument = Protocol.Runtime.CallArgument | { unserializable: any };

export class WKExecutionContext implements js.ExecutionContextDelegate {
  private readonly _session: WKSession;
  readonly _contextId: number | undefined;
  private _contextDestroyedCallback: () => void = () => {};
  private readonly _executionContextDestroyedPromise: Promise<unknown>;

  constructor(session: WKSession, contextId: number | undefined) {
    this._session = session;
    this._contextId = contextId;
    this._executionContextDestroyedPromise = new Promise((resolve, reject) => {
      this._contextDestroyedCallback = resolve;
    });
  }

  _dispose() {
    this._contextDestroyedCallback();
  }

  async rawEvaluate(expression: string): Promise<js.RemoteObject> {
    const contextId = this._contextId;
    const response = await this._session.send('Runtime.evaluate', {
      expression: js.ensureSourceUrl(expression),
      contextId,
      returnByValue: false
    });
    if (response.wasThrown)
      throw new Error('Evaluation failed: ' + response.result.description);
    return response.result;
  }

  async evaluate(context: js.ExecutionContext, returnByValue: boolean, pageFunction: Function | string, ...args: any[]): Promise<any> {
    try {
      let response = await this._evaluateRemoteObject(context, pageFunction, args, returnByValue);
      if (response.result.objectId && response.result.className === 'Promise') {
        response = await Promise.race([
          this._executionContextDestroyedPromise.then(() => contextDestroyedResult),
          this._session.send('Runtime.awaitPromise', {
            promiseObjectId: response.result.objectId,
            returnByValue: false
          })
        ]);
      }
      if (response.wasThrown)
        throw new Error('Evaluation failed: ' + response.result.description);
      if (!returnByValue)
        return context.createHandle(response.result);
      if (response.result.objectId)
        return await this._returnObjectByValue(response.result.objectId);
      return valueFromRemoteObject(response.result);
    } catch (error) {
      if (isSwappedOutError(error) || error.message.includes('Missing injected script for given'))
        throw new Error('Execution context was destroyed, most likely because of a navigation.');
      throw error;
    }
  }

  private async _evaluateRemoteObject(context: js.ExecutionContext, pageFunction: Function | string, args: any[], returnByValue: boolean): Promise<Protocol.Runtime.callFunctionOnReturnValue> {
    if (helper.isString(pageFunction)) {
      const utilityScript = await context.utilityScript();
      const functionDeclaration = `function (returnByValue, pageFunction) { return this.evaluate(returnByValue, pageFunction); }${js.generateSourceUrl()}`;
      return await this._session.send('Runtime.callFunctionOn', {
        functionDeclaration,
        objectId: utilityScript._remoteObject.objectId!,
        arguments: [ { value: returnByValue }, { value: pageFunction } ],
        returnByValue: false, // We need to return real Promise if that is a promise.
        emulateUserGesture: true
      });
    }

    if (typeof pageFunction !== 'function')
      throw new Error(`Expected to get |string| or |function| as the first argument, but got "${pageFunction}" instead.`);

    const { functionText, values, handles, dispose } = await js.prepareFunctionCall<MaybeCallArgument>(pageFunction, context, args, (value: any) => {
      if (typeof value === 'bigint' || Object.is(value, -0) || Object.is(value, Infinity) || Object.is(value, -Infinity) || Object.is(value, NaN))
        return { handle: { unserializable: value } };
      if (value && (value instanceof js.JSHandle)) {
        const remoteObject = value._remoteObject;
        if (!remoteObject.objectId && !Object.is(valueFromRemoteObject(remoteObject), remoteObject.value))
          return { handle: { unserializable: value } };
        if (!remoteObject.objectId)
          return { handle: { value: valueFromRemoteObject(remoteObject) } };
        return { handle: { objectId: remoteObject.objectId } };
      }
      return { value };
    });

    try {
      const utilityScript = await context.utilityScript();
      const callParams = this._serializeFunctionAndArguments(functionText, values, handles, returnByValue);
      return await this._session.send('Runtime.callFunctionOn', {
        functionDeclaration: callParams.functionText,
        objectId: utilityScript._remoteObject.objectId!,
        arguments: callParams.callArguments,
        returnByValue: false, // We need to return real Promise if that is a promise.
        emulateUserGesture: true
      });
    } finally {
      dispose();
    }
  }

  private _serializeFunctionAndArguments(originalText: string, values: any[], handles: MaybeCallArgument[], returnByValue: boolean): { functionText: string, callArguments: Protocol.Runtime.CallArgument[]} {
    const callArguments: Protocol.Runtime.CallArgument[] = values.map(value => ({ value }));
    let functionText = `function (returnByValue, functionText, ...args) { return this.callFunction(returnByValue, functionText, ...args); }${js.generateSourceUrl()}`;
    if (handles.some(handle => 'unserializable' in handle)) {
      const paramStrings = [];
      for (let i = 0; i < callArguments.length; i++)
        paramStrings.push('a[' + i + ']');
      for (const handle of handles) {
        if ('unserializable' in handle) {
          paramStrings.push(unserializableToString(handle.unserializable));
        } else {
          paramStrings.push('a[' + callArguments.length + ']');
          callArguments.push(handle);
        }
      }
      functionText = `function (returnByValue, functionText, ...a) { return  this.callFunction(returnByValue, functionText, ${paramStrings.join(',')}); }${js.generateSourceUrl()}`;
    } else {
      callArguments.push(...(handles as Protocol.Runtime.CallArgument[]));
    }
    return { functionText, callArguments: [ { value: returnByValue }, { value: originalText }, ...callArguments ] };

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
        const remoteObj = arg._remoteObject;
        if (!remoteObj.objectId)
          return valueFromRemoteObject(remoteObj);
      }
      throw new Error('Unsupported value: ' + arg + ' (' + (typeof arg) + ')');
    }
  }

  private async _returnObjectByValue(objectId: Protocol.Runtime.RemoteObjectId): Promise<any> {
    try {
      const serializeResponse = await this._session.send('Runtime.callFunctionOn', {
        // Serialize object using standard JSON implementation to correctly pass 'undefined'.
        functionDeclaration: 'function(){return this}\n' + js.generateSourceUrl(),
        objectId: objectId,
        returnByValue: true
      });
      if (serializeResponse.wasThrown)
        return undefined;
      return serializeResponse.result.value;
    } catch (e) {
      if (isSwappedOutError(e))
        return contextDestroyedResult;
      return undefined;
    }
  }

  async getProperties(handle: js.JSHandle): Promise<Map<string, js.JSHandle>> {
    const objectId = handle._remoteObject.objectId;
    if (!objectId)
      return new Map();
    const response = await this._session.send('Runtime.getProperties', {
      objectId,
      ownProperties: true
    });
    const result = new Map();
    for (const property of response.properties) {
      if (!property.enumerable)
        continue;
      result.set(property.name, handle._context.createHandle(property.value));
    }
    return result;
  }

  async releaseHandle(handle: js.JSHandle): Promise<void> {
    await releaseObject(this._session, handle._remoteObject);
  }

  async handleJSONValue<T>(handle: js.JSHandle<T>): Promise<T> {
    const remoteObject = handle._remoteObject;
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
    const object = handle._remoteObject as Protocol.Runtime.RemoteObject;
    if (object.objectId) {
      let type: string =  object.subtype || object.type;
      // FIXME: promise doesn't have special subtype in WebKit.
      if (object.className === 'Promise')
        type = 'promise';
      return 'JSHandle@' + type;
    }
    return (includeType ? 'JSHandle:' : '') + valueFromRemoteObject(object);
  }
}

const contextDestroyedResult = {
  wasThrown: true,
  result: {
    description: 'Protocol error: Execution context was destroyed, most likely because of a navigation.'
  } as Protocol.Runtime.RemoteObject
};
