// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as frames from './frames';
import * as input from './input';
import * as js from './javascript';
import * as types from './types';
import * as injectedSource from './generated/injectedSource';
import * as cssSelectorEngineSource from './generated/cssSelectorEngineSource';
import * as xpathSelectorEngineSource from './generated/xpathSelectorEngineSource';
import { assert, helper } from './helper';
import Injected from './injected/injected';

export interface DOMWorldDelegate {
  keyboard: input.Keyboard;
  mouse: input.Mouse;
  frame: frames.Frame;
  isJavascriptEnabled(): boolean;
  isElement(remoteObject: any): boolean;
  contentFrame(handle: ElementHandle): Promise<frames.Frame | null>;
  boundingBox(handle: ElementHandle): Promise<types.Rect | null>;
  screenshot(handle: ElementHandle, options?: any): Promise<string | Buffer>;
  ensurePointerActionPoint(handle: ElementHandle, relativePoint?: types.Point): Promise<types.Point>;
  setInputFiles(handle: ElementHandle, files: input.FilePayload[]): Promise<void>;
  adoptElementHandle(handle: ElementHandle, to: DOMWorld): Promise<ElementHandle>;
}

type SelectorRoot = Element | ShadowRoot | Document;

type ResolvedSelector = { root?: ElementHandle, selector: string, disposeRoot?: boolean };
type Selector = string | { root?: ElementHandle, selector: string };

export class DOMWorld {
  readonly context: js.ExecutionContext;
  readonly delegate: DOMWorldDelegate;

  private _injectedPromise?: Promise<js.JSHandle>;

  constructor(context: js.ExecutionContext, delegate: DOMWorldDelegate) {
    this.context = context;
    this.delegate = delegate;
  }

  createHandle(remoteObject: any): ElementHandle | null {
    if (this.delegate.isElement(remoteObject))
      return new ElementHandle(this.context, remoteObject);
    return null;
  }

  private _injected(): Promise<js.JSHandle> {
    if (!this._injectedPromise) {
      const engineSources = [cssSelectorEngineSource.source, xpathSelectorEngineSource.source];
      const source = `
        new (${injectedSource.source})([
          ${engineSources.join(',\n')}
        ])
      `;
      this._injectedPromise = this.context.evaluateHandle(source);
    }
    return this._injectedPromise;
  }

  async adoptElementHandle(handle: ElementHandle): Promise<ElementHandle> {
    assert(handle.executionContext() !== this.context, 'Should not adopt to the same context');
    return this.delegate.adoptElementHandle(handle, this);
  }

  private _normalizeSelector(selector: string): string {
    const eqIndex = selector.indexOf('=');
    if (eqIndex !== -1 && selector.substring(0, eqIndex).trim().match(/^[a-zA-Z_0-9]+$/))
      return selector;
    if (selector.startsWith('//'))
      return 'xpath=' + selector;
    return 'css=' + selector;
  }

  private async _resolveSelector(selector: Selector): Promise<ResolvedSelector> {
    if (helper.isString(selector))
      return { selector: this._normalizeSelector(selector) };
    if (selector.root && selector.root.executionContext() !== this.context) {
      const root = await this.adoptElementHandle(selector.root);
      return { root, selector: this._normalizeSelector(selector.selector), disposeRoot: true };
    }
    return { root: selector.root, selector: this._normalizeSelector(selector.selector) };
  }

  private _selectorToString(selector: Selector): string {
    if (typeof selector === 'string')
      return selector;
    return `:scope >> ${selector.selector}`;
  }

  async $(selector: Selector): Promise<ElementHandle | null> {
    const resolved = await this._resolveSelector(selector);
    const handle = await this.context.evaluateHandle(
        (injected: Injected, selector: string, root: SelectorRoot | undefined) => injected.querySelector(selector, root || document),
        await this._injected(), resolved.selector, resolved.root
    );
    if (resolved.disposeRoot)
      await resolved.root.dispose();
    if (!handle.asElement())
      await handle.dispose();
    return handle.asElement();
  }

  async $$(selector: Selector): Promise<ElementHandle[]> {
    const resolved = await this._resolveSelector(selector);
    const arrayHandle = await this.context.evaluateHandle(
        (injected: Injected, selector: string, root: SelectorRoot | undefined) => injected.querySelectorAll(selector, root || document),
        await this._injected(), resolved.selector, resolved.root
    );
    if (resolved.disposeRoot)
      await resolved.root.dispose();
    const properties = await arrayHandle.getProperties();
    await arrayHandle.dispose();
    const result = [];
    for (const property of properties.values()) {
      const elementHandle = property.asElement();
      if (elementHandle)
        result.push(elementHandle);
      else
        await property.dispose();
    }
    return result;
  }

  $eval: types.$Eval<Selector> = async (selector, pageFunction, ...args) => {
    const elementHandle = await this.$(selector);
    if (!elementHandle)
      throw new Error(`Error: failed to find element matching selector "${this._selectorToString(selector)}"`);
    const result = await elementHandle.evaluate(pageFunction, ...args as any);
    await elementHandle.dispose();
    return result;
  }

  $$eval: types.$$Eval<Selector> = async (selector, pageFunction, ...args) => {
    const resolved = await this._resolveSelector(selector);
    const arrayHandle = await this.context.evaluateHandle(
        (injected: Injected, selector: string, root: SelectorRoot | undefined) => injected.querySelectorAll(selector, root || document),
        await this._injected(), resolved.selector, resolved.root
    );
    const result = await arrayHandle.evaluate(pageFunction, ...args as any);
    await arrayHandle.dispose();
    return result;
  }
}

export class ElementHandle extends js.JSHandle {
  private readonly _world: DOMWorld;

  constructor(context: js.ExecutionContext, remoteObject: any) {
    super(context, remoteObject);
    assert(context._domWorld, 'Element handle should have a dom world');
    this._world = context._domWorld;
  }

  asElement(): ElementHandle | null {
    return this;
  }

  async contentFrame(): Promise<frames.Frame | null> {
    return this._world.delegate.contentFrame(this);
  }

  async _scrollIntoViewIfNeeded() {
    const error = await this.evaluate(async (element, pageJavascriptEnabled) => {
      if (!element.isConnected)
        return 'Node is detached from document';
      if (element.nodeType !== Node.ELEMENT_NODE)
        return 'Node is not of type HTMLElement';
      // force-scroll if page's javascript is disabled.
      if (!pageJavascriptEnabled) {
        element.scrollIntoView({block: 'center', inline: 'center', behavior: 'instant'});
        return false;
      }
      const visibleRatio = await new Promise(resolve => {
        const observer = new IntersectionObserver(entries => {
          resolve(entries[0].intersectionRatio);
          observer.disconnect();
        });
        observer.observe(element);
        // Firefox doesn't call IntersectionObserver callback unless
        // there are rafs.
        requestAnimationFrame(() => {});
      });
      if (visibleRatio !== 1.0)
        element.scrollIntoView({block: 'center', inline: 'center', behavior: 'instant'});
      return false;
    }, this._world.delegate.isJavascriptEnabled());
    if (error)
      throw new Error(error);
  }

  async _performPointerAction(action: (point: types.Point) => Promise<void>, options?: input.PointerActionOptions): Promise<void> {
    const point = await this._world.delegate.ensurePointerActionPoint(this, options ? options.relativePoint : undefined);
    let restoreModifiers: input.Modifier[] | undefined;
    if (options && options.modifiers)
      restoreModifiers = await this._world.delegate.keyboard._ensureModifiers(options.modifiers);
    await action(point);
    if (restoreModifiers)
      await this._world.delegate.keyboard._ensureModifiers(restoreModifiers);
  }

  hover(options?: input.PointerActionOptions): Promise<void> {
    return this._performPointerAction(point => this._world.delegate.mouse.move(point.x, point.y), options);
  }

  click(options?: input.ClickOptions): Promise<void> {
    return this._performPointerAction(point => this._world.delegate.mouse.click(point.x, point.y, options), options);
  }

  dblclick(options?: input.MultiClickOptions): Promise<void> {
    return this._performPointerAction(point => this._world.delegate.mouse.dblclick(point.x, point.y, options), options);
  }

  tripleclick(options?: input.MultiClickOptions): Promise<void> {
    return this._performPointerAction(point => this._world.delegate.mouse.tripleclick(point.x, point.y, options), options);
  }

  async select(...values: (string | ElementHandle | input.SelectOption)[]): Promise<string[]> {
    const options = values.map(value => typeof value === 'object' ? value : { value });
    for (const option of options) {
      if (option instanceof ElementHandle)
        continue;
      if (option.value !== undefined)
        assert(helper.isString(option.value), 'Values must be strings. Found value "' + option.value + '" of type "' + (typeof option.value) + '"');
      if (option.label !== undefined)
        assert(helper.isString(option.label), 'Labels must be strings. Found label "' + option.label + '" of type "' + (typeof option.label) + '"');
      if (option.index !== undefined)
        assert(helper.isNumber(option.index), 'Indices must be numbers. Found index "' + option.index + '" of type "' + (typeof option.index) + '"');
    }
    return this.evaluate(input.selectFunction, ...options);
  }

  async fill(value: string): Promise<void> {
    assert(helper.isString(value), 'Value must be string. Found value "' + value + '" of type "' + (typeof value) + '"');
    const error = await this.evaluate(input.fillFunction);
    if (error)
      throw new Error(error);
    await this.focus();
    await this._world.delegate.keyboard.sendCharacters(value);
  }

  async setInputFiles(...files: (string|input.FilePayload)[]) {
    const multiple = await this.evaluate((element: HTMLInputElement) => !!element.multiple);
    assert(multiple || files.length <= 1, 'Non-multiple file input can only accept single file!');
    await this._world.delegate.setInputFiles(this, await input.loadFiles(files));
  }

  async focus() {
    await this.evaluate(element => element.focus());
  }

  async type(text: string, options: { delay: (number | undefined); } | undefined) {
    await this.focus();
    await this._world.delegate.keyboard.type(text, options);
  }

  async press(key: string, options: { delay?: number; text?: string; } | undefined) {
    await this.focus();
    await this._world.delegate.keyboard.press(key, options);
  }

  async boundingBox(): Promise<types.Rect | null> {
    return this._world.delegate.boundingBox(this);
  }

  async screenshot(options: any = {}): Promise<string | Buffer> {
    return this._world.delegate.screenshot(this, options);
  }

  $(selector: string): Promise<ElementHandle | null> {
    return this._world.$({ root: this, selector });
  }

  $$(selector: string): Promise<ElementHandle[]> {
    return this._world.$$({ root: this, selector });
  }

  $eval: types.$Eval = (selector, pageFunction, ...args) => {
    return this._world.$eval({ root: this, selector }, pageFunction, ...args as any);
  }

  $$eval: types.$$Eval = (selector, pageFunction, ...args) => {
    return this._world.$$eval({ root: this, selector }, pageFunction, ...args as any);
  }

  $x(expression: string): Promise<ElementHandle[]> {
    return this._world.$$({ root: this, selector: 'xpath=' + expression });
  }

  isIntersectingViewport(): Promise<boolean> {
    return this.evaluate(async element => {
      const visibleRatio = await new Promise(resolve => {
        const observer = new IntersectionObserver(entries => {
          resolve(entries[0].intersectionRatio);
          observer.disconnect();
        });
        observer.observe(element);
        // Firefox doesn't call IntersectionObserver callback unless
        // there are rafs.
        requestAnimationFrame(() => {});
      });
      return visibleRatio > 0;
    });
  }
}
