/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ensureBuiltins } from '../isomorphic/builtins';
import { source } from '../isomorphic/utilityScriptSerializers';

import type { Builtins } from '../isomorphic/builtins';

export class UtilityScript {
  constructor(isUnderTest: boolean) {
    // eslint-disable-next-line no-restricted-globals
    this.builtins = ensureBuiltins(globalThis);
    if (isUnderTest) {
      // eslint-disable-next-line no-restricted-globals
      (globalThis as any).builtins = this.builtins;
    }
    const result = source(this.builtins);
    this.serializeAsCallArgument = result.serializeAsCallArgument;
    this.parseEvaluationResultValue = result.parseEvaluationResultValue;
  }

  readonly builtins: Builtins;
  readonly serializeAsCallArgument;
  readonly parseEvaluationResultValue;

  evaluate(isFunction: boolean | undefined, returnByValue: boolean, expression: string, argCount: number, ...argsAndHandles: any[]) {
    const args = argsAndHandles.slice(0, argCount);
    const handles = argsAndHandles.slice(argCount);
    const parameters = [];
    for (let i = 0; i < args.length; i++)
      parameters[i] = this.parseEvaluationResultValue(args[i], handles);

    let result = this.builtins.eval(expression);
    if (isFunction === true) {
      result = result(...parameters);
    } else if (isFunction === false) {
      result = result;
    } else {
      // auto detect.
      if (typeof result === 'function')
        result = result(...parameters);
    }
    return returnByValue ? this._promiseAwareJsonValueNoThrow(result) : result;
  }

  jsonValue(returnByValue: true, value: any) {
    // Special handling of undefined to work-around multi-step returnByValue handling in WebKit.
    if (value === undefined)
      return undefined;
    return this.serializeAsCallArgument(value, (value: any) => ({ fallThrough: value }));
  }

  private _promiseAwareJsonValueNoThrow(value: any) {
    const safeJson = (value: any) => {
      try {
        return this.jsonValue(true, value);
      } catch (e) {
        return undefined;
      }
    };

    if (value && typeof value === 'object' && typeof value.then === 'function') {
      return (async () => {
        // By using async function we ensure that return value is a native Promise,
        // and not some overridden Promise in the page.
        // This makes Firefox and WebKit debugging protocols recognize it as a Promise,
        // properly await and return the value.
        const promiseValue = await value;
        return safeJson(promiseValue);
      })();
    }
    return safeJson(value);
  }
}
