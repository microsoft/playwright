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
import { SelectorEngine, SelectorRoot } from './selectorEngine';
import { createTextSelector } from './textSelectorEngine';
import { XPathEngine } from './xpathSelectorEngine';

type Falsy = false | 0 | '' | undefined | null;
type Predicate<T> = (progress: types.InjectedScriptProgress) => T | Falsy;

export default class InjectedScript {
  readonly engines: Map<string, SelectorEngine>;

  constructor(customEngines: { name: string, engine: SelectorEngine}[]) {
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

  private _pollRaf<T>(progress: types.InjectedScriptProgress, predicate: Predicate<T>): Promise<T> {
    let fulfill: (result: T) => void;
    let reject: (error: Error) => void;
    const result = new Promise<T>((f, r) => { fulfill = f; reject = r; });

    const onRaf = () => {
      if (progress.canceled)
        return;
      try {
        const success = predicate(progress);
        if (success)
          fulfill(success);
        else
          requestAnimationFrame(onRaf);
      } catch (e) {
        reject(e);
      }
    };

    onRaf();
    return result;
  }

  private _pollInterval<T>(progress: types.InjectedScriptProgress, pollInterval: number, predicate: Predicate<T>): Promise<T> {
    let fulfill: (result: T) => void;
    let reject: (error: Error) => void;
    const result = new Promise<T>((f, r) => { fulfill = f; reject = r; });

    const onTimeout = () => {
      if (progress.canceled)
        return;
      try {
        const success = predicate(progress);
        if (success)
          fulfill(success);
        else
          setTimeout(onTimeout, pollInterval);
      } catch (e) {
        reject(e);
      }
    };

    onTimeout();
    return result;
  }

  private _runCancellablePoll<T>(poll: (progess: types.InjectedScriptProgress) => Promise<T>): types.InjectedScriptPoll<T> {
    let currentLogs: string[] = [];
    let logReady = () => {};
    const createLogsPromise = () => new Promise<types.InjectedScriptLogs>(fulfill => {
      logReady = () => {
        const current = currentLogs;
        currentLogs = [];
        fulfill({ current, next: createLogsPromise() });
      };
    });

    let lastLog = '';
    const progress: types.InjectedScriptProgress = {
      canceled: false,
      log: (message: string) => {
        lastLog = message;
        currentLogs.push(message);
        logReady();
      },
      logRepeating: (message: string) => {
        if (message !== lastLog)
          progress.log(message);
      },
    };

    // It is important to create logs promise before running the poll to capture logs from the first run.
    const logs = createLogsPromise();

    return {
      logs,
      result: poll(progress),
      cancel: () => { progress.canceled = true; },
      takeLastLogs: () => currentLogs,
    };
  }

  poll<T>(polling: 'raf' | number, predicate: Predicate<T>): types.InjectedScriptPoll<T> {
    return this._runCancellablePoll(progress => {
      return polling === 'raf' ? this._pollRaf(progress, predicate) : this._pollInterval(progress, polling, predicate);
    });
  }

  getElementBorderWidth(node: Node): { left: number; top: number; } {
    if (node.nodeType !== Node.ELEMENT_NODE || !node.ownerDocument || !node.ownerDocument.defaultView)
      return { left: 0, top: 0 };
    const style = node.ownerDocument.defaultView.getComputedStyle(node as Element);
    return { left: parseInt(style.borderLeftWidth || '', 10), top: parseInt(style.borderTopWidth || '', 10) };
  }

  selectOptions(node: Node, optionsToSelect: (Node | types.SelectOption)[]): types.InjectedScriptResult<string[]> {
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

  waitForEnabledAndFill(node: Node, value: string): types.InjectedScriptPoll<types.InjectedScriptResult<boolean>> {
    return this.poll('raf', progress => {
      if (node.nodeType !== Node.ELEMENT_NODE)
        return { status: 'error', error: 'Node is not of type HTMLElement' };
      const element = node as HTMLElement;
      if (!element.isConnected)
        return { status: 'notconnected' };
      if (!this.isVisible(element)) {
        progress.logRepeating('    element is not visible - waiting...');
        return false;
      }
      if (element.nodeName.toLowerCase() === 'input') {
        const input = element as HTMLInputElement;
        const type = (input.getAttribute('type') || '').toLowerCase();
        const kDateTypes = new Set(['date', 'time', 'datetime', 'datetime-local']);
        const kTextInputTypes = new Set(['', 'email', 'number', 'password', 'search', 'tel', 'text', 'url']);
        if (!kTextInputTypes.has(type) && !kDateTypes.has(type))
          return { status: 'error', error: 'Cannot fill input of type "' + type + '".' };
        if (type === 'number') {
          value = value.trim();
          if (isNaN(Number(value)))
            return { status: 'error', error: 'Cannot type text into input[type=number].' };
        }
        if (input.disabled) {
          progress.logRepeating('    element is disabled - waiting...');
          return false;
        }
        if (input.readOnly) {
          progress.logRepeating('    element is readonly - waiting...');
          return false;
        }
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
        if (textarea.disabled) {
          progress.logRepeating('    element is disabled - waiting...');
          return false;
        }
        if (textarea.readOnly) {
          progress.logRepeating('    element is readonly - waiting...');
          return false;
        }
      } else if (!element.isContentEditable) {
        return { status: 'error', error: 'Element is not an <input>, <textarea> or [contenteditable] element.' };
      }
      const result = this.selectText(node);
      if (result.status === 'success')
        return { status: 'success', value: true };  // Still need to input the value.
      return result;
    });
  }

  selectText(node: Node): types.InjectedScriptResult {
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

  focusNode(node: Node): types.InjectedScriptResult {
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

  waitForDisplayedAtStablePositionAndEnabled(node: Node, rafCount: number): types.InjectedScriptPoll<types.InjectedScriptResult> {
    return this._runCancellablePoll(async progress => {
      if (!node.isConnected)
        return { status: 'notconnected' };
      const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
      if (!element)
        return { status: 'notconnected' };

      let lastRect: types.Rect | undefined;
      let counter = 0;
      let samePositionCounter = 0;
      let lastTime = 0;
      return this._pollRaf(progress, (): types.InjectedScriptResult | false => {
        // First raf happens in the same animation frame as evaluation, so it does not produce
        // any client rect difference compared to synchronous call. We skip the synchronous call
        // and only force layout during actual rafs as a small optimisation.
        if (++counter === 1)
          return false;
        if (!node.isConnected)
          return { status: 'notconnected' };

        // Drop frames that are shorter than 16ms - WebKit Win bug.
        const time = performance.now();
        if (rafCount > 1 && time - lastTime < 15)
          return false;
        lastTime = time;

        // Note: this logic should be similar to isVisible() to avoid surprises.
        const clientRect = element.getBoundingClientRect();
        const rect = { x: clientRect.top, y: clientRect.left, width: clientRect.width, height: clientRect.height };
        const samePosition = lastRect && rect.x === lastRect.x && rect.y === lastRect.y && rect.width === lastRect.width && rect.height === lastRect.height;
        const isDisplayed = rect.width > 0 && rect.height > 0;
        if (samePosition)
          ++samePositionCounter;
        else
          samePositionCounter = 0;
        const isStable = samePositionCounter >= rafCount;
        const isStableForLogs = isStable || !lastRect;
        lastRect = rect;

        const style = element.ownerDocument && element.ownerDocument.defaultView ? element.ownerDocument.defaultView.getComputedStyle(element) : undefined;
        const isVisible = !!style && style.visibility !== 'hidden';

        const elementOrButton = element.closest('button, [role=button]') || element;
        const isDisabled = ['BUTTON', 'INPUT', 'SELECT'].includes(elementOrButton.nodeName) && elementOrButton.hasAttribute('disabled');

        if (isDisplayed && isStable && isVisible && !isDisabled)
          return { status: 'success' };

        if (!isDisplayed || !isVisible)
          progress.logRepeating(`    element is not visible - waiting...`);
        else if (!isStableForLogs)
          progress.logRepeating(`    element is moving - waiting...`);
        else if (isDisabled)
          progress.logRepeating(`    element is disabled - waiting...`);
        return false;
      });
    });
  }

  checkHitTargetAt(node: Node, point: types.Point): types.InjectedScriptResult<boolean> {
    let element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    if (!element || !element.isConnected)
      return { status: 'notconnected' };
    element = element.closest('button, [role=button]') || element;
    let hitElement = this.deepElementFromPoint(document, point.x, point.y);
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

  deepElementFromPoint(document: Document, x: number, y: number): Element | undefined {
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

  previewElement(element: Element): string {
    const attrs = [];
    for (let i = 0; i < element.attributes.length; i++) {
      if (element.attributes[i].name !== 'style')
        attrs.push(` ${element.attributes[i].name}="${element.attributes[i].value}"`);
    }
    attrs.sort((a, b) => a.length - b.length);
    let attrText = attrs.join('');
    if (attrText.length > 50)
      attrText = attrText.substring(0, 49) + '\u2026';
    if (autoClosingTags.has(element.nodeName))
      return `<${element.nodeName.toLowerCase()}${attrText}/>`;

    const children = element.childNodes;
    let onlyText = false;
    if (children.length <= 5) {
      onlyText = true;
      for (let i = 0; i < children.length; i++)
        onlyText = onlyText && children[i].nodeType === Node.TEXT_NODE;
    }
    let text = onlyText ? (element.textContent || '') : '';
    if (text.length > 50)
      text = text.substring(0, 49) + '\u2026';
    return `<${element.nodeName.toLowerCase()}${attrText}>${text}</${element.nodeName.toLowerCase()}>`;
  }
}

const autoClosingTags = new Set(['AREA', 'BASE', 'BR', 'COL', 'COMMAND', 'EMBED', 'HR', 'IMG', 'INPUT', 'KEYGEN', 'LINK', 'MENUITEM', 'META', 'PARAM', 'SOURCE', 'TRACK', 'WBR']);

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
