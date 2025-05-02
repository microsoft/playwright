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

import { assert } from '../../utils/isomorphic/assert';
import { getExceptionMessage, releaseObject } from './crProtocolHelper';
import { rewriteErrorMessage } from '../../utils/isomorphic/stackTrace';
import { parseEvaluationResultValue } from '../../utils/isomorphic/utilityScriptSerializers';
import * as js from '../javascript';
import * as dom from '../dom';
import { isSessionClosedError } from '../protocolError';

import type { CRSession } from './crConnection';
import type { Protocol } from './protocol';

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

  async rawEvaluateHandle(context: js.ExecutionContext, expression: string): Promise<js.JSHandle> {
    const { exceptionDetails, result: remoteObject } = await this._client.send('Runtime.evaluate', {
      expression,
      contextId: this._contextId,
    }).catch(rewriteError);
    if (exceptionDetails)
      throw new js.JavaScriptErrorInEvaluate(getExceptionMessage(exceptionDetails));
    return createHandle(context, remoteObject);
  }

  async evaluateWithArguments(expression: string, returnByValue: boolean, utilityScript: js.JSHandle, values: any[], handles: js.JSHandle[]): Promise<any> {
    const { exceptionDetails, result: remoteObject } = await this._client.send('Runtime.callFunctionOn', {
      functionDeclaration: expression,
      objectId: utilityScript._objectId,
      arguments: [
        { objectId: utilityScript._objectId },
        ...values.map(value => ({ value })),
        ...handles.map(handle => ({ objectId: handle._objectId! })),
      ],
      returnByValue,
      awaitPromise: true,
      userGesture: true
    }).catch(rewriteError);
    if (exceptionDetails)
      throw new js.JavaScriptErrorInEvaluate(getExceptionMessage(exceptionDetails));
    return returnByValue ? parseEvaluationResultValue(remoteObject.value) : createHandle(utilityScript._context, remoteObject);
  }

  async getProperties(object: js.JSHandle): Promise<Map<string, js.JSHandle>> {
    const response = await this._client.send('Runtime.getProperties', {
      objectId: object._objectId!,
      ownProperties: true
    });
    const result = new Map();
    for (const property of response.result) {
      if (!property.enumerable || !property.value)
        continue;
      result.set(property.name, createHandle(object._context, property.value));
    }
    return result;
  }

  async releaseHandle(handle: js.JSHandle): Promise<void> {
    if (!handle._objectId)
      return;
    await releaseObject(this._client, handle._objectId);
  }
}

function rewriteError(error: Error): Protocol.Runtime.evaluateReturnValue {
  if (error.message.includes('Object reference chain is too long'))
    throw new Error('Cannot serialize result: object reference chain is too long.');
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

export function createHandle(context: js.ExecutionContext, remoteObject: Protocol.Runtime.RemoteObject): js.JSHandle {
  if (remoteObject.subtype === 'node') {
    assert(context instanceof dom.FrameExecutionContext);
    return new dom.ElementHandle(context, remoteObject.objectId!);
  }
  return new js.JSHandle(context, remoteObject.subtype || remoteObject.type, renderPreview(remoteObject), remoteObject.objectId, potentiallyUnserializableValue(remoteObject));
}
