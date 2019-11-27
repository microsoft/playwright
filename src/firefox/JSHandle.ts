/**
 * Copyright 2019 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { assert, debugError, helper } from '../helper';
import Injected from '../injected/injected';
import * as input from '../input';
import * as types from '../types';
import * as js from '../javascript';
import { JugglerSession } from './Connection';
import { Frame, FrameManager } from './FrameManager';
import { Page } from './Page';
import { JSHandle, ExecutionContext, markJSHandle, ExecutionContextDelegate } from './ExecutionContext';

type SelectorRoot = Element | ShadowRoot | Document;

export class ElementHandle extends js.JSHandle<ElementHandle> {
  _frame: Frame;
  _frameId: string;
  _page: Page;
  _context: ExecutionContext;
  protected _session: JugglerSession;
  protected _objectId: string;

  constructor(frame: Frame, frameId: string, page: Page, session: JugglerSession, context: ExecutionContext, payload: any) {
    super(context);
    this._frame = frame;
    this._frameId = frameId;
    this._page = page;
    this._session = session;
    this._objectId = payload.objectId;
    markJSHandle(this, payload);
  }

  async contentFrame(): Promise<Frame | null> {
    const {frameId} = await this._session.send('Page.contentFrame', {
      frameId: this._frameId,
      objectId: this._objectId,
    });
    if (!frameId)
      return null;
    const frame = this._page._frameManager.frame(frameId);
    return frame;
  }

  asElement(): ElementHandle {
    return this;
  }

  async boundingBox(): Promise<{ width: number; height: number; x: number; y: number; }> {
    return await this._session.send('Page.getBoundingBox', {
      frameId: this._frameId,
      objectId: this._objectId,
    });
  }

  async screenshot(options: { encoding?: string; path?: string; } = {}) {
    const clip = await this._session.send('Page.getBoundingBox', {
      frameId: this._frameId,
      objectId: this._objectId,
    });
    if (!clip)
      throw new Error('Node is either not visible or not an HTMLElement');
    assert(clip.width, 'Node has 0 width.');
    assert(clip.height, 'Node has 0 height.');
    await this._scrollIntoViewIfNeeded();

    return await this._page.screenshot(Object.assign({}, options, {
      clip: {
        x: clip.x,
        y: clip.y,
        width: clip.width,
        height: clip.height,
      },
    }));
  }

  isIntersectingViewport(): Promise<boolean> {
    return this._frame.evaluate(async (element: Element) => {
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
    }, this);
  }

  async $(selector: string): Promise<ElementHandle | null> {
    const handle = await this._frame.evaluateHandle(
        (root: SelectorRoot, selector: string, injected: Injected) => injected.querySelector('css=' + selector, root),
        this, selector, await this._context._injected()
    );
    const element = handle.asElement();
    if (element)
      return element;
    await handle.dispose();
    return null;
  }

  async $$(selector: string): Promise<ElementHandle[]> {
    const arrayHandle = await this._frame.evaluateHandle(
        (root: SelectorRoot, selector: string, injected: Injected) => injected.querySelectorAll('css=' + selector, root),
        this, selector, await this._context._injected()
    );
    const properties = await arrayHandle.getProperties();
    await arrayHandle.dispose();
    const result = [];
    for (const property of properties.values()) {
      const elementHandle = property.asElement();
      if (elementHandle)
        result.push(elementHandle);
    }
    return result;
  }

  $eval: types.$Eval<JSHandle> = async (selector, pageFunction, ...args) => {
    const elementHandle = await this.$(selector);
    if (!elementHandle)
      throw new Error(`Error: failed to find element matching selector "${selector}"`);
    const result = await this._frame.evaluate(pageFunction, elementHandle, ...args);
    await elementHandle.dispose();
    return result;
  }

  $$eval: types.$$Eval<JSHandle> = async (selector, pageFunction, ...args) => {
    const arrayHandle = await this._frame.evaluateHandle(
        (root: SelectorRoot, selector: string, injected: Injected) => injected.querySelectorAll('css=' + selector, root),
        this, selector, await this._context._injected()
    );

    const result = await this._frame.evaluate(pageFunction, arrayHandle, ...args);
    await arrayHandle.dispose();
    return result;
  }

  async $x(expression: string): Promise<Array<ElementHandle>> {
    const arrayHandle = await this._frame.evaluateHandle(
        (root: SelectorRoot, expression: string, injected: Injected) => injected.querySelectorAll('xpath=' + expression, root),
        this, expression, await this._context._injected()
    );
    const properties = await arrayHandle.getProperties();
    await arrayHandle.dispose();
    const result = [];
    for (const property of properties.values()) {
      const elementHandle = property.asElement();
      if (elementHandle)
        result.push(elementHandle);
    }
    return result;
  }

  async _scrollIntoViewIfNeeded() {
    const error = await this._frame.evaluate(async (element: Element) => {
      if (!element.isConnected)
        return 'Node is detached from document';
      if (element.nodeType !== Node.ELEMENT_NODE)
        return 'Node is not of type HTMLElement';
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
        element.scrollIntoView({block: 'center', inline: 'center', behavior: ('instant' as ScrollBehavior)});
      return false;
    }, this);
    if (error)
      throw new Error(error);
  }

  async click(options?: input.ClickOptions) {
    await this._scrollIntoViewIfNeeded();
    const {x, y} = await this._clickablePoint();
    await this._page.mouse.click(x, y, options);
  }

  async dblclick(options?: input.MultiClickOptions): Promise<void> {
    await this._scrollIntoViewIfNeeded();
    const {x, y} = await this._clickablePoint();
    await this._page.mouse.dblclick(x, y, options);
  }

  async tripleclick(options?: input.MultiClickOptions): Promise<void> {
    await this._scrollIntoViewIfNeeded();
    const {x, y} = await this._clickablePoint();
    await this._page.mouse.tripleclick(x, y, options);
  }

  async setInputFiles(...files: (string|input.FilePayload)[]) {
    const multiple = await this.evaluate((element: HTMLInputElement) => !!element.multiple);
    assert(multiple || files.length <= 1, 'Non-multiple file input can only accept single file!');
    await this.evaluate(input.setFileInputFunction, await input.loadFiles(files));
  }

  async hover() {
    await this._scrollIntoViewIfNeeded();
    const {x, y} = await this._clickablePoint();
    await this._page.mouse.move(x, y);
  }

  async focus() {
    await this._frame.evaluate(element => element.focus(), this);
  }

  async type(text: string, options: { delay: (number | undefined); } | undefined) {
    await this.focus();
    await this._page.keyboard.type(text, options);
  }

  async press(key: string, options: { delay?: number; } | undefined) {
    await this.focus();
    await this._page.keyboard.press(key, options);
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
    await this._page.keyboard.sendCharacters(value);
  }

  async _clickablePoint(): Promise<{ x: number; y: number; }> {
    const result = await this._session.send('Page.getContentQuads', {
      frameId: this._frameId,
      objectId: this._objectId,
    }).catch(debugError);
    if (!result || !result.quads.length)
      throw new Error('Node is either not visible or not an HTMLElement');
    // Filter out quads that have too small area to click into.
    const quads = result.quads.filter(quad => computeQuadArea(quad) > 1);
    if (!quads.length)
      throw new Error('Node is either not visible or not an HTMLElement');
    // Return the middle point of the first quad.
    return computeQuadCenter(quads[0]);
  }
}

export function createHandle(context: ExecutionContext, result: any, exceptionDetails?: any) {
  if (exceptionDetails) {
    if (exceptionDetails.value)
      throw new Error('Evaluation failed: ' + JSON.stringify(exceptionDetails.value));
    else
      throw new Error('Evaluation failed: ' + exceptionDetails.text + '\n' + exceptionDetails.stack);
  }
  if (result.subtype === 'node') {
    const frame = context.frame();
    const frameManager = frame._delegate as FrameManager;
    const frameId = frameManager._frameData(frame).frameId;
    const page = frameManager._page;
    const session = (context._delegate as ExecutionContextDelegate)._session;
    return new ElementHandle(frame, frameId, page, session, context, result);
  }
  const handle = new js.JSHandle(context);
  markJSHandle(handle, result);
  return handle;
}

function computeQuadArea(quad) {
  // Compute sum of all directed areas of adjacent triangles
  // https://en.wikipedia.org/wiki/Polygon#Simple_polygons
  let area = 0;
  const points = [quad.p1, quad.p2, quad.p3, quad.p4];
  for (let i = 0; i < points.length; ++i) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    area += (p1.x * p2.y - p2.x * p1.y) / 2;
  }
  return Math.abs(area);
}

function computeQuadCenter(quad) {
  let x = 0, y = 0;
  for (const point of [quad.p1, quad.p2, quad.p3, quad.p4]) {
    x += point.x;
    y += point.y;
  }
  return {x: x / 4, y: y / 4};
}

type FilePayload = {
  name: string,
  mimeType: string,
  data: string
};
