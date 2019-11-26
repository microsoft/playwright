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

import { CDPSession } from './Connection';
import { Frame } from './Frame';
import { assert, helper } from '../helper';
import { valueFromRemoteObject, getExceptionMessage } from './protocolHelper';
import { createJSHandle, ElementHandle, JSHandle } from './JSHandle';
import { Protocol } from './protocol';
import * as injectedSource from '../generated/injectedSource';
import * as cssSelectorEngineSource from '../generated/cssSelectorEngineSource';
import * as xpathSelectorEngineSource from '../generated/xpathSelectorEngineSource';
import * as types from '../types';

export const EVALUATION_SCRIPT_URL = '__playwright_evaluation_script__';
const SOURCE_URL_REGEX = /^[\040\t]*\/\/[@#] sourceURL=\s*(\S*?)\s*$/m;

export class ExecutionContext implements types.EvaluationContext<JSHandle> {
  _client: CDPSession;
  private _frame: Frame;
  private _injectedPromise: Promise<JSHandle> | null = null;
  private _documentPromise: Promise<ElementHandle> | null = null;
  private _contextId: number;

  constructor(client: CDPSession, contextPayload: Protocol.Runtime.ExecutionContextDescription, frame: Frame | null) {
    this._client = client;
    this._frame = frame;
    this._contextId = contextPayload.id;
  }

  frame(): Frame | null {
    return this._frame;
  }

  evaluate: types.Evaluate<JSHandle> = (pageFunction, ...args) => {
    return this._evaluateInternal(true /* returnByValue */, pageFunction, ...args);
  }

  evaluateHandle: types.EvaluateHandle<JSHandle> = (pageFunction, ...args) => {
    return this._evaluateInternal(false /* returnByValue */, pageFunction, ...args);
  }

  async _evaluateInternal(returnByValue: boolean, pageFunction: Function | string, ...args: any[]): Promise<any> {
    const suffix = `//# sourceURL=${EVALUATION_SCRIPT_URL}`;

    if (helper.isString(pageFunction)) {
      const contextId = this._contextId;
      const expression: string = pageFunction as string;
      const expressionWithSourceUrl = SOURCE_URL_REGEX.test(expression) ? expression : expression + '\n' + suffix;
      const {exceptionDetails, result: remoteObject} = await this._client.send('Runtime.evaluate', {
        expression: expressionWithSourceUrl,
        contextId,
        returnByValue,
        awaitPromise: true,
        userGesture: true
      }).catch(rewriteError);
      if (exceptionDetails)
        throw new Error('Evaluation failed: ' + getExceptionMessage(exceptionDetails));
      return returnByValue ? valueFromRemoteObject(remoteObject) : createJSHandle(this, remoteObject);
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
    let callFunctionOnPromise;
    try {
      callFunctionOnPromise = this._client.send('Runtime.callFunctionOn', {
        functionDeclaration: functionText + '\n' + suffix + '\n',
        executionContextId: this._contextId,
        arguments: args.map(convertArgument.bind(this)),
        returnByValue,
        awaitPromise: true,
        userGesture: true
      });
    } catch (err) {
      if (err instanceof TypeError && err.message.startsWith('Converting circular structure to JSON'))
        err.message += ' Are you passing a nested JSHandle?';
      throw err;
    }
    const { exceptionDetails, result: remoteObject } = await callFunctionOnPromise.catch(rewriteError);
    if (exceptionDetails)
      throw new Error('Evaluation failed: ' + getExceptionMessage(exceptionDetails));
    return returnByValue ? valueFromRemoteObject(remoteObject) : createJSHandle(this, remoteObject);

    function convertArgument(arg: any): any {
      if (typeof arg === 'bigint') // eslint-disable-line valid-typeof
        return { unserializableValue: `${arg.toString()}n` };
      if (Object.is(arg, -0))
        return { unserializableValue: '-0' };
      if (Object.is(arg, Infinity))
        return { unserializableValue: 'Infinity' };
      if (Object.is(arg, -Infinity))
        return { unserializableValue: '-Infinity' };
      if (Object.is(arg, NaN))
        return { unserializableValue: 'NaN' };
      const objectHandle = arg && (arg instanceof JSHandle) ? arg : null;
      if (objectHandle) {
        if (objectHandle._context !== this)
          throw new Error('JSHandles can be evaluated only in the context they were created!');
        if (objectHandle._disposed)
          throw new Error('JSHandle is disposed!');
        if (objectHandle._remoteObject.unserializableValue)
          return { unserializableValue: objectHandle._remoteObject.unserializableValue };
        if (!objectHandle._remoteObject.objectId)
          return { value: objectHandle._remoteObject.value };
        return { objectId: objectHandle._remoteObject.objectId };
      }
      return { value: arg };
    }

    function rewriteError(error: Error): Protocol.Runtime.evaluateReturnValue {
      if (error.message.includes('Object reference chain is too long'))
        return {result: {type: 'undefined'}};
      if (error.message.includes('Object couldn\'t be returned by value'))
        return {result: {type: 'undefined'}};

      if (error.message.endsWith('Cannot find context with specified id') || error.message.endsWith('Inspected target navigated or closed'))
        throw new Error('Execution context was destroyed, most likely because of a navigation.');
      throw error;
    }
  }

  async _adoptBackendNodeId(backendNodeId: Protocol.DOM.BackendNodeId) {
    const {object} = await this._client.send('DOM.resolveNode', {
      backendNodeId,
      executionContextId: this._contextId,
    });
    return createJSHandle(this, object) as ElementHandle;
  }

  async _adoptElementHandle(elementHandle: ElementHandle): Promise<ElementHandle> {
    assert(elementHandle.executionContext() !== this, 'Cannot adopt handle that already belongs to this execution context');
    assert(this._frame, 'Cannot adopt handle without a Frame');
    const nodeInfo = await this._client.send('DOM.describeNode', {
      objectId: elementHandle._remoteObject.objectId,
    });
    return this._adoptBackendNodeId(nodeInfo.node.backendNodeId);
  }

  _injected(): Promise<JSHandle> {
    if (!this._injectedPromise) {
      const engineSources = [cssSelectorEngineSource.source, xpathSelectorEngineSource.source];
      const source = `
        new (${injectedSource.source})([
          ${engineSources.join(',\n')}
        ])
      `;
      this._injectedPromise = this.evaluateHandle(source);
    }
    return this._injectedPromise;
  }

  _document(): Promise<ElementHandle> {
    if (!this._documentPromise)
      this._documentPromise = this.evaluateHandle('document').then(handle => handle.asElement()!);
    return this._documentPromise;
  }
}
