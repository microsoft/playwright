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

import { parseAriaSnapshot } from '@isomorphic/ariaSnapshot';
import { asLocator } from '@isomorphic/locatorGenerators';
import { parseAttributeSelector, parseSelector, stringifySelector, visitAllSelectorParts } from '@isomorphic/selectorParser';
import { cacheNormalizedWhitespaces, normalizeWhiteSpace, trimStringWithEllipsis } from '@isomorphic/stringUtils';

import { generateAriaTree, getAllByAria, matchesAriaTree, renderAriaTree } from './ariaSnapshot';
import { enclosingShadowRootOrDocument, isElementVisible, isInsideScope, parentElementOrShadowHost, setGlobalOptions } from './domUtils';
import { Highlight } from './highlight';
import { kLayoutSelectorNames, layoutSelectorScore } from './layoutSelectorUtils';
import { createReactEngine } from './reactSelectorEngine';
import { createRoleEngine } from './roleSelectorEngine';
import { getAriaDisabled, getAriaRole, getCheckedAllowMixed, getCheckedWithoutMixed, getElementAccessibleDescription, getElementAccessibleErrorMessage, getElementAccessibleName, getReadonly } from './roleUtils';
import { SelectorEvaluatorImpl, sortInDOMOrder } from './selectorEvaluator';
import { generateSelector } from './selectorGenerator';
import { elementMatchesText, elementText, getElementLabels } from './selectorUtils';
import { createVueEngine } from './vueSelectorEngine';
import { XPathEngine } from './xpathSelectorEngine';
import { ConsoleAPI } from './consoleApi';
import { UtilityScript } from './utilityScript';

import type { AriaTemplateNode } from '@isomorphic/ariaSnapshot';
import type { CSSComplexSelectorList } from '@isomorphic/cssParser';
import type { Language } from '@isomorphic/locatorGenerators';
import type { NestedSelectorBody, ParsedSelector, ParsedSelectorPart } from '@isomorphic/selectorParser';
import type * as channels from '@protocol/channels';
import type { AriaSnapshot } from './ariaSnapshot';
import type { LayoutSelectorName } from './layoutSelectorUtils';
import type { SelectorEngine, SelectorRoot } from './selectorEngine';
import type { GenerateSelectorOptions } from './selectorGenerator';
import type { ElementText, TextMatcher } from './selectorUtils';
import type { Builtins } from './utilityScript';


export type FrameExpectParams = Omit<channels.FrameExpectParams, 'expectedValue' | 'timeout'> & { expectedValue?: any };

export type ElementState = 'visible' | 'hidden' | 'enabled' | 'disabled' | 'editable' | 'checked' | 'unchecked' | 'indeterminate' | 'stable';
export type ElementStateWithoutStable = Exclude<ElementState, 'stable'>;
export type ElementStateQueryResult = { matches: boolean, received?: string | 'error:notconnected' };

export type HitTargetInterceptionResult = {
  stop: () => 'done' | { hitTargetDescription: string };
};

interface WebKitLegacyDeviceOrientationEvent extends DeviceOrientationEvent {
  readonly initDeviceOrientationEvent: (type: string, bubbles: boolean, cancelable: boolean, alpha: number, beta: number, gamma: number, absolute: boolean) => void;
}

interface WebKitLegacyDeviceMotionEvent extends DeviceMotionEvent {
  readonly initDeviceMotionEvent: (type: string, bubbles: boolean, cancelable: boolean, acceleration: DeviceMotionEventAcceleration, accelerationIncludingGravity: DeviceMotionEventAcceleration, rotationRate: DeviceMotionEventRotationRate, interval: number) => void;
}

export type InjectedScriptOptions = {
  isUnderTest: boolean;
  sdkLanguage: Language;
  // For strict error and codegen
  testIdAttributeName: string;
  stableRafCount: number;
  browserName: string;
  customEngines: { name: string, source: string }[];
};

export class InjectedScript {
  private _engines: Map<string, SelectorEngine>;
  readonly _evaluator: SelectorEvaluatorImpl;
  private _stableRafCount: number;
  private _browserName: string;
  readonly onGlobalListenersRemoved: Set<() => void>;
  private _hitTargetInterceptor: undefined | ((event: MouseEvent | PointerEvent | TouchEvent) => void);
  private _highlight: Highlight | undefined;
  readonly isUnderTest: boolean;
  private _sdkLanguage: Language;
  private _testIdAttributeNameForStrictErrorAndConsoleCodegen: string = 'data-testid';
  private _markedElements?: { callId: string, elements: Set<Element> };
  // eslint-disable-next-line no-restricted-globals
  readonly window: Window & typeof globalThis;
  readonly document: Document;
  readonly consoleApi: ConsoleAPI;
  private _lastAriaSnapshot: AriaSnapshot | undefined;

  // Recorder must use any external dependencies through InjectedScript.
  // Otherwise it will end up with a copy of all modules it uses, and any
  // module-level globals will be duplicated, which leads to subtle bugs.
  readonly utils = {
    asLocator,
    cacheNormalizedWhitespaces,
    elementText,
    getAriaRole,
    getElementAccessibleDescription,
    getElementAccessibleName,
    isElementVisible,
    isInsideScope,
    normalizeWhiteSpace,
    parseAriaSnapshot,
    // Builtins protect injected code from clock emulation.
    builtins: null as unknown as Builtins,
  };

  private _autoClosingTags: Set<string>;
  private _booleanAttributes: Set<string>;
  private _eventTypes: Map<string, 'mouse' | 'keyboard' | 'touch' | 'pointer' | 'focus' | 'drag' | 'wheel' | 'deviceorientation' | 'devicemotion'>;
  private _hoverHitTargetInterceptorEvents: Set<string>;
  private _tapHitTargetInterceptorEvents: Set<string>;
  private _mouseHitTargetInterceptorEvents: Set<string>;
  private _allHitTargetInterceptorEvents: Set<string>;

  // eslint-disable-next-line no-restricted-globals
  constructor(window: Window & typeof globalThis, options: InjectedScriptOptions) {
    this.window = window;
    this.document = window.document;
    this.isUnderTest = options.isUnderTest;
    // Make sure builtins are created from "window". This is important for InjectedScript instantiated
    // inside a trace viewer snapshot, where "window" differs from "globalThis".
    this.utils.builtins = new UtilityScript(window, options.isUnderTest).builtins;
    this._sdkLanguage = options.sdkLanguage;
    this._testIdAttributeNameForStrictErrorAndConsoleCodegen = options.testIdAttributeName;
    this._evaluator = new SelectorEvaluatorImpl();
    this.consoleApi = new ConsoleAPI(this);

    this.onGlobalListenersRemoved = new Set();
    this._autoClosingTags = new Set(['AREA', 'BASE', 'BR', 'COL', 'COMMAND', 'EMBED', 'HR', 'IMG', 'INPUT', 'KEYGEN', 'LINK', 'MENUITEM', 'META', 'PARAM', 'SOURCE', 'TRACK', 'WBR']);
    this._booleanAttributes = new Set(['checked', 'selected', 'disabled', 'readonly', 'multiple']);
    this._eventTypes = new Map([
      ['auxclick', 'mouse'],
      ['click', 'mouse'],
      ['dblclick', 'mouse'],
      ['mousedown', 'mouse'],
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

      ['wheel', 'wheel'],

      ['deviceorientation', 'deviceorientation'],
      ['deviceorientationabsolute', 'deviceorientation'],

      ['devicemotion', 'devicemotion'],
    ]);
    this._hoverHitTargetInterceptorEvents = new Set(['mousemove']);
    this._tapHitTargetInterceptorEvents = new Set(['pointerdown', 'pointerup', 'touchstart', 'touchend', 'touchcancel']);
    this._mouseHitTargetInterceptorEvents = new Set(['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'click', 'auxclick', 'dblclick', 'contextmenu']);
    this._allHitTargetInterceptorEvents = new Set([...this._hoverHitTargetInterceptorEvents, ...this._tapHitTargetInterceptorEvents, ...this._mouseHitTargetInterceptorEvents]);

    this._engines = new Map();
    this._engines.set('xpath', XPathEngine);
    this._engines.set('xpath:light', XPathEngine);
    this._engines.set('_react', createReactEngine());
    this._engines.set('_vue', createVueEngine());
    this._engines.set('role', createRoleEngine(false));
    this._engines.set('text', this._createTextEngine(true, false));
    this._engines.set('text:light', this._createTextEngine(false, false));
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
    this._engines.set('internal:control', this._createControlEngine());
    this._engines.set('internal:has', this._createHasEngine());
    this._engines.set('internal:has-not', this._createHasNotEngine());
    this._engines.set('internal:and', { queryAll: () => [] });
    this._engines.set('internal:or', { queryAll: () => [] });
    this._engines.set('internal:chain', this._createInternalChainEngine());
    this._engines.set('internal:label', this._createInternalLabelEngine());
    this._engines.set('internal:text', this._createTextEngine(true, true));
    this._engines.set('internal:has-text', this._createInternalHasTextEngine());
    this._engines.set('internal:has-not-text', this._createInternalHasNotTextEngine());
    this._engines.set('internal:attr', this._createNamedAttributeEngine());
    this._engines.set('internal:testid', this._createNamedAttributeEngine());
    this._engines.set('internal:role', createRoleEngine(true));
    this._engines.set('internal:describe', this._createDescribeEngine());
    this._engines.set('aria-ref', this._createAriaRefEngine());

    for (const { name, source } of options.customEngines)
      this._engines.set(name, this.eval(source));

    this._stableRafCount = options.stableRafCount;
    this._browserName = options.browserName;
    setGlobalOptions({ browserNameForWorkarounds: options.browserName });

    this._setupGlobalListenersRemovalDetection();
    this._setupHitTargetInterceptors();

    if (this.isUnderTest)
      (this.window as any).__injectedScript = this;
  }

  eval(expression: string): any {
    return this.window.eval(expression);
  }

  testIdAttributeNameForStrictErrorAndConsoleCodegen(): string {
    return this._testIdAttributeNameForStrictErrorAndConsoleCodegen;
  }

  parseSelector(selector: string): ParsedSelector {
    const result = parseSelector(selector);
    visitAllSelectorParts(result, part => {
      if (!this._engines.has(part.name))
        throw this.createStacklessError(`Unknown engine "${part.name}" while parsing selector ${selector}`);
    });
    return result;
  }

  generateSelector(targetElement: Element, options: GenerateSelectorOptions) {
    return generateSelector(this, targetElement, options);
  }

  generateSelectorSimple(targetElement: Element, options?: GenerateSelectorOptions): string {
    return generateSelector(this, targetElement, { ...options, testIdAttributeName: this._testIdAttributeNameForStrictErrorAndConsoleCodegen }).selector;
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

  ariaSnapshot(node: Node, options?: { mode?: 'raw' | 'regex', forAI?: boolean, refPrefix?: string }): string {
    if (node.nodeType !== Node.ELEMENT_NODE)
      throw this.createStacklessError('Can only capture aria snapshot of Element nodes.');
    this._lastAriaSnapshot = generateAriaTree(node as Element, options);
    return renderAriaTree(this._lastAriaSnapshot, options);
  }

  ariaSnapshotForRecorder(): { ariaSnapshot: string, refs: Map<Element, string> } {
    const tree = generateAriaTree(this.document.body, { forAI: true });
    const ariaSnapshot = renderAriaTree(tree, { forAI: true });
    return { ariaSnapshot, refs: tree.refs };
  }

  getAllByAria(document: Document, template: AriaTemplateNode): Element[] {
    return getAllByAria(document.documentElement, template);
  }

  querySelectorAll(selector: ParsedSelector, root: Node): Element[] {
    if (selector.capture !== undefined) {
      if (selector.parts.some(part => part.name === 'nth'))
        throw this.createStacklessError(`Can't query n-th element in a request with the capture.`);
      const withHas: ParsedSelector = { parts: selector.parts.slice(0, selector.capture + 1) };
      if (selector.capture < selector.parts.length - 1) {
        const parsed: ParsedSelector = { parts: selector.parts.slice(selector.capture + 1) };
        const has: ParsedSelectorPart = { name: 'internal:has', body: { parsed }, source: stringifySelector(parsed) };
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

    // Workaround so that ":scope" matches the ShadowRoot.
    // This is, unfortunately, because an ElementHandle can point to any Node (including ShadowRoot/Document/etc),
    // and not just to an Element, and we support various APIs on ElementHandle like "textContent()".
    if (root.nodeType === 11 /* Node.DOCUMENT_FRAGMENT_NODE */ && selector.parts.length === 1 && selector.parts[0].name === 'css' && selector.parts[0].source === ':scope')
      return [root as Element];

    this._evaluator.begin();
    try {
      let roots = new Set<Element>([root as Element]);
      for (const part of selector.parts) {
        if (part.name === 'nth') {
          roots = this._queryNth(roots, part);
        } else if (part.name === 'internal:and') {
          const andElements = this.querySelectorAll((part.body as NestedSelectorBody).parsed, root);
          roots = new Set(andElements.filter(e => roots.has(e)));
        } else if (part.name === 'internal:or') {
          const orElements = this.querySelectorAll((part.body as NestedSelectorBody).parsed, root);
          roots = new Set(sortInDOMOrder(new Set([...roots, ...orElements])));
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

  private _createCSSEngine(): SelectorEngine {
    return {
      queryAll: (root: SelectorRoot, body: any) => {
        return this._evaluator.query({ scope: root as Document | Element, pierceShadow: true }, body);
      }
    };
  }

  private _createTextEngine(shadow: boolean, internal: boolean): SelectorEngine {
    const queryAll = (root: SelectorRoot, selector: string): Element[] => {
      const { matcher, kind } = createTextMatcher(selector, internal);
      const result: Element[] = [];
      let lastDidNotMatchSelf: Element | null = null;

      const appendElement = (element: Element) => {
        // TODO: replace contains() with something shadow-dom-aware?
        if (kind === 'lax' && lastDidNotMatchSelf && lastDidNotMatchSelf.contains(element))
          return false;
        const matches = elementMatchesText(this._evaluator._cacheText, element, matcher);
        if (matches === 'none')
          lastDidNotMatchSelf = element;
        if (matches === 'self' || (matches === 'selfAndChildren' && kind === 'strict' && !internal))
          result.push(element);
      };

      if (root.nodeType === Node.ELEMENT_NODE)
        appendElement(root as Element);
      const elements = this._evaluator._queryCSS({ scope: root as Document | Element, pierceShadow: shadow }, '*');
      for (const element of elements)
        appendElement(element);
      return result;
    };
    return { queryAll };
  }

  private _createInternalHasTextEngine(): SelectorEngine {
    return {
      queryAll: (root: SelectorRoot, selector: string): Element[] => {
        if (root.nodeType !== 1 /* Node.ELEMENT_NODE */)
          return [];
        const element = root as Element;
        const text = elementText(this._evaluator._cacheText, element);
        const { matcher } = createTextMatcher(selector, true);
        return matcher(text) ? [element] : [];
      }
    };
  }

  private _createInternalHasNotTextEngine(): SelectorEngine {
    return {
      queryAll: (root: SelectorRoot, selector: string): Element[] => {
        if (root.nodeType !== 1 /* Node.ELEMENT_NODE */)
          return [];
        const element = root as Element;
        const text = elementText(this._evaluator._cacheText, element);
        const { matcher } = createTextMatcher(selector, true);
        return matcher(text) ? [] : [element];
      }
    };
  }

  private _createInternalLabelEngine(): SelectorEngine {
    return {
      queryAll: (root: SelectorRoot, selector: string): Element[] => {
        const { matcher } = createTextMatcher(selector, true);
        const allElements = this._evaluator._queryCSS({ scope: root as Document | Element, pierceShadow: true }, '*');
        return allElements.filter(element => {
          return getElementLabels(this._evaluator._cacheText, element).some(label => matcher(label));
        });
      }
    };
  }

  private _createNamedAttributeEngine(): SelectorEngine {
    const queryAll = (root: SelectorRoot, selector: string): Element[] => {
      const parsed = parseAttributeSelector(selector, true);
      if (parsed.name || parsed.attributes.length !== 1)
        throw new Error('Malformed attribute selector: ' + selector);
      const { name, value, caseSensitive } = parsed.attributes[0];
      const lowerCaseValue = caseSensitive ? null : value.toLowerCase();
      let matcher: (s: string) => boolean;
      if (value instanceof RegExp)
        matcher = s => !!s.match(value);
      else if (caseSensitive)
        matcher = s => s === value;
      else
        matcher = s => s.toLowerCase().includes(lowerCaseValue!);
      const elements = this._evaluator._queryCSS({ scope: root as Document | Element, pierceShadow: true }, `[${name}]`);
      return elements.filter(e => matcher(e.getAttribute(name)!));
    };
    return { queryAll };
  }

  private _createDescribeEngine(): SelectorEngine {
    const queryAll = (root: SelectorRoot): Element[] => {
      if (root.nodeType !== 1 /* Node.ELEMENT_NODE */)
        return [];
      return [root as Element];
    };
    return { queryAll };
  }

  private _createControlEngine(): SelectorEngine {
    return {
      queryAll(root: SelectorRoot, body: any) {
        if (body === 'enter-frame')
          return [];
        if (body === 'return-empty')
          return [];
        if (body === 'component') {
          if (root.nodeType !== 1 /* Node.ELEMENT_NODE */)
            return [];
          // Usually, we return the mounted component that is a single child.
          // However, when mounting fragments, return the root instead.
          return [root.childElementCount === 1 ? root.firstElementChild! : root as Element];
        }
        throw new Error(`Internal error, unknown internal:control selector ${body}`);
      }
    };
  }

  private _createHasEngine(): SelectorEngine {
    const queryAll = (root: SelectorRoot, body: NestedSelectorBody) => {
      if (root.nodeType !== 1 /* Node.ELEMENT_NODE */)
        return [];
      const has = !!this.querySelector(body.parsed, root, false);
      return has ? [root as Element] : [];
    };
    return { queryAll };
  }

  private _createHasNotEngine(): SelectorEngine {
    const queryAll = (root: SelectorRoot, body: NestedSelectorBody) => {
      if (root.nodeType !== 1 /* Node.ELEMENT_NODE */)
        return [];
      const has = !!this.querySelector(body.parsed, root, false);
      return has ? [] : [root as Element];
    };
    return { queryAll };
  }

  private _createVisibleEngine(): SelectorEngine {
    const queryAll = (root: SelectorRoot, body: string) => {
      if (root.nodeType !== 1 /* Node.ELEMENT_NODE */)
        return [];
      const visible = body === 'true';
      return isElementVisible(root as Element) === visible ? [root as Element] : [];
    };
    return { queryAll };
  }

  private _createInternalChainEngine(): SelectorEngine {
    const queryAll = (root: SelectorRoot, body: NestedSelectorBody) => {
      return this.querySelectorAll(body.parsed, root);
    };
    return { queryAll };
  }

  extend(source: string, params: any): any {
    const constrFunction = this.window.eval(`
    (() => {
      const module = {};
      ${source}
      return module.exports.default();
    })()`);
    return new constrFunction(this, params);
  }

  async viewportRatio(element: Element): Promise<number> {
    return await new Promise(resolve => {
      const observer = new IntersectionObserver(entries => {
        resolve(entries[0].intersectionRatio);
        observer.disconnect();
      });
      observer.observe(element);
      // Firefox doesn't call IntersectionObserver callback unless
      // there are rafs.
      this.utils.builtins.requestAnimationFrame(() => {});
    });
  }

  getElementBorderWidth(node: Node): { left: number; top: number; } {
    if (node.nodeType !== Node.ELEMENT_NODE || !node.ownerDocument || !node.ownerDocument.defaultView)
      return { left: 0, top: 0 };
    const style = node.ownerDocument.defaultView.getComputedStyle(node as Element);
    return { left: parseInt(style.borderLeftWidth || '', 10), top: parseInt(style.borderTopWidth || '', 10) };
  }

  describeIFrameStyle(iframe: Element): 'error:notconnected' | 'transformed' | { left: number, top: number } {
    if (!iframe.ownerDocument || !iframe.ownerDocument.defaultView)
      return 'error:notconnected';
    const defaultView = iframe.ownerDocument.defaultView;
    for (let e: Element | undefined = iframe; e; e = parentElementOrShadowHost(e)) {
      if (defaultView.getComputedStyle(e).transform !== 'none')
        return 'transformed';
    }
    const iframeStyle = defaultView.getComputedStyle(iframe);
    return {
      left: parseInt(iframeStyle.borderLeftWidth || '', 10) + parseInt(iframeStyle.paddingLeft || '', 10),
      top: parseInt(iframeStyle.borderTopWidth || '', 10) + parseInt(iframeStyle.paddingTop || '', 10),
    };
  }

  retarget(node: Node, behavior: 'none' | 'follow-label' | 'no-follow-label' | 'button-link'): Element | null {
    let element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
    if (!element)
      return null;
    if (behavior === 'none')
      return element;
    if (!element.matches('input, textarea, select') && !(element as any).isContentEditable) {
      if (behavior === 'button-link')
        element = element.closest('button, [role=button], a, [role=link]') || element;
      else
        element = element.closest('button, [role=button], [role=checkbox], [role=radio]') || element;
    }
    if (behavior === 'follow-label') {
      if (!element.matches('a, input, textarea, button, select, [role=link], [role=button], [role=checkbox], [role=radio]') &&
        !(element as any).isContentEditable) {
        // Go up to the label that might be connected to the input/textarea.
        const enclosingLabel: HTMLLabelElement | null = element.closest('label');
        if (enclosingLabel && enclosingLabel.control)
          element = enclosingLabel.control;
      }
    }
    return element;
  }

  async checkElementStates(node: Node, states: ElementState[]): Promise<'error:notconnected' | { missingState: ElementState } | undefined> {
    if (states.includes('stable')) {
      const stableResult = await this._checkElementIsStable(node);
      if (stableResult === false)
        return { missingState: 'stable' };
      if (stableResult === 'error:notconnected')
        return 'error:notconnected';
    }
    for (const state of states) {
      if (state !== 'stable') {
        const result = this.elementState(node, state);
        if (result.received === 'error:notconnected')
          return 'error:notconnected';
        if (!result.matches)
          return { missingState: state };
      }
    }
  }

  private async _checkElementIsStable(node: Node): Promise<'error:notconnected' | boolean> {
    const continuePolling = Symbol('continuePolling');
    let lastRect: { x: number, y: number, width: number, height: number } | undefined;
    let stableRafCounter = 0;
    let lastTime = 0;

    const check = () => {
      const element = this.retarget(node, 'no-follow-label');
      if (!element)
        return 'error:notconnected';

      // Drop frames that are shorter than 16ms - WebKit Win bug.
      const time = this.utils.builtins.performance.now();
      if (this._stableRafCount > 1 && time - lastTime < 15)
        return continuePolling;
      lastTime = time;

      const clientRect = element.getBoundingClientRect();
      const rect = { x: clientRect.top, y: clientRect.left, width: clientRect.width, height: clientRect.height };
      if (lastRect) {
        const samePosition = rect.x === lastRect.x && rect.y === lastRect.y && rect.width === lastRect.width && rect.height === lastRect.height;
        if (!samePosition)
          return false;
        if (++stableRafCounter >= this._stableRafCount)
          return true;
      }
      lastRect = rect;
      return continuePolling;
    };

    let fulfill: (result: 'error:notconnected' | boolean) => void;
    let reject: (error: Error) => void;
    const result = new Promise<'error:notconnected' | boolean>((f, r) => { fulfill = f; reject = r; });

    const raf = () => {
      try {
        const success = check();
        if (success !== continuePolling)
          fulfill(success);
        else
          this.utils.builtins.requestAnimationFrame(raf);
      } catch (e) {
        reject(e);
      }
    };
    this.utils.builtins.requestAnimationFrame(raf);

    return result;
  }

  _createAriaRefEngine() {
    const queryAll = (root: SelectorRoot, selector: string): Element[] => {
      const result = this._lastAriaSnapshot?.elements?.get(selector);
      return result && result.isConnected ? [result] : [];
    };
    return { queryAll };
  }

  elementState(node: Node, state: ElementStateWithoutStable): ElementStateQueryResult {
    const element = this.retarget(node, ['visible', 'hidden'].includes(state) ? 'none' : 'follow-label');
    if (!element || !element.isConnected) {
      if (state === 'hidden')
        return { matches: true, received: 'hidden' };
      return { matches: false, received: 'error:notconnected' };
    }

    if (state === 'visible' || state === 'hidden') {
      const visible = isElementVisible(element);
      return {
        matches: state === 'visible' ? visible : !visible,
        received: visible ? 'visible' : 'hidden'
      };
    }

    if (state === 'disabled' || state === 'enabled') {
      const disabled = getAriaDisabled(element);
      return {
        matches: state === 'disabled' ? disabled : !disabled,
        received: disabled ? 'disabled' : 'enabled'
      };
    }

    if (state === 'editable') {
      const disabled = getAriaDisabled(element);
      const readonly = getReadonly(element);
      if (readonly === 'error')
        throw this.createStacklessError('Element is not an <input>, <textarea>, <select> or [contenteditable] and does not have a role allowing [aria-readonly]');
      return {
        matches: !disabled && !readonly,
        received: disabled ? 'disabled' : readonly ? 'readOnly' : 'editable'
      };
    }

    if (state === 'checked' || state === 'unchecked') {
      const need = state === 'checked';
      const checked = getCheckedWithoutMixed(element);
      if (checked === 'error')
        throw this.createStacklessError('Not a checkbox or radio button');
      return {
        matches: need === checked,
        received: checked ? 'checked' : 'unchecked',
      };
    }

    if (state === 'indeterminate') {
      const checked = getCheckedAllowMixed(element);
      if (checked === 'error')
        throw this.createStacklessError('Not a checkbox or radio button');
      return {
        matches: checked === 'mixed',
        received: checked === true ? 'checked' : checked === false ? 'unchecked' : 'mixed',
      };
    }
    throw this.createStacklessError(`Unexpected element state "${state}"`);
  }

  selectOptions(node: Node, optionsToSelect: (Node | { valueOrLabel?: string, value?: string, label?: string, index?: number })[]): string[] | 'error:notconnected' | 'error:optionsnotfound' | 'error:optionnotenabled' {
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
      const filter = (optionToSelect: Node | { valueOrLabel?: string, value?: string, label?: string, index?: number }) => {
        if (optionToSelect instanceof Node)
          return option === optionToSelect;
        let matches = true;
        if (optionToSelect.valueOrLabel !== undefined)
          matches = matches && (optionToSelect.valueOrLabel === option.value || optionToSelect.valueOrLabel === option.label);
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
      if (!this.elementState(option, 'enabled').matches)
        return 'error:optionnotenabled';
      selectedOptions.push(option);
      if (select.multiple) {
        remainingOptionsToSelect = remainingOptionsToSelect.filter(o => !filter(o));
      } else {
        remainingOptionsToSelect = [];
        break;
      }
    }
    if (remainingOptionsToSelect.length)
      return 'error:optionsnotfound';
    select.value = undefined as any;
    selectedOptions.forEach(option => option.selected = true);
    select.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return selectedOptions.map(option => option.value);
  }

  fill(node: Node, value: string): 'error:notconnected' | 'needsinput' | 'done' {
    const element = this.retarget(node, 'follow-label');
    if (!element)
      return 'error:notconnected';
    if (element.nodeName.toLowerCase() === 'input') {
      const input = element as HTMLInputElement;
      const type = input.type.toLowerCase();
      const kInputTypesToSetValue = new Set(['color', 'date', 'time', 'datetime-local', 'month', 'range', 'week']);
      const kInputTypesToTypeInto = new Set(['', 'email', 'number', 'password', 'search', 'tel', 'text', 'url']);
      if (!kInputTypesToTypeInto.has(type) && !kInputTypesToSetValue.has(type))
        throw this.createStacklessError(`Input of type "${type}" cannot be filled`);
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
        element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
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

  private _activelyFocused(node: Node): { activeElement: Element | null, isFocused: boolean } {
    const activeElement = (node.getRootNode() as (Document | ShadowRoot)).activeElement;
    const isFocused = activeElement === node && !!node.ownerDocument && node.ownerDocument.hasFocus();
    return { activeElement, isFocused };
  }

  focusNode(node: Node, resetSelectionIfNotFocused?: boolean): 'error:notconnected' | 'done' {
    if (!node.isConnected)
      return 'error:notconnected';
    if (node.nodeType !== Node.ELEMENT_NODE)
      throw this.createStacklessError('Node is not an element');

    const { activeElement, isFocused: wasFocused } = this._activelyFocused(node);
    if ((node as HTMLElement).isContentEditable && !wasFocused && activeElement && (activeElement as HTMLElement | SVGElement).blur) {
      // Workaround the Firefox bug where focusing the element does not switch current
      // contenteditable to the new element. However, blurring the previous one helps.
      (activeElement as HTMLElement | SVGElement).blur();
    }
    // On firefox, we have to call focus() twice to actually focus an element in certain
    // scenarios.
    (node as HTMLElement | SVGElement).focus();
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

  blurNode(node: Node): 'error:notconnected' | 'done' {
    if (!node.isConnected)
      return 'error:notconnected';
    if (node.nodeType !== Node.ELEMENT_NODE)
      throw this.createStacklessError('Node is not an element');
    (node as HTMLElement | SVGElement).blur();
    return 'done';
  }

  setInputFiles(node: Node, payloads: { name: string, mimeType: string, buffer: string, lastModifiedMs?: number }[]) {
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
      return new File([bytes], file.name, { type: file.mimeType, lastModified: file.lastModifiedMs });
    });
    const dt = new DataTransfer();
    for (const file of files)
      dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  expectHitTarget(hitPoint: { x: number, y: number }, targetElement: Element) {
    const roots: (Document | ShadowRoot)[] = [];

    // Get all component roots leading to the target element.
    // Go from the bottom to the top to make it work with closed shadow roots.
    let parentElement = targetElement;
    while (parentElement) {
      const root = enclosingShadowRootOrDocument(parentElement);
      if (!root)
        break;
      roots.push(root);
      if (root.nodeType === 9 /* Node.DOCUMENT_NODE */)
        break;
      parentElement = (root as ShadowRoot).host;
    }

    // Hit target in each component root should point to the next component root.
    // Hit target in the last component root should point to the target or its descendant.
    let hitElement: Element | undefined;
    for (let index = roots.length - 1; index >= 0; index--) {
      const root = roots[index];
      // All browsers have different behavior around elementFromPoint and elementsFromPoint.
      // https://github.com/w3c/csswg-drafts/issues/556
      // http://crbug.com/1188919
      const elements: Element[] = root.elementsFromPoint(hitPoint.x, hitPoint.y);
      const singleElement = root.elementFromPoint(hitPoint.x, hitPoint.y);
      if (singleElement && elements[0] && parentElementOrShadowHost(singleElement) === elements[0]) {
        const style = this.window.getComputedStyle(singleElement);
        if (style?.display === 'contents') {
          // Workaround a case where elementsFromPoint misses the inner-most element with display:contents.
          // https://bugs.chromium.org/p/chromium/issues/detail?id=1342092
          elements.unshift(singleElement);
        }
      }
      if (elements[0] && elements[0].shadowRoot === root && elements[1] === singleElement) {
        // Workaround webkit but where first two elements are swapped:
        // <host>
        //   #shadow root
        //     <target>
        // elementsFromPoint produces [<host>, <target>], while it should be [<target>, <host>]
        // In this case, just ignore <host>.
        elements.shift();
      }
      const innerElement = elements[0] as Element | undefined;
      if (!innerElement)
        break;
      hitElement = innerElement;
      if (index && innerElement !== (roots[index - 1] as ShadowRoot).host)
        break;
    }

    // Check whether hit target is the target or its descendant.
    const hitParents: Element[] = [];
    while (hitElement && hitElement !== targetElement) {
      hitParents.push(hitElement);
      hitElement = parentElementOrShadowHost(hitElement);
    }
    if (hitElement === targetElement)
      return 'done';

    const hitTargetDescription = this.previewNode(hitParents[0] || this.document.documentElement);
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

  // Life of a pointer action, for example click.
  //
  // 0. Retry items 1 and 2 while action fails due to navigation or element being detached.
  //   1. Resolve selector to an element.
  //   2. Retry the following steps until the element is detached or frame navigates away.
  //     2a. Wait for the element to be stable (not moving), visible and enabled.
  //     2b. Scroll element into view. Scrolling alternates between:
  //         - Built-in protocol scrolling.
  //         - Anchoring to the top/left, bottom/right and center/center.
  //         This is to scroll elements from under sticky headers/footers.
  //     2c. Click point is calculated, either based on explicitly specified position,
  //         or some visible point of the element based on protocol content quads.
  //     2d. Click point relative to page viewport is converted relative to the target iframe
  //         for the next hit-point check.
  //     2e. (injected) Hit target at the click point must be a descendant of the target element.
  //         This prevents mis-clicking in edge cases like <iframe> overlaying the target.
  //     2f. (injected) Events specific for click (or some other action type) are intercepted on
  //         the Window with capture:true. See 2i for details.
  //         Note: this step is skipped for drag&drop (see inline comments for the reason).
  //     2g. Necessary keyboard modifiers are pressed.
  //     2h. Click event is issued (mousemove + mousedown + mouseup).
  //     2i. (injected) For each event, we check that hit target at the event point
  //         is a descendant of the target element.
  //         This guarantees no race between issuing the event and handling it in the page,
  //         for example due to layout shift.
  //         When hit target check fails, we block all future events in the page.
  //     2j. Keyboard modifiers are restored.
  //     2k. (injected) Event interceptor is removed.
  //     2l. All navigations triggered between 2g-2k are awaited to be either committed or canceled.
  //     2m. If failed, wait for increasing amount of time before the next retry.
  setupHitTargetInterceptor(node: Node, action: 'hover' | 'tap' | 'mouse' | 'drag', hitPoint: { x: number, y: number } | undefined, blockAllEvents: boolean): HitTargetInterceptionResult | 'error:notconnected' | string /* hitTargetDescription */ {
    const element = this.retarget(node, 'button-link');
    if (!element || !element.isConnected)
      return 'error:notconnected';

    if (hitPoint) {
      // First do a preliminary check, to reduce the possibility of some iframe
      // intercepting the action.
      const preliminaryResult = this.expectHitTarget(hitPoint, element);
      if (preliminaryResult !== 'done')
        return preliminaryResult.hitTargetDescription;
    }

    // When dropping, the "element that is being dragged" often stays under the cursor,
    // so hit target check at the moment we receive mousedown does not work -
    // it finds the "element that is being dragged" instead of the
    // "element that we drop onto".
    if (action === 'drag')
      return { stop: () => 'done' };

    const events = {
      'hover': this._hoverHitTargetInterceptorEvents,
      'tap': this._tapHitTargetInterceptorEvents,
      'mouse': this._mouseHitTargetInterceptorEvents,
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
      const point = (!!this.window.TouchEvent && (event instanceof this.window.TouchEvent)) ? event.touches[0] : (event as MouseEvent | PointerEvent);

      // Check that we hit the right element at the first event, and assume all
      // subsequent events will be fine.
      if (result === undefined && point)
        result = this.expectHitTarget({ x: point.clientX, y: point.clientY }, element);

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

  dispatchEvent(node: Node, type: string, eventInitObj: Object) {
    let event;
    const eventInit: any = { bubbles: true, cancelable: true, composed: true, ...eventInitObj };
    switch (this._eventTypes.get(type)) {
      case 'mouse': event = new MouseEvent(type, eventInit); break;
      case 'keyboard': event = new KeyboardEvent(type, eventInit); break;
      case 'touch': {
        // WebKit does not support Touch constructor, but has deprecated createTouch and createTouchList methods.
        if (this._browserName === 'webkit') {
          const createTouch = (t: any) => {
            if (t instanceof Touch)
              return t;
            // createTouch does not accept clientX/clientY, so we have to use pageX/pageY.
            let pageX = t.pageX;
            if (pageX === undefined && t.clientX !== undefined)
              pageX = t.clientX + (this.document.scrollingElement?.scrollLeft || 0);
            let pageY = t.pageY;
            if (pageY === undefined && t.clientY !== undefined)
              pageY = t.clientY + (this.document.scrollingElement?.scrollTop || 0);
            return (this.document as any).createTouch(this.window, t.target ?? node, t.identifier, pageX, pageY, t.screenX, t.screenY, t.radiusX, t.radiusY, t.rotationAngle, t.force);
          };
          const createTouchList = (touches: any) => {
            if (touches instanceof TouchList || !touches)
              return touches;
            return (this.document as any).createTouchList(...touches.map(createTouch));
          };
          eventInit.target ??= node;
          eventInit.touches = createTouchList(eventInit.touches);
          eventInit.targetTouches = createTouchList(eventInit.targetTouches);
          eventInit.changedTouches = createTouchList(eventInit.changedTouches);
          event = new TouchEvent(type, eventInit);
        } else {
          eventInit.target ??= node;
          eventInit.touches = eventInit.touches?.map((t: any) => t instanceof Touch ? t : new Touch({ ...t, target: t.target ?? node }));
          eventInit.targetTouches = eventInit.targetTouches?.map((t: any) => t instanceof Touch ? t : new Touch({ ...t, target: t.target ?? node }));
          eventInit.changedTouches = eventInit.changedTouches?.map((t: any) => t instanceof Touch ? t : new Touch({ ...t, target: t.target ?? node }));
          event = new TouchEvent(type, eventInit);
        }
        break;
      }
      case 'pointer': event = new PointerEvent(type, eventInit); break;
      case 'focus': event = new FocusEvent(type, eventInit); break;
      case 'drag': event = new DragEvent(type, eventInit); break;
      case 'wheel': event = new WheelEvent(type, eventInit); break;
      case 'deviceorientation':
        try {
          event = new DeviceOrientationEvent(type, eventInit);
        } catch {
          const { bubbles, cancelable, alpha, beta, gamma, absolute } = eventInit as {bubbles: boolean, cancelable: boolean, alpha: number, beta: number, gamma: number, absolute: boolean};
          event = this.document.createEvent('DeviceOrientationEvent') as WebKitLegacyDeviceOrientationEvent;
          event.initDeviceOrientationEvent(type, bubbles, cancelable, alpha, beta, gamma, absolute);
        }
        break;
      case 'devicemotion':
        try {
          event = new DeviceMotionEvent(type, eventInit);
        } catch {
          const { bubbles, cancelable, acceleration, accelerationIncludingGravity, rotationRate, interval } = eventInit as {bubbles: boolean, cancelable: boolean, acceleration: DeviceMotionEventAcceleration, accelerationIncludingGravity: DeviceMotionEventAcceleration, rotationRate: DeviceMotionEventRotationRate, interval: number};
          event = this.document.createEvent('DeviceMotionEvent') as WebKitLegacyDeviceMotionEvent;
          event.initDeviceMotionEvent(type, bubbles, cancelable, acceleration, accelerationIncludingGravity, rotationRate, interval);
        }
        break;
      default: event = new Event(type, eventInit); break;
    }
    node.dispatchEvent(event);
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
      if (!value && this._booleanAttributes.has(name))
        attrs.push(` ${name}`);
      else
        attrs.push(` ${name}="${value}"`);
    }
    attrs.sort((a, b) => a.length - b.length);
    const attrText = trimStringWithEllipsis(attrs.join(''), 500);
    if (this._autoClosingTags.has(element.nodeName))
      return oneLine(`<${element.nodeName.toLowerCase()}${attrText}/>`);

    const children = element.childNodes;
    let onlyText = false;
    if (children.length <= 5) {
      onlyText = true;
      for (let i = 0; i < children.length; i++)
        onlyText = onlyText && children[i].nodeType === Node.TEXT_NODE;
    }
    const text = onlyText ? (element.textContent || '') : (children.length ? '\u2026' : '');
    return oneLine(`<${element.nodeName.toLowerCase()}${attrText}>${trimStringWithEllipsis(text, 50)}</${element.nodeName.toLowerCase()}>`);
  }

  strictModeViolationError(selector: ParsedSelector, matches: Element[]): Error {
    const infos = matches.slice(0, 10).map(m => ({
      preview: this.previewNode(m),
      selector: this.generateSelectorSimple(m),
    }));
    const lines = infos.map((info, i) => `\n    ${i + 1}) ${info.preview} aka ${asLocator(this._sdkLanguage, info.selector)}`);
    if (infos.length < matches.length)
      lines.push('\n    ...');
    return this.createStacklessError(`strict mode violation: ${asLocator(this._sdkLanguage, stringifySelector(selector))} resolved to ${matches.length} elements:${lines.join('')}\n`);
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

  createHighlight() {
    return new Highlight(this);
  }

  maskSelectors(selectors: ParsedSelector[], color: string) {
    if (this._highlight)
      this.hideHighlight();
    this._highlight = new Highlight(this);
    this._highlight.install();
    const elements = [];
    for (const selector of selectors)
      elements.push(this.querySelectorAll(selector, this.document.documentElement));
    this._highlight.maskElements(elements.flat(), color);
  }

  highlight(selector: ParsedSelector) {
    if (!this._highlight) {
      this._highlight = new Highlight(this);
      this._highlight.install();
    }
    this._highlight.runHighlightOnRaf(selector);
  }

  hideHighlight() {
    if (this._highlight) {
      this._highlight.uninstall();
      delete this._highlight;
    }
  }

  markTargetElements(markedElements: Set<Element>, callId: string) {
    if (this._markedElements?.callId !== callId)
      this._markedElements = undefined;
    const previous = this._markedElements?.elements || new Set();

    const unmarkEvent = new CustomEvent('__playwright_unmark_target__', {
      bubbles: true,
      cancelable: true,
      detail: callId,
      composed: true,
    });
    for (const element of previous) {
      if (!markedElements.has(element))
        element.dispatchEvent(unmarkEvent);
    }

    const markEvent = new CustomEvent('__playwright_mark_target__', {
      bubbles: true,
      cancelable: true,
      detail: callId,
      composed: true,
    });
    for (const element of markedElements) {
      if (!previous.has(element))
        element.dispatchEvent(markEvent);
    }

    this._markedElements = { callId, elements: markedElements };
  }

  private _setupGlobalListenersRemovalDetection() {
    const customEventName = '__playwright_global_listeners_check__';

    let seenEvent = false;
    const handleCustomEvent = () => seenEvent = true;
    this.window.addEventListener(customEventName, handleCustomEvent);

    new MutationObserver(entries => {
      const newDocumentElement = entries.some(entry => Array.from(entry.addedNodes).includes(this.document.documentElement));
      if (!newDocumentElement)
        return;

      // New documentElement - let's check whether listeners are still here.
      seenEvent = false;
      this.window.dispatchEvent(new CustomEvent(customEventName));
      if (seenEvent)
        return;

      // Listener did not fire. Reattach the listener and notify.
      this.window.addEventListener(customEventName, handleCustomEvent);
      for (const callback of this.onGlobalListenersRemoved)
        callback();
    }).observe(this.document, { childList: true });
  }

  private _setupHitTargetInterceptors() {
    const listener = (event: PointerEvent | MouseEvent | TouchEvent) => this._hitTargetInterceptor?.(event);
    const addHitTargetInterceptorListeners = () => {
      for (const event of this._allHitTargetInterceptorEvents)
        this.window.addEventListener(event as any, listener, { capture: true, passive: false });
    };
    addHitTargetInterceptorListeners();
    this.onGlobalListenersRemoved.add(addHitTargetInterceptorListeners);
  }

  async expect(element: Element | undefined, options: FrameExpectParams, elements: Element[]): Promise<{ matches: boolean, received?: any, missingReceived?: boolean }> {
    const isArray = options.expression === 'to.have.count' || options.expression.endsWith('.array');
    if (isArray)
      return this.expectArray(elements, options);
    if (!element) {
      // expect(locator).toBeHidden() passes when there is no element.
      if (!options.isNot && options.expression === 'to.be.hidden')
        return { matches: true };
      // expect(locator).not.toBeVisible() passes when there is no element.
      if (options.isNot && options.expression === 'to.be.visible')
        return { matches: false };
      // expect(locator).toBeAttached({ attached: false }) passes when there is no element.
      if (!options.isNot && options.expression === 'to.be.detached')
        return { matches: true };
      // expect(locator).not.toBeAttached() passes when there is no element.
      if (options.isNot && options.expression === 'to.be.attached')
        return { matches: false };
      // expect(locator).not.toBeInViewport() passes when there is no element.
      if (options.isNot && options.expression === 'to.be.in.viewport')
        return { matches: false };
      if (options.expression === 'to.have.title' && options?.expectedText?.[0]) {
        const matcher = new ExpectedTextMatcher(options.expectedText[0]);
        const received = this.document.title;
        return { received, matches: matcher.matches(received) };
      }
      if (options.expression === 'to.have.url' && options?.expectedText?.[0]) {
        const matcher = new ExpectedTextMatcher(options.expectedText[0]);
        const received = this.document.location.href;
        return { received, matches: matcher.matches(received) };
      }
      // When none of the above applies, expect does not match.
      return { matches: options.isNot, missingReceived: true };
    }
    return await this.expectSingleElement(element, options);
  }

  private async expectSingleElement(element: Element, options: FrameExpectParams): Promise<{ matches: boolean, received?: any }> {
    const expression = options.expression;

    {
      // Element state / boolean values.
      let result: ElementStateQueryResult | undefined;
      if (expression === 'to.have.attribute') {
        const hasAttribute = element.hasAttribute(options.expressionArg);
        result = {
          matches: hasAttribute,
          received: hasAttribute ? 'attribute present' : 'attribute not present',
        };
      } else if (expression === 'to.be.checked') {
        const { checked, indeterminate } = options.expectedValue;
        if (indeterminate) {
          if (checked !== undefined)
            throw this.createStacklessError('Can\'t assert indeterminate and checked at the same time');
          result = this.elementState(element, 'indeterminate');
        } else {
          result = this.elementState(element, checked === false ? 'unchecked' : 'checked');
        }
      } else if (expression === 'to.be.disabled') {
        result = this.elementState(element, 'disabled');
      } else if (expression === 'to.be.editable') {
        result = this.elementState(element, 'editable');
      } else if (expression === 'to.be.readonly') {
        result = this.elementState(element, 'editable');
        result.matches = !result.matches;
      } else if (expression === 'to.be.empty') {
        if (element.nodeName === 'INPUT' || element.nodeName === 'TEXTAREA') {
          const value = (element as HTMLInputElement).value;
          result = { matches: !value, received: value ? 'notEmpty' : 'empty' };
        } else {
          const text = element.textContent?.trim();
          result = { matches: !text, received: text ? 'notEmpty' : 'empty' };
        }
      } else if (expression === 'to.be.enabled') {
        result = this.elementState(element, 'enabled');
      } else if (expression === 'to.be.focused') {
        const focused = this._activelyFocused(element).isFocused;
        result = {
          matches: focused,
          received: focused ? 'focused' : 'inactive',
        };
      } else if (expression === 'to.be.hidden') {
        result = this.elementState(element, 'hidden');
      } else if (expression === 'to.be.visible') {
        result = this.elementState(element, 'visible');
      } else if (expression === 'to.be.attached') {
        result = {
          matches: true,
          received: 'attached',
        };
      } else if (expression === 'to.be.detached') {
        result = {
          matches: false,
          received: 'attached',
        };
      }

      if (result) {
        if (result.received === 'error:notconnected')
          throw this.createStacklessError('Element is not connected');
        return result;
      }
    }

    {
      // JS property
      if (expression === 'to.have.property') {
        let target = element;
        const properties = options.expressionArg.split('.');
        for (let i = 0; i < properties.length - 1; i++) {
          if (typeof target !== 'object' || !(properties[i] in target))
            return { received: undefined, matches: false };
          target = (target as any)[properties[i]];
        }
        const received = (target as any)[properties[properties.length - 1]];
        const matches = deepEquals(received, options.expectedValue);
        return { received, matches };
      }
    }
    {
      // Viewport intersection
      if (expression === 'to.be.in.viewport') {
        const ratio = await this.viewportRatio(element);
        return { received: `viewport ratio ${ratio}`, matches: ratio > 0 && ratio > (options.expectedNumber ?? 0) - 1e-9 };
      }
    }

    // Multi-Select/Combobox
    {
      if (expression === 'to.have.values') {
        element = this.retarget(element, 'follow-label')!;
        if (element.nodeName !== 'SELECT' || !(element as HTMLSelectElement).multiple)
          throw this.createStacklessError('Not a select element with a multiple attribute');

        const received = [...(element as HTMLSelectElement).selectedOptions].map(o => o.value);
        if (received.length !== options.expectedText!.length)
          return { received, matches: false };
        return { received, matches: received.map((r, i) => new ExpectedTextMatcher(options.expectedText![i]).matches(r)).every(Boolean) };
      }
    }

    {
      if (expression === 'to.match.aria') {
        const result = matchesAriaTree(element, options.expectedValue);
        return {
          received: result.received,
          matches: !!result.matches.length,
        };
      }
    }

    {
      // Single text value.
      let received: string | undefined;
      if (expression === 'to.have.attribute.value') {
        const value = element.getAttribute(options.expressionArg);
        if (value === null)
          return { received: null, matches: false };
        received = value;
      } else if (['to.have.class', 'to.contain.class'].includes(expression)) {
        if (!options.expectedText)
          throw this.createStacklessError('Expected text is not provided for ' + expression);
        return {
          received: element.classList.toString(),
          matches: new ExpectedTextMatcher(options.expectedText[0]).matchesClassList(this, element.classList, /* partial */ expression === 'to.contain.class'),
        };
      } else if (expression === 'to.have.css') {
        received = this.window.getComputedStyle(element).getPropertyValue(options.expressionArg);
      } else if (expression === 'to.have.id') {
        received = element.id;
      } else if (expression === 'to.have.text') {
        received = options.useInnerText ? (element as HTMLElement).innerText : elementText(new Map(), element).full;
      } else if (expression === 'to.have.accessible.name') {
        received = getElementAccessibleName(element, false /* includeHidden */);
      } else if (expression === 'to.have.accessible.description') {
        received = getElementAccessibleDescription(element, false /* includeHidden */);
      } else if (expression === 'to.have.accessible.error.message') {
        received = getElementAccessibleErrorMessage(element);
      } else if (expression === 'to.have.role') {
        received = getAriaRole(element) || '';
      } else if (expression === 'to.have.value') {
        element = this.retarget(element, 'follow-label')!;
        if (element.nodeName !== 'INPUT' && element.nodeName !== 'TEXTAREA' && element.nodeName !== 'SELECT')
          throw this.createStacklessError('Not an input element');
        received = (element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
      }

      if (received !== undefined && options.expectedText) {
        const matcher = new ExpectedTextMatcher(options.expectedText[0]);
        return { received, matches: matcher.matches(received) };
      }
    }

    throw this.createStacklessError('Unknown expect matcher: ' + expression);
  }

  private expectArray(elements: Element[], options: FrameExpectParams): { matches: boolean, received?: any } {
    const expression = options.expression;

    if (expression === 'to.have.count') {
      const received = elements.length;
      const matches = received === options.expectedNumber;
      return { received, matches };
    }

    // Following matchers depend all on ExpectedTextValue.
    if (!options.expectedText)
      throw this.createStacklessError('Expected text is not provided for ' + expression);

    if (['to.have.class.array', 'to.contain.class.array'].includes(expression)) {
      const receivedClassLists = elements.map(e => e.classList);
      const received = receivedClassLists.map(String);
      if (receivedClassLists.length !== options.expectedText.length)
        return { received, matches: false };
      const matches = this._matchSequentially(options.expectedText, receivedClassLists, (matcher, r) =>
        matcher.matchesClassList(this, r, /* partial */ expression === 'to.contain.class.array')
      );
      return {
        received: received,
        matches,
      };
    }

    if (!['to.contain.text.array', 'to.have.text.array'].includes(expression))
      throw this.createStacklessError('Unknown expect matcher: ' + expression);

    const received = elements.map(e => options.useInnerText ? (e as HTMLElement).innerText : elementText(new Map(), e).full);
    // "To match an array" is "to contain an array" + "equal length"
    const lengthShouldMatch = expression !== 'to.contain.text.array';
    const matchesLength = received.length === options.expectedText.length || !lengthShouldMatch;
    if (!matchesLength)
      return { received, matches: false };

    const matches = this._matchSequentially(options.expectedText, received, (matcher, r) => matcher.matches(r));
    return { received, matches };
  }

  private _matchSequentially<T>(
    expectedText: channels.ExpectedTextValue[],
    received: T[],
    matchFn: (matcher: ExpectedTextMatcher, received: T) => boolean
  ): boolean {
    const matchers = expectedText.map(e => new ExpectedTextMatcher(e));
    let mIndex = 0;
    let rIndex = 0;
    while (mIndex < matchers.length && rIndex < received.length) {
      if (matchFn(matchers[mIndex], received[rIndex]))
        ++mIndex;
      ++rIndex;
    }
    return mIndex === matchers.length;
  }
}

function oneLine(s: string): string {
  return s.replace(/\n/g, '↵').replace(/\t/g, '⇆');
}

function cssUnquote(s: string): string {
  // Trim quotes.
  s = s.substring(1, s.length - 1);
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

function createTextMatcher(selector: string, internal: boolean): { matcher: TextMatcher, kind: 'regex' | 'strict' | 'lax' } {
  if (selector[0] === '/' && selector.lastIndexOf('/') > 0) {
    const lastSlash = selector.lastIndexOf('/');
    const re = new RegExp(selector.substring(1, lastSlash), selector.substring(lastSlash + 1));
    return { matcher: (elementText: ElementText) => re.test(elementText.full), kind: 'regex' };
  }
  const unquote = internal ? JSON.parse.bind(JSON) : cssUnquote;
  let strict = false;
  if (selector.length > 1 && selector[0] === '"' && selector[selector.length - 1] === '"') {
    selector = unquote(selector);
    strict = true;
  } else if (internal && selector.length > 1 && selector[0] === '"' && selector[selector.length - 2] === '"' && selector[selector.length - 1] === 'i') {
    selector = unquote(selector.substring(0, selector.length - 1));
    strict = false;
  } else if (internal && selector.length > 1 && selector[0] === '"' && selector[selector.length - 2] === '"' && selector[selector.length - 1] === 's') {
    selector = unquote(selector.substring(0, selector.length - 1));
    strict = true;
  } else if (selector.length > 1 && selector[0] === "'" && selector[selector.length - 1] === "'") {
    selector = unquote(selector);
    strict = true;
  }
  selector = normalizeWhiteSpace(selector);
  if (strict) {
    if (internal)
      return { kind: 'strict', matcher: (elementText: ElementText) => elementText.normalized === selector };

    const strictTextNodeMatcher = (elementText: ElementText) => {
      if (!selector && !elementText.immediate.length)
        return true;
      return elementText.immediate.some(s => normalizeWhiteSpace(s) === selector);
    };
    return { matcher: strictTextNodeMatcher, kind: 'strict' };
  }
  selector = selector.toLowerCase();
  return { kind: 'lax', matcher: (elementText: ElementText) => elementText.normalized.toLowerCase().includes(selector) };
}

class ExpectedTextMatcher {
  _string: string | undefined;
  private _substring: string | undefined;
  private _regex: RegExp | undefined;
  private _normalizeWhiteSpace: boolean | undefined;
  private _ignoreCase: boolean | undefined;

  constructor(expected: channels.ExpectedTextValue) {
    this._normalizeWhiteSpace = expected.normalizeWhiteSpace;
    this._ignoreCase = expected.ignoreCase;
    this._string = expected.matchSubstring ? undefined : this.normalize(expected.string);
    this._substring = expected.matchSubstring ? this.normalize(expected.string) : undefined;
    if (expected.regexSource) {
      const flags = new Set((expected.regexFlags || '').split(''));
      if (expected.ignoreCase === false)
        flags.delete('i');
      if (expected.ignoreCase === true)
        flags.add('i');
      this._regex = new RegExp(expected.regexSource, [...flags].join(''));
    }
  }

  matches(text: string): boolean {
    if (!this._regex)
      text = this.normalize(text)!;
    if (this._string !== undefined)
      return text === this._string;
    if (this._substring !== undefined)
      return text.includes(this._substring);
    if (this._regex)
      return !!this._regex.test(text);
    return false;
  }

  matchesClassList(injectedScript: InjectedScript, classList: DOMTokenList, partial: boolean): boolean {
    if (partial) {
      if (this._regex)
        throw injectedScript.createStacklessError('Partial matching does not support regular expressions. Please provide a string value.');
      return this._string!.split(/\s+/g).filter(Boolean).every(className => classList.contains(className));
    }
    return this.matches(classList.toString());
  }

  private normalize(s: string | undefined): string | undefined {
    if (!s)
      return s;
    if (this._normalizeWhiteSpace)
      s = normalizeWhiteSpace(s);
    if (this._ignoreCase)
      s = s.toLocaleLowerCase();
    return s;
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
