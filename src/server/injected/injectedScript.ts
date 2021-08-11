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
import { XPathEngine } from './xpathSelectorEngine';
import { ReactEngine } from './reactSelectorEngine';
import { VueEngine } from './vueSelectorEngine';
import { ParsedSelector, ParsedSelectorPart, parseSelector } from '../common/selectorParser';
import { FatalDOMError } from '../common/domErrors';
import { SelectorEvaluatorImpl, isVisible, parentElementOrShadowHost, elementMatchesText, TextMatcher, createRegexTextMatcher, createStrictTextMatcher, createLaxTextMatcher } from './selectorEvaluator';
import { CSSComplexSelectorList } from '../common/cssParser';

type Predicate<T> = (progress: InjectedScriptProgress, continuePolling: symbol) => T | symbol;

export type InjectedScriptProgress = {
  aborted: boolean,
  log: (message: string) => void,
  logRepeating: (message: string) => void,
};

export type InjectedScriptPoll<T> = {
  run: () => Promise<T>,
  // Takes more logs, waiting until at least one message is available.
  takeNextLogs: () => Promise<string[]>,
  // Takes all current logs without waiting.
  takeLastLogs: () => string[],
  cancel: () => void,
};

export type ElementStateWithoutStable = 'visible' | 'hidden' | 'enabled' | 'disabled' | 'editable' | 'checked';
export type ElementState = ElementStateWithoutStable | 'stable';

export interface SelectorEngineV2 {
  queryAll(root: SelectorRoot, body: any): Element[];
}

export type ElementMatch = {
  element: Element;
  capture: Element | undefined;
};

export class InjectedScript {
  private _engines: Map<string, SelectorEngineV2>;
  _evaluator: SelectorEvaluatorImpl;
  private _stableRafCount: number;
  private _replaceRafWithTimeout: boolean;

  constructor(stableRafCount: number, replaceRafWithTimeout: boolean, customEngines: { name: string, engine: SelectorEngine}[]) {
    this._evaluator = new SelectorEvaluatorImpl(new Map());

    this._engines = new Map();
    this._engines.set('xpath', XPathEngine);
    this._engines.set('xpath:light', XPathEngine);
    this._engines.set('_react', ReactEngine);
    this._engines.set('_vue', VueEngine);
    this._engines.set('text', this._createTextEngine(true));
    this._engines.set('text:light', this._createTextEngine(false));
    this._engines.set('id', this._createAttributeEngine('id', true));
    this._engines.set('id:light', this._createAttributeEngine('id', false));
    this._engines.set('data-testid', this._createAttributeEngine('data-testid', true));
    this._engines.set('data-testid:light', this._createAttributeEngine('data-testid', false));
    this._engines.set('data-test-id', this._createAttributeEngine('data-test-id', true));
    this._engines.set('data-test-id:light', this._createAttributeEngine('data-test-id', false));
    this._engines.set('data-test', this._createAttributeEngine('data-test', true));
    this._engines.set('data-test:light', this._createAttributeEngine('data-test', false));
    this._engines.set('css', this._createCSSEngine());
    this._engines.set('nth', { queryAll: () => [] });
    this._engines.set('visible', { queryAll: () => [] });

    for (const { name, engine } of customEngines)
      this._engines.set(name, engine);

    this._stableRafCount = stableRafCount;
    this._replaceRafWithTimeout = replaceRafWithTimeout;
  }

  parseSelector(selector: string): ParsedSelector {
    const result = parseSelector(selector);
    for (const part of result.parts) {
      if (!this._engines.has(part.name))
        throw new Error(`Unknown engine "${part.name}" while parsing selector ${selector}`);
    }
    return result;
  }

  querySelector(selector: ParsedSelector, root: Node, strict: boolean): Element | undefined {
    if (!(root as any)['querySelector'])
      throw new Error('Node is not queryable.');
    this._evaluator.begin();
    try {
      const result = this._querySelectorRecursively([{ element: root as Element, capture: undefined }], selector, 0, new Map());
      if (strict && result.length > 1)
        throw new Error(`strict mode violation: selector resolved to ${result.length} elements.`);
      return result[0]?.capture || result[0]?.element;
    } finally {
      this._evaluator.end();
    }
  }

  private _querySelectorRecursively(roots: ElementMatch[], selector: ParsedSelector, index: number, queryCache: Map<Element, Element[][]>): ElementMatch[] {
    if (index === selector.parts.length)
      return roots;

    const part = selector.parts[index];
    if (part.name === 'nth') {
      let filtered: ElementMatch[] = [];
      if (part.body === '0') {
        filtered = roots.slice(0, 1);
      } else if (part.body === '-1') {
        if (roots.length)
          filtered = roots.slice(roots.length - 1);
      } else {
        if (typeof selector.capture === 'number')
          throw new Error(`Can't query n-th element in a request with the capture.`);
        const nth = +part.body;
        const set = new Set<Element>();
        for (const root of roots) {
          set.add(root.element);
          if (nth + 1 === set.size)
            filtered = [root];
        }
      }
      return this._querySelectorRecursively(filtered, selector, index + 1, queryCache);
    }

    if (part.name === 'visible') {
      const visible = Boolean(part.body);
      return roots.filter(match => visible === isVisible(match.element));
    }

    const result: ElementMatch[] = [];
    for (const root of roots) {
      const capture = index - 1 === selector.capture ? root.element : root.capture;

      // Do not query engine twice for the same element.
      let queryResults = queryCache.get(root.element);
      if (!queryResults) {
        queryResults = [];
        queryCache.set(root.element, queryResults);
      }
      let all = queryResults[index];
      if (!all) {
        all = this._queryEngineAll(selector.parts[index], root.element);
        queryResults[index] = all;
      }

      for (const element of all)
        result.push({ element, capture });
    }
    return this._querySelectorRecursively(result, selector, index + 1, queryCache);
  }

  querySelectorAll(selector: ParsedSelector, root: Node): Element[] {
    if (!(root as any)['querySelectorAll'])
      throw new Error('Node is not queryable.');
    this._evaluator.begin();
    try {
      const result = this._querySelectorRecursively([{ element: root as Element, capture: undefined }], selector, 0, new Map());
      const set = new Set<Element>();
      for (const r of result)
        set.add(r.capture || r.element);
      return [...set];
    } finally {
      this._evaluator.end();
    }
  }

  private _queryEngineAll(part: ParsedSelectorPart, root: SelectorRoot): Element[] {
    return this._engines.get(part.name)!.queryAll(root, part.body);
  }

  private _createAttributeEngine(attribute: string, shadow: boolean): SelectorEngine {
    const toCSS = (selector: string): CSSComplexSelectorList => {
      const css = `[${attribute}=${JSON.stringify(selector)}]`;
      return [{ simples: [{ selector: { css, functions: [] }, combinator: '' }] }];
    };
    return {
      queryAll: (root: SelectorRoot, selector: string): Element[] => {
        return this._evaluator.query({ scope: root as Document | Element, pierceShadow: shadow }, toCSS(selector));
      }
    };
  }

  private _createCSSEngine(): SelectorEngineV2 {
    const evaluator = this._evaluator;
    return {
      queryAll(root: SelectorRoot, body: any) {
        return evaluator.query({ scope: root as Document | Element, pierceShadow: true }, body);
      }
    };
  }

  private _createTextEngine(shadow: boolean): SelectorEngine {
    const queryList = (root: SelectorRoot, selector: string): Element[] => {
      const { matcher, kind } = createTextMatcher(selector);
      const result: Element[] = [];
      let lastDidNotMatchSelf: Element | null = null;

      const appendElement = (element: Element) => {
        // TODO: replace contains() with something shadow-dom-aware?
        if (kind === 'lax' && lastDidNotMatchSelf && lastDidNotMatchSelf.contains(element))
          return false;
        const matches = elementMatchesText(this._evaluator, element, matcher);
        if (matches === 'none')
          lastDidNotMatchSelf = element;
        if (matches === 'self' || (matches === 'selfAndChildren' && kind === 'strict'))
          result.push(element);
      };

      if (root.nodeType === Node.ELEMENT_NODE)
        appendElement(root as Element);
      const elements = this._evaluator._queryCSS({ scope: root as Document | Element, pierceShadow: shadow }, '*');
      for (const element of elements)
        appendElement(element);
      return result;
    };

    return {
      queryAll: (root: SelectorRoot, selector: string): Element[] => {
        return queryList(root, selector);
      }
    };
  }

  extend(source: string, params: any): any {
    const constrFunction = global.eval(`
    (() => {
      ${source}
      return pwExport;
    })()`);
    return new constrFunction(this, params);
  }

  isVisible(element: Element): boolean {
    return isVisible(element);
  }

  pollRaf<T>(predicate: Predicate<T>): InjectedScriptPoll<T> {
    return this._runAbortableTask(progress => {
      let fulfill: (result: T) => void;
      let reject: (error: Error) => void;
      const result = new Promise<T>((f, r) => { fulfill = f; reject = r; });

      const onRaf = () => {
        if (progress.aborted)
          return;
        try {
          const continuePolling = Symbol('continuePolling');
          const success = predicate(progress, continuePolling);
          if (success !== continuePolling)
            fulfill(success as T);
          else
            requestAnimationFrame(onRaf);
        } catch (e) {
          progress.log('  ' + e.message);
          reject(e);
        }
      };

      onRaf();
      return result;
    });
  }

  pollInterval<T>(pollInterval: number, predicate: Predicate<T>): InjectedScriptPoll<T> {
    return this._runAbortableTask(progress => {
      let fulfill: (result: T) => void;
      let reject: (error: Error) => void;
      const result = new Promise<T>((f, r) => { fulfill = f; reject = r; });

      const onTimeout = () => {
        if (progress.aborted)
          return;
        try {
          const continuePolling = Symbol('continuePolling');
          const success = predicate(progress, continuePolling);
          if (success !== continuePolling)
            fulfill(success as T);
          else
            setTimeout(onTimeout, pollInterval);
        } catch (e) {
          reject(e);
        }
      };

      onTimeout();
      return result;
    });
  }

  private _runAbortableTask<T>(task: (progess: InjectedScriptProgress) => Promise<T>): InjectedScriptPoll<T> {
    let unsentLogs: string[] = [];
    let takeNextLogsCallback: ((logs: string[]) => void) | undefined;
    let taskFinished = false;
    const logReady = () => {
      if (!takeNextLogsCallback)
        return;
      takeNextLogsCallback(unsentLogs);
      unsentLogs = [];
      takeNextLogsCallback = undefined;
    };

    const takeNextLogs = () => new Promise<string[]>(fulfill => {
      takeNextLogsCallback = fulfill;
      if (unsentLogs.length || taskFinished)
        logReady();
    });

    let lastLog = '';
    const progress: InjectedScriptProgress = {
      aborted: false,
      log: (message: string) => {
        lastLog = message;
        unsentLogs.push(message);
        logReady();
      },
      logRepeating: (message: string) => {
        if (message !== lastLog)
          progress.log(message);
      },
    };

    const run = () => {
      const result = task(progress);

      // After the task has finished, there should be no more logs.
      // Release any pending `takeNextLogs` call, and do not block any future ones.
      // This prevents non-finished protocol evaluation calls and memory leaks.
      result.finally(() => {
        taskFinished = true;
        logReady();
      });

      return result;
    };

    return {
      takeNextLogs,
      run,
      cancel: () => { progress.aborted = true; },
      takeLastLogs: () => unsentLogs,
    };
  }

  getElementBorderWidth(node: Node): { left: number; top: number; } {
    if (node.nodeType !== Node.ELEMENT_NODE || !node.ownerDocument || !node.ownerDocument.defaultView)
      return { left: 0, top: 0 };
    const style = node.ownerDocument.defaultView.getComputedStyle(node as Element);
    return { left: parseInt(style.borderLeftWidth || '', 10), top: parseInt(style.borderTopWidth || '', 10) };
  }

  retarget(node: Node, behavior: 'follow-label' | 'no-follow-label'): Element | null {
    let element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
    if (!element)
      return null;
    if (!element.matches('input, textarea, select'))
      element = element.closest('button, [role=button], [role=checkbox], [role=radio]') || element;
    if (behavior === 'follow-label') {
      if (!element.matches('input, textarea, button, select, [role=button], [role=checkbox], [role=radio]') &&
          !(element as any).isContentEditable) {
        // Go up to the label that might be connected to the input/textarea.
        element = element.closest('label') || element;
      }
      if (element.nodeName === 'LABEL')
        element = (element as HTMLLabelElement).control || element;
    }
    return element;
  }

  waitForElementStatesAndPerformAction<T>(node: Node, states: ElementState[], force: boolean | undefined,
    callback: (node: Node, progress: InjectedScriptProgress, continuePolling: symbol) => T | symbol): InjectedScriptPoll<T | 'error:notconnected' | FatalDOMError> {
    let lastRect: { x: number, y: number, width: number, height: number } | undefined;
    let counter = 0;
    let samePositionCounter = 0;
    let lastTime = 0;

    const predicate = (progress: InjectedScriptProgress, continuePolling: symbol) => {
      if (force) {
        progress.log(`    forcing action`);
        return callback(node, progress, continuePolling);
      }

      for (const state of states) {
        if (state !== 'stable') {
          const result = this.checkElementState(node, state);
          if (typeof result !== 'boolean')
            return result;
          if (!result) {
            progress.logRepeating(`    element is not ${state} - waiting...`);
            return continuePolling;
          }
          continue;
        }

        const element = this.retarget(node, 'no-follow-label');
        if (!element)
          return 'error:notconnected';

        // First raf happens in the same animation frame as evaluation, so it does not produce
        // any client rect difference compared to synchronous call. We skip the synchronous call
        // and only force layout during actual rafs as a small optimisation.
        if (++counter === 1)
          return continuePolling;

        // Drop frames that are shorter than 16ms - WebKit Win bug.
        const time = performance.now();
        if (this._stableRafCount > 1 && time - lastTime < 15)
          return continuePolling;
        lastTime = time;

        const clientRect = element.getBoundingClientRect();
        const rect = { x: clientRect.top, y: clientRect.left, width: clientRect.width, height: clientRect.height };
        const samePosition = lastRect && rect.x === lastRect.x && rect.y === lastRect.y && rect.width === lastRect.width && rect.height === lastRect.height;
        if (samePosition)
          ++samePositionCounter;
        else
          samePositionCounter = 0;
        const isStable = samePositionCounter >= this._stableRafCount;
        const isStableForLogs = isStable || !lastRect;
        lastRect = rect;
        if (!isStableForLogs)
          progress.logRepeating(`    element is not stable - waiting...`);
        if (!isStable)
          return continuePolling;
      }

      return callback(node, progress, continuePolling);
    };

    if (this._replaceRafWithTimeout)
      return this.pollInterval(16, predicate);
    else
      return this.pollRaf(predicate);
  }

  checkElementState(node: Node, state: ElementStateWithoutStable): boolean | 'error:notconnected' | FatalDOMError {
    const element = this.retarget(node, ['stable', 'visible', 'hidden'].includes(state) ? 'no-follow-label' : 'follow-label');
    if (!element || !element.isConnected) {
      if (state === 'hidden')
        return true;
      return 'error:notconnected';
    }

    if (state === 'visible')
      return this.isVisible(element);
    if (state === 'hidden')
      return !this.isVisible(element);

    const disabled = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(element.nodeName) && element.hasAttribute('disabled');
    if (state === 'disabled')
      return disabled;
    if (state === 'enabled')
      return !disabled;

    const editable = !(['INPUT', 'TEXTAREA', 'SELECT'].includes(element.nodeName) && element.hasAttribute('readonly'));
    if (state === 'editable')
      return !disabled && editable;

    if (state === 'checked') {
      if (element.getAttribute('role') === 'checkbox')
        return element.getAttribute('aria-checked') === 'true';
      if (element.nodeName !== 'INPUT')
        return 'error:notcheckbox';
      if (!['radio', 'checkbox'].includes((element as HTMLInputElement).type.toLowerCase()))
        return 'error:notcheckbox';
      return (element as HTMLInputElement).checked;
    }
    throw new Error(`Unexpected element state "${state}"`);
  }

  selectOptions(optionsToSelect: (Node | { value?: string, label?: string, index?: number })[],
    node: Node, progress: InjectedScriptProgress, continuePolling: symbol): string[] | 'error:notconnected' | FatalDOMError | symbol {
    const element = this.retarget(node, 'follow-label');
    if (!element)
      return 'error:notconnected';
    if (element.nodeName.toLowerCase() !== 'select')
      return 'error:notselect';
    const select = element as HTMLSelectElement;
    const options = [...select.options];
    const selectedOptions = [];
    let remainingOptionsToSelect = optionsToSelect.slice();
    for (let index = 0; index < options.length; index++) {
      const option = options[index];
      const filter = (optionToSelect: Node | { value?: string, label?: string, index?: number }) => {
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
      };
      if (!remainingOptionsToSelect.some(filter))
        continue;
      selectedOptions.push(option);
      if (select.multiple) {
        remainingOptionsToSelect = remainingOptionsToSelect.filter(o => !filter(o));
      } else {
        remainingOptionsToSelect = [];
        break;
      }
    }
    if (remainingOptionsToSelect.length) {
      progress.logRepeating('    did not find some options - waiting... ');
      return continuePolling;
    }
    select.value = undefined as any;
    selectedOptions.forEach(option => option.selected = true);
    progress.log('    selected specified option(s)');
    select.dispatchEvent(new Event('input', { 'bubbles': true }));
    select.dispatchEvent(new Event('change', { 'bubbles': true }));
    return selectedOptions.map(option => option.value);
  }

  fill(value: string, node: Node, progress: InjectedScriptProgress): FatalDOMError | 'error:notconnected' | 'needsinput' | 'done' {
    const element = this.retarget(node, 'follow-label');
    if (!element)
      return 'error:notconnected';
    if (element.nodeName.toLowerCase() === 'input') {
      const input = element as HTMLInputElement;
      const type = input.type.toLowerCase();
      const kDateTypes = new Set(['date', 'time', 'datetime', 'datetime-local', 'month', 'week']);
      const kTextInputTypes = new Set(['', 'email', 'number', 'password', 'search', 'tel', 'text', 'url']);
      if (!kTextInputTypes.has(type) && !kDateTypes.has(type)) {
        progress.log(`    input of type "${type}" cannot be filled`);
        return 'error:notfillableinputtype';
      }
      if (type === 'number') {
        value = value.trim();
        if (isNaN(Number(value)))
          return 'error:notfillablenumberinput';
      }
      if (kDateTypes.has(type)) {
        value = value.trim();
        input.focus();
        input.value = value;
        if (input.value !== value)
          return 'error:notvaliddate';
        element.dispatchEvent(new Event('input', { 'bubbles': true }));
        element.dispatchEvent(new Event('change', { 'bubbles': true }));
        return 'done';  // We have already changed the value, no need to input it.
      }
    } else if (element.nodeName.toLowerCase() === 'textarea') {
      // Nothing to check here.
    } else if (!(element as HTMLElement).isContentEditable) {
      return 'error:notfillableelement';
    }
    this.selectText(element);
    return 'needsinput';  // Still need to input the value.
  }

  selectText(node: Node): 'error:notconnected' | 'done' {
    const element = this.retarget(node, 'follow-label');
    if (!element)
      return 'error:notconnected';
    if (element.nodeName.toLowerCase() === 'input') {
      const input = element as HTMLInputElement;
      input.select();
      input.focus();
      return 'done';
    }
    if (element.nodeName.toLowerCase() === 'textarea') {
      const textarea = element as HTMLTextAreaElement;
      textarea.selectionStart = 0;
      textarea.selectionEnd = textarea.value.length;
      textarea.focus();
      return 'done';
    }
    const range = element.ownerDocument.createRange();
    range.selectNodeContents(element);
    const selection = element.ownerDocument.defaultView!.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    (element as HTMLElement | SVGElement).focus();
    return 'done';
  }

  focusNode(node: Node, resetSelectionIfNotFocused?: boolean): FatalDOMError | 'error:notconnected' | 'done' {
    if (!node.isConnected)
      return 'error:notconnected';
    if (node.nodeType !== Node.ELEMENT_NODE)
      return 'error:notelement';
    const wasFocused = (node.getRootNode() as (Document | ShadowRoot)).activeElement === node && node.ownerDocument && node.ownerDocument.hasFocus();
    (node as HTMLElement | SVGElement).focus();

    if (resetSelectionIfNotFocused && !wasFocused && node.nodeName.toLowerCase() === 'input') {
      try {
        const input = node as HTMLInputElement;
        input.setSelectionRange(0, 0);
      } catch (e) {
        // Some inputs do not allow selection.
      }
    }
    return 'done';
  }

  setInputFiles(node: Node, payloads: { name: string, mimeType: string, buffer: string }[]) {
    if (node.nodeType !== Node.ELEMENT_NODE)
      return 'Node is not of type HTMLElement';
    const element: Element | undefined = node as Element;
    if (element.nodeName !== 'INPUT')
      return 'Not an <input> element';
    const input = element as HTMLInputElement;
    const type = (input.getAttribute('type') || '').toLowerCase();
    if (type !== 'file')
      return 'Not an input[type=file] element';

    const files = payloads.map(file => {
      const bytes = Uint8Array.from(atob(file.buffer), c => c.charCodeAt(0));
      return new File([bytes], file.name, { type: file.mimeType });
    });
    const dt = new DataTransfer();
    for (const file of files)
      dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('input', { 'bubbles': true }));
    input.dispatchEvent(new Event('change', { 'bubbles': true }));
  }

  checkHitTargetAt(node: Node, point: { x: number, y: number }): 'error:notconnected' | 'done' | { hitTargetDescription: string } {
    let element: Element | null | undefined = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    if (!element || !element.isConnected)
      return 'error:notconnected';
    element = element.closest('button, [role=button]') || element;
    let hitElement = this.deepElementFromPoint(document, point.x, point.y);
    const hitParents: Element[] = [];
    while (hitElement && hitElement !== element) {
      hitParents.push(hitElement);
      hitElement = parentElementOrShadowHost(hitElement);
    }
    if (hitElement === element)
      return 'done';
    const hitTargetDescription = this.previewNode(hitParents[0]);
    // Root is the topmost element in the hitTarget's chain that is not in the
    // element's chain. For example, it might be a dialog element that overlays
    // the target.
    let rootHitTargetDescription: string | undefined;
    while (element) {
      const index = hitParents.indexOf(element);
      if (index !== -1) {
        if (index > 1)
          rootHitTargetDescription = this.previewNode(hitParents[index - 1]);
        break;
      }
      element = parentElementOrShadowHost(element);
    }
    if (rootHitTargetDescription)
      return { hitTargetDescription: `${hitTargetDescription} from ${rootHitTargetDescription} subtree` };
    return { hitTargetDescription };
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

  deepElementFromPoint(document: Document, x: number, y: number): Element | undefined {
    let container: Document | ShadowRoot | null = document;
    let element: Element | undefined;
    while (container) {
      // elementFromPoint works incorrectly in Chromium (http://crbug.com/1188919),
      // so we use elementsFromPoint instead.
      const elements = container.elementsFromPoint(x, y);
      const innerElement = elements[0] as Element | undefined;
      if (!innerElement || element === innerElement)
        break;
      element = innerElement;
      container = element.shadowRoot;
    }
    return element;
  }

  previewNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE)
      return oneLine(`#text=${node.nodeValue || ''}`);
    if (node.nodeType !== Node.ELEMENT_NODE)
      return oneLine(`<${node.nodeName.toLowerCase()} />`);
    const element = node as Element;

    const attrs = [];
    for (let i = 0; i < element.attributes.length; i++) {
      const { name, value } = element.attributes[i];
      if (name === 'style')
        continue;
      if (!value && booleanAttributes.has(name))
        attrs.push(` ${name}`);
      else
        attrs.push(` ${name}="${value}"`);
    }
    attrs.sort((a, b) => a.length - b.length);
    let attrText = attrs.join('');
    if (attrText.length > 50)
      attrText = attrText.substring(0, 49) + '\u2026';
    if (autoClosingTags.has(element.nodeName))
      return oneLine(`<${element.nodeName.toLowerCase()}${attrText}/>`);

    const children = element.childNodes;
    let onlyText = false;
    if (children.length <= 5) {
      onlyText = true;
      for (let i = 0; i < children.length; i++)
        onlyText = onlyText && children[i].nodeType === Node.TEXT_NODE;
    }
    let text = onlyText ? (element.textContent || '') : (children.length ? '\u2026' : '');
    if (text.length > 50)
      text = text.substring(0, 49) + '\u2026';
    return oneLine(`<${element.nodeName.toLowerCase()}${attrText}>${text}</${element.nodeName.toLowerCase()}>`);
  }
}

const autoClosingTags = new Set(['AREA', 'BASE', 'BR', 'COL', 'COMMAND', 'EMBED', 'HR', 'IMG', 'INPUT', 'KEYGEN', 'LINK', 'MENUITEM', 'META', 'PARAM', 'SOURCE', 'TRACK', 'WBR']);
const booleanAttributes = new Set(['checked', 'selected', 'disabled', 'readonly', 'multiple']);

function oneLine(s: string): string {
  return s.replace(/\n/g, '↵').replace(/\t/g, '⇆');
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

function unescape(s: string): string {
  if (!s.includes('\\'))
    return s;
  const r: string[] = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === '\\' && i + 1 < s.length)
      i++;
    r.push(s[i++]);
  }
  return r.join('');
}

function createTextMatcher(selector: string): { matcher: TextMatcher, kind: 'regex' | 'strict' | 'lax' } {
  if (selector[0] === '/' && selector.lastIndexOf('/') > 0) {
    const lastSlash = selector.lastIndexOf('/');
    const matcher: TextMatcher = createRegexTextMatcher(selector.substring(1, lastSlash), selector.substring(lastSlash + 1));
    return { matcher, kind: 'regex' };
  }
  let strict = false;
  if (selector.length > 1 && selector[0] === '"' && selector[selector.length - 1] === '"') {
    selector = unescape(selector.substring(1, selector.length - 1));
    strict = true;
  }
  if (selector.length > 1 && selector[0] === "'" && selector[selector.length - 1] === "'") {
    selector = unescape(selector.substring(1, selector.length - 1));
    strict = true;
  }
  const matcher = strict ? createStrictTextMatcher(selector) : createLaxTextMatcher(selector);
  return { matcher, kind: strict ? 'strict' : 'lax' };
}

export default InjectedScript;
