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
  readonly _sources: string[];
  _generation = 0;

  static _instance() {
    if (!selectors)
      selectors = new Selectors();
    return selectors;
  }

  constructor() {
    this._sources = [];
  }

  async register(engineFunction: string | Function, ...args: any[]) {
    const source = helper.evaluationString(engineFunction, ...args);
    this._sources.push(source);
    ++this._generation;
  }

  async _createSelector(name: string, handle: dom.ElementHandle<Element>): Promise<string | undefined> {
    const mainContext = await handle._page.mainFrame()._mainContext();
    return mainContext.evaluate((injected: Injected, target: Element, name: string) => {
      return injected.engines.get(name)!.create(document.documentElement, target);
    }, await mainContext._injected(), handle, name);
  }
}
