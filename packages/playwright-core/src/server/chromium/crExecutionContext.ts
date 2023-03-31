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

import type { CRSession } from './crConnection';
import { getExceptionMessage, releaseObject } from './crProtocolHelper';
import type { Protocol } from './protocol';
import * as js from '../javascript';
import { rewriteErrorMessage } from '../../utils/stackTrace';
import { parseEvaluationResultValue } from '../isomorphic/utilityScriptSerializers';
import { isSessionClosedError } from '../protocolError';

export class CRExecutionContext implements js.ExecutionContextDelegate {
  _client: CRSession;
  _contextId: number;

  constructor(client: CRSession, contextPayload: Protocol.Runtime.ExecutionContextDescription) {
    this._client = client;
    this._contextId = contextPayload.id;
  }

  async rawEvaluateJSON(expression: string): Promise<any> {
    const { exceptionDetails, result: remoteObject } = await this._client.send('Runtime.evaluate', {
      expression,
      contextId: this._contextId,
      returnByValue: true,
    }).catch(rewriteError);
    if (exceptionDetails)
      throw new js.JavaScriptErrorInEvaluate(getExceptionMessage(exceptionDetails));
    return remoteObject.value;
  }

  async rawEvaluateHandle(expression: string): Promise<js.ObjectId> {
    const { exceptionDetails, result: remoteObject } = await this._client.send('Runtime.evaluate', {
      expression,
      contextId: this._contextId,
    }).catch(rewriteError);
    if (exceptionDetails)
      throw new js.JavaScriptErrorInEvaluate(getExceptionMessage(exceptionDetails));
    return remoteObject.objectId!;
  }

  rawCallFunctionNoReply(func: Function, ...args: any[]) {
    this._client.send('Runtime.callFunctionOn', {
      functionDeclaration: func.toString(),
      arguments: args.map(a => a instanceof js.JSHandle ? { objectId: a._objectId } : { value: a }),
      returnByValue: true,
      executionContextId: this._contextId,
      userGesture: true
    }).catch(() => {});
  }

  async evaluateWithArguments(expression: string, returnByValue: boolean, utilityScript: js.JSHandle<any>, values: any[], objectIds: string[]): Promise<any> {
    const { exceptionDetails, result: remoteObject } = await this._client.send('Runtime.callFunctionOn', {
      functionDeclaration: expression,
      objectId: utilityScript._objectId,
      arguments: [
        { objectId: utilityScript._objectId },
        ...values.map(value => ({ value })),
        ...objectIds.map(objectId => ({ objectId })),
      ],
      returnByValue,
      awaitPromise: true,
      userGesture: true
    }).catch(rewriteError);
    if (exceptionDetails)
      throw new js.JavaScriptErrorInEvaluate(getExceptionMessage(exceptionDetails));
    return returnByValue ? parseEvaluationResultValue(remoteObject.value) : utilityScript._context.createHandle(remoteObject);
  }

  async getProperties(context: js.ExecutionContext, objectId: js.ObjectId): Promise<Map<string, js.JSHandle>> {
    const response = await this._client.send('Runtime.getProperties', {
      objectId,
      ownProperties: true
    });
    const result = new Map();
    for (const property of response.result) {
      if (!property.enumerable || !property.value)
        continue;
      result.set(property.name, context.createHandle(property.value));
    }
    return result;
  }

  createHandle(context: js.ExecutionContext, remoteObject: Protocol.Runtime.RemoteObject): js.JSHandle {
    return new js.JSHandle(context, remoteObject.subtype || remoteObject.type, renderPreview(remoteObject), remoteObject.objectId, potentiallyUnserializableValue(remoteObject));
  }

  async releaseHandle(objectId: js.ObjectId): Promise<void> {
    await releaseObject(this._client, objectId);
  }

  async objectCount(objectId: js.ObjectId): Promise<number> {
    const result = await this._client.send('Runtime.queryObjects', {
      prototypeObjectId: objectId
    });
    const match = result.objects.description!.match(/Array\((\d+)\)/)!;
    return +match[1];
  }
}

function rewriteError(error: Error): Protocol.Runtime.evaluateReturnValue {
  if (error.message.includes('Object reference chain is too long'))
    return { result: { type: 'undefined' } };
  if (error.message.includes('Object couldn\'t be returned by value'))
    return { result: { type: 'undefined' } };

  if (error instanceof TypeError && error.message.startsWith('Converting circular structure to JSON'))
    rewriteErrorMessage(error, error.message + ' Are you passing a nested JSHandle?');
  if (!js.isJavaScriptErrorInEvaluate(error) && !isSessionClosedError(error))
    throw new Error('Execution context was destroyed, most likely because of a navigation.');
  throw error;
}

function potentiallyUnserializableValue(remoteObject: Protocol.Runtime.RemoteObject): any {
  const value = remoteObject.value;
  const unserializableValue = remoteObject.unserializableValue;
  return unserializableValue ? js.parseUnserializableValue(unserializableValue) : value;
}

function renderPreview(object: Protocol.Runtime.RemoteObject): string | undefined {
  if (object.type === 'undefined')
    return 'undefined';
  if ('value' in object)
    return String(object.value);
  if (object.unserializableValue)
    return String(object.unserializableValue);

  if (object.description === 'Object' && object.preview) {
    const tokens = [];
    for (const { name, value } of object.preview.properties)
      tokens.push(`${name}: ${value}`);
    return `{${tokens.join(', ')}}`;
  }
  if (object.subtype === 'array' && object.preview)
    return js.sparseArrayToString(object.preview.properties);
  return object.description;
}
