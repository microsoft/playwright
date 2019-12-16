// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as frames from './frames';
import * as input from './input';
import * as js from './javascript';
import * as types from './types';
import * as injectedSource from './generated/injectedSource';
import * as cssSelectorEngineSource from './generated/cssSelectorEngineSource';
import * as xpathSelectorEngineSource from './generated/xpathSelectorEngineSource';
import * as zsSelectorEngineSource from './generated/zsSelectorEngineSource';
import { assert, helper, debugError } from './helper';
import Injected from './injected/injected';
import { Page } from './page';
import { TimeoutError } from './errors';

type ScopedSelector = types.Selector & { scope?: ElementHandle };
type ResolvedSelector = { scope?: ElementHandle, selector: string, visibility: types.Visibility, disposeScope?: boolean };

export class FrameExecutionContext extends js.ExecutionContext {
  private readonly _frame: frames.Frame;

  private _injectedPromise?: Promise<js.JSHandle>;

  constructor(delegate: js.ExecutionContextDelegate, frame: frames.Frame) {
    super(delegate);
    this._frame = frame;
  }

  frame(): frames.Frame | null {
    return this._frame;
  }

  _createHandle(remoteObject: any): js.JSHandle | null {
    if (this._frame._page._delegate.isElementHandle(remoteObject))
      return new ElementHandle(this, remoteObject);
    return super._createHandle(remoteObject);
  }

  _injected(): Promise<js.JSHandle> {
    if (!this._injectedPromise) {
      const engineSources = [cssSelectorEngineSource.source, xpathSelectorEngineSource.source, zsSelectorEngineSource.source];
      const source = `
        new (${injectedSource.source})([
          ${engineSources.join(',\n')}
        ])
      `;
      this._injectedPromise = this.evaluateHandle(source);
    }
    return this._injectedPromise;
  }

  async _adoptElementHandle<T extends Node>(handle: ElementHandle<T>): Promise<ElementHandle<T>> {
    assert(handle.executionContext() !== this, 'Should not adopt to the same context');
    return this._frame._page._delegate.adoptElementHandle(handle, this);
  }

  async _resolveSelector(selector: string | ScopedSelector): Promise<ResolvedSelector> {
    if (helper.isString(selector))
      return { selector: normalizeSelector(selector), visibility: 'any' };
    if (selector.scope && selector.scope.executionContext() !== this) {
      const scope = await this._adoptElementHandle(selector.scope);
      return { scope, selector: normalizeSelector(selector.selector), disposeScope: true, visibility: selector.visibility || 'any' };
    }
    return { scope: selector.scope, selector: normalizeSelector(selector.selector), visibility: selector.visibility || 'any' };
  }

  async _$(selector: string | ScopedSelector): Promise<ElementHandle<Element> | null> {
    const resolved = await this._resolveSelector(selector);
    const handle = await this.evaluateHandle(
        (injected: Injected, selector: string, visibility: types.Visibility, scope?: Node) => {
          const element = injected.querySelector(selector, scope || document);
          if (visibility === 'any' || !element)
            return element;
          return injected.isVisible(element) === (visibility === 'visible') ? element : undefined;
        },
        await this._injected(), resolved.selector, resolved.visibility, resolved.scope
    );
    if (resolved.disposeScope)
      await resolved.scope.dispose();
    if (!handle.asElement())
      await handle.dispose();
    return handle.asElement();
  }

  async _$$(selector: string | ScopedSelector): Promise<ElementHandle<Element>[]> {
    const resolved = await this._resolveSelector(selector);
    const arrayHandle = await this.evaluateHandle(
        (injected: Injected, selector: string, visibility: types.Visibility, scope?: Node) => {
          const elements = injected.querySelectorAll(selector, scope || document);
          if (visibility !== 'any')
            return elements.filter(element => injected.isVisible(element) === (visibility === 'visible'));
          return elements;
        },
        await this._injected(), resolved.selector, resolved.visibility, resolved.scope
    );
    if (resolved.disposeScope)
      await resolved.scope.dispose();
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

  _$eval: types.$Eval<string | ScopedSelector> = async (selector, pageFunction, ...args) => {
    const elementHandle = await this._$(selector);
    if (!elementHandle)
      throw new Error(`Error: failed to find element matching selector "${types.selectorToString(selector)}"`);
    const result = await elementHandle.evaluate(pageFunction, ...args as any);
    await elementHandle.dispose();
    return result;
  }

  _$$eval: types.$$Eval<string | ScopedSelector> = async (selector, pageFunction, ...args) => {
    const resolved = await this._resolveSelector(selector);
    const arrayHandle = await this.evaluateHandle(
        (injected: Injected, selector: string, visibility: types.Visibility, scope?: Node) => {
          const elements = injected.querySelectorAll(selector, scope || document);
          if (visibility !== 'any')
            return elements.filter(element => injected.isVisible(element) === (visibility === 'visible'));
          return elements;
        },
        await this._injected(), resolved.selector, resolved.visibility, resolved.scope
    );
    const result = await arrayHandle.evaluate(pageFunction, ...args as any);
    await arrayHandle.dispose();
    return result;
  }
}

export class ElementHandle<T extends Node = Node> extends js.JSHandle<T> {
  readonly _context: FrameExecutionContext;
  readonly _page: Page;

  constructor(context: FrameExecutionContext, remoteObject: any) {
    super(context, remoteObject);
    this._page = context.frame()._page;
  }

  asElement(): ElementHandle<T> | null {
    return this;
  }

  async contentFrame(): Promise<frames.Frame | null> {
    return this._page._delegate.getContentFrame(this);
  }

  async _scrollIntoViewIfNeeded() {
    const error = await this.evaluate(async (node: Node, pageJavascriptEnabled: boolean) => {
      if (!node.isConnected)
        return 'Node is detached from document';
      if (node.nodeType !== Node.ELEMENT_NODE)
        return 'Node is not of type HTMLElement';
      const element = node as Element;
      // force-scroll if page's javascript is disabled.
      if (!pageJavascriptEnabled) {
        // @ts-ignore because only Chromium still supports 'instant'
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
      if (visibleRatio !== 1.0) {
        // @ts-ignore because only Chromium still supports 'instant'
        element.scrollIntoView({block: 'center', inline: 'center', behavior: 'instant'});
      }
      return false;
    }, !!this._page._state.javascriptEnabled);
    if (error)
      throw new Error(error);
  }

  private async _ensurePointerActionPoint(relativePoint?: types.Point): Promise<types.Point> {
    await this._scrollIntoViewIfNeeded();
    if (!relativePoint)
      return this._clickablePoint();
    let r = await this._viewportPointAndScroll(relativePoint);
    if (r.scrollX || r.scrollY) {
      const error = await this.evaluate((element, scrollX, scrollY) => {
        if (!element.ownerDocument || !element.ownerDocument.defaultView)
          return 'Node does not have a containing window';
        element.ownerDocument.defaultView.scrollBy(scrollX, scrollY);
        return false;
      }, r.scrollX, r.scrollY);
      if (error)
        throw new Error(error);
      r = await this._viewportPointAndScroll(relativePoint);
      if (r.scrollX || r.scrollY)
        throw new Error('Failed to scroll relative point into viewport');
    }
    return r.point;
  }

  private async _clickablePoint(): Promise<types.Point> {
    const intersectQuadWithViewport = (quad: types.Quad): types.Quad => {
      return quad.map(point => ({
        x: Math.min(Math.max(point.x, 0), metrics.width),
        y: Math.min(Math.max(point.y, 0), metrics.height),
      })) as types.Quad;
    };

    const computeQuadArea = (quad: types.Quad) => {
      // Compute sum of all directed areas of adjacent triangles
      // https://en.wikipedia.org/wiki/Polygon#Simple_polygons
      let area = 0;
      for (let i = 0; i < quad.length; ++i) {
        const p1 = quad[i];
        const p2 = quad[(i + 1) % quad.length];
        area += (p1.x * p2.y - p2.x * p1.y) / 2;
      }
      return Math.abs(area);
    };

    const [quads, metrics] = await Promise.all([
      this._page._delegate.getContentQuads(this),
      this._page._delegate.layoutViewport(),
    ]);
    if (!quads || !quads.length)
      throw new Error('Node is either not visible or not an HTMLElement');

    const filtered = quads.map(quad => intersectQuadWithViewport(quad)).filter(quad => computeQuadArea(quad) > 1);
    if (!filtered.length)
      throw new Error('Node is either not visible or not an HTMLElement');
    // Return the middle point of the first quad.
    const result = { x: 0, y: 0 };
    for (const point of filtered[0]) {
      result.x += point.x / 4;
      result.y += point.y / 4;
    }
    return result;
  }

  private async _viewportPointAndScroll(relativePoint: types.Point): Promise<{point: types.Point, scrollX: number, scrollY: number}> {
    const [box, border] = await Promise.all([
      this.boundingBox(),
      this.evaluate((node: Node) => {
        if (node.nodeType !== Node.ELEMENT_NODE)
          return { x: 0, y: 0 };
        const style = node.ownerDocument.defaultView.getComputedStyle(node as Element);
        return { x: parseInt(style.borderLeftWidth, 10), y: parseInt(style.borderTopWidth, 10) };
      }).catch(debugError),
    ]);
    const point = { x: relativePoint.x, y: relativePoint.y };
    if (box) {
      point.x += box.x;
      point.y += box.y;
    }
    if (border) {
      // Make point relative to the padding box to align with offsetX/offsetY.
      point.x += border.x;
      point.y += border.y;
    }
    const metrics = await this._page._delegate.layoutViewport();
    // Give 20 extra pixels to avoid any issues on viewport edge.
    let scrollX = 0;
    if (point.x < 20)
      scrollX = point.x - 20;
    if (point.x > metrics.width - 20)
      scrollX = point.x - metrics.width + 20;
    let scrollY = 0;
    if (point.y < 20)
      scrollY = point.y - 20;
    if (point.y > metrics.height - 20)
      scrollY = point.y - metrics.height + 20;
    return { point, scrollX, scrollY };
  }

  private async _waitForStationary(options: types.TimeoutOptions) {
    const { timeout = this._page._timeoutSettings.timeout() } = options;
    const success = await helper.waitWithTimeout(this.evaluate((node: Node, injected: Injected, timeout: number) => {
      let elementState;
      return injected.pollRaf(() => {
        if (!node.isConnected || node.nodeType !== Node.ELEMENT_NODE)
          return false;
        const element = node as Element;
        const rect = element.getBoundingClientRect();
        let computedOpacity = 1;
        for (let parent: Element | undefined = element; parent; parent = injected.utils.parentElementOrShadowHost(parent))
          computedOpacity *= +getComputedStyle(parent).opacity;
        const newState = {
          x: rect.top,
          y: rect.left,
          width: rect.width,
          height: rect.height,
          computedOpacity,
          iteration: elementState ? elementState.iteration + 1 : 1,
        };
        if (elementState &&
            elementState.iteration >= 2 &&
            newState.x === elementState.x &&
            newState.y === elementState.y &&
            newState.width === elementState.width &&
            newState.height === elementState.height &&
            newState.computedOpacity === elementState.computedOpacity) {
          return true;
        }
        elementState = newState;
        return false;
      }, timeout);
    }, await this._context._injected(), timeout), 'stationary', timeout);
    if (!success)
      throw new TimeoutError(`waiting for stationary failed: timeout ${timeout}ms exceeded`);
  }

  private async _waitToBecomeHitTargetAt(point: types.Point, options: types.TimeoutOptions) {
    const { timeout = this._page._timeoutSettings.timeout() } = options;
    const success = await helper.waitWithTimeout(this.evaluate((node: Node, injected: Injected, timeout: number, point: types.Point) => {
      return injected.pollRaf(() => {
        for (let hitElement = injected.utils.deepElementFromPoint(document, point.x, point.y);
             hitElement;
             hitElement = injected.utils.parentElementOrShadowHost(hitElement)) {
          if (hitElement === node)
            return true;
        }
        return false;
      }, timeout);
    }, await this._context._injected(), timeout, point), 'hit target', timeout);
    if (!success)
      throw new TimeoutError(`waiting for hit target failed: timeout ${timeout}ms exceeded`);
  }

  async _performPointerAction(action: (point: types.Point) => Promise<void>, options?: input.PointerActionOptions & types.WaitForOptions<'stationary' | 'hittarget'>): Promise<void> {
    if (options && types.multipleContains(options.waitFor, 'stationary'))
      await this._waitForStationary(options);
    const point = await this._ensurePointerActionPoint(options ? options.relativePoint : undefined);
    if (options && types.multipleContains(options.waitFor, 'hittarget'))
      await this._waitToBecomeHitTargetAt(point, options);
    let restoreModifiers: input.Modifier[] | undefined;
    if (options && options.modifiers)
      restoreModifiers = await this._page.keyboard._ensureModifiers(options.modifiers);
    await action(point);
    if (restoreModifiers)
      await this._page.keyboard._ensureModifiers(restoreModifiers);
  }

  hover(options?: input.PointerActionOptions & types.WaitForOptions<'stationary' | 'hittarget'>): Promise<void> {
    return this._performPointerAction(point => this._page.mouse.move(point.x, point.y), options);
  }

  click(options?: input.ClickOptions & types.WaitForOptions<'stationary' | 'hittarget'>): Promise<void> {
    return this._performPointerAction(point => this._page.mouse.click(point.x, point.y, options), options);
  }

  dblclick(options?: input.MultiClickOptions & types.WaitForOptions<'stationary' | 'hittarget'>): Promise<void> {
    return this._performPointerAction(point => this._page.mouse.dblclick(point.x, point.y, options), options);
  }

  tripleclick(options?: input.MultiClickOptions & types.WaitForOptions<'stationary' | 'hittarget'>): Promise<void> {
    return this._performPointerAction(point => this._page.mouse.tripleclick(point.x, point.y, options), options);
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
    await this._page.keyboard.sendCharacters(value);
  }

  async setInputFiles(...files: (string|input.FilePayload)[]) {
    const multiple = await this.evaluate((node: Node) => {
      if (node.nodeType !== Node.ELEMENT_NODE || (node as Element).tagName !== 'INPUT')
        throw new Error('Node is not an HTMLInputElement');
      const input = node as HTMLInputElement;
      return input.multiple;
    });
    assert(multiple || files.length <= 1, 'Non-multiple file input can only accept single file!');
    await this._page._delegate.setInputFiles(this, await input.loadFiles(files));
  }

  async focus() {
    const errorMessage = await this.evaluate((element: Node) => {
      if (!element['focus'])
        return 'Node is not an HTML or SVG element.';
      (element as HTMLElement|SVGElement).focus();
      return false;
    });
    if (errorMessage)
      throw new Error(errorMessage);
  }

  async type(text: string, options?: { delay?: number }) {
    await this.focus();
    await this._page.keyboard.type(text, options);
  }

  async press(key: string, options: { delay?: number; text?: string; } | undefined) {
    await this.focus();
    await this._page.keyboard.press(key, options);
  }

  async boundingBox(): Promise<types.Rect | null> {
    return this._page._delegate.getBoundingBox(this);
  }

  async screenshot(options?: types.ElementScreenshotOptions): Promise<string | Buffer> {
    return this._page._screenshotter.screenshotElement(this, options);
  }

  private _scopedSelector(selector: string | types.Selector): string | ScopedSelector {
    selector = types.clearSelector(selector);
    if (helper.isString(selector))
      selector = { selector };
    return { scope: this, selector: selector.selector, visibility: selector.visibility };
  }

  $(selector: string | types.Selector): Promise<ElementHandle | null> {
    return this._context._$(this._scopedSelector(selector));
  }

  $$(selector: string | types.Selector): Promise<ElementHandle<Element>[]> {
    return this._context._$$(this._scopedSelector(selector));
  }

  $eval: types.$Eval<string | types.Selector> = (selector, pageFunction, ...args) => {
    return this._context._$eval(this._scopedSelector(selector), pageFunction, ...args as any);
  }

  $$eval: types.$$Eval<string | types.Selector> = (selector, pageFunction, ...args) => {
    return this._context._$$eval(this._scopedSelector(selector), pageFunction, ...args as any);
  }

  $x(expression: string): Promise<ElementHandle<Element>[]> {
    return this._context._$$({ scope: this, selector: 'xpath=' + expression });
  }

  isIntersectingViewport(): Promise<boolean> {
    return this.evaluate(async (node: Node) => {
      if (node.nodeType !== Node.ELEMENT_NODE)
        throw new Error('Node is not of type HTMLElement');
      const element = node as Element;
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

function normalizeSelector(selector: string): string {
  const eqIndex = selector.indexOf('=');
  if (eqIndex !== -1 && selector.substring(0, eqIndex).trim().match(/^[a-zA-Z_0-9]+$/))
    return selector;
  if (selector.startsWith('//'))
    return 'xpath=' + selector;
  if (selector.startsWith('"'))
    return 'zs=' + selector;
  return 'css=' + selector;
}

export type Task = (context: FrameExecutionContext) => Promise<js.JSHandle>;

export function waitForFunctionTask(pageFunction: Function | string, options: types.WaitForFunctionOptions, ...args: any[]) {
  const { polling = 'raf' } = options;
  if (helper.isString(polling))
    assert(polling === 'raf' || polling === 'mutation', 'Unknown polling option: ' + polling);
  else if (helper.isNumber(polling))
    assert(polling > 0, 'Cannot poll with non-positive interval: ' + polling);
  else
    throw new Error('Unknown polling options: ' + polling);
  const predicateBody = helper.isString(pageFunction) ? 'return (' + pageFunction + ')' : 'return (' + pageFunction + ')(...args)';

  return async (context: FrameExecutionContext) => context.evaluateHandle((injected: Injected, predicateBody: string, polling: types.Polling, timeout: number, ...args) => {
    const predicate = new Function('...args', predicateBody);
    if (polling === 'raf')
      return injected.pollRaf(predicate, timeout, ...args);
    if (polling === 'mutation')
      return injected.pollMutation(predicate, timeout, ...args);
    return injected.pollInterval(polling, predicate, timeout, ...args);
  }, await context._injected(), predicateBody, polling, options.timeout, ...args);
}

export function waitForSelectorTask(selector: string | types.Selector, timeout: number): Task {
  return async (context: FrameExecutionContext) => {
    const resolved = await context._resolveSelector(selector);
    return context.evaluateHandle((injected: Injected, selector: string, visibility: types.Visibility, timeout: number, scope?: Node) => {
      if (visibility !== 'any')
        return injected.pollRaf(predicate, timeout);
      return injected.pollMutation(predicate, timeout);

      function predicate(): Element | boolean {
        const element = injected.querySelector(selector, scope || document);
        if (!element)
          return visibility === 'hidden';
        if (visibility === 'any')
          return element;
        return injected.isVisible(element) === (visibility === 'visible') ? element : false;
      }
    }, await context._injected(), resolved.selector, resolved.visibility, timeout, resolved.scope);
  };
}
