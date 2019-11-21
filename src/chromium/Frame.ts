/**
 * Copyright 2017 Google Inc. All rights reserved.
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

import { helper } from '../helper';
import { CDPSession } from './Connection';
import { DOMWorld } from './DOMWorld';
import { ExecutionContext } from './ExecutionContext';
import { FrameManager } from './FrameManager';
import { ClickOptions, ElementHandle, JSHandle, MultiClickOptions, PointerActionOptions } from './JSHandle';
import { Response } from './NetworkManager';
import { Protocol } from './protocol';

export class Frame {
  _id: string;
  _frameManager: FrameManager;
  private _client: CDPSession;
  private _parentFrame: Frame;
  private _url = '';
  private _detached = false;
  _loaderId = '';
  _lifecycleEvents = new Set<string>();
  _mainWorld: DOMWorld;
  _secondaryWorld: DOMWorld;
  private _childFrames = new Set<Frame>();
  private _name: string;
  private _navigationURL: string;

  constructor(frameManager: FrameManager, client: CDPSession, parentFrame: Frame | null, frameId: string) {
    this._frameManager = frameManager;
    this._client = client;
    this._parentFrame = parentFrame;
    this._id = frameId;

    this._mainWorld = new DOMWorld(frameManager, this, frameManager._timeoutSettings);
    this._secondaryWorld = new DOMWorld(frameManager, this, frameManager._timeoutSettings);

    if (this._parentFrame)
      this._parentFrame._childFrames.add(this);
  }

  async goto(
    url: string,
    options: { referer?: string; timeout?: number; waitUntil?: string | string[]; } | undefined
  ): Promise<Response | null> {
    return await this._frameManager.navigateFrame(this, url, options);
  }

  async waitForNavigation(options: { timeout?: number; waitUntil?: string | string[]; } | undefined): Promise<Response | null> {
    return await this._frameManager.waitForFrameNavigation(this, options);
  }

  executionContext(): Promise<ExecutionContext> {
    return this._mainWorld.executionContext();
  }

  async evaluateHandle(pageFunction: Function | string, ...args: any[]): Promise<JSHandle> {
    return this._mainWorld.evaluateHandle(pageFunction, ...args);
  }

  async evaluate(pageFunction: Function | string, ...args: any[]): Promise<any> {
    return this._mainWorld.evaluate(pageFunction, ...args);
  }

  async $(selector: string): Promise<ElementHandle | null> {
    return this._mainWorld.$(selector);
  }

  async $x(expression: string): Promise<ElementHandle[]> {
    return this._mainWorld.$x(expression);
  }

  async $eval(selector: string, pageFunction: Function | string, ...args: any[]): Promise<(object | undefined)> {
    return this._mainWorld.$eval(selector, pageFunction, ...args);
  }

  async $$eval(selector: string, pageFunction: Function | string, ...args: any[]): Promise<(object | undefined)> {
    return this._mainWorld.$$eval(selector, pageFunction, ...args);
  }

  async $$(selector: string): Promise<ElementHandle[]> {
    return this._mainWorld.$$(selector);
  }

  async content(): Promise<string> {
    return this._secondaryWorld.content();
  }

  async setContent(html: string, options: {
      timeout?: number;
      waitUntil?: string | string[];
    } = {}) {
    return this._secondaryWorld.setContent(html, options);
  }

  name(): string {
    return this._name || '';
  }

  url(): string {
    return this._url;
  }

  parentFrame(): Frame | null {
    return this._parentFrame;
  }

  childFrames(): Frame[] {
    return Array.from(this._childFrames);
  }

  isDetached(): boolean {
    return this._detached;
  }

  async addScriptTag(options: {
      url?: string; path?: string;
      content?: string;
      type?: string; }): Promise<ElementHandle> {
    return this._mainWorld.addScriptTag(options);
  }

  async addStyleTag(options: {
      url?: string;
      path?: string;
      content?: string; }): Promise<ElementHandle> {
    return this._mainWorld.addStyleTag(options);
  }

  async click(selector: string, options?: ClickOptions) {
    return this._secondaryWorld.click(selector, options);
  }

  async dblclick(selector: string, options?: MultiClickOptions) {
    return this._secondaryWorld.dblclick(selector, options);
  }

  async tripleclick(selector: string, options?: MultiClickOptions) {
    return this._secondaryWorld.tripleclick(selector, options);
  }

  async fill(selector: string, value: string) {
    return this._secondaryWorld.fill(selector, value);
  }

  async focus(selector: string) {
    return this._secondaryWorld.focus(selector);
  }

  async hover(selector: string, options?: PointerActionOptions) {
    return this._secondaryWorld.hover(selector, options);
  }

  select(selector: string, ...values: string[]): Promise<string[]>{
    return this._secondaryWorld.select(selector, ...values);
  }

  async type(selector: string, text: string, options: { delay: (number | undefined); } | undefined) {
    return this._mainWorld.type(selector, text, options);
  }

  waitFor(selectorOrFunctionOrTimeout: (string | number | Function), options: any = {}, ...args: any[]): Promise<JSHandle | null> {
    const xPathPattern = '//';

    if (helper.isString(selectorOrFunctionOrTimeout)) {
      const string = selectorOrFunctionOrTimeout as string;
      if (string.startsWith(xPathPattern))
        return this.waitForXPath(string, options);
      return this.waitForSelector(string, options);
    }
    if (helper.isNumber(selectorOrFunctionOrTimeout))
      return new Promise(fulfill => setTimeout(fulfill, selectorOrFunctionOrTimeout as number));
    if (typeof selectorOrFunctionOrTimeout === 'function')
      return this.waitForFunction(selectorOrFunctionOrTimeout, options, ...args);
    return Promise.reject(new Error('Unsupported target type: ' + (typeof selectorOrFunctionOrTimeout)));
  }

  async waitForSelector(selector: string, options: {
      visible?: boolean;
      hidden?: boolean;
      timeout?: number; } | undefined): Promise<ElementHandle | null> {
    const handle = await this._secondaryWorld.waitForSelector(selector, options);
    if (!handle)
      return null;
    const mainExecutionContext = await this._mainWorld.executionContext();
    const result = await mainExecutionContext._adoptElementHandle(handle);
    await handle.dispose();
    return result;
  }

  async waitForXPath(xpath: string, options: {
      visible?: boolean;
      hidden?: boolean;
      timeout?: number; } | undefined): Promise<ElementHandle | null> {
    const handle = await this._secondaryWorld.waitForXPath(xpath, options);
    if (!handle)
      return null;
    const mainExecutionContext = await this._mainWorld.executionContext();
    const result = await mainExecutionContext._adoptElementHandle(handle);
    await handle.dispose();
    return result;
  }

  waitForFunction(
    pageFunction: Function | string,
    options: { polling?: string | number; timeout?: number; } = {},
    ...args): Promise<JSHandle> {
    return this._mainWorld.waitForFunction(pageFunction, options, ...args);
  }

  async title(): Promise<string> {
    return this._secondaryWorld.title();
  }

  _navigated(framePayload: Protocol.Page.Frame) {
    this._name = framePayload.name;
    // TODO(lushnikov): remove this once requestInterception has loaderId exposed.
    this._navigationURL = framePayload.url;
    this._url = framePayload.url;
  }

  _navigatedWithinDocument(url: string) {
    this._url = url;
  }

  _onLifecycleEvent(loaderId: string, name: string) {
    if (name === 'init') {
      this._loaderId = loaderId;
      this._lifecycleEvents.clear();
    }
    this._lifecycleEvents.add(name);
  }

  _onLoadingStopped() {
    this._lifecycleEvents.add('DOMContentLoaded');
    this._lifecycleEvents.add('load');
  }

  _detach() {
    this._detached = true;
    this._mainWorld._detach();
    this._secondaryWorld._detach();
    if (this._parentFrame)
      this._parentFrame._childFrames.delete(this);
    this._parentFrame = null;
  }
}
