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

import type { SerializedValue } from '@isomorphic/utilityScriptSerializers';

// --- This section should match javascript.ts and generated_injected_builtins.js ---

// This runtime guid is replaced by the actual guid at runtime in all generated sources.
const kRuntimeGuid = '$runtime_guid$';
// This flag is replaced by true/false at runtime in all generated sources.
const kUtilityScriptIsUnderTest = false;

// The name of the global playwright binding, referenced in Node.js.
const kPlaywrightBinding = `__playwright__binding__${kRuntimeGuid}`;

// The name of the global property that stores the UtilityScript instance,
// referenced by generated_injected_builtins.js.
const kUtilityScriptGlobalProperty = `__playwright_utility_script__${kRuntimeGuid}`;

export type Builtins = {
  setTimeout: Window['setTimeout'],
  clearTimeout: Window['clearTimeout'],
  setInterval: Window['setInterval'],
  clearInterval: Window['clearInterval'],
  requestAnimationFrame: Window['requestAnimationFrame'],
  cancelAnimationFrame: Window['cancelAnimationFrame'],
  requestIdleCallback: Window['requestIdleCallback'],
  cancelIdleCallback: (id: number) => void,
  performance: Window['performance'],
  // eslint-disable-next-line no-restricted-globals
  eval: typeof window['eval'],
  // eslint-disable-next-line no-restricted-globals
  Intl: typeof window['Intl'],
  // eslint-disable-next-line no-restricted-globals
  Date: typeof window['Date'],
  // eslint-disable-next-line no-restricted-globals
  Map: typeof window['Map'],
  // eslint-disable-next-line no-restricted-globals
  Set: typeof window['Set'],
};

// --- End of the matching section ---

export type BindingPayload = {
  name: string;
  seq: number;
  serializedArgs?: SerializedValue[],
};

type BindingData = {
  callbacks: Map<number, { resolve: (value: any) => void, reject: (error: Error) => void }>;
  lastSeq: number;
  handles: Map<number, any>;
};

export class UtilityScript {
  // eslint-disable-next-line no-restricted-globals
  readonly global: typeof globalThis;
  readonly builtins: Builtins;
  readonly isUnderTest: boolean;

  private _bindings = new Map<string, BindingData>();

  // eslint-disable-next-line no-restricted-globals
  constructor(global: typeof globalThis) {
    this.global = global;
    this.isUnderTest = kUtilityScriptIsUnderTest;
    // UtilityScript is evaluated in every page as an InitScript, and saves builtins
    // from the global object, before the page has a chance to temper with them.
    //
    // Later on, any compiled script replaces global invocations of builtins, e.g. setTimeout,
    // with a version exported by generate_injected_builtins.js. That file tries to
    // get original builtins saved on the instance of UtilityScript, and falls back
    // to the global object just in case something goes wrong with InitScript that creates UtilityScript.
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
      eval: global.eval?.bind(global),
      Intl: global.Intl,
      Date: global.Date,
      Map: global.Map,
      Set: global.Set,
    };
    if (this.isUnderTest)
      (global as any).builtins = this.builtins;
  }

  evaluate(isFunction: boolean | undefined, returnByValue: boolean, expression: string, argCount: number, ...argsAndHandles: any[]) {
    const args = argsAndHandles.slice(0, argCount);
    const handles = argsAndHandles.slice(argCount);
    const parameters = [];
    for (let i = 0; i < args.length; i++)
      parameters[i] = parseEvaluationResultValue(args[i], handles);

    let result = eval(expression);
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

  addBinding(bindingName: string, needsHandle: boolean) {
    const data: BindingData = {
      callbacks: new Map(),
      lastSeq: 0,
      handles: new Map(),
    };
    this._bindings.set(bindingName, data);
    (this.global as any)[bindingName] = (...args: any[]) => {
      if (needsHandle && args.slice(1).some(arg => arg !== undefined))
        throw new Error(`exposeBindingHandle supports a single argument, ${args.length} received`);
      const seq = ++data.lastSeq;
      const promise = new Promise((resolve, reject) => data.callbacks.set(seq, { resolve, reject }));
      let payload: BindingPayload;
      if (needsHandle) {
        data.handles.set(seq, args[0]);
        payload = { name: bindingName, seq };
      } else {
        const serializedArgs = [];
        for (let i = 0; i < args.length; i++) {
          serializedArgs[i] = serializeAsCallArgument(args[i], v => {
            return { fallThrough: v };
          });
        }
        payload = { name: bindingName, seq, serializedArgs };
      }
      (this.global as any)[kPlaywrightBinding](JSON.stringify(payload));
      return promise;
    };
  }

  takeBindingHandle(arg: { name: string, seq: number }) {
    const handles = this._bindings.get(arg.name)!.handles;
    const handle = handles.get(arg.seq);
    handles.delete(arg.seq);
    return handle;
  }

  deliverBindingResult(arg: { name: string, seq: number, result?: any, error?: any }) {
    const callbacks = this._bindings.get(arg.name)!.callbacks;
    if ('error' in arg)
      callbacks.get(arg.seq)!.reject(arg.error);
    else
      callbacks.get(arg.seq)!.resolve(arg.result);
    callbacks.delete(arg.seq);
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

// eslint-disable-next-line no-restricted-globals
export function ensureUtilityScript(global?: typeof globalThis): UtilityScript {
  // eslint-disable-next-line no-restricted-globals
  global = global ?? globalThis;
  let utilityScript: UtilityScript = (global as any)[kUtilityScriptGlobalProperty];
  if (utilityScript)
    return utilityScript;

  utilityScript = new UtilityScript(global);
  Object.defineProperty(global, kUtilityScriptGlobalProperty, { value: utilityScript, configurable: false, enumerable: false, writable: false });
  return utilityScript;
}
