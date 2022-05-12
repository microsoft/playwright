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

import type { SelectorEngine, SelectorRoot } from './selectorEngine';
import { XPathEngine } from './xpathSelectorEngine';
import { ReactEngine } from './reactSelectorEngine';
import { VueEngine } from './vueSelectorEngine';
import { RoleEngine } from './roleSelectorEngine';
import type { NestedSelectorBody, ParsedSelector, ParsedSelectorPart } from '../isomorphic/selectorParser';
import { allEngineNames, parseSelector, stringifySelector } from '../isomorphic/selectorParser';
import { type TextMatcher, elementMatchesText, createRegexTextMatcher, createStrictTextMatcher, createLaxTextMatcher } from './selectorUtils';
import { SelectorEvaluatorImpl } from './selectorEvaluator';
import { isElementVisible, parentElementOrShadowHost } from './domUtils';
import type { CSSComplexSelectorList } from '../isomorphic/cssParser';
import { generateSelector } from './selectorGenerator';
import type * as channels from '../../protocol/channels';
import { Highlight } from './highlight';
import { getAriaDisabled, getAriaRole, getElementAccessibleName } from './roleUtils';
import { kLayoutSelectorNames, type LayoutSelectorName, layoutSelectorScore } from './layoutSelectorUtils';

type Predicate<T> = (progress: InjectedScriptProgress) => T | symbol;

export type InjectedScriptProgress = {
  injectedScript: InjectedScript;
  continuePolling: symbol;
  aborted: boolean;
  log: (message: string) => void;
  logRepeating: (message: string) => void;
  setIntermediateResult: (intermediateResult: any) => void;
};

export type LogEntry = {
  message?: string;
  intermediateResult?: string;
};

export type FrameExpectParams = Omit<channels.FrameExpectParams, 'expectedValue'> & { expectedValue?: any };

export type InjectedScriptPoll<T> = {
  run: () => Promise<T>,
  // Takes more logs, waiting until at least one message is available.
  takeNextLogs: () => Promise<LogEntry[]>,
  // Takes all current logs without waiting.
  takeLastLogs: () => LogEntry[],
  cancel: () => void,
};

export type ElementStateWithoutStable = 'visible' | 'hidden' | 'enabled' | 'disabled' | 'editable' | 'checked' | 'unchecked';
export type ElementState = ElementStateWithoutStable | 'stable';

export interface SelectorEngineV2 {
  queryAll(root: SelectorRoot, body: any): Element[];
}

export type HitTargetInterceptionResult = {
  stop: () => 'done' | { hitTargetDescription: string };
};

export class InjectedScript {
  private _engines: Map<string, SelectorEngineV2>;
  _evaluator: SelectorEvaluatorImpl;
  private _stableRafCount: number;
  private _browserName: string;
  onGlobalListenersRemoved = new Set<() => void>();
  private _hitTargetInterceptor: undefined | ((event: MouseEvent | PointerEvent | TouchEvent) => void);
  private _highlight: Highlight | undefined;
  readonly isUnderTest: boolean;

  constructor(isUnderTest: boolean, stableRafCount: number, browserName: string, experimentalFeaturesEnabled: boolean, customEngines: { name: string, engine: SelectorEngine}[]) {
    this.isUnderTest = isUnderTest;
    this._evaluator = new SelectorEvaluatorImpl(new Map());

    this._engines = new Map();
    this._engines.set('xpath', XPathEngine);
    this._engines.set('xpath:light', XPathEngine);
    this._engines.set('_react', ReactEngine);
    this._engines.set('_vue', VueEngine);
    this._engines.set('role', RoleEngine);
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
    this._engines.set('visible', this._createVisibleEngine());
    this._engines.set('control', this._createControlEngine());
    this._engines.set('has', this._createHasEngine());

    for (const { name, engine } of customEngines)
      this._engines.set(name, engine);

    this._stableRafCount = stableRafCount;
    this._browserName = browserName;

    this._setupGlobalListenersRemovalDetection();
    this._setupHitTargetInterceptors();

    if (isUnderTest)
      (window as any).__injectedScript = this;
  }

  eval(expression: string): any {
    return globalThis.eval(expression);
  }

  parseSelector(selector: string): ParsedSelector {
    const result = parseSelector(selector);
    for (const name of allEngineNames(result)) {
      if (!this._engines.has(name))
        throw this.createStacklessError(`Unknown engine "${name}" while parsing selector ${selector}`);
    }
    return result;
  }

  generateSelector(targetElement: Element): string {
    return generateSelector(this, targetElement, true).selector;
  }

  querySelector(selector: ParsedSelector, root: Node, strict: boolean): Element | undefined {
    const result = this.querySelectorAll(selector, root);
    if (strict && result.length > 1)
      throw this.strictModeViolationError(selector, result);
    return result[0];
  }

  private _queryNth(elements: Set<Element>, part: ParsedSelectorPart): Set<Element> {
    const list = [...elements];
    let nth = +part.body;
    if (nth === -1)
      nth = list.length - 1;
    return new Set<Element>(list.slice(nth, nth + 1));
  }

  private _queryLayoutSelector(elements: Set<Element>, part: ParsedSelectorPart, originalRoot: Node): Set<Element> {
    const name = part.name as LayoutSelectorName;
    const body = part.body as NestedSelectorBody;
    const result: { element: Element, score: number }[] = [];
    const inner = this.querySelectorAll(body.parsed, originalRoot);
    for (const element of elements) {
      const score = layoutSelectorScore(name, element, inner, body.distance);
      if (score !== undefined)
        result.push({ element, score });
    }
    result.sort((a, b) => a.score - b.score);
    return new Set<Element>(result.map(r => r.element));
  }

  querySelectorAll(selector: ParsedSelector, root: Node): Element[] {
    if (selector.capture !== undefined) {
      if (selector.parts.some(part => part.name === 'nth'))
        throw this.createStacklessError(`Can't query n-th element in a request with the capture.`);
      const withHas: ParsedSelector = { parts: selector.parts.slice(0, selector.capture + 1) };
      if (selector.capture < selector.parts.length - 1) {
        const parsed: ParsedSelector = { parts: selector.parts.slice(selector.capture + 1) };
        const has: ParsedSelectorPart = { name: 'has', body: { parsed }, source: stringifySelector(parsed) };
        withHas.parts.push(has);
      }
      return this.querySelectorAll(withHas, root);
    }

    if (!(root as any)['querySelectorAll'])
      throw this.createStacklessError('Node is not queryable.');

    if (selector.capture !== undefined) {
      // We should have handled the capture above.
      throw this.createStacklessError('Internal error: there should not be a capture in the selector.');
    }

    this._evaluator.begin();
    try {
      let roots = new Set<Element>([root as Element]);
      for (const part of selector.parts) {
        if (part.name === 'nth') {
          roots = this._queryNth(roots, part);
        } else if (kLayoutSelectorNames.includes(part.name as LayoutSelectorName)) {
          roots = this._queryLayoutSelector(roots, part, root);
        } else {
          const next = new Set<Element>();
          for (const root of roots) {
            const all = this._queryEngineAll(part, root);
            for (const one of all)
              next.add(one);
          }
          roots = next;
        }
      }
      return [...roots];
    } finally {
      this._evaluator.end();
    }
  }

  private _queryEngineAll(part: ParsedSelectorPart, root: SelectorRoot): Element[] {
    const result = this._engines.get(part.name)!.queryAll(root, part.body);
    for (const element of result) {
      if (!('nodeName' in element))
        throw this.createStacklessError(`Expected a Node but got ${Object.prototype.toString.call(element)}`);
    }
    return result;
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
        const matches = elementMatchesText(this._evaluator._cacheText, element, matcher);
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

  private _createControlEngine(): SelectorEngineV2 {
    return {
      queryAll(root: SelectorRoot, body: any) {
        if (body === 'enter-frame')
          return [];
        if (body === 'return-empty')
          return [];
        throw new Error(`Internal error, unknown control selector ${body}`);
      }
    };
  }

  private _createHasEngine(): SelectorEngineV2 {
    const queryAll = (root: SelectorRoot, body: NestedSelectorBody) => {
      if (root.nodeType !== 1 /* Node.ELEMENT_NODE */)
        return [];
      const has = !!this.querySelector(body.parsed, root, false);
      return has ? [root as Element] : [];
    };
    return { queryAll };
  }

  private _createVisibleEngine(): SelectorEngineV2 {
    const queryAll = (root: SelectorRoot, body: string) => {
      if (root.nodeType !== 1 /* Node.ELEMENT_NODE */)
        return [];
      return isElementVisible(root as Element) === Boolean(body) ? [root as Element] : [];
    };
    return { queryAll };
  }

  private _createLayoutEngine(name: LayoutSelectorName): SelectorEngineV2 {
    const queryAll = (root: SelectorRoot, body: ParsedSelector) => {
      if (root.nodeType !== 1 /* Node.ELEMENT_NODE */)
        return [];
      const has = !!this.querySelector(body, root, false);
      return has ? [root as Element] : [];
    };
    return { queryAll };
  }

  extend(source: string, params: any): any {
    const constrFunction = globalThis.eval(`
    (() => {
      const module = {};
      ${source}
      return module.exports;
    })()`);
    return new constrFunction(this, params);
  }

  isVisible(element: Element): boolean {
    return isElementVisible(element);
  }

  pollRaf<T>(predicate: Predicate<T>): InjectedScriptPoll<T> {
    return this.poll(predicate, next => requestAnimationFrame(next));
  }

  pollInterval<T>(pollInterval: number, predicate: Predicate<T>): InjectedScriptPoll<T> {
    return this.poll(predicate, next => setTimeout(next, pollInterval));
  }

  pollLogScale<T>(predicate: Predicate<T>): InjectedScriptPoll<T> {
    const pollIntervals = [100, 250, 500];
    let attempts = 0;
    return this.poll(predicate, next => setTimeout(next, pollIntervals[attempts++] || 1000));
  }

  poll<T>(predicate: Predicate<T>, scheduleNext: (next: () => void) => void): InjectedScriptPoll<T> {
    return this._runAbortableTask(progress => {
      let fulfill: (result: T) => void;
      let reject: (error: Error) => void;
      const result = new Promise<T>((f, r) => { fulfill = f; reject = r; });

      const next = () => {
        if (progress.aborted)
          return;
        try {
          const success = predicate(progress);
          if (success !== progress.continuePolling)
            fulfill(success as T);
          else
            scheduleNext(next);
        } catch (e) {
          progress.log('  ' + e.message);
          reject(e);
        }
      };

      next();
      return result;
    });
  }

  private _runAbortableTask<T>(task: (progess: InjectedScriptProgress) => Promise<T>): InjectedScriptPoll<T> {
    let unsentLog: LogEntry[] = [];
    let takeNextLogsCallback: ((logs: LogEntry[]) => void) | undefined;
    let taskFinished = false;
    const logReady = () => {
      if (!takeNextLogsCallback)
        return;
      takeNextLogsCallback(unsentLog);
      unsentLog = [];
      takeNextLogsCallback = undefined;
    };

    const takeNextLogs = () => new Promise<LogEntry[]>(fulfill => {
      takeNextLogsCallback = fulfill;
      if (unsentLog.length || taskFinished)
        logReady();
    });

    let lastMessage = '';
    let lastIntermediateResult: any = undefined;
    const progress: InjectedScriptProgress = {
      injectedScript: this,
      aborted: false,
      continuePolling: Symbol('continuePolling'),
      log: (message: string) => {
        lastMessage = message;
        unsentLog.push({ message });
        logReady();
      },
      logRepeating: (message: string) => {
        if (message !== lastMessage)
          progress.log(message);
      },
      setIntermediateResult: (intermediateResult: any) => {
        if (lastIntermediateResult === intermediateResult)
          return;
        lastIntermediateResult = intermediateResult;
        unsentLog.push({ intermediateResult });
        logReady();
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
      takeLastLogs: () => unsentLog,
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
    callback: (node: Node, progress: InjectedScriptProgress) => T | symbol): InjectedScriptPoll<T | 'error:notconnected'> {
    let lastRect: { x: number, y: number, width: number, height: number } | undefined;
    let counter = 0;
    let samePositionCounter = 0;
    let lastTime = 0;

    return this.pollRaf(progress => {
      if (force) {
        progress.log(`    forcing action`);
        return callback(node, progress);
      }

      for (const state of states) {
        if (state !== 'stable') {
          const result = this.elementState(node, state);
          if (typeof result !== 'boolean')
            return result;
          if (!result) {
            progress.logRepeating(`    element is not ${state} - waiting...`);
            return progress.continuePolling;
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
          return progress.continuePolling;

        // Drop frames that are shorter than 16ms - WebKit Win bug.
        const time = performance.now();
        if (this._stableRafCount > 1 && time - lastTime < 15)
          return progress.continuePolling;
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
          return progress.continuePolling;
      }

      return callback(node, progress);
    });
  }

  elementState(node: Node, state: ElementStateWithoutStable): boolean | 'error:notconnected' {
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

    const disabled = getAriaDisabled(element);
    if (state === 'disabled')
      return disabled;
    if (state === 'enabled')
      return !disabled;

    const editable = !(['INPUT', 'TEXTAREA', 'SELECT'].includes(element.nodeName) && element.hasAttribute('readonly'));
    if (state === 'editable')
      return !disabled && editable;

    if (state === 'checked' || state === 'unchecked') {
      if (['checkbox', 'radio'].includes(element.getAttribute('role') || '')) {
        const result = element.getAttribute('aria-checked') === 'true';
        return state === 'checked' ? result : !result;
      }
      if (element.nodeName !== 'INPUT')
        throw this.createStacklessError('Not a checkbox or radio button');
      if (!['radio', 'checkbox'].includes((element as HTMLInputElement).type.toLowerCase()))
        throw this.createStacklessError('Not a checkbox or radio button');
      const result = (element as HTMLInputElement).checked;
      return state === 'checked' ? result : !result;
    }
    throw this.createStacklessError(`Unexpected element state "${state}"`);
  }

  selectOptions(optionsToSelect: (Node | { value?: string, label?: string, index?: number })[],
    node: Node, progress: InjectedScriptProgress): string[] | 'error:notconnected' | symbol {
    const element = this.retarget(node, 'follow-label');
    if (!element)
      return 'error:notconnected';
    if (element.nodeName.toLowerCase() !== 'select')
      throw this.createStacklessError('Element is not a <select> element');
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
      return progress.continuePolling;
    }
    select.value = undefined as any;
    selectedOptions.forEach(option => option.selected = true);
    progress.log('    selected specified option(s)');
    select.dispatchEvent(new Event('input', { 'bubbles': true }));
    select.dispatchEvent(new Event('change', { 'bubbles': true }));
    return selectedOptions.map(option => option.value);
  }

  fill(value: string, node: Node, progress: InjectedScriptProgress): 'error:notconnected' | 'needsinput' | 'done' {
    const element = this.retarget(node, 'follow-label');
    if (!element)
      return 'error:notconnected';
    if (element.nodeName.toLowerCase() === 'input') {
      const input = element as HTMLInputElement;
      const type = input.type.toLowerCase();
      const kInputTypesToSetValue = new Set(['color', 'date', 'time', 'datetime', 'datetime-local', 'month', 'range', 'week']);
      const kInputTypesToTypeInto = new Set(['', 'email', 'number', 'password', 'search', 'tel', 'text', 'url']);
      if (!kInputTypesToTypeInto.has(type) && !kInputTypesToSetValue.has(type)) {
        progress.log(`    input of type "${type}" cannot be filled`);
        throw this.createStacklessError(`Input of type "${type}" cannot be filled`);
      }
      if (type === 'number') {
        value = value.trim();
        if (isNaN(Number(value)))
          throw this.createStacklessError('Cannot type text into input[type=number]');
      }
      if (kInputTypesToSetValue.has(type)) {
        value = value.trim();
        input.focus();
        input.value = value;
        if (input.value !== value)
          throw this.createStacklessError('Malformed value');
        element.dispatchEvent(new Event('input', { 'bubbles': true }));
        element.dispatchEvent(new Event('change', { 'bubbles': true }));
        return 'done';  // We have already changed the value, no need to input it.
      }
    } else if (element.nodeName.toLowerCase() === 'textarea') {
      // Nothing to check here.
    } else if (!(element as HTMLElement).isContentEditable) {
      throw this.createStacklessError('Element is not an <input>, <textarea> or [contenteditable] element');
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

  focusNode(node: Node, resetSelectionIfNotFocused?: boolean): 'error:notconnected' | 'done' {
    if (!node.isConnected)
      return 'error:notconnected';
    if (node.nodeType !== Node.ELEMENT_NODE)
      throw this.createStacklessError('Node is not an element');

    const activeElement = (node.getRootNode() as (Document | ShadowRoot)).activeElement;
    const wasFocused = activeElement === node && node.ownerDocument && node.ownerDocument.hasFocus();
    if (!wasFocused && activeElement && (activeElement as HTMLElement | SVGElement).blur) {
      // Workaround the Firefox bug where focusing the element does not switch current
      // contenteditable to the new element. However, blurring the previous one helps.
      (activeElement as HTMLElement | SVGElement).blur();
    }
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
    const hitElement = this.deepElementFromPoint(document, point.x, point.y);
    return this._expectHitTargetParent(hitElement, element);
  }

  private _expectHitTargetParent(hitElement: Element | undefined, targetElement: Element) {
    const hitParents: Element[] = [];
    while (hitElement && hitElement !== targetElement) {
      hitParents.push(hitElement);
      hitElement = parentElementOrShadowHost(hitElement);
    }
    if (hitElement === targetElement)
      return 'done';
    const hitTargetDescription = this.previewNode(hitParents[0] || document.documentElement);
    // Root is the topmost element in the hitTarget's chain that is not in the
    // element's chain. For example, it might be a dialog element that overlays
    // the target.
    let rootHitTargetDescription: string | undefined;
    let element: Element | undefined = targetElement;
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

  setupHitTargetInterceptor(node: Node, action: 'hover' | 'tap' | 'mouse', blockAllEvents: boolean): HitTargetInterceptionResult | 'error:notconnected' {
    const maybeElement: Element | null | undefined = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    if (!maybeElement || !maybeElement.isConnected)
      return 'error:notconnected';
    const element = maybeElement.closest('button, [role=button]') || maybeElement;

    const events = {
      'hover': kHoverHitTargetInterceptorEvents,
      'tap': kTapHitTargetInterceptorEvents,
      'mouse': kMouseHitTargetInterceptorEvents,
    }[action];
    let result: 'done' | { hitTargetDescription: string } | undefined;

    const listener = (event: PointerEvent | MouseEvent | TouchEvent) => {
      // Ignore events that we do not expect to intercept.
      if (!events.has(event.type))
        return;

      // Playwright only issues trusted events, so allow any custom events originating from
      // the page or content scripts.
      if (!event.isTrusted)
        return;

      // Determine the event point. Note that Firefox does not always have window.TouchEvent.
      const point = (!!window.TouchEvent && (event instanceof window.TouchEvent)) ? event.touches[0] : (event as MouseEvent | PointerEvent);

      // Check that we hit the right element at the first event, and assume all
      // subsequent events will be fine.
      if (result === undefined && point) {
        const hitElement = this.deepElementFromPoint(document, point.clientX, point.clientY);
        result = this._expectHitTargetParent(hitElement, element);
      }

      if (blockAllEvents || (result !== 'done' && result !== undefined)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };

    const stop = () => {
      if (this._hitTargetInterceptor === listener)
        this._hitTargetInterceptor = undefined;
      // If we did not get any events, consider things working. Possible causes:
      // - JavaScript is disabled (webkit-only).
      // - Some <iframe> overlays the element from another frame.
      // - Hovering a disabled control prevents any events from firing.
      return result || 'done';
    };

    // Note: this removes previous listener, just in case there are two concurrent clicks
    // or something went wrong and we did not cleanup.
    this._hitTargetInterceptor = listener;
    return { stop };
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
      const elements: Element[] = container.elementsFromPoint(x, y);
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
      if (name === 'style' || name.startsWith('__playwright'))
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

  strictModeViolationError(selector: ParsedSelector, matches: Element[]): Error {
    const infos = matches.slice(0, 10).map(m => ({
      preview: this.previewNode(m),
      selector: this.generateSelector(m),
    }));
    const lines = infos.map((info, i) => `\n    ${i + 1}) ${info.preview} aka playwright.$("${info.selector}")`);
    if (infos.length < matches.length)
      lines.push('\n    ...');
    return this.createStacklessError(`strict mode violation: "${stringifySelector(selector)}" resolved to ${matches.length} elements:${lines.join('')}\n`);
  }

  createStacklessError(message: string): Error {
    if (this._browserName === 'firefox') {
      const error = new Error('Error: ' + message);
      // Firefox cannot delete the stack, so assign to an empty string.
      error.stack = '';
      return error;
    }
    const error = new Error(message);
    // Chromium/WebKit should delete the stack instead.
    delete error.stack;
    return error;
  }

  maskSelectors(selectors: ParsedSelector[]) {
    if (this._highlight)
      this.hideHighlight();
    this._highlight = new Highlight(this.isUnderTest);
    this._highlight.install();
    const elements = [];
    for (const selector of selectors)
      elements.push(this.querySelectorAll(selector, document.documentElement));
    this._highlight.maskElements(elements.flat());
  }

  highlight(selector: ParsedSelector) {
    if (!this._highlight) {
      this._highlight = new Highlight(this.isUnderTest);
      this._highlight.install();
    }
    this._runHighlightOnRaf(selector);
  }

  _runHighlightOnRaf(selector: ParsedSelector) {
    if (!this._highlight)
      return;
    this._highlight.updateHighlight(this.querySelectorAll(selector, document.documentElement), stringifySelector(selector), false);
    requestAnimationFrame(() => this._runHighlightOnRaf(selector));
  }

  hideHighlight() {
    if (this._highlight) {
      this._highlight.uninstall();
      delete this._highlight;
    }
  }

  private _setupGlobalListenersRemovalDetection() {
    const customEventName = '__playwright_global_listeners_check__';

    let seenEvent = false;
    const handleCustomEvent = () => seenEvent = true;
    window.addEventListener(customEventName, handleCustomEvent);

    new MutationObserver(entries => {
      const newDocumentElement = entries.some(entry => Array.from(entry.addedNodes).includes(document.documentElement));
      if (!newDocumentElement)
        return;

      // New documentElement - let's check whether listeners are still here.
      seenEvent = false;
      window.dispatchEvent(new CustomEvent(customEventName));
      if (seenEvent)
        return;

      // Listener did not fire. Reattach the listener and notify.
      window.addEventListener(customEventName, handleCustomEvent);
      for (const callback of this.onGlobalListenersRemoved)
        callback();
    }).observe(document, { childList: true });
  }

  private _setupHitTargetInterceptors() {
    const listener = (event: PointerEvent | MouseEvent | TouchEvent) => this._hitTargetInterceptor?.(event);
    const addHitTargetInterceptorListeners = () => {
      for (const event of kAllHitTargetInterceptorEvents)
        window.addEventListener(event as any, listener, { capture: true, passive: false });
    };
    addHitTargetInterceptorListeners();
    this.onGlobalListenersRemoved.add(addHitTargetInterceptorListeners);
  }

  expectSingleElement(progress: InjectedScriptProgress, element: Element, options: FrameExpectParams): { matches: boolean, received?: any } {
    const injected = progress.injectedScript;
    const expression = options.expression;

    {
      // Element state / boolean values.
      let elementState: boolean | 'error:notconnected' | 'error:notcheckbox' | undefined;
      if (expression === 'to.be.checked') {
        elementState = progress.injectedScript.elementState(element, 'checked');
      } else if (expression === 'to.be.unchecked') {
        elementState = progress.injectedScript.elementState(element, 'unchecked');
      } else if (expression === 'to.be.disabled') {
        elementState = progress.injectedScript.elementState(element, 'disabled');
      } else if (expression === 'to.be.editable') {
        elementState = progress.injectedScript.elementState(element, 'editable');
      } else if (expression === 'to.be.empty') {
        if (element.nodeName === 'INPUT' || element.nodeName === 'TEXTAREA')
          elementState = !(element as HTMLInputElement).value;
        else
          elementState = !element.textContent?.trim();
      } else if (expression === 'to.be.enabled') {
        elementState = progress.injectedScript.elementState(element, 'enabled');
      } else if (expression === 'to.be.focused') {
        elementState = document.activeElement === element;
      } else if (expression === 'to.be.hidden') {
        elementState = progress.injectedScript.elementState(element, 'hidden');
      } else if (expression === 'to.be.visible') {
        elementState = progress.injectedScript.elementState(element, 'visible');
      }

      if (elementState !== undefined) {
        if (elementState === 'error:notcheckbox')
          throw injected.createStacklessError('Element is not a checkbox');
        if (elementState === 'error:notconnected')
          throw injected.createStacklessError('Element is not connected');
        return { received: elementState, matches: elementState };
      }
    }

    {
      // JS property
      if (expression === 'to.have.property') {
        const received = (element as any)[options.expressionArg];
        const matches = deepEquals(received, options.expectedValue);
        return { received, matches };
      }
    }

    {
      // Single text value.
      let received: string | undefined;
      if (expression === 'to.have.attribute') {
        received = element.getAttribute(options.expressionArg) || '';
      } else if (expression === 'to.have.class') {
        received = element.className;
      } else if (expression === 'to.have.css') {
        received = window.getComputedStyle(element).getPropertyValue(options.expressionArg);
      } else if (expression === 'to.have.id') {
        received = element.id;
      } else if (expression === 'to.have.text') {
        received = options.useInnerText ? (element as HTMLElement).innerText : element.textContent || '';
      } else if (expression === 'to.have.title') {
        received = document.title;
      } else if (expression === 'to.have.url') {
        received = document.location.href;
      } else if (expression === 'to.have.value') {
        element = this.retarget(element, 'follow-label')!;
        if (element.nodeName !== 'INPUT' && element.nodeName !== 'TEXTAREA' && element.nodeName !== 'SELECT')
          throw this.createStacklessError('Not an input element');
        received = (element as any).value;
      }

      if (received !== undefined && options.expectedText) {
        const matcher = new ExpectedTextMatcher(options.expectedText[0]);
        return { received, matches: matcher.matches(received) };
      }
    }

    throw this.createStacklessError('Unknown expect matcher: ' + expression);
  }

  expectArray(elements: Element[], options: FrameExpectParams): { matches: boolean, received?: any } {
    const expression = options.expression;

    if (expression === 'to.have.count') {
      const received = elements.length;
      const matches = received === options.expectedNumber;
      return { received, matches };
    }

    // List of values.
    let received: string[] | undefined;
    if (expression === 'to.have.text.array' || expression === 'to.contain.text.array')
      received = elements.map(e => options.useInnerText ? (e as HTMLElement).innerText : e.textContent || '');
    else if (expression === 'to.have.class.array')
      received = elements.map(e => e.className);

    if (received && options.expectedText) {
      // "To match an array" is "to contain an array" + "equal length"
      const lengthShouldMatch = expression !== 'to.contain.text.array';
      const matchesLength = received.length === options.expectedText.length || !lengthShouldMatch;
      if (!matchesLength)
        return { received, matches: false };

      // Each matcher should get a "received" that matches it, in order.
      let i = 0;
      const matchers = options.expectedText.map(e => new ExpectedTextMatcher(e));
      let allMatchesFound = true;
      for (const matcher of matchers) {
        while (i < received.length && !matcher.matches(received[i]))
          i++;
        if (i >= received.length) {
          allMatchesFound = false;
          break;
        }
      }
      return { received, matches: allMatchesFound };
    }
    throw this.createStacklessError('Unknown expect matcher: ' + expression);
  }

  getElementAccessibleName(element: Element, includeHidden?: boolean): string {
    const hiddenCache = new Map<Element, boolean>();
    return getElementAccessibleName(element, !!includeHidden, hiddenCache);
  }

  getAriaRole(element: Element) {
    return getAriaRole(element);
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

const kHoverHitTargetInterceptorEvents = new Set(['mousemove']);
const kTapHitTargetInterceptorEvents = new Set(['pointerdown', 'pointerup', 'touchstart', 'touchend', 'touchcancel']);
const kMouseHitTargetInterceptorEvents = new Set(['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'click', 'auxclick', 'dblclick', 'contextmenu']);
const kAllHitTargetInterceptorEvents = new Set([...kHoverHitTargetInterceptorEvents, ...kTapHitTargetInterceptorEvents, ...kMouseHitTargetInterceptorEvents]);

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

class ExpectedTextMatcher {
  _string: string | undefined;
  private _substring: string | undefined;
  private _regex: RegExp | undefined;
  private _normalizeWhiteSpace: boolean | undefined;

  constructor(expected: channels.ExpectedTextValue) {
    this._normalizeWhiteSpace = expected.normalizeWhiteSpace;
    this._string = expected.matchSubstring ? undefined : this.normalizeWhiteSpace(expected.string);
    this._substring = expected.matchSubstring ? this.normalizeWhiteSpace(expected.string) : undefined;
    this._regex = expected.regexSource ? new RegExp(expected.regexSource, expected.regexFlags) : undefined;
  }

  matches(text: string): boolean {
    if (this._normalizeWhiteSpace && !this._regex)
      text = this.normalizeWhiteSpace(text)!;
    if (this._string !== undefined)
      return text === this._string;
    if (this._substring !== undefined)
      return text.includes(this._substring);
    if (this._regex)
      return !!this._regex.test(text);
    return false;
  }

  private normalizeWhiteSpace(s: string | undefined): string | undefined {
    if (!s)
      return s;
    return this._normalizeWhiteSpace ? s.trim().replace(/\u200b/g, '').replace(/\s+/g, ' ') : s;
  }
}

function deepEquals(a: any, b: any): boolean {
  if (a === b)
    return true;

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    if (a.constructor !== b.constructor)
      return false;

    if (Array.isArray(a)) {
      if (a.length !== b.length)
        return false;
      for (let i = 0; i < a.length; ++i) {
        if (!deepEquals(a[i], b[i]))
          return false;
      }
      return true;
    }

    if (a instanceof RegExp)
      return a.source === b.source && a.flags === b.flags;
    // This covers Date.
    if (a.valueOf !== Object.prototype.valueOf)
      return a.valueOf() === b.valueOf();
    // This covers custom objects.
    if (a.toString !== Object.prototype.toString)
      return a.toString() === b.toString();

    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length)
      return false;

    for (let i = 0; i < keys.length; ++i) {
      if (!b.hasOwnProperty(keys[i]))
        return false;
    }

    for (const key of keys) {
      if (!deepEquals(a[key], b[key]))
        return false;
    }
    return true;
  }

  if (typeof a === 'number' && typeof b === 'number')
    return isNaN(a) && isNaN(b);

  return false;
}

module.exports = InjectedScript;
