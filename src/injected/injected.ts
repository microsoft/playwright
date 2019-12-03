// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { SelectorEngine, SelectorRoot } from './selectorEngine';
import { Utils } from './utils';

type ParsedSelector = { engine: SelectorEngine, selector: string }[];

class Injected {
  readonly utils: Utils;
  readonly engines: Map<string, SelectorEngine>;

  constructor(engines: SelectorEngine[]) {
    this.utils = new Utils();
    this.engines = new Map();
    for (const engine of engines)
      this.engines.set(engine.name, engine);
  }

  querySelector(selector: string, root: SelectorRoot): Element | undefined {
    const parsed = this._parseSelector(selector);
    let element = root;
    for (const { engine, selector } of parsed) {
      const next = engine.query((element as Element).shadowRoot || element, selector);
      if (!next)
        return;
      element = next;
    }
    return element as Element;
  }

  querySelectorAll(selector: string, root: SelectorRoot): Element[] {
    const parsed = this._parseSelector(selector);
    let set = new Set<SelectorRoot>([ root ]);
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

  pollMutation(predicate: Function, timeout: number, ...args: any[]): Promise<any> {
    let timedOut = false;
    if (timeout)
      setTimeout(() => timedOut = true, timeout);

    const success = predicate.apply(null, args);
    if (success)
      return Promise.resolve(success);

    let fulfill;
    const result = new Promise(x => fulfill = x);
    const observer = new MutationObserver(mutations => {
      if (timedOut) {
        observer.disconnect();
        fulfill();
      }
      const success = predicate.apply(null, args);
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

  pollRaf(predicate: Function, timeout: number, ...args: any[]): Promise<any> {
    let timedOut = false;
    if (timeout)
      setTimeout(() => timedOut = true, timeout);

    let fulfill;
    const result = new Promise(x => fulfill = x);
    onRaf();
    return result;

    function onRaf() {
      if (timedOut) {
        fulfill();
        return;
      }
      const success = predicate.apply(null, args);
      if (success)
        fulfill(success);
      else
        requestAnimationFrame(onRaf);
    }
  }

  pollInterval(pollInterval: number, predicate: Function, timeout: number, ...args: any[]): Promise<any> {
    let timedOut = false;
    if (timeout)
      setTimeout(() => timedOut = true, timeout);

    let fulfill;
    const result = new Promise(x => fulfill = x);
    onTimeout();
    return result;

    function onTimeout() {
      if (timedOut) {
        fulfill();
        return;
      }
      const success = predicate.apply(null, args);
      if (success)
        fulfill(success);
      else
        setTimeout(onTimeout, pollInterval);
    }
  }
}

export default Injected;
