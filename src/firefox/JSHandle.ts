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

import * as path from 'path';
import { assert, debugError, helper } from '../helper';
import { ClickOptions, fillFunction, MultiClickOptions, selectFunction, SelectOption } from '../input';
import { JugglerSession } from './Connection';
import Injected from '../injected/injected';

type SelectorRoot = Element | ShadowRoot | Document;
import { ExecutionContext } from './ExecutionContext';
import { Frame } from './FrameManager';

export class JSHandle {
  _context: ExecutionContext;
  protected _session: JugglerSession;
  private _executionContextId: string;
  protected _objectId: string;
  private _type: string;
  private _subtype: string;
  _disposed: boolean;
  _protocolValue: { unserializableValue: any; value: any; objectId: any; };

  constructor(context: ExecutionContext, payload: any) {
    this._context = context;
    this._session = this._context._session;
    this._executionContextId = this._context._executionContextId;
    this._objectId = payload.objectId;
    this._type = payload.type;
    this._subtype = payload.subtype;
    this._disposed = false;
    this._protocolValue = {
      unserializableValue: payload.unserializableValue,
      value: payload.value,
      objectId: payload.objectId,
    };
  }

  executionContext(): ExecutionContext {
    return this._context;
  }

  async evaluate(pageFunction: Function | string, ...args: any[]): Promise<(any)> {
    return await this.executionContext().evaluate(pageFunction, this, ...args);
  }

  async evaluateHandle(pageFunction: Function | string, ...args: any[]): Promise<JSHandle> {
    return await this.executionContext().evaluateHandle(pageFunction, this, ...args);
  }

  toString(): string {
    if (this._objectId)
      return 'JSHandle@' + (this._subtype || this._type);
    return 'JSHandle:' + this._deserializeValue(this._protocolValue);
  }

  async getProperty(propertyName: string): Promise<JSHandle | null> {
    const objectHandle = await this._context.evaluateHandle((object, propertyName) => {
      const result = {__proto__: null};
      result[propertyName] = object[propertyName];
      return result;
    }, this, propertyName);
    const properties = await objectHandle.getProperties();
    const result = properties.get(propertyName) || null;
    await objectHandle.dispose();
    return result;
  }

  async getProperties(): Promise<Map<string, JSHandle>> {
    const response = await this._session.send('Runtime.getObjectProperties', {
      executionContextId: this._executionContextId,
      objectId: this._objectId,
    });
    const result = new Map();
    for (const property of response.properties)
      result.set(property.name, createHandle(this._context, property.value, null));

    return result;
  }

  _deserializeValue({unserializableValue, value}) {
    if (unserializableValue === 'Infinity')
      return Infinity;
    if (unserializableValue === '-Infinity')
      return -Infinity;
    if (unserializableValue === '-0')
      return -0;
    if (unserializableValue === 'NaN')
      return NaN;
    return value;
  }

  async jsonValue() {
    if (!this._objectId)
      return this._deserializeValue(this._protocolValue);
    const simpleValue = await this._session.send('Runtime.callFunction', {
      executionContextId: this._executionContextId,
      returnByValue: true,
      functionDeclaration: (e => e).toString(),
      args: [this._protocolValue],
    });
    return this._deserializeValue(simpleValue.result);
  }

  asElement(): ElementHandle | null {
    return null;
  }

  async dispose() {
    if (!this._objectId)
      return;
    this._disposed = true;
    await this._session.send('Runtime.disposeObject', {
      executionContextId: this._executionContextId,
      objectId: this._objectId,
    }).catch(error => {
      // Exceptions might happen in case of a page been navigated or closed.
      // Swallow these since they are harmless and we don't leak anything in this case.
      debugError(error);
    });
  }
}

export class ElementHandle extends JSHandle {
  _frame: Frame;
  _frameId: any;
  constructor(frame: Frame, context: ExecutionContext, payload: any) {
    super(context, payload);
    this._frame = frame;
    this._frameId = frame._frameId;
  }

  async contentFrame(): Promise<Frame | null> {
    const {frameId} = await this._session.send('Page.contentFrame', {
      frameId: this._frameId,
      objectId: this._objectId,
    });
    if (!frameId)
      return null;
    const frame = this._frame._frameManager.frame(frameId);
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

    return await this._frame._page.screenshot(Object.assign({}, options, {
      clip: {
        x: clip.x,
        y: clip.y,
        width: clip.width,
        height: clip.height,
      },
    }));
  }

  isIntersectingViewport(): Promise<boolean> {
    return this._frame.evaluate(async element => {
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

  async $eval(selector: string, pageFunction: Function | string, ...args: Array<any>): Promise<object | undefined> {
    const elementHandle = await this.$(selector);
    if (!elementHandle)
      throw new Error(`Error: failed to find element matching selector "${selector}"`);
    const result = await this._frame.evaluate(pageFunction, elementHandle, ...args);
    await elementHandle.dispose();
    return result;
  }

  async $$eval(selector: string, pageFunction: Function | string, ...args: Array<any>): Promise<object | undefined> {
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
        (element, expression) => {
          const document = element.ownerDocument || element;
          const iterator = document.evaluate(expression, element, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE);
          const array = [];
          let item;
          while ((item = iterator.iterateNext()))
            array.push(item);
          return array;
        },
        this, expression
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
    const error = await this._frame.evaluate(async element => {
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
        element.scrollIntoView({block: 'center', inline: 'center', behavior: 'instant'});
      return false;
    }, this);
    if (error)
      throw new Error(error);
  }

  async click(options?: ClickOptions) {
    await this._scrollIntoViewIfNeeded();
    const {x, y} = await this._clickablePoint();
    await this._frame._page.mouse.click(x, y, options);
  }

  async dblclick(options?: MultiClickOptions): Promise<void> {
    await this._scrollIntoViewIfNeeded();
    const {x, y} = await this._clickablePoint();
    await this._frame._page.mouse.dblclick(x, y, options);
  }

  async tripleclick(options?: MultiClickOptions): Promise<void> {
    await this._scrollIntoViewIfNeeded();
    const {x, y} = await this._clickablePoint();
    await this._frame._page.mouse.tripleclick(x, y, options);
  }

  async uploadFile(...filePaths: Array<string>) {
    const files = filePaths.map(filePath => path.resolve(filePath));
    await this._session.send('Page.setFileInputFiles', {
      frameId: this._frameId,
      objectId: this._objectId,
      files,
    });
  }

  async hover() {
    await this._scrollIntoViewIfNeeded();
    const {x, y} = await this._clickablePoint();
    await this._frame._page.mouse.move(x, y);
  }

  async focus() {
    await this._frame.evaluate(element => element.focus(), this);
  }

  async type(text: string, options: { delay: (number | undefined); } | undefined) {
    await this.focus();
    await this._frame._page.keyboard.type(text, options);
  }

  async press(key: string, options: { delay?: number; } | undefined) {
    await this.focus();
    await this._frame._page.keyboard.press(key, options);
  }

  async select(...values: (string | ElementHandle | SelectOption)[]): Promise<string[]> {
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
    return this.evaluate(selectFunction, ...options);
  }

  async fill(value: string): Promise<void> {
    assert(helper.isString(value), 'Value must be string. Found value "' + value + '" of type "' + (typeof value) + '"');
    const error = await this.evaluate(fillFunction);
    if (error)
      throw new Error(error);
    await this.focus();
    await this._frame._page.keyboard.sendCharacter(value);
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
  const frame = context.frame();
  if (exceptionDetails) {
    if (exceptionDetails.value)
      throw new Error('Evaluation failed: ' + JSON.stringify(exceptionDetails.value));
    else
      throw new Error('Evaluation failed: ' + exceptionDetails.text + '\n' + exceptionDetails.stack);
  }
  return result.subtype === 'node' ? new ElementHandle(frame, context, result) : new JSHandle(context, result);
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
