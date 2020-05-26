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

import { helper } from '../helper';
import * as js from '../javascript';
import { FFSession } from './ffConnection';
import { Protocol } from './protocol';
import * as debugSupport from '../debug/debugSupport';
import { RemoteObject, parseEvaluationResultValue } from '../remoteObject';

export class FFExecutionContext implements js.ExecutionContextDelegate {
  _session: FFSession;
  _executionContextId: string;

  constructor(session: FFSession, executionContextId: string) {
    this._session = session;
    this._executionContextId = executionContextId;
  }

  async rawEvaluate(expression: string): Promise<RemoteObject> {
    const payload = await this._session.send('Runtime.evaluate', {
      expression: debugSupport.ensureSourceUrl(expression),
      returnByValue: false,
      executionContextId: this._executionContextId,
    }).catch(rewriteError);
    checkException(payload.exceptionDetails);
    return payload.result!;
  }

  async evaluate(context: js.ExecutionContext, returnByValue: boolean, pageFunction: Function | string, ...args: any[]): Promise<any> {
    if (helper.isString(pageFunction)) {
      return this._callOnUtilityScript(context,
          `evaluate`, [
            { value: debugSupport.ensureSourceUrl(pageFunction) },
          ], returnByValue, () => {});
    }
    if (typeof pageFunction !== 'function')
      throw new Error(`Expected to get |string| or |function| as the first argument, but got "${pageFunction}" instead.`);

    const { functionText, values, handles, dispose } = await js.prepareFunctionCall(pageFunction, context, args);

    return this._callOnUtilityScript(context,
        `callFunction`, [
          { value: functionText },
          ...values.map(value => ({ value })),
          ...handles.map(handle => ({ objectId: handle.objectId, value: handle.value })),
        ], returnByValue, dispose);
  }

  private async _callOnUtilityScript(context: js.ExecutionContext, method: string, args: Protocol.Runtime.CallFunctionArgument[], returnByValue: boolean, dispose: () => void) {
    try {
      const utilityScript = await context.utilityScript();
      const payload = await this._session.send('Runtime.callFunction', {
        functionDeclaration: `(utilityScript, ...args) => utilityScript.${method}(...args)` + debugSupport.generateSourceUrl(),
        args: [
          { objectId: utilityScript._objectId, value: undefined },
          { value: returnByValue },
          ...args
        ],
        returnByValue,
        executionContextId: this._executionContextId
      }).catch(rewriteError);
      checkException(payload.exceptionDetails);
      if (returnByValue)
        return parseEvaluationResultValue(payload.result!.value);
      return context.createHandle(payload.result!);
    } finally {
      dispose();
    }
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

  async releaseHandle(handle: js.JSHandle): Promise<void> {
    if (!handle._objectId)
      return;
    await this._session.send('Runtime.disposeObject', {
      executionContextId: this._executionContextId,
      objectId: handle._objectId,
    }).catch(error => {});
  }

  async handleJSONValue<T>(handle: js.JSHandle<T>): Promise<T> {
    if (handle._objectId) {
      return await this._callOnUtilityScript(handle._context,
          `jsonValue`, [
            { objectId: handle._objectId, value: undefined },
          ], true, () => {});
    }
    return handle._value;
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
    error.message += ' Are you passing a nested JSHandle?';
  throw error;
}
