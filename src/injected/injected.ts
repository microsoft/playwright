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

import { SelectorEngine, SelectorRoot } from './selectorEngine';
import { Utils } from './utils';
import { CSSEngine } from './cssSelectorEngine';
import { XPathEngine } from './xpathSelectorEngine';
import { TextEngine } from './textSelectorEngine';

function createAttributeEngine(attribute: string): SelectorEngine {
  const engine: SelectorEngine = {
    name: attribute,

    create(root: SelectorRoot, target: Element): string | undefined {
      const value = target.getAttribute(attribute);
      if (!value)
        return;
      if (root.querySelector(`[${attribute}=${value}]`) === target)
        return value;
    },

    query(root: SelectorRoot, selector: string): Element | undefined {
      return root.querySelector(`[${attribute}=${selector}]`) || undefined;
    },

    queryAll(root: SelectorRoot, selector: string): Element[] {
      return Array.from(root.querySelectorAll(`[${attribute}=${selector}]`));
    }
  };
  return engine;
}

type ParsedSelector = { engine: SelectorEngine, selector: string }[];
type Predicate = (element: Element | undefined) => any;

class Injected {
  readonly utils: Utils;
  readonly engines: Map<string, SelectorEngine>;

  constructor(customEngines: SelectorEngine[]) {
    const defaultEngines = [
      CSSEngine,
      XPathEngine,
      TextEngine,
      createAttributeEngine('id'),
      createAttributeEngine('data-testid'),
      createAttributeEngine('data-test-id'),
      createAttributeEngine('data-test'),
    ];
    this.utils = new Utils();
    this.engines = new Map();
    for (const engine of [...defaultEngines, ...customEngines])
      this.engines.set(engine.name, engine);
  }

  querySelector(selector: string, root: Node): Element | undefined {
    const parsed = this._parseSelector(selector);
    if (!(root as any)['querySelector'])
      throw new Error('Node is not queryable.');
    let element = root as SelectorRoot;
    for (const { engine, selector } of parsed) {
      const next = engine.query((element as Element).shadowRoot || element, selector);
      if (!next)
        return;
      element = next;
    }
    return element as Element;
  }

  querySelectorAll(selector: string, root: Node): Element[] {
    const parsed = this._parseSelector(selector);
    if (!(root as any)['querySelectorAll'])
      throw new Error('Node is not queryable.');
    let set = new Set<SelectorRoot>([ root as SelectorRoot ]);
    for (const { engine, selector } of parsed) {
      const newSet = new Set<Element>();
      for (const prev of set) {
        for (const next of engine.queryAll((prev as Element).shadowRoot || prev, selector)) {
          if (newSet.has(next))
            continue;
          newSet.add(next);
        }
      }
      set = newSet;
    }
    return Array.from(set) as Element[];
  }

  private _parseSelector(selector: string): ParsedSelector {
    let index = 0;
    let quote: string | undefined;
    let start = 0;
    const result: ParsedSelector = [];
    const append = () => {
      const part = selector.substring(start, index);
      const eqIndex = part.indexOf('=');
      if (eqIndex === -1)
        throw new Error(`Cannot parse selector ${selector}`);
      const name = part.substring(0, eqIndex).trim();
      const body = part.substring(eqIndex + 1);
      const engine = this.engines.get(name.toLowerCase());
      if (!engine)
        throw new Error(`Unknown engine ${name} while parsing selector ${selector}`);
      result.push({ engine, selector: body });
    };
    while (index < selector.length) {
      const c = selector[index];
      if (c === '\\' && index + 1 < selector.length) {
        index += 2;
      } else if (c === quote) {
        quote = undefined;
        index++;
      } else if (!quote && c === '>' && selector[index + 1] === '>') {
        append();
        index += 2;
        start = index;
      } else {
        index++;
      }
    }
    append();
    return result;
  }

  isVisible(element: Element): boolean {
    if (!element.ownerDocument || !element.ownerDocument.defaultView)
      return true;
    const style = element.ownerDocument.defaultView.getComputedStyle(element);
    if (!style || style.visibility === 'hidden')
      return false;
    const rect = element.getBoundingClientRect();
    return !!(rect.top || rect.bottom || rect.width || rect.height);
  }

  private _pollMutation(selector: string | undefined, predicate: Predicate, timeout: number): Promise<any> {
    let timedOut = false;
    if (timeout)
      setTimeout(() => timedOut = true, timeout);

    const element = selector === undefined ? undefined : this.querySelector(selector, document);
    const success = predicate(element);
    if (success)
      return Promise.resolve(success);

    let fulfill: (result?: any) => void;
    const result = new Promise(x => fulfill = x);
    const observer = new MutationObserver(() => {
      if (timedOut) {
        observer.disconnect();
        fulfill();
        return;
      }
      const element = selector === undefined ? undefined : this.querySelector(selector, document);
      const success = predicate(element);
      if (success) {
        observer.disconnect();
        fulfill(success);
      }
    });
    observer.observe(document, {
      childList: true,
      subtree: true,
      attributes: true
    });
    return result;
  }

  private _pollRaf(selector: string | undefined, predicate: Predicate, timeout: number): Promise<any> {
    let timedOut = false;
    if (timeout)
      setTimeout(() => timedOut = true, timeout);

    let fulfill: (result?: any) => void;
    const result = new Promise(x => fulfill = x);

    const onRaf = () => {
      if (timedOut) {
        fulfill();
        return;
      }
      const element = selector === undefined ? undefined : this.querySelector(selector, document);
      const success = predicate(element);
      if (success)
        fulfill(success);
      else
        requestAnimationFrame(onRaf);
    };

    onRaf();
    return result;
  }

  private _pollInterval(selector: string | undefined, pollInterval: number, predicate: Predicate, timeout: number): Promise<any> {
    let timedOut = false;
    if (timeout)
      setTimeout(() => timedOut = true, timeout);

    let fulfill: (result?: any) => void;
    const result = new Promise(x => fulfill = x);
    const onTimeout = () => {
      if (timedOut) {
        fulfill();
        return;
      }
      const element = selector === undefined ? undefined : this.querySelector(selector, document);
      const success = predicate(element);
      if (success)
        fulfill(success);
      else
        setTimeout(onTimeout, pollInterval);
    };

    onTimeout();
    return result;
  }

  poll(polling: 'raf' | 'mutation' | number, selector: string | undefined, timeout: number, predicate: Predicate): Promise<any> {
    if (polling === 'raf')
      return this._pollRaf(selector, predicate, timeout);
    if (polling === 'mutation')
      return this._pollMutation(selector, predicate, timeout);
    return this._pollInterval(selector, polling, predicate, timeout);
  }
}

export default Injected;
