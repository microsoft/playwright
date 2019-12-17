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

import { EventEmitter } from 'events';
import * as dom from './dom';
import * as frames from './frames';
import { assert, debugError, helper } from './helper';
import * as input from './input';
import * as js from './javascript';
import * as network from './network';
import { Screenshotter } from './screenshotter';
import { TimeoutSettings } from './timeoutSettings';
import * as types from './types';
import { Events } from './events';
import { BrowserContext, BrowserInterface } from './browserContext';
import { ConsoleMessage, ConsoleMessageLocation } from './console';
import Injected from './injected/injected';

export interface PageDelegate {
  readonly rawMouse: input.RawMouse;
  readonly rawKeyboard: input.RawKeyboard;

  reload(options?: frames.NavigateOptions): Promise<network.Response | null>;
  goBack(options?: frames.NavigateOptions): Promise<network.Response | null>;
  goForward(options?: frames.NavigateOptions): Promise<network.Response | null>;
  exposeBinding(name: string, bindingFunction: string): Promise<void>;
  evaluateOnNewDocument(source: string): Promise<void>;
  closePage(runBeforeUnload: boolean): Promise<void>;

  navigateFrame(frame: frames.Frame, url: string, options?: frames.GotoOptions): Promise<network.Response | null>;
  waitForFrameNavigation(frame: frames.Frame, options?: frames.NavigateOptions): Promise<network.Response | null>;
  setFrameContent(frame: frames.Frame, html: string, options?: frames.NavigateOptions): Promise<void>;

  setExtraHTTPHeaders(extraHTTPHeaders: network.Headers): Promise<void>;
  setUserAgent(userAgent: string): Promise<void>;
  setJavaScriptEnabled(enabled: boolean): Promise<void>;
  setBypassCSP(enabled: boolean): Promise<void>;
  setViewport(viewport: types.Viewport): Promise<void>;
  setEmulateMedia(mediaType: input.MediaType | null, mediaColorScheme: input.MediaColorScheme | null): Promise<void>;
  setCacheEnabled(enabled: boolean): Promise<void>;

  getBoundingBoxForScreenshot(handle: dom.ElementHandle<Node>): Promise<types.Rect | null>;
  canScreenshotOutsideViewport(): boolean;
  setBackgroundColor(color?: { r: number; g: number; b: number; a: number; }): Promise<void>;
  takeScreenshot(format: string, options: types.ScreenshotOptions, viewport: types.Viewport): Promise<Buffer>;
  resetViewport(oldSize: types.Size): Promise<void>;

  isElementHandle(remoteObject: any): boolean;
  adoptElementHandle<T extends Node>(handle: dom.ElementHandle<T>, to: dom.FrameExecutionContext): Promise<dom.ElementHandle<T>>;
  getContentFrame(handle: dom.ElementHandle): Promise<frames.Frame | null>;
  getContentQuads(handle: dom.ElementHandle): Promise<types.Quad[] | null>;
  layoutViewport(): Promise<{ width: number, height: number }>;
  setInputFiles(handle: dom.ElementHandle, files: input.FilePayload[]): Promise<void>;
  getBoundingBox(handle: dom.ElementHandle): Promise<types.Rect | null>;
}

type PageState = {
  viewport: types.Viewport | null;
  userAgent: string | null;
  mediaType: input.MediaType | null;
  mediaColorScheme: input.MediaColorScheme | null;
  javascriptEnabled: boolean | null;
  extraHTTPHeaders: network.Headers | null;
  bypassCSP: boolean | null;
  cacheEnabled: boolean | null;
};

export type FileChooser = {
  element: dom.ElementHandle,
  multiple: boolean
};

export class Page extends EventEmitter {
  private _closed = false;
  private _closedCallback: () => void;
  private _closedPromise: Promise<void>;
  private _disconnected = false;
  private _disconnectedCallback: (e: Error) => void;
  readonly _disconnectedPromise: Promise<Error>;
  private _browserContext: BrowserContext;
  readonly keyboard: input.Keyboard;
  readonly mouse: input.Mouse;
  readonly _timeoutSettings: TimeoutSettings;
  readonly _delegate: PageDelegate;
  readonly _state: PageState;
  private _pageBindings = new Map<string, Function>();
  readonly _screenshotter: Screenshotter;
  private _fileChooserInterceptors = new Set<(chooser: FileChooser) => void>();
  readonly _frameManager: frames.FrameManager;

  constructor(delegate: PageDelegate, browserContext: BrowserContext) {
    super();
    this._delegate = delegate;
    this._closedPromise = new Promise(f => this._closedCallback = f);
    this._disconnectedPromise = new Promise(f => this._disconnectedCallback = f);
    this._browserContext = browserContext;
    this._state = {
      viewport: null,
      userAgent: null,
      mediaType: null,
      mediaColorScheme: null,
      javascriptEnabled: null,
      extraHTTPHeaders: null,
      bypassCSP: null,
      cacheEnabled: null,
    };
    this.keyboard = new input.Keyboard(delegate.rawKeyboard);
    this.mouse = new input.Mouse(delegate.rawMouse, this.keyboard);
    this._timeoutSettings = new TimeoutSettings();
    this._screenshotter = new Screenshotter(this);
    this._frameManager = new frames.FrameManager(this);
  }

  _didClose() {
    assert(!this._closed, 'Page closed twice');
    this._closed = true;
    this.emit(Events.Page.Close);
    this._closedCallback();
  }

  _didDisconnect() {
    assert(!this._disconnected, 'Page disconnected twice');
    this._disconnected = true;
    this._disconnectedCallback(new Error('Target closed'));
  }

  async _onFileChooserOpened(handle: dom.ElementHandle) {
    if (!this._fileChooserInterceptors.size) {
      await handle.dispose();
      return;
    }
    const interceptors = Array.from(this._fileChooserInterceptors);
    this._fileChooserInterceptors.clear();
    const multiple = await handle.evaluate((element: HTMLInputElement) => !!element.multiple);
    const fileChooser = { element: handle, multiple };
    for (const interceptor of interceptors)
      interceptor.call(null, fileChooser);
    this.emit(Events.Page.FileChooser, fileChooser);
  }

  async waitForFileChooser(options: { timeout?: number; } = {}): Promise<FileChooser> {
    const {
      timeout = this._timeoutSettings.timeout(),
    } = options;
    let callback;
    const promise = new Promise<FileChooser>(x => callback = x);
    this._fileChooserInterceptors.add(callback);
    return helper.waitWithTimeout<FileChooser>(promise, 'waiting for file chooser', timeout).catch(e => {
      this._fileChooserInterceptors.delete(callback);
      throw e;
    });
  }

  browser(): BrowserInterface {
    return this._browserContext.browser();
  }

  browserContext(): BrowserContext {
    return this._browserContext;
  }

  mainFrame(): frames.Frame {
    return this._frameManager.mainFrame();
  }

  frames(): frames.Frame[] {
    return this._frameManager.frames();
  }

  setDefaultNavigationTimeout(timeout: number) {
    this._timeoutSettings.setDefaultNavigationTimeout(timeout);
  }

  setDefaultTimeout(timeout: number) {
    this._timeoutSettings.setDefaultTimeout(timeout);
  }

  async $(selector: string | types.Selector): Promise<dom.ElementHandle<Element> | null> {
    return this.mainFrame().$(selector);
  }

  async _createSelector(name: string, handle: dom.ElementHandle<Element>): Promise<string> {
    const mainContext = await this.mainFrame()._mainContext();
    return mainContext.evaluate((injected: Injected, target: Element, name: string) => {
      return injected.engines.get(name).create(document.documentElement, target);
    }, await mainContext._injected(), handle, name);
  }

  evaluateHandle: types.EvaluateHandle = async (pageFunction, ...args) => {
    const context = await this.mainFrame().executionContext();
    return context.evaluateHandle(pageFunction, ...args as any);
  }

  $eval: types.$Eval = (selector, pageFunction, ...args) => {
    return this.mainFrame().$eval(selector, pageFunction, ...args as any);
  }

  $$eval: types.$$Eval = (selector, pageFunction, ...args) => {
    return this.mainFrame().$$eval(selector, pageFunction, ...args as any);
  }

  async $$(selector: string | types.Selector): Promise<dom.ElementHandle<Element>[]> {
    return this.mainFrame().$$(selector);
  }

  async $x(expression: string): Promise<dom.ElementHandle<Element>[]> {
    return this.mainFrame().$x(expression);
  }

  async addScriptTag(options: { url?: string; path?: string; content?: string; type?: string; }): Promise<dom.ElementHandle> {
    return this.mainFrame().addScriptTag(options);
  }

  async addStyleTag(options: { url?: string; path?: string; content?: string; }): Promise<dom.ElementHandle> {
    return this.mainFrame().addStyleTag(options);
  }

  async exposeFunction(name: string, playwrightFunction: Function) {
    if (this._pageBindings.has(name))
      throw new Error(`Failed to add page binding with name ${name}: window['${name}'] already exists!`);
    this._pageBindings.set(name, playwrightFunction);
    await this._delegate.exposeBinding(name, helper.evaluationString(addPageBinding, name));

    function addPageBinding(bindingName: string) {
      const binding = window[bindingName];
      window[bindingName] = (...args) => {
        const me = window[bindingName];
        let callbacks = me['callbacks'];
        if (!callbacks) {
          callbacks = new Map();
          me['callbacks'] = callbacks;
        }
        const seq = (me['lastSeq'] || 0) + 1;
        me['lastSeq'] = seq;
        const promise = new Promise((resolve, reject) => callbacks.set(seq, {resolve, reject}));
        binding(JSON.stringify({name: bindingName, seq, args}));
        return promise;
      };
    }
  }

  setExtraHTTPHeaders(headers: network.Headers) {
    this._state.extraHTTPHeaders = {...headers};
    return this._delegate.setExtraHTTPHeaders(headers);
  }

  setUserAgent(userAgent: string) {
    this._state.userAgent = userAgent;
    return this._delegate.setUserAgent(userAgent);
  }

  async _onBindingCalled(payload: string, context: js.ExecutionContext) {
    const {name, seq, args} = JSON.parse(payload);
    let expression = null;
    try {
      const result = await this._pageBindings.get(name)(...args);
      expression = helper.evaluationString(deliverResult, name, seq, result);
    } catch (error) {
      if (error instanceof Error)
        expression = helper.evaluationString(deliverError, name, seq, error.message, error.stack);
      else
        expression = helper.evaluationString(deliverErrorValue, name, seq, error);
    }
    context.evaluate(expression).catch(debugError);

    function deliverResult(name: string, seq: number, result: any) {
      window[name]['callbacks'].get(seq).resolve(result);
      window[name]['callbacks'].delete(seq);
    }

    function deliverError(name: string, seq: number, message: string, stack: string) {
      const error = new Error(message);
      error.stack = stack;
      window[name]['callbacks'].get(seq).reject(error);
      window[name]['callbacks'].delete(seq);
    }

    function deliverErrorValue(name: string, seq: number, value: any) {
      window[name]['callbacks'].get(seq).reject(value);
      window[name]['callbacks'].delete(seq);
    }
  }

  _addConsoleMessage(type: string, args: js.JSHandle[], location: ConsoleMessageLocation, text?: string) {
    if (!this.listenerCount(Events.Page.Console)) {
      args.forEach(arg => arg.dispose());
      return;
    }
    this.emit(Events.Page.Console, new ConsoleMessage(type, text, args, location));
  }

  url(): string {
    return this.mainFrame().url();
  }

  content(): Promise<string> {
    return this.mainFrame().content();
  }

  setContent(html: string, options?: frames.NavigateOptions): Promise<void> {
    return this.mainFrame().setContent(html, options);
  }

  goto(url: string, options?: frames.GotoOptions): Promise<network.Response | null> {
    return this.mainFrame().goto(url, options);
  }

  async reload(options?: frames.NavigateOptions): Promise<network.Response | null> {
    return this._delegate.reload(options);
  }

  waitForNavigation(options?: frames.NavigateOptions): Promise<network.Response | null> {
    return this.mainFrame().waitForNavigation(options);
  }

  async waitForRequest(urlOrPredicate: (string | Function), options: { timeout?: number; } = {}): Promise<Request> {
    const {
      timeout = this._timeoutSettings.timeout(),
    } = options;
    return helper.waitForEvent(this, Events.Page.Request, (request: network.Request) => {
      if (helper.isString(urlOrPredicate))
        return (urlOrPredicate === request.url());
      if (typeof urlOrPredicate === 'function')
        return !!(urlOrPredicate(request));
      return false;
    }, timeout, this._disconnectedPromise);
  }

  async waitForResponse(urlOrPredicate: (string | Function), options: { timeout?: number; } = {}): Promise<network.Response> {
    const {
      timeout = this._timeoutSettings.timeout(),
    } = options;
    return helper.waitForEvent(this, Events.Page.Response, (response: network.Response) => {
      if (helper.isString(urlOrPredicate))
        return (urlOrPredicate === response.url());
      if (typeof urlOrPredicate === 'function')
        return !!(urlOrPredicate(response));
      return false;
    }, timeout, this._disconnectedPromise);
  }

  async goBack(options?: frames.NavigateOptions): Promise<network.Response | null> {
    return this._delegate.goBack(options);
  }

  async goForward(options?: frames.NavigateOptions): Promise<network.Response | null> {
    return this._delegate.goForward(options);
  }

  async emulate(options: { viewport: types.Viewport; userAgent: string; }) {
    await Promise.all([
      this.setViewport(options.viewport),
      this.setUserAgent(options.userAgent)
    ]);
  }

  async setJavaScriptEnabled(enabled: boolean) {
    if (this._state.javascriptEnabled === enabled)
      return;
    this._state.javascriptEnabled = enabled;
    await this._delegate.setJavaScriptEnabled(enabled);
  }

  async setBypassCSP(enabled: boolean) {
    if (this._state.bypassCSP === enabled)
      return;
    this._state.bypassCSP = enabled;
    await this._delegate.setBypassCSP(enabled);
  }

  async emulateMedia(options: { type?: input.MediaType, colorScheme?: input.MediaColorScheme }) {
    assert(!options.type || input.mediaTypes.has(options.type), 'Unsupported media type: ' + options.type);
    assert(!options.colorScheme || input.mediaColorSchemes.has(options.colorScheme), 'Unsupported color scheme: ' + options.colorScheme);
    if (options.type !== undefined)
      this._state.mediaType = options.type;
    if (options.colorScheme !== undefined)
      this._state.mediaColorScheme = options.colorScheme;
    await this._delegate.setEmulateMedia(this._state.mediaType, this._state.mediaColorScheme);
  }

  async setViewport(viewport: types.Viewport) {
    const oldIsMobile = this._state.viewport ? !!this._state.viewport.isMobile : false;
    const oldHasTouch = this._state.viewport ? !!this._state.viewport.hasTouch : false;
    const newIsMobile = !!viewport.isMobile;
    const newHasTouch = !!viewport.hasTouch;
    this._state.viewport = { ...viewport };
    await this._delegate.setViewport(viewport);
    if (oldIsMobile !== newIsMobile || oldHasTouch !== newHasTouch)
      await this.reload();
  }

  viewport(): types.Viewport | null {
    return this._state.viewport;
  }

  evaluate: types.Evaluate = (pageFunction, ...args) => {
    return this.mainFrame().evaluate(pageFunction, ...args as any);
  }

  async evaluateOnNewDocument(pageFunction: Function | string, ...args: any[]) {
    const source = helper.evaluationString(pageFunction, ...args);
    await this._delegate.evaluateOnNewDocument(source);
  }

  async setCacheEnabled(enabled: boolean = true) {
    if (this._state.cacheEnabled === enabled)
      return;
    this._state.cacheEnabled = enabled;
    await this._delegate.setCacheEnabled(enabled);
  }

  async screenshot(options?: types.ScreenshotOptions): Promise<Buffer> {
    return this._screenshotter.screenshotPage(options);
  }

  title(): Promise<string> {
    return this.mainFrame().title();
  }

  async close(options: { runBeforeUnload: (boolean | undefined); } = {runBeforeUnload: undefined}) {
    assert(!this._disconnected, 'Protocol error: Connection closed. Most likely the page has been closed.');
    const runBeforeUnload = !!options.runBeforeUnload;
    await this._delegate.closePage(runBeforeUnload);
    if (!runBeforeUnload)
      await this._closedPromise;
  }

  isClosed(): boolean {
    return this._closed;
  }

  click(selector: string | types.Selector, options?: frames.WaitForOptions & input.ClickOptions) {
    return this.mainFrame().click(selector, options);
  }

  dblclick(selector: string | types.Selector, options?: frames.WaitForOptions & input.MultiClickOptions) {
    return this.mainFrame().dblclick(selector, options);
  }

  tripleclick(selector: string | types.Selector, options?: frames.WaitForOptions & input.MultiClickOptions) {
    return this.mainFrame().tripleclick(selector, options);
  }

  fill(selector: string | types.Selector, value: string, options?: frames.WaitForOptions) {
    return this.mainFrame().fill(selector, value, options);
  }

  focus(selector: string | types.Selector, options?: frames.WaitForOptions) {
    return this.mainFrame().focus(selector, options);
  }

  hover(selector: string | types.Selector, options?: frames.WaitForOptions & input.PointerActionOptions) {
    return this.mainFrame().hover(selector, options);
  }

  select(selector: string | types.Selector, value: string | dom.ElementHandle | input.SelectOption | string[] | dom.ElementHandle[] | input.SelectOption[] | undefined, options?: frames.WaitForOptions): Promise<string[]> {
    return this.mainFrame().select(selector, value, options);
  }

  type(selector: string | types.Selector, text: string, options: frames.WaitForOptions & { delay: (number | undefined); } | undefined) {
    return this.mainFrame().type(selector, text, options);
  }

  waitFor(selectorOrFunctionOrTimeout: (string | number | Function), options: { visible?: boolean; hidden?: boolean; timeout?: number; polling?: string | number; } = {}, ...args: any[]): Promise<js.JSHandle> {
    return this.mainFrame().waitFor(selectorOrFunctionOrTimeout, options, ...args);
  }

  waitForSelector(selector: string | types.Selector, options: types.TimeoutOptions = {}): Promise<dom.ElementHandle | null> {
    return this.mainFrame().waitForSelector(selector, options);
  }

  waitForXPath(xpath: string, options: types.TimeoutOptions = {}): Promise<dom.ElementHandle | null> {
    return this.mainFrame().waitForXPath(xpath, options);
  }

  waitForFunction(pageFunction: Function | string, options: types.WaitForFunctionOptions, ...args: any[]): Promise<js.JSHandle> {
    return this.mainFrame().waitForFunction(pageFunction, options, ...args);
  }
}
