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

import * as dom from './dom';
import Injected from './injected/injected';
import { helper } from './helper';

let selectors: Selectors;

export class Selectors {
  readonly _engines: Map<string, string>;
  _generation = 0;

  static _instance() {
    if (!selectors)
      selectors = new Selectors();
    return selectors;
  }

  constructor() {
    this._engines = new Map();
  }

  async register(name: string, script: string | Function | { path?: string, content?: string }): Promise<void> {
    if (!name.match(/^[a-zA-Z_0-9-]+$/))
      throw new Error('Selector engine name may only contain [a-zA-Z0-9_] characters');
    // Note: keep in sync with Injected class, and also keep 'zs' for future.
    if (['css', 'xpath', 'text', 'id', 'zs', 'data-testid', 'data-test-id', 'data-test'].includes(name))
      throw new Error(`"${name}" is a predefined selector engine`);
    const source = await helper.evaluationScript(script, [], false);
    if (this._engines.has(name))
      throw new Error(`"${name}" selector engine has been already registered`);
    this._engines.set(name, source);
    ++this._generation;
  }

  async _createSelector(name: string, handle: dom.ElementHandle<Element>): Promise<string | undefined> {
    const mainContext = await handle._page.mainFrame()._mainContext();
    return mainContext.evaluate((injected: Injected, target: Element, name: string) => {
      return injected.engines.get(name)!.create(document.documentElement, target);
    }, await mainContext._injected(), handle, name);
  }
}
