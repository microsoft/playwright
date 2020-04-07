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

type Predicate = () => any;

class Injected {
  isVisible(element: Element): boolean {
    if (!element.ownerDocument || !element.ownerDocument.defaultView)
      return true;
    const style = element.ownerDocument.defaultView.getComputedStyle(element);
    if (!style || style.visibility === 'hidden')
      return false;
    const rect = element.getBoundingClientRect();
    return !!(rect.top || rect.bottom || rect.width || rect.height);
  }

  private _pollMutation(predicate: Predicate, timeout: number): Promise<any> {
    let timedOut = false;
    if (timeout)
      setTimeout(() => timedOut = true, timeout);

    const success = predicate();
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
      const success = predicate();
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

  private _pollRaf(predicate: Predicate, timeout: number): Promise<any> {
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
      const success = predicate();
      if (success)
        fulfill(success);
      else
        requestAnimationFrame(onRaf);
    };

    onRaf();
    return result;
  }

  private _pollInterval(pollInterval: number, predicate: Predicate, timeout: number): Promise<any> {
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
      const success = predicate();
      if (success)
        fulfill(success);
      else
        setTimeout(onTimeout, pollInterval);
    };

    onTimeout();
    return result;
  }

  poll(polling: 'raf' | 'mutation' | number, timeout: number, predicate: Predicate): Promise<any> {
    if (polling === 'raf')
      return this._pollRaf(predicate, timeout);
    if (polling === 'mutation')
      return this._pollMutation(predicate, timeout);
    return this._pollInterval(polling, predicate, timeout);
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
    if (!this.isVisible(element))
      return 'Element is not visible';
    if (element.nodeName.toLowerCase() === 'input') {
      const input = element as HTMLInputElement;
      const type = (input.getAttribute('type') || '').toLowerCase();
      const kDateTypes = new Set(['date', 'time', 'datetime', 'datetime-local']);
      const kTextInputTypes = new Set(['', 'email', 'number', 'password', 'search', 'tel', 'text', 'url']);
      if (!kTextInputTypes.has(type) && !kDateTypes.has(type))
        return 'Cannot fill input of type "' + type + '".';
      if (type === 'number') {
        value = value.trim();
        if (!value || isNaN(Number(value)))
          return 'Cannot type text into input[type=number].';
      }
      if (input.disabled)
        return 'Cannot fill a disabled input.';
      if (input.readOnly)
        return 'Cannot fill a readonly input.';
      if (kDateTypes.has(type)) {
        value = value.trim();
        input.focus();
        input.value = value;
        if (input.value !== value)
          return `Malformed ${type} "${value}"`;
        element.dispatchEvent(new Event('input', { 'bubbles': true }));
        element.dispatchEvent(new Event('change', { 'bubbles': true }));
        return false;  // We have already changed the value, no need to input it.
      }
      input.select();
      input.focus();
      return true;
    }
    if (element.nodeName.toLowerCase() === 'textarea') {
      const textarea = element as HTMLTextAreaElement;
      if (textarea.disabled)
        return 'Cannot fill a disabled textarea.';
      if (textarea.readOnly)
        return 'Cannot fill a readonly textarea.';
      textarea.selectionStart = 0;
      textarea.selectionEnd = textarea.value.length;
      textarea.focus();
      return true;
    }
    if (element.isContentEditable) {
      const range = element.ownerDocument!.createRange();
      range.selectNodeContents(element);
      const selection = element.ownerDocument!.defaultView!.getSelection();
      if (!selection)
        return 'Element belongs to invisible iframe.';
      selection.removeAllRanges();
      selection.addRange(range);
      element.focus();
      return true;
    }
    return 'Element is not an <input>, <textarea> or [contenteditable] element.';
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

  async waitForDisplayedAtStablePosition(node: Node, timeout: number) {
    if (!node.isConnected)
      throw new Error('Element is not attached to the DOM');
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    if (!element)
      throw new Error('Element is not attached to the DOM');

    let lastRect: types.Rect | undefined;
    let counter = 0;
    const result = await this.poll('raf', timeout, () => {
      // First raf happens in the same animation frame as evaluation, so it does not produce
      // any client rect difference compared to synchronous call. We skip the synchronous call
      // and only force layout during actual rafs as a small optimisation.
      if (++counter === 1)
        return false;
      const clientRect = element.getBoundingClientRect();
      const rect = { x: clientRect.top, y: clientRect.left, width: clientRect.width, height: clientRect.height };
      const isDisplayedAndStable = lastRect && rect.x === lastRect.x && rect.y === lastRect.y && rect.width === lastRect.width && rect.height === lastRect.height && rect.width > 0 && rect.height > 0;
      lastRect = rect;
      return isDisplayedAndStable;
    });
    if (!result)
      throw new Error(`waiting for element to be displayed and not moving failed: timeout ${timeout}ms exceeded`);
  }

  async waitForHitTargetAt(node: Node, timeout: number, point: types.Point) {
    let element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    while (element && window.getComputedStyle(element).pointerEvents === 'none')
      element = element.parentElement;
    if (!element)
      throw new Error('Element is not attached to the DOM');
    const result = await this.poll('raf', timeout, () => {
      let hitElement = this._deepElementFromPoint(document, point.x, point.y);
      while (hitElement && hitElement !== element)
        hitElement = this._parentElementOrShadowHost(hitElement);
      return hitElement === element;
    });
    if (!result)
      throw new Error(`waiting for element to receive mouse events failed: timeout ${timeout}ms exceeded`);
  }

  private _parentElementOrShadowHost(element: Element): Element | undefined {
    if (element.parentElement)
      return element.parentElement;
    if (!element.parentNode)
      return;
    if (element.parentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE && (element.parentNode as ShadowRoot).host)
      return (element.parentNode as ShadowRoot).host;
  }

  private _deepElementFromPoint(document: Document, x: number, y: number): Element | undefined {
    let container: Document | ShadowRoot | null = document;
    let element: Element | undefined;
    while (container) {
      const innerElement = container.elementFromPoint(x, y) as Element | undefined;
      if (!innerElement || element === innerElement)
        break;
      element = innerElement;
      container = element.shadowRoot;
    }
    return element;
  }
}

export default Injected;
