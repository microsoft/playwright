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

import { assert } from '../../utils/isomorphic/assert';
import { rewriteErrorMessage } from '../../utils/isomorphic/stackTrace';
import { parseEvaluationResultValue } from '../../utils/isomorphic/utilityScriptSerializers';
import * as js from '../javascript';
import * as dom from '../dom';
import { isSessionClosedError } from '../protocolError';

import type { FFSession } from './ffConnection';
import type { Protocol } from './protocol';

export class FFExecutionContext implements js.ExecutionContextDelegate {
  _session: FFSession;
  _executionContextId: string;

  constructor(session: FFSession, executionContextId: string) {
    this._session = session;
    this._executionContextId = executionContextId;
  }

  async rawEvaluateJSON(expression: string): Promise<any> {
    const payload = await this._session.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      executionContextId: this._executionContextId,
    }).catch(rewriteError);
    checkException(payload.exceptionDetails);
    return payload.result!.value;
  }

  async rawEvaluateHandle(context: js.ExecutionContext, expression: string): Promise<js.JSHandle> {
    const payload = await this._session.send('Runtime.evaluate', {
      expression,
      returnByValue: false,
      executionContextId: this._executionContextId,
    }).catch(rewriteError);
    checkException(payload.exceptionDetails);
    return createHandle(context, payload.result!);
  }

  async evaluateWithArguments(expression: string, returnByValue: boolean, utilityScript: js.JSHandle, values: any[], handles: js.JSHandle[]): Promise<any> {
    const payload = await this._session.send('Runtime.callFunction', {
      functionDeclaration: expression,
      args: [
        { objectId: utilityScript._objectId, value: undefined },
        ...values.map(value => ({ value })),
        ...handles.map(handle => ({ objectId: handle._objectId!, value: undefined })),
      ],
      returnByValue,
      executionContextId: this._executionContextId
    }).catch(rewriteError);
    checkException(payload.exceptionDetails);
    if (returnByValue)
      return parseEvaluationResultValue(payload.result!.value);
    return createHandle(utilityScript._context, payload.result!);
  }

  async getProperties(object: js.JSHandle): Promise<Map<string, js.JSHandle>> {
    const response = await this._session.send('Runtime.getObjectProperties', {
      executionContextId: this._executionContextId,
      objectId: object._objectId!,
    });
    const result = new Map();
    for (const property of response.properties)
      result.set(property.name, createHandle(object._context, property.value));
    return result;
  }

  async releaseHandle(handle: js.JSHandle): Promise<void> {
    if (!handle._objectId)
      return;
    await this._session.send('Runtime.disposeObject', {
      executionContextId: this._executionContextId,
      objectId: handle._objectId,
    });
  }
}

function checkException(exceptionDetails?: Protocol.Runtime.ExceptionDetails) {
  if (!exceptionDetails)
    return;
  if (exceptionDetails.value)
    throw new js.JavaScriptErrorInEvaluate(JSON.stringify(exceptionDetails.value));
  else
    throw new js.JavaScriptErrorInEvaluate(exceptionDetails.text + (exceptionDetails.stack ? '\n' + exceptionDetails.stack : ''));
}

function rewriteError(error: Error): (Protocol.Runtime.evaluateReturnValue | Protocol.Runtime.callFunctionReturnValue) {
  if (error.message.includes('cyclic object value') || error.message.includes('Object is not serializable'))
    return { result: { type: 'undefined', value: undefined } };
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
  if (object.unserializableValue)
    return String(object.unserializableValue);
  if (object.type === 'symbol')
    return 'Symbol()';
  if (object.subtype === 'regexp')
    return 'RegExp';
  if (object.subtype === 'weakmap')
    return 'WeakMap';
  if (object.subtype === 'weakset')
    return 'WeakSet';
  if (object.subtype)
    return object.subtype[0].toUpperCase() + object.subtype.slice(1);
  if ('value' in object)
    return String(object.value);
}

export function createHandle(context: js.ExecutionContext, remoteObject: Protocol.Runtime.RemoteObject): js.JSHandle {
  if (remoteObject.subtype === 'node') {
    assert(context instanceof dom.FrameExecutionContext);
    return new dom.ElementHandle(context, remoteObject.objectId!);
  }
  return new js.JSHandle(context, remoteObject.subtype || remoteObject.type || '', renderPreview(remoteObject), remoteObject.objectId, potentiallyUnserializableValue(remoteObject));
}
