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

import { CRSession } from './crConnection';
import { getExceptionMessage, releaseObject } from './crProtocolHelper';
import { Protocol } from './protocol';
import * as js from '../javascript';
import * as sourceMap from '../../utils/sourceMap';
import { rewriteErrorMessage } from '../../utils/stackTrace';
import { parseEvaluationResultValue } from '../common/utilityScriptSerializers';

export class CRExecutionContext implements js.ExecutionContextDelegate {
  _client: CRSession;
  _contextId: number;

  constructor(client: CRSession, contextPayload: Protocol.Runtime.ExecutionContextDescription) {
    this._client = client;
    this._contextId = contextPayload.id;
  }

  async rawEvaluate(expression: string): Promise<string> {
    const { exceptionDetails, result: remoteObject } = await this._client.send('Runtime.evaluate', {
      expression: sourceMap.ensureSourceUrl(expression),
      contextId: this._contextId,
    }).catch(rewriteError);
    if (exceptionDetails)
      throw new Error('Evaluation failed: ' + getExceptionMessage(exceptionDetails));
    return remoteObject.objectId!;
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
      throw new Error('Evaluation failed: ' + getExceptionMessage(exceptionDetails));
    return returnByValue ? parseEvaluationResultValue(remoteObject.value) : utilityScript._context.createHandle(remoteObject);
  }

  async getProperties(handle: js.JSHandle): Promise<Map<string, js.JSHandle>> {
    const objectId = handle._objectId;
    if (!objectId)
      return new Map();
    const response = await this._client.send('Runtime.getProperties', {
      objectId,
      ownProperties: true
    });
    const result = new Map();
    for (const property of response.result) {
      if (!property.enumerable || !property.value)
        continue;
      result.set(property.name, handle._context.createHandle(property.value));
    }
    return result;
  }

  createHandle(context: js.ExecutionContext, remoteObject: Protocol.Runtime.RemoteObject): js.JSHandle {
    return new js.JSHandle(context, remoteObject.subtype || remoteObject.type, remoteObject.objectId, potentiallyUnserializableValue(remoteObject));
  }

  async releaseHandle(handle: js.JSHandle): Promise<void> {
    if (!handle._objectId)
      return;
    await releaseObject(this._client, handle._objectId);
  }
}

function rewriteError(error: Error): Protocol.Runtime.evaluateReturnValue {
  if (error.message.includes('Object reference chain is too long'))
    return {result: {type: 'undefined'}};
  if (error.message.includes('Object couldn\'t be returned by value'))
    return {result: {type: 'undefined'}};

  if (error.message.endsWith('Cannot find context with specified id') || error.message.endsWith('Inspected target navigated or closed') || error.message.endsWith('Execution context was destroyed.'))
    throw new Error('Execution context was destroyed, most likely because of a navigation.');
  if (error instanceof TypeError && error.message.startsWith('Converting circular structure to JSON'))
    rewriteErrorMessage(error, error.message + ' Are you passing a nested JSHandle?');
  throw error;
}

function potentiallyUnserializableValue(remoteObject: Protocol.Runtime.RemoteObject): any {
  const value = remoteObject.value;
  const unserializableValue = remoteObject.unserializableValue;
  return unserializableValue ? js.parseUnserializableValue(unserializableValue) : value;
}
