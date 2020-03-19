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

  _adoptIfNeeded(handle: js.JSHandle): Promise<js.JSHandle> | null {
    if (handle instanceof ElementHandle && handle._context !== this)
      return this.frame._page._delegate.adoptElementHandle(handle, this);
    return null;
  }

  async _evaluate(returnByValue: boolean, waitForNavigations: boolean, pageFunction: string | Function, ...args: any[]): Promise<any> {
    return await this.frame._page._frameManager.waitForNavigationsCreatedBy(async () => {
      return this._delegate.evaluate(this, returnByValue, pageFunction, ...args);
    }, waitForNavigations ? undefined : { waitUntil: 'nowait' });
  }

  _createHandle(remoteObject: any): js.JSHandle {
    if (this.frame._page._delegate.isElementHandle(remoteObject))
      return new ElementHandle(this, remoteObject);
    return super._createHandle(remoteObject);
  }

  _injected(): Promise<js.JSHandle<Injected>> {
    const selectors = Selectors._instance();
    if (this._injectedPromise && selectors._generation !== this._injectedGeneration) {
      this._injectedPromise.then(handle => handle.dispose());
      this._injectedPromise = undefined;
    }
    if (!this._injectedPromise) {
      const custom: string[] = [];
      for (const [name, source] of selectors._engines)
        custom.push(`{ name: '${name}', engine: (${source}) }`);
      const source = `
        new (${injectedSource.source})([
          ${custom.join(',\n')}
        ])
      `;
      this._injectedPromise = this._evaluate(false /* returnByValue */, false /* waitForNavigations */, source);
      this._injectedGeneration = selectors._generation;
    }
    return this._injectedPromise;
  }

  async _$(selector: string, scope?: ElementHandle): Promise<ElementHandle<Element> | null> {
    const handle = await this.evaluateHandle(
        (injected: Injected, selector: string, scope?: Node) => injected.querySelector(selector, scope || document),
        await this._injected(), selector, scope
    );
    if (!handle.asElement())
      handle.dispose();
    return handle.asElement() as ElementHandle<Element>;
  }

  async _$array(selector: string, scope?: ElementHandle): Promise<js.JSHandle<Element[]>> {
    const arrayHandle = await this.evaluateHandle(
        (injected: Injected, selector: string, scope?: Node) => injected.querySelectorAll(selector, scope || document),
        await this._injected(), selector, scope
    );
    return arrayHandle;
  }

  async _$$(selector: string, scope?: ElementHandle): Promise<ElementHandle<Element>[]> {
    const arrayHandle = await this._$array(selector, scope);
    const properties = await arrayHandle.getProperties();
    arrayHandle.dispose();
    const result: ElementHandle<Element>[] = [];
    for (const property of properties.values()) {
      const elementHandle = property.asElement() as ElementHandle<Element>;
      if (elementHandle)
        result.push(elementHandle);
      else
        property.dispose();
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
    for (const page of this._page._browserContext.pages()) {
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

  async _performPointerAction(action: (point: types.Point) => Promise<void>, options?: PointerActionOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions): Promise<void> {
    const { force = false } = (options || {});
    if (!force)
      await this._waitForDisplayedAtStablePosition(options);
    const offset = options ? options.offset : undefined;
    await this._scrollRectIntoViewIfNeeded(offset ? { x: offset.x, y: offset.y, width: 0, height: 0 } : undefined);
    const point = offset ? await this._offsetPoint(offset) : await this._clickablePoint();
    if (!force)
      await this._waitForHitTargetAt(point, options);

    await this._page._frameManager.waitForNavigationsCreatedBy(async () => {
      let restoreModifiers: input.Modifier[] | undefined;
      if (options && options.modifiers)
        restoreModifiers = await this._page.keyboard._ensureModifiers(options.modifiers);
      await action(point);
      if (restoreModifiers)
        await this._page.keyboard._ensureModifiers(restoreModifiers);
    }, options, true);
  }

  hover(options?: PointerActionOptions & types.PointerActionWaitOptions): Promise<void> {
    return this._performPointerAction(point => this._page.mouse.move(point.x, point.y), options);
  }

  click(options?: ClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions): Promise<void> {
    return this._performPointerAction(point => this._page.mouse.click(point.x, point.y, options), options);
  }

  dblclick(options?: MultiClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions): Promise<void> {
    return this._performPointerAction(point => this._page.mouse.dblclick(point.x, point.y, options), options);
  }

  async selectOption(values: string | ElementHandle | types.SelectOption | string[] | ElementHandle[] | types.SelectOption[], options?: types.NavigatingActionWaitOptions): Promise<string[]> {
    let vals: string[] | ElementHandle[] | types.SelectOption[];
    if (!Array.isArray(values))
      vals = [ values ] as (string[] | ElementHandle[] | types.SelectOption[]);
    else
      vals = values;
    const selectOptions = (vals as any).map((value: any) => typeof value === 'object' ? value : { value });
    for (const option of selectOptions) {
      if (option instanceof ElementHandle)
        continue;
      if (option.value !== undefined)
        assert(helper.isString(option.value), 'Values must be strings. Found value "' + option.value + '" of type "' + (typeof option.value) + '"');
      if (option.label !== undefined)
        assert(helper.isString(option.label), 'Labels must be strings. Found label "' + option.label + '" of type "' + (typeof option.label) + '"');
      if (option.index !== undefined)
        assert(helper.isNumber(option.index), 'Indices must be numbers. Found index "' + option.index + '" of type "' + (typeof option.index) + '"');
    }
    return await this._page._frameManager.waitForNavigationsCreatedBy<string[]>(async () => {
      return this._evaluateInUtility((injected, node, ...optionsToSelect) => injected.selectOptions(node, optionsToSelect), ...selectOptions);
    }, options);
  }

  async fill(value: string, options?: types.NavigatingActionWaitOptions): Promise<void> {
    assert(helper.isString(value), 'Value must be string. Found value "' + value + '" of type "' + (typeof value) + '"');
    await this._page._frameManager.waitForNavigationsCreatedBy(async () => {
      const error = await this._evaluateInUtility((injected, node, value) => injected.fill(node, value), value);
      if (error)
        throw new Error(error);
      if (value)
        await this._page.keyboard.insertText(value);
      else
        await this._page.keyboard.press('Delete');
    }, options, true);
  }

  async setInputFiles(files: string | types.FilePayload | string[] | types.FilePayload[]) {
    const multiple = await this._evaluateInUtility((injected: Injected, node: Node) => {
      if (node.nodeType !== Node.ELEMENT_NODE || (node as Element).tagName !== 'INPUT')
        throw new Error('Node is not an HTMLInputElement');
      const input = node as HTMLInputElement;
      return input.multiple;
    });
    let ff: string[] | types.FilePayload[];
    if (!Array.isArray(files))
      ff = [ files ] as string[] | types.FilePayload[];
    else
      ff = files;
    assert(multiple || ff.length <= 1, 'Non-multiple file input can only accept single file!');
    const filePayloads: types.FilePayload[] = [];
    for (const item of ff) {
      if (typeof item === 'string') {
        const file: types.FilePayload = {
          name: platform.basename(item),
          type: platform.getMimeType(item),
          data: await platform.readFileAsync(item, 'base64')
        };
        filePayloads.push(file);
      } else {
        filePayloads.push(item);
      }
    }
    await this._page._frameManager.waitForNavigationsCreatedBy(async () => {
      await this._page._delegate.setInputFiles(this as any as ElementHandle<HTMLInputElement>, filePayloads);
    });
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

  async type(text: string, options?: { delay?: number } & types.NavigatingActionWaitOptions) {
    await this._page._frameManager.waitForNavigationsCreatedBy(async () => {
      await this.focus();
      await this._page.keyboard.type(text, options);
    }, options, true);
  }

  async press(key: string, options?: { delay?: number } & types.NavigatingActionWaitOptions) {
    await this._page._frameManager.waitForNavigationsCreatedBy(async () => {
      await this.focus();
      await this._page.keyboard.press(key, options);
    }, options, true);
  }

  async check(options?: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions) {
    await this._setChecked(true, options);
  }

  async uncheck(options?: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions) {
    await this._setChecked(false, options);
  }

  private async _setChecked(state: boolean, options?: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions) {
    if (await this._evaluateInUtility((injected, node) => injected.isCheckboxChecked(node)) === state)
      return;
    await this.click(options);
    if (await this._evaluateInUtility((injected, node) => injected.isCheckboxChecked(node)) !== state)
      throw new Error('Unable to click checkbox');
  }

  async boundingBox(): Promise<types.Rect | null> {
    return this._page._delegate.getBoundingBox(this);
  }

  async screenshot(options?: types.ElementScreenshotOptions): Promise<platform.BufferType> {
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
    elementHandle.dispose();
    return result;
  }

  $$eval: types.$$Eval = async (selector, pageFunction, ...args) => {
    const arrayHandle = await this._context._$array(selector, this);
    const result = await arrayHandle.evaluate(pageFunction, ...args as any);
    arrayHandle.dispose();
    return result;
  }

  async _waitForDisplayedAtStablePosition(options: types.TimeoutOptions = {}): Promise<void> {
    const stablePromise = this._evaluateInUtility((injected, node, timeout) => {
      return injected.waitForDisplayedAtStablePosition(node, timeout);
    }, options.timeout || 0);
    await helper.waitWithTimeout(stablePromise, 'element to be displayed and not moving', options.timeout || 0);
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

  return async (context: FrameExecutionContext) => context.evaluateHandle((injected: Injected, selector: string | undefined, predicateBody: string, polling: types.Polling, timeout: number, ...args) => {
    const innerPredicate = new Function('...args', predicateBody);
    return injected.poll(polling, selector, timeout, (element: Element | undefined): any => {
      if (selector === undefined)
        return innerPredicate(...args);
      return innerPredicate(element, ...args);
    });
  }, await context._injected(), selector, predicateBody, polling, options.timeout || 0, ...args);
}

export function waitForSelectorTask(selector: string, waitFor: 'attached' | 'detached' | 'visible' | 'hidden', timeout: number): Task {
  return async (context: FrameExecutionContext) => context.evaluateHandle((injected, selector, waitFor, timeout) => {
    const polling = (waitFor === 'attached' || waitFor === 'detached') ? 'mutation' : 'raf';
    return injected.poll(polling, selector, timeout, (element: Element | undefined): Element | boolean => {
      switch (waitFor) {
        case 'attached':
          return element || false;
        case 'detached':
          return !element;
        case 'visible':
          return element && injected.isVisible(element) ? element : false;
        case 'hidden':
          return !element || !injected.isVisible(element);
      }
    });
  }, await context._injected(), selector, waitFor, timeout);
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
