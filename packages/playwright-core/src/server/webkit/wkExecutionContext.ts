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

import type { WKSession } from './wkConnection';
import type { Protocol } from './protocol';
import * as js from '../javascript';
import { parseEvaluationResultValue } from '../isomorphic/utilityScriptSerializers';
import { isSessionClosedError } from '../protocolError';

export class WKExecutionContext implements js.ExecutionContextDelegate {
  private readonly _session: WKSession;
  readonly _contextId: number | undefined;

  constructor(session: WKSession, contextId: number | undefined) {
    this._session = session;
    this._contextId = contextId;
  }

  async rawEvaluateJSON(expression: string): Promise<any> {
    try {
      const response = await this._session.send('Runtime.evaluate', {
        expression,
        contextId: this._contextId,
        returnByValue: true
      });
      if (response.wasThrown)
        throw new js.JavaScriptErrorInEvaluate(response.result.description);
      return response.result.value;
    } catch (error) {
      throw rewriteError(error);
    }
  }

  async rawEvaluateHandle(expression: string): Promise<js.ObjectId> {
    try {
      const response = await this._session.send('Runtime.evaluate', {
        expression,
        contextId: this._contextId,
        returnByValue: false
      });
      if (response.wasThrown)
        throw new js.JavaScriptErrorInEvaluate(response.result.description);
      return response.result.objectId!;
    } catch (error) {
      throw rewriteError(error);
    }
  }

  rawCallFunctionNoReply(func: Function, ...args: any[]) {
    this._session.send('Runtime.callFunctionOn', {
      functionDeclaration: func.toString(),
      objectId: args.find(a => a instanceof js.JSHandle)!._objectId!,
      arguments: args.map(a => a instanceof js.JSHandle ? { objectId: a._objectId } : { value: a }),
      returnByValue: true,
      emulateUserGesture: true
    }).catch(() => {});
  }

  async evaluateWithArguments(expression: string, returnByValue: boolean, utilityScript: js.JSHandle<any>, values: any[], objectIds: string[]): Promise<any> {
    try {
      const response = await this._session.send('Runtime.callFunctionOn', {
        functionDeclaration: expression,
        objectId: utilityScript._objectId!,
        arguments: [
          { objectId: utilityScript._objectId },
          ...values.map(value => ({ value })),
          ...objectIds.map(objectId => ({ objectId })),
        ],
        returnByValue,
        emulateUserGesture: true,
        awaitPromise: true
      });
      if (response.wasThrown)
        throw new js.JavaScriptErrorInEvaluate(response.result.description);
      if (returnByValue)
        return parseEvaluationResultValue(response.result.value);
      return utilityScript._context.createHandle(response.result);
    } catch (error) {
      throw rewriteError(error);
    }
  }

  async getProperties(context: js.ExecutionContext, objectId: js.ObjectId): Promise<Map<string, js.JSHandle>> {
    const response = await this._session.send('Runtime.getProperties', {
      objectId,
      ownProperties: true
    });
    const result = new Map();
    for (const property of response.properties) {
      if (!property.enumerable || !property.value)
        continue;
      result.set(property.name, context.createHandle(property.value));
    }
    return result;
  }

  createHandle(context: js.ExecutionContext, remoteObject: Protocol.Runtime.RemoteObject): js.JSHandle {
    const isPromise = remoteObject.className === 'Promise';
    return new js.JSHandle(context, isPromise ? 'promise' : remoteObject.subtype || remoteObject.type, renderPreview(remoteObject), remoteObject.objectId, potentiallyUnserializableValue(remoteObject));
  }

  async releaseHandle(objectId: js.ObjectId): Promise<void> {
    await this._session.send('Runtime.releaseObject', { objectId });
  }

  objectCount(objectId: js.ObjectId): Promise<number> {
    throw new Error('Method not implemented in WebKit.');
  }
}

function potentiallyUnserializableValue(remoteObject: Protocol.Runtime.RemoteObject): any {
  const value = remoteObject.value;
  const isUnserializable = remoteObject.type === 'number' && ['NaN', '-Infinity', 'Infinity', '-0'].includes(remoteObject.description!);
  return isUnserializable ? js.parseUnserializableValue(remoteObject.description!) : value;
}

function rewriteError(error: Error): Error {
  if (!js.isJavaScriptErrorInEvaluate(error) && !isSessionClosedError(error))
    return new Error('Execution context was destroyed, most likely because of a navigation.');
  return error;
}

function renderPreview(object: Protocol.Runtime.RemoteObject): string | undefined {
  if (object.type === 'undefined')
    return 'undefined';
  if ('value' in object)
    return String(object.value);

  if (object.description === 'Object' && object.preview) {
    const tokens = [];
    for (const { name, value } of object.preview.properties!)
      tokens.push(`${name}: ${value}`);
    return `{${tokens.join(', ')}}`;
  }
  if (object.subtype === 'array' && object.preview)
    return js.sparseArrayToString(object.preview.properties!);
  return object.description;
}
