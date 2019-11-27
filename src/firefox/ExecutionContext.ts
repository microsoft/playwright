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

import {helper} from '../helper';
import { JSHandle, createHandle, ElementHandle } from './JSHandle';
import { Response } from './NetworkManager';
import * as js from '../javascript';
import { JugglerSession } from './Connection';

export type ExecutionContext = js.ExecutionContext<JSHandle, ElementHandle, Response>;

export class ExecutionContextDelegate implements js.ExecutionContextDelegate<JSHandle, ElementHandle, Response> {
  _session: JugglerSession;
  _executionContextId: string;

  constructor(session: JugglerSession, executionContextId: string) {
    this._session = session;
    this._executionContextId = executionContextId;
  }

  async evaluate(context: ExecutionContext, returnByValue: boolean, pageFunction: Function | string, ...args: any[]): Promise<any> {
    if (returnByValue) {
      try {
        const handle = await this.evaluate(context, false /* returnByValue */, pageFunction, ...args as any);
        const result = await handle.jsonValue();
        await handle.dispose();
        return result;
      } catch (e) {
        if (e.message.includes('cyclic object value') || e.message.includes('Object is not serializable'))
          return undefined;
        throw e;
      }
    }

    if (helper.isString(pageFunction)) {
      const payload = await this._session.send('Runtime.evaluate', {
        expression: pageFunction.trim(),
        executionContextId: this._executionContextId,
      }).catch(rewriteError);
      return createHandle(context, payload.result, payload.exceptionDetails);
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
    const protocolArgs = args.map(arg => {
      if (arg instanceof JSHandle) {
        if (arg._context !== context)
          throw new Error('JSHandles can be evaluated only in the context they were created!');
        if (arg._disposed)
          throw new Error('JSHandle is disposed!');
        return arg._protocolValue;
      }
      if (Object.is(arg, Infinity))
        return {unserializableValue: 'Infinity'};
      if (Object.is(arg, -Infinity))
        return {unserializableValue: '-Infinity'};
      if (Object.is(arg, -0))
        return {unserializableValue: '-0'};
      if (Object.is(arg, NaN))
        return {unserializableValue: 'NaN'};
      return {value: arg};
    });
    let callFunctionPromise;
    try {
      callFunctionPromise = this._session.send('Runtime.callFunction', {
        functionDeclaration: functionText,
        args: protocolArgs,
        executionContextId: this._executionContextId
      });
    } catch (err) {
      if (err instanceof TypeError && err.message.startsWith('Converting circular structure to JSON'))
        err.message += ' Are you passing a nested JSHandle?';
      throw err;
    }
    const payload = await callFunctionPromise.catch(rewriteError);
    return createHandle(context, payload.result, payload.exceptionDetails);

    function rewriteError(error) {
      if (error.message.includes('Failed to find execution context with id'))
        throw new Error('Execution context was destroyed, most likely because of a navigation.');
      throw error;
    }
  }
}
