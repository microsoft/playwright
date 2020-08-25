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

import * as js from '../javascript';
import { FFSession } from './ffConnection';
import { Protocol } from './protocol';
import * as sourceMap from '../../utils/sourceMap';
import { rewriteErrorMessage } from '../../utils/stackTrace';
import { parseEvaluationResultValue } from '../common/utilityScriptSerializers';

export class FFExecutionContext implements js.ExecutionContextDelegate {
  _session: FFSession;
  _executionContextId: string;

  constructor(session: FFSession, executionContextId: string) {
    this._session = session;
    this._executionContextId = executionContextId;
  }

  async rawEvaluate(expression: string): Promise<string> {
    const payload = await this._session.send('Runtime.evaluate', {
      expression: sourceMap.ensureSourceUrl(expression),
      returnByValue: false,
      executionContextId: this._executionContextId,
    }).catch(rewriteError);
    checkException(payload.exceptionDetails);
    return payload.result!.objectId!;
  }

  async evaluateWithArguments(expression: string, returnByValue: boolean, utilityScript: js.JSHandle<any>, values: any[], objectIds: string[]): Promise<any> {
    const payload = await this._session.send('Runtime.callFunction', {
      functionDeclaration: expression,
      args: [
        { objectId: utilityScript._objectId, value: undefined },
        ...values.map(value => ({ value })),
        ...objectIds.map(objectId => ({ objectId, value: undefined })),
      ],
      returnByValue,
      executionContextId: this._executionContextId
    }).catch(rewriteError);
    checkException(payload.exceptionDetails);
    if (returnByValue)
      return parseEvaluationResultValue(payload.result!.value);
    return utilityScript._context.createHandle(payload.result!);
  }

  async getProperties(handle: js.JSHandle): Promise<Map<string, js.JSHandle>> {
    const objectId = handle._objectId;
    if (!objectId)
      return new Map();
    const response = await this._session.send('Runtime.getObjectProperties', {
      executionContextId: this._executionContextId,
      objectId,
    });
    const result = new Map();
    for (const property of response.properties)
      result.set(property.name, handle._context.createHandle(property.value));
    return result;
  }

  createHandle(context: js.ExecutionContext, remoteObject: Protocol.Runtime.RemoteObject): js.JSHandle {
    return new js.JSHandle(context, remoteObject.subtype || remoteObject.type || '', remoteObject.objectId, potentiallyUnserializableValue(remoteObject));
  }

  async releaseHandle(handle: js.JSHandle): Promise<void> {
    if (!handle._objectId)
      return;
    await this._session.send('Runtime.disposeObject', {
      executionContextId: this._executionContextId,
      objectId: handle._objectId,
    }).catch(error => {});
  }
}

function checkException(exceptionDetails?: Protocol.Runtime.ExceptionDetails) {
  if (!exceptionDetails)
    return;
  if (exceptionDetails.value)
    throw new Error('Evaluation failed: ' + JSON.stringify(exceptionDetails.value));
  else
    throw new Error('Evaluation failed: ' + exceptionDetails.text + '\n' + exceptionDetails.stack);
}

function rewriteError(error: Error): (Protocol.Runtime.evaluateReturnValue | Protocol.Runtime.callFunctionReturnValue) {
  if (error.message.includes('cyclic object value') || error.message.includes('Object is not serializable'))
    return {result: {type: 'undefined', value: undefined}};
  if (error.message.includes('Failed to find execution context with id') || error.message.includes('Execution context was destroyed!'))
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
