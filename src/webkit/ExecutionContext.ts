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

import { TargetSession } from './Connection';
import { Frame } from './FrameManager';
import { helper } from '../helper';
import { valueFromRemoteObject } from './protocolHelper';
import { createJSHandle, JSHandle } from './JSHandle';
import { Protocol } from './protocol';
import * as injectedSource from '../generated/injectedSource';
import * as cssSelectorEngineSource from '../generated/cssSelectorEngineSource';
import * as xpathSelectorEngineSource from '../generated/xpathSelectorEngineSource';
import * as types from '../types';

export const EVALUATION_SCRIPT_URL = '__playwright_evaluation_script__';
const SOURCE_URL_REGEX = /^[\040\t]*\/\/[@#] sourceURL=\s*(\S*?)\s*$/m;

export class ExecutionContext implements types.EvaluationContext<JSHandle> {
  _globalObjectId?: string;
  _session: TargetSession;
  _frame: Frame;
  _contextId: number;
  private _contextDestroyedCallback: any;
  private _executionContextDestroyedPromise: Promise<unknown>;
  private _injectedPromise: Promise<JSHandle> | null = null;

  constructor(client: TargetSession, contextPayload: Protocol.Runtime.ExecutionContextDescription, frame: Frame | null) {
    this._session = client;
    this._frame = frame;
    this._contextId = contextPayload.id;
    this._contextDestroyedCallback = null;
    this._executionContextDestroyedPromise = new Promise((resolve, reject) => {
      this._contextDestroyedCallback = resolve;
    });
  }

  _dispose() {
    this._contextDestroyedCallback();
  }

  frame(): Frame | null {
    return this._frame;
  }

  evaluate<Args extends any[], R>(pageFunction: types.Func<Args, R>, ...args: types.Boxed<Args, JSHandle>): Promise<R> {
    return this._evaluateInternal(true /* returnByValue */, pageFunction, ...args);
  }

  evaluateHandle<Args extends any[]>(pageFunction: types.Func<Args>, ...args: types.Boxed<Args, JSHandle>): Promise<JSHandle> {
    return this._evaluateInternal(false /* returnByValue */, pageFunction, ...args);
  }

  async _evaluateInternal(returnByValue: boolean, pageFunction: Function | string, ...args: any[]): Promise<any> {
    const suffix = `//# sourceURL=${EVALUATION_SCRIPT_URL}`;

    if (helper.isString(pageFunction)) {
      const contextId = this._contextId;
      const expression: string = pageFunction as string;
      const expressionWithSourceUrl = SOURCE_URL_REGEX.test(expression) ? expression : expression + '\n' + suffix;
      return this._session.send('Runtime.evaluate', {
        expression: expressionWithSourceUrl,
        contextId,
        returnByValue: false,
        emulateUserGesture: true
      }).then(response => {
        if (response.result.type === 'object' && response.result.className === 'Promise') {
          const contextDiscarded = this._executionContextDestroyedPromise.then(() => ({
            wasThrown: true,
            result: {
              description: 'Protocol error: Execution context was destroyed, most likely because of a navigation.'
            } as Protocol.Runtime.RemoteObject
          }));
          return Promise.race([
            contextDiscarded,
            this._session.send('Runtime.awaitPromise', {
              promiseObjectId: response.result.objectId,
              returnByValue: false
            })
          ]);
        }
        return response;
      }).then(response => {
        if (response.wasThrown)
          throw new Error('Evaluation failed: ' + response.result.description);
        if (!returnByValue)
          return createJSHandle(this, response.result);
        if (response.result.objectId) {
          const serializeFunction = function() {
            try {
              return JSON.stringify(this);
            } catch (e) {
              if (e instanceof TypeError)
                return void 0;
              throw e;
            }
          };
          return this._session.send('Runtime.callFunctionOn', {
            // Serialize object using standard JSON implementation to correctly pass 'undefined'.
            functionDeclaration: serializeFunction + '\n' + suffix + '\n',
            objectId: response.result.objectId,
            returnByValue
          }).then(serializeResponse => {
            if (serializeResponse.wasThrown)
              throw new Error('Serialization failed: ' + serializeResponse.result.description);
            // This is the case of too long property chain, not serializable to json string.
            if (serializeResponse.result.type === 'undefined')
              return undefined;
            if (serializeResponse.result.type !== 'string')
              throw new Error('Unexpected result of JSON.stringify: ' + JSON.stringify(serializeResponse, null, 2));
            return JSON.parse(serializeResponse.result.value);
          });
        }
        return valueFromRemoteObject(response.result);
      }).catch(rewriteError);
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

    let serializableArgs;
    if (args.some(isUnserializable)) {
      serializableArgs = [];
      const paramStrings = [];
      for (const arg of args) {
        if (isUnserializable(arg)) {
          paramStrings.push(unserializableToString(arg));
        } else {
          paramStrings.push('arguments[' + serializableArgs.length + ']');
          serializableArgs.push(arg);
        }
      }
      functionText = `() => (${functionText})(${paramStrings.join(',')})`;
    } else {
      serializableArgs = args;
    }

    const thisObjectId = await this._contextGlobalObjectId();
    let callFunctionOnPromise;
    try {
      callFunctionOnPromise = this._session.send('Runtime.callFunctionOn', {
        functionDeclaration: functionText + '\n' + suffix + '\n',
        // TODO(yurys): support executionContextId in WebKit
        objectId: thisObjectId,
        arguments: serializableArgs.map(convertArgument.bind(this)),
        returnByValue: false,
        emulateUserGesture: true
      });
    } catch (err) {
      if (err instanceof TypeError && err.message.startsWith('Converting circular structure to JSON'))
        err.message += ' Are you passing a nested JSHandle?';
      throw err;
    }
    return callFunctionOnPromise.then(response => {
      if (response.result.type === 'object' && response.result.className === 'Promise') {
        const contextDiscarded = this._executionContextDestroyedPromise.then(() => ({
          wasThrown: true,
          result: {
            description: 'Protocol error: Execution context was destroyed, most likely because of a navigation.'
          } as Protocol.Runtime.RemoteObject
        }));
        return Promise.race([
          contextDiscarded,
          this._session.send('Runtime.awaitPromise', {
            promiseObjectId: response.result.objectId,
            returnByValue: false
          })
        ]);
      }
      return response;
    }).then(response => {
      if (response.wasThrown)
        throw new Error('Evaluation failed: ' + response.result.description);
      if (!returnByValue)
        return createJSHandle(this, response.result);
      if (response.result.objectId) {
        const serializeFunction = function() {
          try {
            return JSON.stringify(this);
          } catch (e) {
            if (e instanceof TypeError)
              return void 0;
            throw e;
          }
        };
        return this._session.send('Runtime.callFunctionOn', {
          // Serialize object using standard JSON implementation to correctly pass 'undefined'.
          functionDeclaration: serializeFunction + '\n' + suffix + '\n',
          objectId: response.result.objectId,
          returnByValue
        }).then(serializeResponse => {
          if (serializeResponse.wasThrown)
            throw new Error('Serialization failed: ' + serializeResponse.result.description);
          // This is the case of too long property chain, not serializable to json string.
          if (serializeResponse.result.type === 'undefined')
            return undefined;
          if (serializeResponse.result.type !== 'string')
            throw new Error('Unexpected result of JSON.stringify: ' + JSON.stringify(serializeResponse, null, 2));
          return JSON.parse(serializeResponse.result.value);
        });
      }
      return valueFromRemoteObject(response.result);
    }).catch(rewriteError);

    function convertArgument(this: ExecutionContext, arg: JSHandle | any) : Protocol.Runtime.CallArgument{
      const objectHandle = arg && (arg instanceof JSHandle) ? arg : null;
      if (objectHandle) {
        if (objectHandle._context !== this)
          throw new Error('JSHandles can be evaluated only in the context they were created!');
        if (objectHandle._disposed)
          throw new Error('JSHandle is disposed!');
        if (!objectHandle._remoteObject.objectId)
          return { value: valueFromRemoteObject(objectHandle._remoteObject) };
        return { objectId: objectHandle._remoteObject.objectId };
      }
      return { value: arg };
    }

    function unserializableToString(arg) {
      if (Object.is(arg, -0))
        return '-0';
      if (Object.is(arg, Infinity))
        return 'Infinity';
      if (Object.is(arg, -Infinity))
        return '-Infinity';
      if (Object.is(arg, NaN))
        return 'NaN';
      if (arg instanceof JSHandle) {
        const remoteObj = arg._remoteObject;
        if (!remoteObj.objectId)
          return valueFromRemoteObject(remoteObj);
      }
      throw new Error('Unsupported value: ' + arg + ' (' + (typeof arg) + ')');
    }

    function isUnserializable(arg) {
      if (typeof arg === 'bigint')
        return true;
      if (Object.is(arg, -0))
        return true;
      if (Object.is(arg, Infinity))
        return true;
      if (Object.is(arg, -Infinity))
        return true;
      if (Object.is(arg, NaN))
        return true;
      if (arg instanceof JSHandle) {
        const remoteObj = arg._remoteObject;
        if (!remoteObj.objectId)
          return !Object.is(valueFromRemoteObject(remoteObj), remoteObj.value);
      }
      return false;
    }

    /**
     * @param {!Error} error
     * @return {!Protocol.Runtime.evaluateReturnValue}
     */
    function rewriteError(error) {
      if (error.message.includes('Object couldn\'t be returned by value'))
        return {result: {type: 'undefined'}};

      if (error.message.includes('Missing injected script for given'))
        throw new Error('Execution context was destroyed, most likely because of a navigation.');
      throw error;
    }
  }

  async _contextGlobalObjectId() {
    if (!this._globalObjectId) {
      const globalObject = await this._session.send('Runtime.evaluate', { expression: 'this', contextId: this._contextId });
      this._globalObjectId = globalObject.result.objectId;
    }
    return this._globalObjectId;
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
}
