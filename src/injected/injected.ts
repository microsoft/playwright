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

type SanitizedElementData = {
  fontSize: number,
  color: string,
  lineHeight: string,
  letterSpacing: string,
};
type SanitizedScreenshotData = {
  replacements: Map<Node, Element>;
};

export class Injected {
  private _sanitizedScreenshotData?: SanitizedScreenshotData;

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

  sanitizeScreenshot() {
    if (this._sanitizedScreenshotData)
      throw new Error('One screenshot at a time');

    const elementData = new Map<Element, SanitizedElementData>();
    const measure = (n: Node) => {
      if (n.nodeType === Node.ELEMENT_NODE) {
        const e = n as Element;
        if (e.shadowRoot)
          measure(e.shadowRoot);
        if ((e as HTMLElement).offsetParent) {
          const style = window.getComputedStyle(e);
          elementData.set(e, { fontSize: parseInt(style.fontSize, 10), color: style.color, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing });
        }
      }
      for (let c = n.firstChild; c; c = c.nextSibling)
        measure(c);
    };
    measure(document);

    const screenshotData: SanitizedScreenshotData = {
      replacements: new Map(),
    };
    const visit = (n: Node): Node => {
      const data = n.nodeType === Node.ELEMENT_NODE ? elementData.get(n as Element) : undefined;
      if (!data) {
        for (let c: Node | null = n.firstChild; c; c = c.nextSibling)
          c = visit(c);
        return n;
      }
      const e = n as Element;
      if (e.shadowRoot)
        visit(e.shadowRoot);

      // TODO: fix pseudos

      if (e.nodeName === 'BUTTON' || e.nodeName === 'TEXTAREA') {
        data.fontSize = 16;
        const box = this._createReplacementBox(e as HTMLElement, {
          'display': 'inline-block',
          'background': e.nodeName === 'BUTTON' ? 'gray' : 'white',
          'box-sizing': 'border-box',
          'border': '1px solid black',
        });
        const text = e.textContent;
        if (text)
          box.appendChild(this._createTextBox(e.ownerDocument!, text, data));
        screenshotData.replacements.set(e, box);
        e.replaceWith(box);
        return box;
      }

      if (e.nodeName === 'SELECT') {
        data.fontSize = 16;
        const select = e as HTMLSelectElement;
        const box = this._createReplacementBox(select, {
          'display': 'inline-block',
          'background': 'white',
          'box-sizing': 'border-box',
          'border': '1px solid black',
          'max-width': '150px',
          'min-height': select.multiple ? '64px' : '16px',
        });
        if (select.multiple) {
          for (const option of Array.from(select.options)) {
            const textBox = this._createTextBox(e.ownerDocument!, option.label, data);
            textBox.style.display = 'block';
            textBox.style.background = option.selected ? 'gray' : 'white';
            box.appendChild(textBox);
          }
        } else {
          const option = select.options[select.selectedIndex];
          if (option)
            box.appendChild(this._createTextBox(e.ownerDocument!, option.label, data));
        }
        screenshotData.replacements.set(e, box);
        e.replaceWith(box);
        return box;
      }

      if (e.nodeName === 'INPUT') {
        data.fontSize = 16;
        const input = e as HTMLInputElement;
        const type = input.type.toLowerCase();
        const props: { [key: string]: string } = {
          'display': 'inline-block',
          'background': 'white',
          'box-sizing': 'border-box',
          'border': '1px solid black',
          'max-width': '150px',
          'min-height': '16px',
        };
        if (type === 'checkbox') {
          props['background'] = input.checked ? 'white' : 'black';
          props['min-width'] = '16px';
        }
        if (type === 'file' || type === 'image') {
          props['background'] = 'green';
          props['min-width'] = '100px';
        }
        if (type === 'radio') {
          props['background'] = input.checked ? 'black' : 'white';
          props['border-radius'] = '50%';
          props['min-width'] = '16px';
        }
        if (type === 'range') {
          const min = parseFloat(input.min);
          const max = parseFloat(input.max);
          const value = parseFloat(input.value);
          props['width'] = '200px';
          props['border-left-width'] = max === min ? '100px' : (value - min) / (max - min) * 200 + 'px';
        }
        const box = this._createReplacementBox(input, props);
        if (!['checkbox', 'file', 'hidden', 'image', 'radio', 'range'].includes(type)) {
          const text = input.value;
          if (text)
            box.appendChild(this._createTextBox(e.ownerDocument!, text, data));
        }
        screenshotData.replacements.set(e, box);
        e.replaceWith(box);
        return box;
      }

      const texts: Text[] = [];
      for (let c: Node | null = e.firstChild; c; c = c.nextSibling) {
        if (c.nodeType !== Node.TEXT_NODE)
          c = visit(c);
        else
          texts.push(c as Text);
      }
      for (const t of texts) {
        const textBox = this._createTextBox(e.ownerDocument!, t.nodeValue || '', data);
        screenshotData.replacements.set(t, textBox);
        t.replaceWith(textBox);
      }
      return e;
    };
    visit(document);
    this._sanitizedScreenshotData = screenshotData;
  }

  unsanitizeScreenshot() {
    if (!this._sanitizedScreenshotData)
      return;
    for (const [t, e] of this._sanitizedScreenshotData.replacements)
      e.replaceWith(t);
    this._sanitizedScreenshotData = undefined;
  }

  private _createTextBox(doc: Document, text: string, data: SanitizedElementData) {
    const box = doc.createElement('playwright-box');
    box.style.display = 'inline';
    box.style.padding = '0';
    box.style.margin = '0';
    box.style.border = 'none';
    box.style.outline = 'none';
    if (data.lineHeight === 'normal')
      box.style.lineHeight = '1';
    // TODO: figure out the first/last space collapse rules.
    text = text.replace(/^\s+/u, '').replace(/\s+$/u, '').replace(/\s\s+/ug, ' ');
    // TODO: define a good size for each font size.
    const charWidth = Math.floor(data.fontSize * 0.45) + 'px';
    const charHeight = (data.fontSize + 3) + 'px';
    for (let i = 0; i < text.length; i++) {
      // TODO: try to handle unpaired surrogates, emojis, extra-wide chars and extra-narrow chars.
      const char = doc.createElement('playwright-char');
      char.style.display = 'inline-block';
      char.style.padding = '0';
      char.style.margin = '0';
      char.style.outline = 'none';
      char.style.boxSizing = 'border-box';
      char.style.width = charWidth;
      char.style.height = charHeight;
      if (!/^\s+$/u.test(text[i])) {
        char.style.background = data.color;
        char.style.backgroundClip = 'padding-box';
        char.style.border = '1px solid transparent';
        char.style.borderWidth = '2px 1px';
      }
      box.appendChild(char);
    }
    return box;
  }

  private _createReplacementBox(e: HTMLElement, props: { [key: string]: string }): HTMLElement {
    const box = e.ownerDocument!.createElement('playwright-box');
    box.style.cssText = e.style.cssText;
    for (const [key, value] of Object.entries(props)) {
      if (!box.style.getPropertyValue(key))
        box.style.setProperty(key, value);
    }
    box.style.setProperty('appearance', 'none');
    box.style.setProperty('-webkit-appearance', 'none');
    box.style.setProperty('-moz-appearance', 'none');
    return box;
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
