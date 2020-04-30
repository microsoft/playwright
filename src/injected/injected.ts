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

type Predicate<T> = () => T;
export type InjectedResult<T = undefined> =
  (T extends undefined ? { status: 'success', value?: T} : { status: 'success', value: T }) |
  { status: 'notconnected' } |
  { status: 'timeout' } |
  { status: 'error', error: string };

export class Injected {
  isVisible(element: Element): boolean {
    // Note: this logic should be similar to waitForDisplayedAtStablePosition() to avoid surprises.
    if (!element.ownerDocument || !element.ownerDocument.defaultView)
      return true;
    const style = element.ownerDocument.defaultView.getComputedStyle(element);
    if (!style || style.visibility === 'hidden')
      return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  private _pollRaf<T>(predicate: Predicate<T>, timeout: number): Promise<T | undefined> {
    let timedOut = false;
    if (timeout)
      setTimeout(() => timedOut = true, timeout);

    let fulfill: (result?: any) => void;
    const result = new Promise<T | undefined>(x => fulfill = x);

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

  private _pollInterval<T>(pollInterval: number, predicate: Predicate<T>, timeout: number): Promise<T | undefined> {
    let timedOut = false;
    if (timeout)
      setTimeout(() => timedOut = true, timeout);

    let fulfill: (result?: any) => void;
    const result = new Promise<T | undefined>(x => fulfill = x);
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

  poll<T>(polling: 'raf' | number, timeout: number, predicate: Predicate<T>): Promise<T | undefined> {
    if (polling === 'raf')
      return this._pollRaf(predicate, timeout);
    return this._pollInterval(polling, predicate, timeout);
  }

  getElementBorderWidth(node: Node): { left: number; top: number; } {
    if (node.nodeType !== Node.ELEMENT_NODE || !node.ownerDocument || !node.ownerDocument.defaultView)
      return { left: 0, top: 0 };
    const style = node.ownerDocument.defaultView.getComputedStyle(node as Element);
    return { left: parseInt(style.borderLeftWidth || '', 10), top: parseInt(style.borderTopWidth || '', 10) };
  }

  selectOptions(node: Node, optionsToSelect: (Node | types.SelectOption)[]): InjectedResult<string[]> {
    if (node.nodeName.toLowerCase() !== 'select')
      return { status: 'error', error: 'Element is not a <select> element.' };
    if (!node.isConnected)
      return { status: 'notconnected' };
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
    return { status: 'success', value: options.filter(option => option.selected).map(option => option.value) };
  }

  fill(node: Node, value: string): InjectedResult<boolean> {
    if (node.nodeType !== Node.ELEMENT_NODE)
      return { status: 'error', error: 'Node is not of type HTMLElement' };
    const element = node as HTMLElement;
    if (!element.isConnected)
      return { status: 'notconnected' };
    if (!this.isVisible(element))
      return { status: 'error', error: 'Element is not visible' };
    if (element.nodeName.toLowerCase() === 'input') {
      const input = element as HTMLInputElement;
      const type = (input.getAttribute('type') || '').toLowerCase();
      const kDateTypes = new Set(['date', 'time', 'datetime', 'datetime-local']);
      const kTextInputTypes = new Set(['', 'email', 'number', 'password', 'search', 'tel', 'text', 'url']);
      if (!kTextInputTypes.has(type) && !kDateTypes.has(type))
        return { status: 'error', error: 'Cannot fill input of type "' + type + '".' };
      if (type === 'number') {
        value = value.trim();
        if (!value || isNaN(Number(value)))
          return { status: 'error', error: 'Cannot type text into input[type=number].' };
      }
      if (input.disabled)
        return { status: 'error', error: 'Cannot fill a disabled input.' };
      if (input.readOnly)
        return { status: 'error', error: 'Cannot fill a readonly input.' };
      if (kDateTypes.has(type)) {
        value = value.trim();
        input.focus();
        input.value = value;
        if (input.value !== value)
          return { status: 'error', error: `Malformed ${type} "${value}"` };
        element.dispatchEvent(new Event('input', { 'bubbles': true }));
        element.dispatchEvent(new Event('change', { 'bubbles': true }));
        return { status: 'success', value: false };  // We have already changed the value, no need to input it.
      }
    } else if (element.nodeName.toLowerCase() === 'textarea') {
      const textarea = element as HTMLTextAreaElement;
      if (textarea.disabled)
        return { status: 'error', error: 'Cannot fill a disabled textarea.' };
      if (textarea.readOnly)
        return { status: 'error', error: 'Cannot fill a readonly textarea.' };
    } else if (!element.isContentEditable) {
      return { status: 'error', error: 'Element is not an <input>, <textarea> or [contenteditable] element.' };
    }
    const result = this.selectText(node);
    if (result.status === 'success')
      return { status: 'success', value: true };  // Still need to input the value.
    return result;
  }

  selectText(node: Node): InjectedResult {
    if (node.nodeType !== Node.ELEMENT_NODE)
      return { status: 'error', error: 'Node is not of type HTMLElement' };
    if (!node.isConnected)
      return { status: 'notconnected' };
    const element = node as HTMLElement;
    if (!this.isVisible(element))
      return { status: 'error', error: 'Element is not visible' };
    if (element.nodeName.toLowerCase() === 'input') {
      const input = element as HTMLInputElement;
      input.select();
      input.focus();
      return { status: 'success' };
    }
    if (element.nodeName.toLowerCase() === 'textarea') {
      const textarea = element as HTMLTextAreaElement;
      textarea.selectionStart = 0;
      textarea.selectionEnd = textarea.value.length;
      textarea.focus();
      return { status: 'success' };
    }
    const range = element.ownerDocument!.createRange();
    range.selectNodeContents(element);
    const selection = element.ownerDocument!.defaultView!.getSelection();
    if (!selection)
      return { status: 'error', error: 'Element belongs to invisible iframe.' };
    selection.removeAllRanges();
    selection.addRange(range);
    element.focus();
    return { status: 'success' };
  }

  focusNode(node: Node): InjectedResult {
    if (!node.isConnected)
      return { status: 'notconnected' };
    if (!(node as any)['focus'])
      return { status: 'error', error: 'Node is not an HTML or SVG element.' };
    (node as HTMLElement | SVGElement).focus();
    return { status: 'success' };
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

  async setInputFiles(node: Node, payloads: types.FileTransferPayload[]) {
    if (node.nodeType !== Node.ELEMENT_NODE)
      return 'Node is not of type HTMLElement';
    const element: Element | undefined = node as Element;
    if (element.nodeName !== 'INPUT')
      return 'Not an <input> element';
    const input = element as HTMLInputElement;
    const type = (input.getAttribute('type') || '').toLowerCase();
    if (type !== 'file')
      return 'Not an input[type=file] element';

    const files = await Promise.all(payloads.map(async file => {
      const result = await fetch(`data:${file.type};base64,${file.data}`);
      return new File([await result.blob()], file.name, {type: file.type});
    }));
    const dt = new DataTransfer();
    for (const file of files)
      dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('input', { 'bubbles': true }));
    input.dispatchEvent(new Event('change', { 'bubbles': true }));
  }

  async waitForDisplayedAtStablePosition(node: Node, timeout: number): Promise<InjectedResult> {
    if (!node.isConnected)
      return { status: 'notconnected' };
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    if (!element)
      return { status: 'notconnected' };

    let lastRect: types.Rect | undefined;
    let counter = 0;
    const result = await this.poll('raf', timeout, (): 'notconnected' | boolean => {
      // First raf happens in the same animation frame as evaluation, so it does not produce
      // any client rect difference compared to synchronous call. We skip the synchronous call
      // and only force layout during actual rafs as a small optimisation.
      if (++counter === 1)
        return false;
      if (!node.isConnected)
        return 'notconnected';
      // Note: this logic should be similar to isVisible() to avoid surprises.
      const clientRect = element.getBoundingClientRect();
      const rect = { x: clientRect.top, y: clientRect.left, width: clientRect.width, height: clientRect.height };
      let isDisplayedAndStable = lastRect && rect.x === lastRect.x && rect.y === lastRect.y && rect.width === lastRect.width && rect.height === lastRect.height && rect.width > 0 && rect.height > 0;
      const style = element.ownerDocument && element.ownerDocument.defaultView ? element.ownerDocument.defaultView.getComputedStyle(element) : undefined;
      isDisplayedAndStable = isDisplayedAndStable && (!!style && style.visibility !== 'hidden');
      lastRect = rect;
      return !!isDisplayedAndStable;
    });
    return { status: result === 'notconnected' ? 'notconnected' : (result ? 'success' : 'timeout') };
  }

  checkHitTargetAt(node: Node, point: types.Point): InjectedResult<boolean> {
    let element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    while (element && window.getComputedStyle(element).pointerEvents === 'none')
      element = element.parentElement;
    if (!element || !element.isConnected)
      return { status: 'notconnected' };
    let hitElement = this._deepElementFromPoint(document, point.x, point.y);
    while (hitElement && hitElement !== element)
      hitElement = this._parentElementOrShadowHost(hitElement);
    return { status: 'success', value: hitElement === element };
  }

  dispatchEvent(node: Node, type: string, eventInit: Object) {
    let event;
    eventInit = { bubbles: true, cancelable: true, composed: true, ...eventInit };
    switch (eventType.get(type)) {
      case 'mouse': event = new MouseEvent(type, eventInit); break;
      case 'keyboard': event = new KeyboardEvent(type, eventInit); break;
      case 'touch': event = new TouchEvent(type, eventInit); break;
      case 'pointer': event = new PointerEvent(type, eventInit); break;
      case 'focus': event = new FocusEvent(type, eventInit); break;
      case 'drag': event = new DragEvent(type, eventInit); break;
      default: event = new Event(type, eventInit); break;
    }
    node.dispatchEvent(event);
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

const eventType = new Map<string, 'mouse'|'keyboard'|'touch'|'pointer'|'focus'|'drag'>([
  ['auxclick', 'mouse'],
  ['click', 'mouse'],
  ['dblclick', 'mouse'],
  ['mousedown','mouse'],
  ['mouseeenter', 'mouse'],
  ['mouseleave', 'mouse'],
  ['mousemove', 'mouse'],
  ['mouseout', 'mouse'],
  ['mouseover', 'mouse'],
  ['mouseup', 'mouse'],
  ['mouseleave', 'mouse'],
  ['mousewheel', 'mouse'],

  ['keydown', 'keyboard'],
  ['keyup', 'keyboard'],
  ['keypress', 'keyboard'],
  ['textInput', 'keyboard'],

  ['touchstart', 'touch'],
  ['touchmove', 'touch'],
  ['touchend', 'touch'],
  ['touchcancel', 'touch'],

  ['pointerover', 'pointer'],
  ['pointerout', 'pointer'],
  ['pointerenter', 'pointer'],
  ['pointerleave', 'pointer'],
  ['pointerdown', 'pointer'],
  ['pointerup', 'pointer'],
  ['pointermove', 'pointer'],
  ['pointercancel', 'pointer'],
  ['gotpointercapture', 'pointer'],
  ['lostpointercapture', 'pointer'],

  ['focus', 'focus'],
  ['blur', 'focus'],

  ['drag', 'drag'],
  ['dragstart', 'drag'],
  ['dragend', 'drag'],
  ['dragover', 'drag'],
  ['dragenter', 'drag'],
  ['dragleave', 'drag'],
  ['dragexit', 'drag'],
  ['drop', 'drag'],
]);
