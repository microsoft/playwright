/**
 * Copyright (c) Microsoft Corporation.
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

import { parseEvaluationResultValue } from '@isomorphic/utilityScriptSerializers';
import * as js from '../../javascript';
import * as dom from '../../dom';

import type { WDSession } from './wdConnection';

let lastHandleId = 0;

// Metadata we attach to a JSHandle so it can be re-materialized inside a
// WebDriver `execute` call. A handle is one of:
//  - `source`:     a self-contained IIFE we inline to reconstruct the object
//                  (UtilityScript, InjectedScript) — stateless, rebuilt per call.
//  - `registryId`: a key into the page-side `window.__pwHandles` map, which is
//                  how we emulate live remote handles over a protocol that has
//                  none. Valid until the document navigates.
type WDHandleMeta = {
  source?: string;
  registryId?: string;
};

// Lazily creates the page-side live-handle registry. Idempotent; included at the
// top of every script so `window.__pwHandles.get(...)` is always available.
const kRegistryInit = `window.__pwHandles = window.__pwHandles || new Map(); window.__pwHandleSeq = window.__pwHandleSeq || 0;`;

/**
 * ExecutionContextDelegate over classic W3C WebDriver `execute/async`.
 *
 * WebDriver has no persistent object handles, so we emulate them with a page-side
 * registry (`window.__pwHandles`): when an evaluate returns a non-serializable
 * value (a DOM node, the InjectedScript hit-target interceptor, …) we stash it in
 * the registry and return its key. Passing that handle back inlines a
 * `window.__pwHandles.get(key)` lookup, so the live object is recovered in-page.
 * UtilityScript/InjectedScript are instead inlined from source each call.
 */
export class WDExecutionContext implements js.ExecutionContextDelegate {
  private readonly _session: WDSession;
  private readonly _handleMeta = new Map<string, WDHandleMeta>();

  constructor(session: WDSession) {
    this._session = session;
  }

  async rawEvaluateJSON(expression: string): Promise<any> {
    const result = await this._session.executeAsync(wrapAsync(`return (${expression});`));
    return unwrap(result);
  }

  async rawEvaluateHandle(context: js.ExecutionContext, expression: string): Promise<js.JSHandle> {
    // The only callers are `_utilityScript()` / `injectedScript()`, which pass a
    // self-contained IIFE source. Stash the source on a placeholder handle and
    // inline it on every evaluate that references it.
    const objectId = `wd-source-${++lastHandleId}`;
    this._handleMeta.set(objectId, { source: expression });
    return new js.JSHandle(context, 'object', undefined, objectId);
  }

  async evaluateWithArguments(expression: string, returnByValue: boolean, utilityScript: js.JSHandle<any>, values: any[], handles: js.JSHandle[]): Promise<any> {
    // `expression` is `(utilityScript, ...args) => utilityScript.evaluate(...args)`,
    // `values` is `[isFunction, returnByValue, userExpr, argCount, ...serializedArgs]`,
    // and `handles` are JSHandle arguments referenced from `serializedArgs`.
    const utilityExpr = this._inlineHandle(utilityScript);
    const handleExprs = handles.map(handle => this._inlineHandle(handle));
    const call = `(${expression})(${utilityExpr}, ...__pwValues, ...[${handleExprs.join(', ')}])`;

    let body: string;
    if (returnByValue) {
      // UtilityScript already returns a JSON-serializable structure.
      body = `const __pwValues = __pwArgs[0]; return ${call};`;
    } else {
      // Recover a live handle. The InjectedScript polling protocol returns
      // `{ result: <Promise>, abort }` and expects the resolved `.result` to be
      // read later; resolve it here (in-page, where the Promise is live) before
      // storing, so it survives. Primitives are returned inline.
      body = `
        const __pwValues = __pwArgs[0];
        let __pwR = await ${call};
        if (__pwR && typeof __pwR === 'object' && typeof __pwR.abort === 'function' && __pwR.result && typeof __pwR.result.then === 'function')
          __pwR = { result: await __pwR.result, abort: __pwR.abort };
        if (__pwR === null || (typeof __pwR !== 'object' && typeof __pwR !== 'function'))
          return { __pwPrimitive: true, value: __pwR };
        const __pwId = 'h' + (++window.__pwHandleSeq);
        window.__pwHandles.set(__pwId, __pwR);
        return { __pwHandleId: __pwId, isElement: (typeof Node !== 'undefined' && __pwR instanceof Node) };
      `;
    }

    const result = await this._session.executeAsync(wrapAsync(body), [values]);
    const value = unwrap(result);
    if (returnByValue)
      return parseEvaluationResultValue(value);
    return this._createHandleFromResult(utilityScript._context, value);
  }

  async getProperties(object: js.JSHandle): Promise<Map<string, js.JSHandle>> {
    const meta = object._objectId ? this._handleMeta.get(object._objectId) : undefined;
    if (!meta?.registryId)
      return new Map();
    const expression = `() => {
      const obj = window.__pwHandles.get(${JSON.stringify(meta.registryId)});
      const out = [];
      if (obj) {
        for (const name of Object.keys(obj)) {
          const id = 'h' + (++window.__pwHandleSeq);
          window.__pwHandles.set(id, obj[name]);
          out.push({ name, id });
        }
      }
      return out;
    }`;
    const entries = await this._session.executeAsync(wrapAsync(`${kRegistryInit} return (${expression})();`));
    const list = unwrap(entries) as { name: string, id: string }[];
    const result = new Map<string, js.JSHandle>();
    for (const { name, id } of list) {
      const objectId = `wd-obj-${id}`;
      this._handleMeta.set(objectId, { registryId: id });
      result.set(name, new js.JSHandle(object._context, 'object', undefined, objectId));
    }
    return result;
  }

  async releaseHandle(handle: js.JSHandle): Promise<void> {
    if (!handle._objectId)
      return;
    const meta = this._handleMeta.get(handle._objectId);
    this._handleMeta.delete(handle._objectId);
    if (meta?.registryId)
      await this._session.executeAsync(wrapAsync(`window.__pwHandles && window.__pwHandles.delete(${JSON.stringify(meta.registryId)}); return undefined;`)).catch(() => {});
  }

  shouldPrependErrorPrefix(): boolean {
    return false;
  }

  // Builds the JS expression that recovers a handle inside a WebDriver script.
  private _inlineHandle(handle: js.JSHandle): string {
    const meta = handle._objectId ? this._handleMeta.get(handle._objectId) : undefined;
    if (meta?.source)
      return `(${meta.source.trim().replace(/;+\s*$/, '')})`;
    if (meta?.registryId)
      return `window.__pwHandles.get(${JSON.stringify(meta.registryId)})`;
    throw new js.JavaScriptErrorInEvaluate('Cannot pass an unknown JSHandle to a WebDriver evaluate.');
  }

  private _createHandleFromResult(context: js.ExecutionContext, descriptor: any): js.JSHandle {
    if (descriptor && descriptor.__pwPrimitive)
      return new js.JSHandle(context, typeof descriptor.value, undefined, undefined, descriptor.value);
    const registryId = descriptor?.__pwHandleId as string | undefined;
    const objectId = `wd-obj-${registryId}`;
    this._handleMeta.set(objectId, { registryId });
    if (descriptor?.isElement && context instanceof dom.FrameExecutionContext)
      return new dom.ElementHandle(context, objectId);
    return new js.JSHandle(context, 'object', undefined, objectId);
  }
}

// Wraps a body into an `execute/async` script: the last argument is the
// completion callback. Lets the page function return a promise and surfaces
// thrown errors as `{ __pwError }` rather than hanging.
function wrapAsync(body: string): string {
  return `
    const __pwArgs = arguments;
    const __pwDone = __pwArgs[__pwArgs.length - 1];
    ${kRegistryInit}
    (async () => {
      ${body}
    })().then(value => __pwDone({ value }), error => __pwDone({ __pwError: (error && error.stack) || String(error) }));
  `;
}

function unwrap(result: any): any {
  if (result && typeof result === 'object' && '__pwError' in result)
    throw new js.JavaScriptErrorInEvaluate(String(result.__pwError));
  return result ? result.value : undefined;
}
