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
import * as console from '../console';
import * as dom from '../dom';
import * as frames from '../frames';
import { assert, debugError, helper } from '../helper';
import * as input from '../input';
import { ClickOptions, mediaColorSchemes, mediaTypes, MultiClickOptions, PointerActionOptions, SelectOption } from '../input';
import * as js from '../javascript';
import * as network from '../network';
import { Screenshotter } from '../screenshotter';
import { TimeoutSettings } from '../TimeoutSettings';
import * as types from '../types';
import { Browser } from './Browser';
import { BrowserContext } from './BrowserContext';
import { CDPSession } from './Connection';
import { Events } from './events';
import { Accessibility } from './features/accessibility';
import { Coverage } from './features/coverage';
import { Interception } from './features/interception';
import { Overrides } from './features/overrides';
import { PDF } from './features/pdf';
import { Workers } from './features/workers';
import { FrameManager, FrameManagerEvents } from './FrameManager';
import { RawKeyboardImpl, RawMouseImpl } from './Input';
import { NetworkManagerEvents } from './NetworkManager';
import { CRScreenshotDelegate } from './Screenshotter';
import { Protocol } from './protocol';

export class Page extends EventEmitter {
  private _closed = false;
  private _closedCallback: () => void;
  private _closedPromise: Promise<void>;
  private _disconnected = false;
  private _disconnectedCallback: (e: Error) => void;
  private _disconnectedPromise: Promise<Error>;
  _client: CDPSession;
  private _browserContext: BrowserContext;
  readonly keyboard: input.Keyboard;
  readonly mouse: input.Mouse;
  private _timeoutSettings: TimeoutSettings;
  _frameManager: FrameManager;
  readonly accessibility: Accessibility;
  readonly coverage: Coverage;
  readonly overrides: Overrides;
  readonly interception: Interception;
  readonly pdf: PDF;
  readonly workers: Workers;
  private _pageBindings = new Map<string, Function>();
  _javascriptEnabled = true;
  private _viewport: types.Viewport | null = null;
  _screenshotter: Screenshotter;
  private _fileChooserInterceptors = new Set<(chooser: FileChooser) => void>();
  private _emulatedMediaType: string | undefined;

  constructor(client: CDPSession, browserContext: BrowserContext, ignoreHTTPSErrors: boolean) {
    super();
    this._client = client;
    this._closedPromise = new Promise(f => this._closedCallback = f);
    this._disconnectedPromise = new Promise(f => this._disconnectedCallback = f);
    this._browserContext = browserContext;
    this.keyboard = new input.Keyboard(new RawKeyboardImpl(client));
    this.mouse = new input.Mouse(new RawMouseImpl(client), this.keyboard);
    this._timeoutSettings = new TimeoutSettings();
    this.accessibility = new Accessibility(client);
    this._frameManager = new FrameManager(client, this, ignoreHTTPSErrors, this._timeoutSettings);
    this.coverage = new Coverage(client);
    this.pdf = new PDF(client);
    this.workers = new Workers(client, this._addConsoleMessage.bind(this), error => this.emit(Events.Page.PageError, error));
    this.overrides = new Overrides(client);
    this.interception = new Interception(this._frameManager.networkManager());
    this._screenshotter = new Screenshotter(this, new CRScreenshotDelegate(this._client), browserContext.browser());

    this._frameManager.on(FrameManagerEvents.FrameAttached, event => this.emit(Events.Page.FrameAttached, event));
    this._frameManager.on(FrameManagerEvents.FrameDetached, event => this.emit(Events.Page.FrameDetached, event));
    this._frameManager.on(FrameManagerEvents.FrameNavigated, event => this.emit(Events.Page.FrameNavigated, event));

    const networkManager = this._frameManager.networkManager();
    networkManager.on(NetworkManagerEvents.Request, event => this.emit(Events.Page.Request, event));
    networkManager.on(NetworkManagerEvents.Response, event => this.emit(Events.Page.Response, event));
    networkManager.on(NetworkManagerEvents.RequestFailed, event => this.emit(Events.Page.RequestFailed, event));
    networkManager.on(NetworkManagerEvents.RequestFinished, event => this.emit(Events.Page.RequestFinished, event));
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

  browser(): Browser {
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
    await this._frameManager._exposeBinding(name, helper.evaluationString(addPageBinding, name));

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

  async setExtraHTTPHeaders(headers: { [s: string]: string; }) {
    return this._frameManager.networkManager().setExtraHTTPHeaders(headers);
  }

  async setUserAgent(userAgent: string) {
    return this._frameManager.networkManager().setUserAgent(userAgent);
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

  _addConsoleMessage(type: string, args: js.JSHandle[], location: console.ConsoleMessageLocation) {
    if (!this.listenerCount(Events.Page.Console)) {
      args.forEach(arg => arg.dispose());
      return;
    }
    this.emit(Events.Page.Console, new console.ConsoleMessage(type, undefined, args, location));
  }

  url(): string {
    return this.mainFrame().url();
  }

  async content(): Promise<string> {
    return await this.mainFrame().content();
  }

  async setContent(html: string, options: { timeout?: number; waitUntil?: string | string[]; } | undefined) {
    await this.mainFrame().setContent(html, options);
  }

  async goto(url: string, options: { referer?: string; timeout?: number; waitUntil?: string | string[]; } | undefined): Promise<network.Response | null> {
    return await this.mainFrame().goto(url, options);
  }

  async reload(options: { timeout?: number; waitUntil?: string | string[]; } = {}): Promise<network.Response | null> {
    const [response] = await Promise.all([
      this.waitForNavigation(options),
      this._client.send('Page.reload')
    ]);
    return response;
  }

  async waitForNavigation(options: { timeout?: number; waitUntil?: string | string[]; } = {}): Promise<network.Response | null> {
    return await this.mainFrame().waitForNavigation(options);
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

  async goBack(options: { timeout?: number; waitUntil?: string | string[]; } | undefined): Promise<network.Response | null> {
    return this._go(-1, options);
  }

  async goForward(options: { timeout?: number; waitUntil?: string | string[]; } | undefined): Promise<network.Response | null> {
    return this._go(+1, options);
  }

  async _go(delta, options: { timeout?: number; waitUntil?: string | string[]; } | undefined): Promise<network.Response | null> {
    const history = await this._client.send('Page.getNavigationHistory');
    const entry = history.entries[history.currentIndex + delta];
    if (!entry)
      return null;
    const [response] = await Promise.all([
      this.waitForNavigation(options),
      this._client.send('Page.navigateToHistoryEntry', {entryId: entry.id}),
    ]);
    return response;
  }

  async emulate(options: { viewport: types.Viewport; userAgent: string; }) {
    await Promise.all([
      this.setViewport(options.viewport),
      this.setUserAgent(options.userAgent)
    ]);
  }

  async setJavaScriptEnabled(enabled: boolean) {
    if (this._javascriptEnabled === enabled)
      return;
    this._javascriptEnabled = enabled;
    await this._client.send('Emulation.setScriptExecutionDisabled', { value: !enabled });
  }

  async setBypassCSP(enabled: boolean) {
    await this._client.send('Page.setBypassCSP', { enabled });
  }

  async emulateMedia(options: {
      type?: string,
      colorScheme?: 'dark' | 'light' | 'no-preference' }) {
    assert(!options.type || mediaTypes.has(options.type), 'Unsupported media type: ' + options.type);
    assert(!options.colorScheme || mediaColorSchemes.has(options.colorScheme), 'Unsupported color scheme: ' + options.colorScheme);
    const media = typeof options.type === 'undefined' ? this._emulatedMediaType : options.type;
    const features = typeof options.colorScheme === 'undefined' ? [] : [{ name: 'prefers-color-scheme', value: options.colorScheme }];
    await this._client.send('Emulation.setEmulatedMedia', { media: media || '', features });
    this._emulatedMediaType = options.type;
  }

  async setViewport(viewport: types.Viewport) {
    const {
      width,
      height,
      isMobile = false,
      deviceScaleFactor = 1,
      hasTouch = false,
      isLandscape = false,
    } = viewport;
    const screenOrientation: Protocol.Emulation.ScreenOrientation = isLandscape ? { angle: 90, type: 'landscapePrimary' } : { angle: 0, type: 'portraitPrimary' };
    await Promise.all([
      this._client.send('Emulation.setDeviceMetricsOverride', { mobile: isMobile, width, height, deviceScaleFactor, screenOrientation }),
      this._client.send('Emulation.setTouchEmulationEnabled', {
        enabled: hasTouch
      })
    ]);
    const oldIsMobile = this._viewport ? !!this._viewport.isMobile : false;
    const oldHasTouch = this._viewport ? !!this._viewport.hasTouch : false;
    this._viewport = viewport;
    if (oldIsMobile !== isMobile || oldHasTouch !== hasTouch)
      await this.reload();
  }

  viewport(): types.Viewport | null {
    return this._viewport;
  }

  evaluate: types.Evaluate = (pageFunction, ...args) => {
    return this.mainFrame().evaluate(pageFunction, ...args as any);
  }

  async evaluateOnNewDocument(pageFunction: Function | string, ...args: any[]) {
    const source = helper.evaluationString(pageFunction, ...args);
    await this._client.send('Page.addScriptToEvaluateOnNewDocument', { source });
  }

  async setCacheEnabled(enabled: boolean = true) {
    await this._frameManager.networkManager().setCacheEnabled(enabled);
  }

  screenshot(options?: types.ScreenshotOptions): Promise<Buffer> {
    return this._screenshotter.screenshotPage(options);
  }

  async title(): Promise<string> {
    return this.mainFrame().title();
  }

  async close(options: { runBeforeUnload: (boolean | undefined); } = {runBeforeUnload: undefined}) {
    assert(!this._disconnected, 'Protocol error: Connection closed. Most likely the page has been closed.');
    const runBeforeUnload = !!options.runBeforeUnload;
    if (runBeforeUnload) {
      await this._client.send('Page.close');
    } else {
      await this.browser()._closePage(this);
      await this._closedPromise;
    }
  }

  isClosed(): boolean {
    return this._closed;
  }

  click(selector: string | types.Selector, options?: ClickOptions) {
    return this.mainFrame().click(selector, options);
  }

  dblclick(selector: string | types.Selector, options?: MultiClickOptions) {
    return this.mainFrame().dblclick(selector, options);
  }

  tripleclick(selector: string | types.Selector, options?: MultiClickOptions) {
    return this.mainFrame().tripleclick(selector, options);
  }

  fill(selector: string | types.Selector, value: string) {
    return this.mainFrame().fill(selector, value);
  }

  focus(selector: string | types.Selector) {
    return this.mainFrame().focus(selector);
  }

  hover(selector: string | types.Selector, options?: PointerActionOptions) {
    return this.mainFrame().hover(selector, options);
  }

  select(selector: string | types.Selector, ...values: (string | dom.ElementHandle | SelectOption)[]): Promise<string[]> {
    return this.mainFrame().select(selector, ...values);
  }

  type(selector: string | types.Selector, text: string, options: { delay: (number | undefined); } | undefined) {
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

type FileChooser = {
  element: dom.ElementHandle,
  multiple: boolean
};
