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
import { CDPSession } from './Connection';
import { ExecutionContext } from './ExecutionContext';
import { Frame } from './Frame';
import { FrameManager } from './FrameManager';
import { assert, debugError, helper } from '../helper';
import { valueFromRemoteObject, releaseObject } from './protocolHelper';
import { Page } from './Page';
import { Modifier, Button } from './Input';
import { Protocol } from './protocol';

type Point = {
  x: number;
  y: number;
};

export type PointerActionOptions = {
  modifiers?: Modifier[];
  relativePoint?: Point;
};

export type ClickOptions = PointerActionOptions & {
  delay?: number;
  button?: Button;
  clickCount?: number;
};

export type MultiClickOptions = PointerActionOptions & {
  delay?: number;
  button?: Button;
};

export type SelectOption = {
  value?: string;
  label?: string;
  index?: number;
};

export function createJSHandle(context: ExecutionContext, remoteObject: Protocol.Runtime.RemoteObject) {
  const frame = context.frame();
  if (remoteObject.subtype === 'node' && frame) {
    const frameManager = frame._frameManager;
    return new ElementHandle(context, context._client, remoteObject, frameManager.page(), frameManager);
  }
  return new JSHandle(context, context._client, remoteObject);
}

export class JSHandle {
  _context: ExecutionContext;
  protected _client: CDPSession;
  _remoteObject: Protocol.Runtime.RemoteObject;
  _disposed = false;

  constructor(context: ExecutionContext, client: CDPSession, remoteObject: Protocol.Runtime.RemoteObject) {
    this._context = context;
    this._client = client;
    this._remoteObject = remoteObject;
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

  async getProperty(propertyName: string): Promise<JSHandle | null> {
    const objectHandle = await this.evaluateHandle((object, propertyName) => {
      const result = {__proto__: null};
      result[propertyName] = object[propertyName];
      return result;
    }, propertyName);
    const properties = await objectHandle.getProperties();
    const result = properties.get(propertyName) || null;
    await objectHandle.dispose();
    return result;
  }

  async getProperties(): Promise<Map<string, JSHandle>> {
    const response = await this._client.send('Runtime.getProperties', {
      objectId: this._remoteObject.objectId,
      ownProperties: true
    });
    const result = new Map();
    for (const property of response.result) {
      if (!property.enumerable)
        continue;
      result.set(property.name, createJSHandle(this._context, property.value));
    }
    return result;
  }

  async jsonValue(): Promise<object | null> {
    if (this._remoteObject.objectId) {
      const response = await this._client.send('Runtime.callFunctionOn', {
        functionDeclaration: 'function() { return this; }',
        objectId: this._remoteObject.objectId,
        returnByValue: true,
        awaitPromise: true,
      });
      return valueFromRemoteObject(response.result);
    }
    return valueFromRemoteObject(this._remoteObject);
  }

  asElement(): ElementHandle | null {
    return null;
  }

  async dispose() {
    if (this._disposed)
      return;
    this._disposed = true;
    await releaseObject(this._client, this._remoteObject);
  }

  toString(): string {
    if (this._remoteObject.objectId) {
      const type =  this._remoteObject.subtype || this._remoteObject.type;
      return 'JSHandle@' + type;
    }
    return 'JSHandle:' + valueFromRemoteObject(this._remoteObject);
  }
}

export class ElementHandle extends JSHandle {
  private _page: Page;
  private _frameManager: FrameManager;

  constructor(context: ExecutionContext, client: CDPSession, remoteObject: Protocol.Runtime.RemoteObject, page: Page, frameManager: FrameManager) {
    super(context, client, remoteObject);
    this._client = client;
    this._remoteObject = remoteObject;
    this._page = page;
    this._frameManager = frameManager;
  }

  asElement(): ElementHandle | null {
    return this;
  }

  async contentFrame(): Promise<Frame|null> {
    const nodeInfo = await this._client.send('DOM.describeNode', {
      objectId: this._remoteObject.objectId
    });
    if (typeof nodeInfo.node.frameId !== 'string')
      return null;
    return this._frameManager.frame(nodeInfo.node.frameId);
  }

  async _scrollIntoViewIfNeeded() {
    const error = await this.evaluate(async(element, pageJavascriptEnabled) => {
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
      });
      if (visibleRatio !== 1.0)
        element.scrollIntoView({block: 'center', inline: 'center', behavior: 'instant'});
      return false;
    }, this._page._javascriptEnabled);
    if (error)
      throw new Error(error);
  }

  async _clickablePoint(): Promise<Point> {
    const [result, layoutMetrics] = await Promise.all([
      this._client.send('DOM.getContentQuads', {
        objectId: this._remoteObject.objectId
      }).catch(debugError),
      this._client.send('Page.getLayoutMetrics'),
    ]);
    if (!result || !result.quads.length)
      throw new Error('Node is either not visible or not an HTMLElement');
    // Filter out quads that have too small area to click into.
    const {clientWidth, clientHeight} = layoutMetrics.layoutViewport;
    const quads = result.quads.map(quad => this._fromProtocolQuad(quad)).map(quad => this._intersectQuadWithViewport(quad, clientWidth, clientHeight)).filter(quad => computeQuadArea(quad) > 1);
    if (!quads.length)
      throw new Error('Node is either not visible or not an HTMLElement');
    // Return the middle point of the first quad.
    const quad = quads[0];
    let x = 0;
    let y = 0;
    for (const point of quad) {
      x += point.x;
      y += point.y;
    }
    return {
      x: x / 4,
      y: y / 4
    };
  }

  async _viewportPointAndScroll(relativePoint: Point): Promise<{point: Point, scrollX: number, scrollY: number}> {
    const model = await this._getBoxModel();
    let point: Point;
    if (!model) {
      point = relativePoint;
    } else {
      // Use padding quad to be compatible with offsetX/offsetY properties.
      const quad = model.model.padding;
      const x = Math.min(quad[0], quad[2], quad[4], quad[6]);
      const y = Math.min(quad[1], quad[3], quad[5], quad[7]);
      point = {
        x: x + relativePoint.x,
        y: y + relativePoint.y,
      };
    }
    const metrics = await this._client.send('Page.getLayoutMetrics');
    // Give one extra pixel to avoid any issues on viewport edge.
    let scrollX = 0;
    if (point.x < 1)
      scrollX = point.x - 1;
    if (point.x > metrics.layoutViewport.clientWidth - 1)
      scrollX = point.x - metrics.layoutViewport.clientWidth + 1;
    let scrollY = 0;
    if (point.y < 1)
      scrollY = point.y - 1;
    if (point.y > metrics.layoutViewport.clientHeight - 1)
      scrollY = point.y - metrics.layoutViewport.clientHeight + 1;
    return { point, scrollX, scrollY };
  }

  async _performPointerAction(action: (point: Point) => Promise<void>, options?: PointerActionOptions): Promise<void> {
    await this._scrollIntoViewIfNeeded();
    let point: Point;
    if (options && options.relativePoint) {
      let r = await this._viewportPointAndScroll(options.relativePoint);
      if (r.scrollX || r.scrollY) {
        const error = await this.evaluate((element, scrollX, scrollY) => {
          if (!element.ownerDocument || !element.ownerDocument.defaultView)
            return 'Node does not have a containing window';
          element.ownerDocument.defaultView.scrollBy(scrollX, scrollY);
          return false;
        }, r.scrollX, r.scrollY);
        if (error)
          throw new Error(error);
        r = await this._viewportPointAndScroll(options.relativePoint);
        if (r.scrollX || r.scrollY)
          throw new Error('Failed to scroll relative point into viewport');
      }
      point = r.point;
    } else {
      await this._scrollIntoViewIfNeeded();
      point = await this._clickablePoint();
    }
    let restoreModifiers: Modifier[] | undefined;
    if (options && options.modifiers)
      restoreModifiers = await this._page.keyboard._ensureModifiers(options.modifiers);
    await action(point);
    if (restoreModifiers)
      await this._page.keyboard._ensureModifiers(restoreModifiers);
  }

  _getBoxModel(): Promise<void | Protocol.DOM.getBoxModelReturnValue> {
    return this._client.send('DOM.getBoxModel', {
      objectId: this._remoteObject.objectId
    }).catch(error => debugError(error));
  }

  _fromProtocolQuad(quad: number[]): Array<{ x: number; y: number; }> {
    return [
      {x: quad[0], y: quad[1]},
      {x: quad[2], y: quad[3]},
      {x: quad[4], y: quad[5]},
      {x: quad[6], y: quad[7]}
    ];
  }

  _intersectQuadWithViewport(quad: Array<{ x: number; y: number; }>, width: number, height: number): Array<{ x: number; y: number; }> {
    return quad.map(point => ({
      x: Math.min(Math.max(point.x, 0), width),
      y: Math.min(Math.max(point.y, 0), height),
    }));
  }

  hover(options?: PointerActionOptions): Promise<void> {
    return this._performPointerAction(point => this._page.mouse.move(point.x, point.y), options);
  }

  click(options?: ClickOptions): Promise<void> {
    return this._performPointerAction(point => this._page.mouse.click(point.x, point.y, options), options);
  }

  dblclick(options?: MultiClickOptions): Promise<void> {
    return this._performPointerAction(point => this._page.mouse.dblclick(point.x, point.y, options), options);
  }

  tripleclick(options?: MultiClickOptions): Promise<void> {
    return this._performPointerAction(point => this._page.mouse.tripleclick(point.x, point.y, options), options);
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
    return this.evaluate((element: HTMLSelectElement, ...optionsToSelect: (Node | SelectOption)[]) => {
      if (element.nodeName.toLowerCase() !== 'select')
        throw new Error('Element is not a <select> element.');

      const options = Array.from(element.options);
      element.value = undefined;
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
      return options.filter(option => option.selected).map(option => option.value);
    }, ...options);
  }

  async fill(value: string): Promise<void> {
    assert(helper.isString(value), 'Value must be string. Found value "' + value + '" of type "' + (typeof value) + '"');
    const error = await this.evaluate((element: HTMLElement) => {
      if (element.nodeType !== Node.ELEMENT_NODE)
        return 'Node is not of type HTMLElement';
      if (element.nodeName.toLowerCase() === 'input') {
        const input = element as HTMLInputElement;
        const type = input.getAttribute('type') || '';
        const kTextInputTypes = new Set(['', 'password', 'search', 'tel', 'text', 'url']);
        if (!kTextInputTypes.has(type.toLowerCase()))
          return 'Cannot fill input of type "' + type + '".';
        input.selectionStart = 0;
        input.selectionEnd = input.value.length;
      } else if (element.nodeName.toLowerCase() === 'textarea') {
        const textarea = element as HTMLTextAreaElement;
        textarea.selectionStart = 0;
        textarea.selectionEnd = textarea.value.length;
      } else if (element.isContentEditable) {
        if (!element.ownerDocument || !element.ownerDocument.defaultView)
          return 'Element does not belong to a window';
        const range = element.ownerDocument.createRange();
        range.selectNodeContents(element);
        const selection = element.ownerDocument.defaultView.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        return 'Element is not an <input>, <textarea> or [contenteditable] element.';
      }
      return false;
    });
    if (error)
      throw new Error(error);
    await this.focus();
    await this._page.keyboard.sendCharacter(value);
  }

  async uploadFile(...filePaths: string[]) {
    const files = filePaths.map(filePath => path.resolve(filePath));
    const objectId = this._remoteObject.objectId;
    await this._client.send('DOM.setFileInputFiles', { objectId, files });
  }

  async focus() {
    await this.evaluate(element => element.focus());
  }

  async type(text: string, options: { delay: (number | undefined); } | undefined) {
    await this.focus();
    await this._page.keyboard.type(text, options);
  }

  async press(key: string, options: { delay?: number; text?: string; } | undefined) {
    await this.focus();
    await this._page.keyboard.press(key, options);
  }

  async boundingBox(): Promise<{ x: number; y: number; width: number; height: number; } | null> {
    const result = await this._getBoxModel();

    if (!result)
      return null;

    const quad = result.model.border;
    const x = Math.min(quad[0], quad[2], quad[4], quad[6]);
    const y = Math.min(quad[1], quad[3], quad[5], quad[7]);
    const width = Math.max(quad[0], quad[2], quad[4], quad[6]) - x;
    const height = Math.max(quad[1], quad[3], quad[5], quad[7]) - y;

    return {x, y, width, height};
  }

  async screenshot(options: any = {}): Promise<string | Buffer> {
    let needsViewportReset = false;

    let boundingBox = await this.boundingBox();
    assert(boundingBox, 'Node is either not visible or not an HTMLElement');

    const viewport = this._page.viewport();

    if (viewport && (boundingBox.width > viewport.width || boundingBox.height > viewport.height)) {
      const newViewport = {
        width: Math.max(viewport.width, Math.ceil(boundingBox.width)),
        height: Math.max(viewport.height, Math.ceil(boundingBox.height)),
      };
      await this._page.setViewport(Object.assign({}, viewport, newViewport));

      needsViewportReset = true;
    }

    await this._scrollIntoViewIfNeeded();

    boundingBox = await this.boundingBox();
    assert(boundingBox, 'Node is either not visible or not an HTMLElement');
    assert(boundingBox.width !== 0, 'Node has 0 width.');
    assert(boundingBox.height !== 0, 'Node has 0 height.');

    const { layoutViewport: { pageX, pageY } } = await this._client.send('Page.getLayoutMetrics');

    const clip = Object.assign({}, boundingBox);
    clip.x += pageX;
    clip.y += pageY;

    const imageData = await this._page.screenshot(Object.assign({}, {
      clip
    }, options));

    if (needsViewportReset)
      await this._page.setViewport(viewport);

    return imageData;
  }

  async $(selector: string): Promise<ElementHandle | null> {
    const handle = await this.evaluateHandle(
        (element, selector) => element.querySelector(selector),
        selector
    );
    const element = handle.asElement();
    if (element)
      return element;
    await handle.dispose();
    return null;
  }

  async $$(selector: string): Promise<ElementHandle[]> {
    const arrayHandle = await this.evaluateHandle(
        (element, selector) => element.querySelectorAll(selector),
        selector
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

  async $eval(selector: string, pageFunction: Function | string, ...args: any[]): Promise<(object | undefined)> {
    const elementHandle = await this.$(selector);
    if (!elementHandle)
      throw new Error(`Error: failed to find element matching selector "${selector}"`);
    const result = await elementHandle.evaluate(pageFunction, ...args);
    await elementHandle.dispose();
    return result;
  }

  async $$eval(selector: string, pageFunction: Function | string, ...args: any[]): Promise<(object | undefined)> {
    const arrayHandle = await this.evaluateHandle(
        (element, selector) => Array.from(element.querySelectorAll(selector)),
        selector
    );

    const result = await arrayHandle.evaluate(pageFunction, ...args);
    await arrayHandle.dispose();
    return result;
  }

  async $x(expression: string): Promise<ElementHandle[]> {
    const arrayHandle = await this.evaluateHandle(
        (element, expression) => {
          const document = element.ownerDocument || element;
          const iterator = document.evaluate(expression, element, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE);
          const array = [];
          let item;
          while ((item = iterator.iterateNext()))
            array.push(item);
          return array;
        },
        expression
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

  isIntersectingViewport(): Promise<boolean> {
    return this.evaluate(async element => {
      const visibleRatio = await new Promise(resolve => {
        const observer = new IntersectionObserver(entries => {
          resolve(entries[0].intersectionRatio);
          observer.disconnect();
        });
        observer.observe(element);
      });
      return visibleRatio > 0;
    });
  }
}

function computeQuadArea(quad) {
  // Compute sum of all directed areas of adjacent triangles
  // https://en.wikipedia.org/wiki/Polygon#Simple_polygons
  let area = 0;
  for (let i = 0; i < quad.length; ++i) {
    const p1 = quad[i];
    const p2 = quad[(i + 1) % quad.length];
    area += (p1.x * p2.y - p2.x * p1.y) / 2;
  }
  return Math.abs(area);
}
