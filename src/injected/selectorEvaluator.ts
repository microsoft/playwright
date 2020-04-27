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

import * as types from '../types';
import { createAttributeEngine } from './attributeSelectorEngine';
import { createCSSEngine } from './cssSelectorEngine';
import { Injected } from './injected';
import { SelectorEngine, SelectorRoot } from './selectorEngine';
import { createTextSelector } from './textSelectorEngine';
import { XPathEngine } from './xpathSelectorEngine';

class SelectorEvaluator {
  readonly engines: Map<string, SelectorEngine>;
  readonly injected: Injected;

  constructor(customEngines: { name: string, engine: SelectorEngine}[]) {
    this.injected = new Injected();
    this.engines = new Map();
    // Note: keep predefined names in sync with Selectors class.
    this.engines.set('css', createCSSEngine(true));
    this.engines.set('css:light', createCSSEngine(false));
    this.engines.set('xpath', XPathEngine);
    this.engines.set('xpath:light', XPathEngine);
    this.engines.set('text', createTextSelector(true));
    this.engines.set('text:light', createTextSelector(false));
    this.engines.set('id', createAttributeEngine('id', true));
    this.engines.set('id:light', createAttributeEngine('id', false));
    this.engines.set('data-testid', createAttributeEngine('data-testid', true));
    this.engines.set('data-testid:light', createAttributeEngine('data-testid', false));
    this.engines.set('data-test-id', createAttributeEngine('data-test-id', true));
    this.engines.set('data-test-id:light', createAttributeEngine('data-test-id', false));
    this.engines.set('data-test', createAttributeEngine('data-test', true));
    this.engines.set('data-test:light', createAttributeEngine('data-test', false));
    for (const {name, engine} of customEngines)
      this.engines.set(name, engine);
  }

  querySelector(selector: types.ParsedSelector, root: Node): Element | undefined {
    if (!(root as any)['querySelector'])
      throw new Error('Node is not queryable.');
    return this._querySelectorRecursively(root as SelectorRoot, selector, 0);
  }

  private _querySelectorRecursively(root: SelectorRoot, selector: types.ParsedSelector, index: number): Element | undefined {
    const current = selector.parts[index];
    if (index === selector.parts.length - 1)
      return this.engines.get(current.name)!.query(root, current.body);
    const all = this.engines.get(current.name)!.queryAll(root, current.body);
    for (const next of all) {
      const result = this._querySelectorRecursively(next, selector, index + 1);
      if (result)
        return selector.capture === index ? next : result;
    }
  }

  querySelectorAll(selector: types.ParsedSelector, root: Node): Element[] {
    if (!(root as any)['querySelectorAll'])
      throw new Error('Node is not queryable.');
    const capture = selector.capture === undefined ? selector.parts.length - 1 : selector.capture;
    // Query all elements up to the capture.
    const partsToQuerAll = selector.parts.slice(0, capture + 1);
    // Check they have a descendant matching everything after the capture.
    const partsToCheckOne = selector.parts.slice(capture + 1);
    let set = new Set<SelectorRoot>([ root as SelectorRoot ]);
    for (const { name, body } of partsToQuerAll) {
      const newSet = new Set<Element>();
      for (const prev of set) {
        for (const next of this.engines.get(name)!.queryAll(prev, body)) {
          if (newSet.has(next))
            continue;
          newSet.add(next);
        }
      }
      set = newSet;
    }
    const candidates = Array.from(set) as Element[];
    if (!partsToCheckOne.length)
      return candidates;
    const partial = { parts: partsToCheckOne };
    return candidates.filter(e => !!this._querySelectorRecursively(e, partial, 0));
  }
}

export default SelectorEvaluator;
