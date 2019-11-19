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
import * as fs from 'fs';
import { assert, debugError, helper } from '../helper';
import { TargetSession } from './Connection';
import { ExecutionContext } from './ExecutionContext';
import { FrameManager } from './FrameManager';
import { Button } from './Input';
import { Page } from './Page';
import { Protocol } from './protocol';
import { releaseObject, valueFromRemoteObject } from './protocolHelper';
const writeFileAsync = helper.promisify(fs.writeFile);

export type ClickOptions = {
  delay?: number;
  button?: Button;
  clickCount?: number;
};

export function createJSHandle(context: ExecutionContext, remoteObject: Protocol.Runtime.RemoteObject) {
  const frame = context.frame();
  if (remoteObject.subtype === 'node' && frame) {
    const frameManager = frame._frameManager;
    return new ElementHandle(context, context._session, remoteObject, frameManager.page(), frameManager);
  }
  return new JSHandle(context, context._session, remoteObject);
}

export class JSHandle {
  _context: ExecutionContext;
  protected _client: TargetSession;
  _remoteObject: Protocol.Runtime.RemoteObject;
  _disposed = false;

  constructor(context: ExecutionContext, client: TargetSession, remoteObject: Protocol.Runtime.RemoteObject) {
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
    for (const property of response.properties) {
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
        returnByValue: true
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
      let type: string =  this._remoteObject.subtype || this._remoteObject.type;
      // FIXME: promise doesn't have special subtype in WebKit.
      if (this._remoteObject.className === 'Promise')
        type = 'promise';
      return 'JSHandle@' + type;
    }
    return 'JSHandle:' + valueFromRemoteObject(this._remoteObject);
  }
}

export class ElementHandle extends JSHandle {
  private _page: Page;
  private _frameManager: FrameManager;

  constructor(context: ExecutionContext, client: TargetSession, remoteObject: Protocol.Runtime.RemoteObject, page: Page, frameManager: FrameManager) {
    super(context, client, remoteObject);
    this._client = client;
    this._remoteObject = remoteObject;
    this._page = page;
    this._frameManager = frameManager;
  }

  asElement(): ElementHandle | null {
    return this;
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

  async _clickablePoint() {
    const [result, viewport] = await Promise.all([
      this._client.send('DOM.getContentQuads', {
        objectId: this._remoteObject.objectId
      }).catch(debugError),
      this._page.evaluate(() => ({ clientWidth: innerWidth, clientHeight: innerHeight })),
    ]);
    if (!result || !result.quads.length)
      throw new Error('Node is either not visible or not an HTMLElement');
    // Filter out quads that have too small area to click into.
    const {clientWidth, clientHeight} = viewport;
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

  async hover(): Promise<void> {
    await this._scrollIntoViewIfNeeded();
    const {x, y} = await this._clickablePoint();
    await this._page.mouse.move(x, y);
  }

  async click(options?: ClickOptions): Promise<void> {
    await this._scrollIntoViewIfNeeded();
    const {x, y} = await this._clickablePoint();
    await this._page.mouse.click(x, y, options);
  }

  async select(...values: string[]): Promise<string[]> {
    for (const value of values)
      assert(helper.isString(value), 'Values must be strings. Found value "' + value + '" of type "' + (typeof value) + '"');
    return this.evaluate((element: HTMLSelectElement, values: string[]) => {
      if (element.nodeName.toLowerCase() !== 'select')
        throw new Error('Element is not a <select> element.');

      const options = Array.from(element.options);
      element.value = undefined;
      for (const option of options) {
        option.selected = values.includes(option.value);
        if (option.selected && !element.multiple)
          break;
      }
      element.dispatchEvent(new Event('input', { 'bubbles': true }));
      element.dispatchEvent(new Event('change', { 'bubbles': true }));
      return options.filter(option => option.selected).map(option => option.value);
    }, values);
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

  async screenshot(options: {path?: string} = {}): Promise<string | Buffer> {
    const objectId = this._remoteObject.objectId;
    this._client.send('DOM.getDocument');
    const {nodeId} = await this._client.send('DOM.requestNode', {objectId});
    const result = await this._client.send('Page.snapshotNode', {nodeId});
    const prefix = 'data:image/png;base64,';
    const buffer = Buffer.from(result.dataURL.substr(prefix.length), 'base64');
    if (options.path)
      await writeFileAsync(options.path, buffer);
    return buffer;
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

type BoxModel = {
  content: {x: number, y: number}[],
  padding: {x: number, y: number}[],
  border: {x: number, y: number}[],
  margin: {x: number, y: number}[],
  width: number,
  height : number
};
