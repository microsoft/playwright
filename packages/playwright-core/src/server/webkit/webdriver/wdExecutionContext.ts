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

// Metadata we attach to a JSHandle so it can be re-materialized inside a
// WebDriver `execute` call. `registryId` is a key into the page-side
// `window.__pwHandles` map, which is how we emulate live remote handles over a
// protocol that has none. Valid until the document navigates.
type WDHandleMeta = {
  registryId: string;
};

// Lazily creates the page-side live-handle registry. Idempotent; included at the
// top of every script so `window.__pwHandles.get(...)` is always available.
const kRegistryInit = `window.__pwHandles = window.__pwHandles || new Map(); window.__pwHandleSeq = window.__pwHandleSeq || 0;`;

// Page event captured as a side-channel of every `execute` (see kBridgeInit).
export type WDPageEvent = { type: string, text: string };

// Idempotently installs a console hook that buffers messages on window, so we
// can surface them (and the lifecycle-clearing tag setContent logs) over a
// protocol that pushes no console events. Lives on `window`/`console`, both of
// which survive `document.open()`.
const kBridgeInit = `
  if (!window.__pwBridge) {
    window.__pwBridge = true;
    window.__pwEvents = [];
    for (const __pwType of ['log', 'debug', 'info', 'warning', 'error']) {
      const __pwMethod = __pwType === 'warning' ? 'warn' : __pwType;
      const __pwOrig = window.console[__pwMethod];
      window.console[__pwMethod] = function(...args) {
        try {
          window.__pwEvents.push({ type: __pwType, text: args.map(a => { try { return typeof a === 'string' ? a : JSON.stringify(a); } catch (e) { return String(a); } }).join(' ') });
        } catch (e) {}
        if (__pwOrig) return __pwOrig.apply(window.console, args);
      };
    }
  }
`;

/**
 * ExecutionContextDelegate over classic W3C WebDriver `execute/async`.
 *
 * WebDriver has no persistent object handles, so we emulate them with a page-side
 * registry (`window.__pwHandles`): when an evaluate returns a non-serializable
 * value (a DOM node, UtilityScript/InjectedScript, the hit-target interceptor, …)
 * we stash it in the registry and return its key. Passing that handle back inlines
 * a `window.__pwHandles.get(key)` lookup, so the live object is recovered in-page.
 * Crucially this caches UtilityScript/InjectedScript as per-document singletons
 * rather than rebuilding them (and re-installing their global event listeners) on
 * every evaluate.
 */
export class WDExecutionContext implements js.ExecutionContextDelegate {
  private readonly _session: WDSession;
  private readonly _onPageEvents: (events: WDPageEvent[], readyState: string) => void;
  private readonly _handleMeta = new Map<string, WDHandleMeta>();

  constructor(session: WDSession, onPageEvents: (events: WDPageEvent[], readyState: string) => void) {
    this._session = session;
    this._onPageEvents = onPageEvents;
  }

  // Runs a script, then delivers any buffered console messages and the document
  // readyState so the page can synthesize console + lifecycle events.
  private async _execute(script: string, args: any[] = []): Promise<any> {
    const result = await this._session.executeAsync(script, args);
    if (result && typeof result === 'object') {
      this._onPageEvents(result.events || [], result.readyState || '');
      if ('__pwError' in result)
        throw new js.JavaScriptErrorInEvaluate(String(result.__pwError));
      return result.value;
    }
    return undefined;
  }

  async rawEvaluateJSON(expression: string): Promise<any> {
    return await this._execute(wrapAsync(`return (${expression});`));
  }

  async rawEvaluateHandle(context: js.ExecutionContext, expression: string): Promise<js.JSHandle> {
    // The callers are `_utilityScript()` / `injectedScript()`, passing a
    // self-contained IIFE source. Evaluate it once and keep the resulting object
    // live in the page registry, so it is reused (not rebuilt) on every evaluate.
    const expr = expression.trim().replace(/;+\s*$/, '');
    const value = await this._execute(wrapAsync(`
      const __pwR = (${expr});
      const __pwId = 'h' + (++window.__pwHandleSeq);
      window.__pwHandles.set(__pwId, __pwR);
      return { __pwHandleId: __pwId, isElement: false };
    `));
    return this._createHandleFromResult(context, value);
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

    const value = await this._execute(wrapAsync(body), [values]);
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
    const list = await this._execute(wrapAsync(`return (${expression})();`)) as { name: string, id: string }[];
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
      await this._execute(wrapAsync(`window.__pwHandles && window.__pwHandles.delete(${JSON.stringify(meta.registryId)}); return undefined;`)).catch(() => {});
  }

  shouldPrependErrorPrefix(): boolean {
    return false;
  }

  // Builds the JS expression that recovers a handle inside a WebDriver script.
  private _inlineHandle(handle: js.JSHandle): string {
    const meta = handle._objectId ? this._handleMeta.get(handle._objectId) : undefined;
    if (meta?.registryId)
      return `window.__pwHandles.get(${JSON.stringify(meta.registryId)})`;
    throw new js.JavaScriptErrorInEvaluate('Cannot pass an unknown JSHandle to a WebDriver evaluate.');
  }

  private _createHandleFromResult(context: js.ExecutionContext, descriptor: any): js.JSHandle {
    if (descriptor && descriptor.__pwPrimitive)
      return new js.JSHandle(context, typeof descriptor.value, undefined, undefined, descriptor.value);
    const registryId = descriptor?.__pwHandleId as string;
    const objectId = `wd-obj-${registryId}`;
    this._handleMeta.set(objectId, { registryId });
    if (descriptor?.isElement && context instanceof dom.FrameExecutionContext)
      return new dom.ElementHandle(context, objectId);
    return new js.JSHandle(context, 'object', undefined, objectId);
  }
}

// Wraps a body into an `execute/async` script: the last argument is the
// completion callback. Lets the page function return a promise and surfaces
// thrown errors as `{ __pwError }` rather than hanging. Every result also
// carries buffered console events and the document readyState, so the page can
// synthesize console + lifecycle events that WebDriver never pushes.
function wrapAsync(body: string): string {
  return `
    const __pwArgs = arguments;
    const __pwDone = __pwArgs[__pwArgs.length - 1];
    ${kRegistryInit}
    ${kBridgeInit}
    const __pwDrain = () => { const e = window.__pwEvents || []; window.__pwEvents = []; return { events: e, readyState: document.readyState }; };
    (async () => {
      ${body}
    })().then(
      value => __pwDone({ value, ...__pwDrain() }),
      error => __pwDone({ __pwError: (error && error.stack) || String(error), ...__pwDrain() }));
  `;
}
