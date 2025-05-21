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

import { parseEvaluationResultValue, serializeAsCallArgument } from '@isomorphic/utilityScriptSerializers';

// Keep in sync with eslint.config.mjs
export type Builtins = {
  setTimeout: Window['setTimeout'],
  clearTimeout: Window['clearTimeout'],
  setInterval: Window['setInterval'],
  clearInterval: Window['clearInterval'],
  requestAnimationFrame: Window['requestAnimationFrame'],
  cancelAnimationFrame: Window['cancelAnimationFrame'],
  requestIdleCallback: Window['requestIdleCallback'],
  cancelIdleCallback: Window['cancelIdleCallback'],
  performance: Window['performance'],
  // eslint-disable-next-line no-restricted-globals
  Intl: typeof window['Intl'],
  // eslint-disable-next-line no-restricted-globals
  Date: typeof window['Date'],
};

export class UtilityScript {
  // eslint-disable-next-line no-restricted-globals
  readonly global: typeof globalThis;
  // Builtins protect injected code from clock emulation.
  readonly builtins: Builtins;
  readonly isUnderTest: boolean;

  // eslint-disable-next-line no-restricted-globals
  constructor(global: typeof globalThis, isUnderTest: boolean) {
    this.global = global;
    this.isUnderTest = isUnderTest;
    if ((global as any).__pwClock) {
      this.builtins = (global as any).__pwClock.builtins;
    } else {
      this.builtins = {
        setTimeout: global.setTimeout?.bind(global),
        clearTimeout: global.clearTimeout?.bind(global),
        setInterval: global.setInterval?.bind(global),
        clearInterval: global.clearInterval?.bind(global),
        requestAnimationFrame: global.requestAnimationFrame?.bind(global),
        cancelAnimationFrame: global.cancelAnimationFrame?.bind(global),
        requestIdleCallback: global.requestIdleCallback?.bind(global),
        cancelIdleCallback: global.cancelIdleCallback?.bind(global),
        performance: global.performance,
        Intl: global.Intl,
        Date: global.Date,
      } satisfies Builtins;
    }
    if (this.isUnderTest)
      (global as any).builtins = this.builtins;
  }

  evaluate(isFunction: boolean | undefined, returnByValue: boolean, expression: string, argCount: number, ...argsAndHandles: any[]) {
    const args = argsAndHandles.slice(0, argCount);
    const handles = argsAndHandles.slice(argCount);
    const parameters = [];
    for (let i = 0; i < args.length; i++)
      parameters[i] = parseEvaluationResultValue(args[i], handles);

    let result = this.global.eval(expression);
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
    return serializeAsCallArgument(value, (value: any) => ({ fallThrough: value }));
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
