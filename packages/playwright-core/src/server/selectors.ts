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

import type * as dom from './dom';
import type * as frames from './frames';
import type * as js from './javascript';
import type * as types from './types';
import type { ParsedSelector } from './isomorphic/selectorParser';
import { allEngineNames, InvalidSelectorError, parseSelector, stringifySelector } from './isomorphic/selectorParser';
import { createGuid } from '../utils';

export type SelectorInfo = {
  parsed: ParsedSelector,
  world: types.World,
  strict: boolean,
};

export class Selectors {
  readonly _builtinEngines: Set<string>;
  readonly _builtinEnginesInMainWorld: Set<string>;
  readonly _engines: Map<string, { source: string, contentScript: boolean }>;
  readonly guid = `selectors@${createGuid()}`;

  constructor() {
    // Note: keep in sync with InjectedScript class.
    this._builtinEngines = new Set([
      'css', 'css:light',
      'xpath', 'xpath:light',
      '_react', '_vue',
      'text', 'text:light',
      'id', 'id:light',
      'data-testid', 'data-testid:light',
      'data-test-id', 'data-test-id:light',
      'data-test', 'data-test:light',
      'nth', 'visible', 'control', 'has',
      'role',
    ]);
    this._builtinEnginesInMainWorld = new Set([
      '_react', '_vue',
    ]);
    this._engines = new Map();
  }

  async register(name: string, source: string, contentScript: boolean = false): Promise<void> {
    if (!name.match(/^[a-zA-Z_0-9-]+$/))
      throw new Error('Selector engine name may only contain [a-zA-Z0-9_] characters');
    // Note: we keep 'zs' for future use.
    if (this._builtinEngines.has(name) || name === 'zs' || name === 'zs:light')
      throw new Error(`"${name}" is a predefined selector engine`);
    if (this._engines.has(name))
      throw new Error(`"${name}" selector engine has been already registered`);
    this._engines.set(name, { source, contentScript });
  }

  unregisterAll() {
    this._engines.clear();
  }

  async query(frame: frames.Frame, info: SelectorInfo, scope?: dom.ElementHandle): Promise<dom.ElementHandle<Element> | null> {
    const context = await frame._context(info.world);
    const injectedScript = await context.injectedScript();
    const handle = await injectedScript.evaluateHandle((injected, { parsed, scope, strict }) => {
      return injected.querySelector(parsed, scope || document, strict);
    }, { parsed: info.parsed, scope, strict: info.strict });
    const elementHandle = handle.asElement() as dom.ElementHandle<Element> | null;
    if (!elementHandle) {
      handle.dispose();
      return null;
    }
    const mainContext = await frame._mainContext();
    return this._adoptIfNeeded(elementHandle, mainContext);
  }

  async _queryArrayInMainWorld(frame: frames.Frame, info: SelectorInfo, scope?: dom.ElementHandle): Promise<js.JSHandle<Element[]>> {
    const context = await frame._mainContext();
    const injectedScript = await context.injectedScript();
    const arrayHandle = await injectedScript.evaluateHandle((injected, { parsed, scope }) => {
      return injected.querySelectorAll(parsed, scope || document);
    }, { parsed: info.parsed, scope });
    return arrayHandle;
  }

  async _queryCount(frame: frames.Frame, info: SelectorInfo, scope?: dom.ElementHandle): Promise<number> {
    const context = await frame._context(info.world);
    const injectedScript = await context.injectedScript();
    return await injectedScript.evaluate((injected, { parsed, scope }) => {
      return injected.querySelectorAll(parsed, scope || document).length;
    }, { parsed: info.parsed, scope });
  }

  async _queryAll(frame: frames.Frame, selector: SelectorInfo, scope?: dom.ElementHandle, adoptToMain?: boolean): Promise<dom.ElementHandle<Element>[]> {
    const info = typeof selector === 'string' ? frame._page.parseSelector(selector) : selector;
    const context = await frame._context(info.world);
    const injectedScript = await context.injectedScript();
    const arrayHandle = await injectedScript.evaluateHandle((injected, { parsed, scope }) => {
      return injected.querySelectorAll(parsed, scope || document);
    }, { parsed: info.parsed, scope });

    const properties = await arrayHandle.getProperties();
    arrayHandle.dispose();

    // Note: adopting elements one by one may be slow. If we encounter the issue here,
    // we might introduce 'useMainContext' option or similar to speed things up.
    const targetContext = adoptToMain ? await frame._mainContext() : context;
    const result: Promise<dom.ElementHandle<Element>>[] = [];
    for (const property of properties.values()) {
      const elementHandle = property.asElement() as dom.ElementHandle<Element>;
      if (elementHandle)
        result.push(this._adoptIfNeeded(elementHandle, targetContext));
      else
        property.dispose();
    }
    return Promise.all(result);
  }

  private async _adoptIfNeeded<T extends Node>(handle: dom.ElementHandle<T>, context: dom.FrameExecutionContext): Promise<dom.ElementHandle<T>> {
    if (handle._context === context)
      return handle;
    const adopted = handle._page._delegate.adoptElementHandle(handle, context);
    handle.dispose();
    return adopted;
  }

  parseSelector(selector: string | ParsedSelector, strict: boolean): SelectorInfo {
    const parsed = typeof selector === 'string' ? parseSelector(selector) : selector;
    let needsMainWorld = false;
    for (const name of allEngineNames(parsed)) {
      const custom = this._engines.get(name);
      if (!custom && !this._builtinEngines.has(name))
        throw new InvalidSelectorError(`Unknown engine "${name}" while parsing selector ${stringifySelector(parsed)}`);
      if (custom && !custom.contentScript)
        needsMainWorld = true;
      if (this._builtinEnginesInMainWorld.has(name))
        needsMainWorld = true;
    }
    return {
      parsed,
      world: needsMainWorld ? 'main' : 'utility',
      strict,
    };
  }
}
