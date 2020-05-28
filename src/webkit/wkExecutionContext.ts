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
import { Protocol } from './protocol';
import * as js from '../javascript';
import * as debugSupport from '../debug/debugSupport';
import { RemoteObject, parseEvaluationResultValue } from '../remoteObject';

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

  async rawEvaluate(expression: string): Promise<RemoteObject> {
    const contextId = this._contextId;
    const response = await this._session.send('Runtime.evaluate', {
      expression: debugSupport.ensureSourceUrl(expression),
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
        return await this._returnObjectByValue(context, response.result.objectId);
      return parseEvaluationResultValue(response.result.value);
    } catch (error) {
      if (isSwappedOutError(error) || error.message.includes('Missing injected script for given'))
        throw new Error('Execution context was destroyed, most likely because of a navigation.');
      throw error;
    }
  }

  private async _evaluateRemoteObject(context: js.ExecutionContext, pageFunction: Function | string, args: any[], returnByValue: boolean): Promise<Protocol.Runtime.callFunctionOnReturnValue> {
    if (helper.isString(pageFunction)) {
      const utilityScript = await context.utilityScript();
      const functionDeclaration = `function (returnByValue, pageFunction) { return this.evaluate(returnByValue, pageFunction); }` + debugSupport.generateSourceUrl();
      return await this._session.send('Runtime.callFunctionOn', {
        functionDeclaration,
        objectId: utilityScript._objectId!,
        arguments: [
          { value: returnByValue },
          { value: debugSupport.ensureSourceUrl(pageFunction) } ],
        returnByValue: false, // We need to return real Promise if that is a promise.
        emulateUserGesture: true
      });
    }

    if (typeof pageFunction !== 'function')
      throw new Error(`Expected to get |string| or |function| as the first argument, but got "${pageFunction}" instead.`);

    const { functionText, values, handles, dispose } = await js.prepareFunctionCall(pageFunction, context, args);

    try {
      const utilityScript = await context.utilityScript();
      return await this._session.send('Runtime.callFunctionOn', {
        functionDeclaration: `function (...args) { return this.callFunction(...args) }` + debugSupport.generateSourceUrl(),
        objectId: utilityScript._objectId!,
        arguments: [
          { value: returnByValue },
          { value: functionText },
          ...values.map(value => ({ value })),
          ...handles,
        ],
        returnByValue: false, // We need to return real Promise if that is a promise.
        emulateUserGesture: true
      });
    } finally {
      dispose();
    }
  }

  private async _returnObjectByValue(context: js.ExecutionContext, objectId: Protocol.Runtime.RemoteObjectId): Promise<any> {
    // This is different from handleJSONValue in that it does not throw.
    try {
      const utilityScript = await context.utilityScript();
      const serializeResponse = await this._session.send('Runtime.callFunctionOn', {
        functionDeclaration: 'object => object' + debugSupport.generateSourceUrl(),
        objectId: utilityScript._objectId!,
        arguments: [ { objectId } ],
        returnByValue: true
      });
      if (serializeResponse.wasThrown)
        return undefined;
      return parseEvaluationResultValue(serializeResponse.result.value);
    } catch (e) {
      if (isSwappedOutError(e))
        return contextDestroyedResult;
      return undefined;
    }
  }

  async getProperties(handle: js.JSHandle): Promise<Map<string, js.JSHandle>> {
    const objectId = handle._objectId;
    if (!objectId)
      return new Map();
    const response = await this._session.send('Runtime.getProperties', {
      objectId,
      ownProperties: true
    });
    const result = new Map();
    for (const property of response.properties) {
      if (!property.enumerable || !property.value)
        continue;
      result.set(property.name, handle._context.createHandle(property.value));
    }
    return result;
  }

  async releaseHandle(handle: js.JSHandle): Promise<void> {
    if (!handle._objectId)
      return;
    await this._session.send('Runtime.releaseObject', {objectId: handle._objectId}).catch(error => {});
  }

  async handleJSONValue<T>(handle: js.JSHandle<T>): Promise<T> {
    if (handle._objectId) {
      const utilityScript = await handle._context.utilityScript();
      const response = await this._session.send('Runtime.callFunctionOn', {
        functionDeclaration: 'function (object) { return this.jsonValue(true, object); }' + debugSupport.generateSourceUrl(),
        objectId: utilityScript._objectId!,
        arguments: [ { objectId: handle._objectId } ],
        returnByValue: true
      });
      if (response.wasThrown)
        throw new Error('Evaluation failed: ' + response.result.description);
      return parseEvaluationResultValue(response.result.value);
    }
    return handle._value;
  }
}

const contextDestroyedResult = {
  wasThrown: true,
  result: {
    description: 'Protocol error: Execution context was destroyed, most likely because of a navigation.'
  } as Protocol.Runtime.RemoteObject
};
