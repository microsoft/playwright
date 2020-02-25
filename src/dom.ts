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

import * as frames from './frames';
import * as input from './input';
import * as js from './javascript';
import * as types from './types';
import * as injectedSource from './generated/injectedSource';
import { assert, helper, debugError } from './helper';
import Injected from './injected/injected';
import { Page } from './page';
import * as platform from './platform';
import { Selectors } from './selectors';

export type PointerActionOptions = {
  modifiers?: input.Modifier[];
  offset?: types.Point;
};

export type ClickOptions = PointerActionOptions & input.MouseClickOptions;

export type MultiClickOptions = PointerActionOptions & input.MouseMultiClickOptions;

export class FrameExecutionContext extends js.ExecutionContext {
  readonly frame: frames.Frame;

  private _injectedPromise?: Promise<js.JSHandle>;
  private _injectedGeneration = -1;

  constructor(delegate: js.ExecutionContextDelegate, frame: frames.Frame) {
    super(delegate);
    this.frame = frame;
  }

  async _evaluate(returnByValue: boolean, pageFunction: string | Function, ...args: any[]): Promise<any> {
    const needsAdoption = (value: any): boolean => {
      return typeof value === 'object' && value instanceof ElementHandle && value._context !== this;
    };

    if (!args.some(needsAdoption)) {
      // Only go through asynchronous calls if required.
      return this._delegate.evaluate(this, returnByValue, pageFunction, ...args);
    }

    const toDispose: Promise<ElementHandle>[] = [];
    const adopted = await Promise.all(args.map(async arg => {
      if (!needsAdoption(arg))
        return arg;
      const adopted = this.frame._page._delegate.adoptElementHandle(arg, this);
      toDispose.push(adopted);
      return adopted;
    }));
    let result;
    try {
      result = await this._delegate.evaluate(this, returnByValue, pageFunction, ...adopted);
    } finally {
      await Promise.all(toDispose.map(handlePromise => handlePromise.then(handle => handle.dispose())));
    }
    return result;
  }

  _createHandle(remoteObject: any): js.JSHandle {
    if (this.frame._page._delegate.isElementHandle(remoteObject))
      return new ElementHandle(this, remoteObject);
    return super._createHandle(remoteObject);
  }

  _injected(): Promise<js.JSHandle> {
    const selectors = Selectors._instance();
    if (this._injectedPromise && selectors._generation !== this._injectedGeneration) {
      this._injectedPromise.then(handle => handle.dispose());
      this._injectedPromise = undefined;
    }
    if (!this._injectedPromise) {
      const source = `
        new (${injectedSource.source})([
          ${selectors._sources.join(',\n')}
        ])
      `;
      this._injectedPromise = this.evaluateHandle(source);
      this._injectedGeneration = selectors._generation;
    }
    return this._injectedPromise;
  }

  async _$(selector: string, scope?: ElementHandle): Promise<ElementHandle<Element> | null> {
    const handle = await this.evaluateHandle(
        (injected: Injected, selector: string, scope?: Node) => injected.querySelector(selector, scope || document),
        await this._injected(), normalizeSelector(selector), scope
    );
    if (!handle.asElement())
      await handle.dispose();
    return handle.asElement() as ElementHandle<Element>;
  }

  async _$array(selector: string, scope?: ElementHandle): Promise<js.JSHandle<Element[]>> {
    const arrayHandle = await this.evaluateHandle(
        (injected: Injected, selector: string, scope?: Node) => injected.querySelectorAll(selector, scope || document),
        await this._injected(), normalizeSelector(selector), scope
    );
    return arrayHandle;
  }

  async _$$(selector: string, scope?: ElementHandle): Promise<ElementHandle<Element>[]> {
    const arrayHandle = await this._$array(selector, scope);
    const properties = await arrayHandle.getProperties();
    await arrayHandle.dispose();
    const result: ElementHandle<Element>[] = [];
    for (const property of properties.values()) {
      const elementHandle = property.asElement() as ElementHandle<Element>;
      if (elementHandle)
        result.push(elementHandle);
      else
        await property.dispose();
    }
    return result;
  }
}

export class ElementHandle<T extends Node = Node> extends js.JSHandle<T> {
  readonly _context: FrameExecutionContext;
  readonly _page: Page;

  constructor(context: FrameExecutionContext, remoteObject: any) {
    super(context, remoteObject);
    this._context = context;
    this._page = context.frame._page;
  }

  asElement(): ElementHandle<T> | null {
    return this;
  }

  _evaluateInUtility: types.EvaluateWithInjected<T> = async (pageFunction, ...args) => {
    const utility = await this._context.frame._utilityContext();
    return utility.evaluate(pageFunction as any, await utility._injected(), this, ...args);
  }

  async ownerFrame(): Promise<frames.Frame | null> {
    const frameId = await this._page._delegate.getOwnerFrame(this);
    if (!frameId)
      return null;
    const pages = this._page.context()._existingPages();
    for (const page of pages) {
      const frame = page._frameManager.frame(frameId);
      if (frame)
        return frame;
    }
    return null;
  }

  async contentFrame(): Promise<frames.Frame | null> {
    const isFrameElement = await this._evaluateInUtility((injected, node) => node && (node.nodeName === 'IFRAME' || node.nodeName === 'FRAME'));
    if (!isFrameElement)
      return null;
    return this._page._delegate.getContentFrame(this);
  }

  async _scrollRectIntoViewIfNeeded(rect?: types.Rect): Promise<void> {
    await this._page._delegate.scrollRectIntoViewIfNeeded(this, rect);
  }

  async scrollIntoViewIfNeeded() {
    await this._scrollRectIntoViewIfNeeded();
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
    ] as const);
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

  private async _offsetPoint(offset: types.Point): Promise<types.Point> {
    const [box, border] = await Promise.all([
      this.boundingBox(),
      this._evaluateInUtility((injected, node) => injected.getElementBorderWidth(node)).catch(debugError),
    ]);
    const point = { x: offset.x, y: offset.y };
    if (box) {
      point.x += box.x;
      point.y += box.y;
    }
    if (border) {
      // Make point relative to the padding box to align with offsetX/offsetY.
      point.x += border.left;
      point.y += border.top;
    }
    return point;
  }

  async _performPointerAction(action: (point: types.Point) => Promise<void>, options?: PointerActionOptions & types.WaitForOptions): Promise<void> {
    const { waitFor = true } = (options || {});
    if (!helper.isBoolean(waitFor))
      throw new Error('waitFor option should be a boolean, got "' + (typeof waitFor) + '"');
    if (waitFor)
      await this._waitForStablePosition(options);
    const offset = options ? options.offset : undefined;
    await this._scrollRectIntoViewIfNeeded(offset ? { x: offset.x, y: offset.y, width: 0, height: 0 } : undefined);
    const point = offset ? await this._offsetPoint(offset) : await this._clickablePoint();
    if (waitFor)
      await this._waitForHitTargetAt(point, options);
    let restoreModifiers: input.Modifier[] | undefined;
    if (options && options.modifiers)
      restoreModifiers = await this._page.keyboard._ensureModifiers(options.modifiers);
    await action(point);
    if (restoreModifiers)
      await this._page.keyboard._ensureModifiers(restoreModifiers);
  }

  hover(options?: PointerActionOptions & types.WaitForOptions): Promise<void> {
    return this._performPointerAction(point => this._page.mouse.move(point.x, point.y), options);
  }

  click(options?: ClickOptions & types.WaitForOptions): Promise<void> {
    return this._performPointerAction(point => this._page.mouse.click(point.x, point.y, options), options);
  }

  dblclick(options?: MultiClickOptions & types.WaitForOptions): Promise<void> {
    return this._performPointerAction(point => this._page.mouse.dblclick(point.x, point.y, options), options);
  }

  tripleclick(options?: MultiClickOptions & types.WaitForOptions): Promise<void> {
    return this._performPointerAction(point => this._page.mouse.tripleclick(point.x, point.y, options), options);
  }

  async select(...values: (string | ElementHandle | types.SelectOption)[]): Promise<string[]> {
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
    return this._evaluateInUtility((injected, node, ...optionsToSelect) => injected.selectOptions(node, optionsToSelect), ...options);
  }

  async fill(value: string): Promise<void> {
    assert(helper.isString(value), 'Value must be string. Found value "' + value + '" of type "' + (typeof value) + '"');
    const error = await this._evaluateInUtility((injected, node, value) => injected.fill(node, value), value);
    if (error)
      throw new Error(error);
    if (value)
      await this._page.keyboard.sendCharacters(value);
    else
      await this._page.keyboard.press('Delete');
  }

  async setInputFiles(...files: (string | types.FilePayload)[]) {
    const multiple = await this._evaluateInUtility((injected: Injected, node: Node) => {
      if (node.nodeType !== Node.ELEMENT_NODE || (node as Element).tagName !== 'INPUT')
        throw new Error('Node is not an HTMLInputElement');
      const input = node as HTMLInputElement;
      return input.multiple;
    });
    assert(multiple || files.length <= 1, 'Non-multiple file input can only accept single file!');
    const filePayloads = await Promise.all(files.map(async item => {
      if (typeof item === 'string') {
        const file: types.FilePayload = {
          name: platform.basename(item),
          type: platform.getMimeType(item),
          data: await platform.readFileAsync(item, 'base64')
        };
        return file;
      }
      return item;
    }));
    await this._page._delegate.setInputFiles(this as any as ElementHandle<HTMLInputElement>, filePayloads);
  }

  async focus() {
    const errorMessage = await this._evaluateInUtility((injected: Injected, element: Node) => {
      if (!(element as any)['focus'])
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

  async press(key: string, options?: { delay?: number, text?: string }) {
    await this.focus();
    await this._page.keyboard.press(key, options);
  }

  async check(options?: types.WaitForOptions) {
    await this._setChecked(true, options);
  }

  async uncheck(options?: types.WaitForOptions) {
    await this._setChecked(false, options);
  }

  private async _setChecked(state: boolean, options?: types.WaitForOptions) {
    if (await this._evaluateInUtility((injected, node) => injected.isCheckboxChecked(node)) === state)
      return;
    await this.click(options);
    if (await this._evaluateInUtility((injected, node) => injected.isCheckboxChecked(node)) !== state)
      throw new Error('Unable to click checkbox');
  }

  async boundingBox(): Promise<types.Rect | null> {
    return this._page._delegate.getBoundingBox(this);
  }

  async screenshot(options?: types.ElementScreenshotOptions): Promise<string | platform.BufferType> {
    return this._page._screenshotter.screenshotElement(this, options);
  }

  $(selector: string): Promise<ElementHandle | null> {
    return this._context._$(selector, this);
  }

  $$(selector: string): Promise<ElementHandle<Element>[]> {
    return this._context._$$(selector, this);
  }

  $eval: types.$Eval = async (selector, pageFunction, ...args) => {
    const elementHandle = await this._context._$(selector, this);
    if (!elementHandle)
      throw new Error(`Error: failed to find element matching selector "${selector}"`);
    const result = await elementHandle.evaluate(pageFunction, ...args as any);
    await elementHandle.dispose();
    return result;
  }

  $$eval: types.$$Eval = async (selector, pageFunction, ...args) => {
    const arrayHandle = await this._context._$array(selector, this);
    const result = await arrayHandle.evaluate(pageFunction, ...args as any);
    await arrayHandle.dispose();
    return result;
  }

  async _waitForStablePosition(options: types.TimeoutOptions = {}): Promise<void> {
    const stablePromise = this._evaluateInUtility((injected, node, timeout) => {
      return injected.waitForStablePosition(node, timeout);
    }, options.timeout || 0);
    await helper.waitWithTimeout(stablePromise, 'element to stop moving', options.timeout || 0);
  }

  async _waitForHitTargetAt(point: types.Point, options: types.TimeoutOptions = {}): Promise<void> {
    const frame = await this.ownerFrame();
    if (frame && frame.parentFrame()) {
      const element = await frame.frameElement();
      const box = await element.boundingBox();
      if (!box)
        throw new Error('Element is not attached to the DOM');
      // Translate from viewport coordinates to frame coordinates.
      point = { x: point.x - box.x, y: point.y - box.y };
    }
    const hitTargetPromise = this._evaluateInUtility((injected, node, timeout, point) => {
      return injected.waitForHitTargetAt(node, timeout, point);
    }, options.timeout || 0, point);
    await helper.waitWithTimeout(hitTargetPromise, 'element to receive mouse events', options.timeout || 0);
  }
}

function normalizeSelector(selector: string): string {
  const eqIndex = selector.indexOf('=');
  if (eqIndex !== -1 && selector.substring(0, eqIndex).trim().match(/^[a-zA-Z_0-9-]+$/))
    return selector;
  // If selector starts with '//' or '//' prefixed with multiple opening
  // parenthesis, consider xpath. @see https://github.com/microsoft/playwright/issues/817
  if (/^\(*\/\//.test(selector))
    return 'xpath=' + selector;
  if (selector.startsWith('"'))
    return 'text=' + selector;
  return 'css=' + selector;
}

export type Task = (context: FrameExecutionContext) => Promise<js.JSHandle>;

function assertPolling(polling: types.Polling) {
  if (helper.isString(polling))
    assert(polling === 'raf' || polling === 'mutation', 'Unknown polling option: ' + polling);
  else if (helper.isNumber(polling))
    assert(polling > 0, 'Cannot poll with non-positive interval: ' + polling);
  else
    throw new Error('Unknown polling options: ' + polling);
}

export function waitForFunctionTask(selector: string | undefined, pageFunction: Function | string, options: types.WaitForFunctionOptions, ...args: any[]): Task {
  const { polling = 'raf' } = options;
  assertPolling(polling);
  const predicateBody = helper.isString(pageFunction) ? 'return (' + pageFunction + ')' : 'return (' + pageFunction + ')(...args)';
  if (selector !== undefined)
    selector = normalizeSelector(selector);

  return async (context: FrameExecutionContext) => context.evaluateHandle((injected: Injected, selector: string | undefined, predicateBody: string, polling: types.Polling, timeout: number, ...args) => {
    const innerPredicate = new Function('...args', predicateBody);
    return injected.poll(polling, selector, timeout, (element: Element | undefined): any => {
      if (selector === undefined)
        return innerPredicate(...args);
      return innerPredicate(element, ...args);
    });
  }, await context._injected(), selector, predicateBody, polling, options.timeout || 0, ...args);
}

export function waitForSelectorTask(selector: string, visibility: types.Visibility, timeout: number): Task {
  selector = normalizeSelector(selector);
  return async (context: FrameExecutionContext) => context.evaluateHandle((injected: Injected, selector: string, visibility: types.Visibility, timeout: number) => {
    const polling = visibility === 'any' ? 'mutation' : 'raf';
    return injected.poll(polling, selector, timeout, (element: Element | undefined): Element | boolean => {
      if (!element)
        return visibility === 'hidden';
      if (visibility === 'any')
        return element;
      return injected.isVisible(element) === (visibility === 'visible') ? element : false;
    });
  }, await context._injected(), selector, visibility, timeout);
}

export const setFileInputFunction = async (element: HTMLInputElement, payloads: types.FilePayload[]) => {
  const files = await Promise.all(payloads.map(async (file: types.FilePayload) => {
    const result = await fetch(`data:${file.type};base64,${file.data}`);
    return new File([await result.blob()], file.name, {type: file.type});
  }));
  const dt = new DataTransfer();
  for (const file of files)
    dt.items.add(file);
  element.files = dt.files;
  element.dispatchEvent(new Event('input', { 'bubbles': true }));
  element.dispatchEvent(new Event('change', { 'bubbles': true }));
};
