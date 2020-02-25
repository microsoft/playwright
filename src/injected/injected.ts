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
import * as types from '../types';

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

  getElementBorderWidth(node: Node): { left: number; top: number; } {
    if (node.nodeType !== Node.ELEMENT_NODE || !node.ownerDocument || !node.ownerDocument.defaultView)
      return { left: 0, top: 0 };
    const style = node.ownerDocument.defaultView.getComputedStyle(node as Element);
    return { left: parseInt(style.borderLeftWidth || '', 10), top: parseInt(style.borderTopWidth || '', 10) };
  }

  selectOptions(node: Node, optionsToSelect: (Node | types.SelectOption)[]) {
    if (node.nodeName.toLowerCase() !== 'select')
      throw new Error('Element is not a <select> element.');
    const element = node as HTMLSelectElement;

    const options = Array.from(element.options);
    element.value = undefined as any;
    for (let index = 0; index < options.length; index++) {
      const option = options[index];
      option.selected = optionsToSelect.some(optionToSelect => {
        if (optionToSelect instanceof Node)
          return option === optionToSelect;
        let matches = true;
        if (optionToSelect.value !== undefined)
          matches = matches && optionToSelect.value === option.value;
        if (optionToSelect.label !== undefined)
          matches = matches && optionToSelect.label === option.label;
        if (optionToSelect.index !== undefined)
          matches = matches && optionToSelect.index === index;
        return matches;
      });
      if (option.selected && !element.multiple)
        break;
    }
    element.dispatchEvent(new Event('input', { 'bubbles': true }));
    element.dispatchEvent(new Event('change', { 'bubbles': true }));
    return options.filter(option => option.selected).map(option => option.value);
  }

  fill(node: Node, value: string) {
    if (node.nodeType !== Node.ELEMENT_NODE)
      return 'Node is not of type HTMLElement';
    const element = node as HTMLElement;
    if (!element.isConnected)
      return 'Element is not attached to the DOM';
    if (!element.ownerDocument || !element.ownerDocument.defaultView)
      return 'Element does not belong to a window';

    const style = element.ownerDocument.defaultView.getComputedStyle(element);
    if (!style || style.visibility === 'hidden')
      return 'Element is hidden';
    if (!element.offsetParent && element.tagName !== 'BODY')
      return 'Element is not visible';
    if (element.nodeName.toLowerCase() === 'input') {
      const input = element as HTMLInputElement;
      const type = input.getAttribute('type') || '';
      const kTextInputTypes = new Set(['', 'email', 'number', 'password', 'search', 'tel', 'text', 'url']);
      if (!kTextInputTypes.has(type.toLowerCase()))
        return 'Cannot fill input of type "' + type + '".';
      if (type.toLowerCase() === 'number') {
        value = value.trim();
        if (!value || isNaN(Number(value)))
          return 'Cannot type text into input[type=number].';
      }
      if (input.disabled)
        return 'Cannot fill a disabled input.';
      if (input.readOnly)
        return 'Cannot fill a readonly input.';
      input.select();
      input.focus();
    } else if (element.nodeName.toLowerCase() === 'textarea') {
      const textarea = element as HTMLTextAreaElement;
      if (textarea.disabled)
        return 'Cannot fill a disabled textarea.';
      if (textarea.readOnly)
        return 'Cannot fill a readonly textarea.';
      textarea.selectionStart = 0;
      textarea.selectionEnd = textarea.value.length;
      textarea.focus();
    } else if (element.isContentEditable) {
      const range = element.ownerDocument.createRange();
      range.selectNodeContents(element);
      const selection = element.ownerDocument.defaultView.getSelection();
      if (!selection)
        return 'Element belongs to invisible iframe.';
      selection.removeAllRanges();
      selection.addRange(range);
      element.focus();
    } else {
      return 'Element is not an <input>, <textarea> or [contenteditable] element.';
    }
    return false;
  }

  isCheckboxChecked(node: Node) {
    if (node.nodeType !== Node.ELEMENT_NODE)
      throw new Error('Not a checkbox or radio button');

    let element: Element | undefined = node as Element;
    if (element.getAttribute('role') === 'checkbox')
      return element.getAttribute('aria-checked') === 'true';

    if (element.nodeName === 'LABEL') {
      const forId = element.getAttribute('for');
      if (forId && element.ownerDocument)
        element = element.ownerDocument.querySelector(`input[id="${forId}"]`) || undefined;
      else
        element = element.querySelector('input[type=checkbox],input[type=radio]') || undefined;
    }
    if (element && element.nodeName === 'INPUT') {
      const type = element.getAttribute('type');
      if (type && (type.toLowerCase() === 'checkbox' || type.toLowerCase() === 'radio'))
        return (element as HTMLInputElement).checked;
    }
    throw new Error('Not a checkbox');
  }

  waitForStablePosition(node: Node, timeout: number) {
    if (!node.isConnected)
      throw new Error('Element is not attached to the DOM');
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    if (!element)
      throw new Error('Element is not attached to the DOM');

    let lastRect: types.Rect | undefined;
    let counter = 0;
    return this.poll('raf', undefined, timeout, () => {
      // First raf happens in the same animation frame as evaluation, so it does not produce
      // any client rect difference compared to synchronous call. We skip the synchronous call
      // and only force layout during actual rafs as a small optimisation.
      if (++counter === 1)
        return false;
      const clientRect = element.getBoundingClientRect();
      const rect = { x: clientRect.top, y: clientRect.left, width: clientRect.width, height: clientRect.height };
      const isStable = lastRect && rect.x === lastRect.x && rect.y === lastRect.y && rect.width === lastRect.width && rect.height === lastRect.height;
      lastRect = rect;
      return isStable;
    });
  }

  waitForHitTargetAt(node: Node, timeout: number, point: types.Point) {
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    if (!element)
      throw new Error('Element is not attached to the DOM');
    return this.poll('raf', undefined, timeout, () => {
      let hitElement = this.utils.deepElementFromPoint(document, point.x, point.y);
      while (hitElement && hitElement !== element)
        hitElement = this.utils.parentElementOrShadowHost(hitElement);
      return hitElement === element;
    });
  }
}

export default Injected;
