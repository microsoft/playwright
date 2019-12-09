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
import { assert, helper } from '../helper';
import * as input from '../input';
import { ClickOptions, mediaColorSchemes, mediaTypes, MultiClickOptions } from '../input';
import * as js from '../javascript';
import * as network from '../network';
import { Screenshotter } from '../screenshotter';
import { TimeoutSettings } from '../TimeoutSettings';
import * as types from '../types';
import { Browser, BrowserContext } from './Browser';
import { TargetSession } from './Connection';
import { Events } from './events';
import { FrameManager, FrameManagerEvents } from './FrameManager';
import { RawKeyboardImpl, RawMouseImpl } from './Input';
import { NetworkManagerEvents } from './NetworkManager';
import { Protocol } from './protocol';
import { WKScreenshotDelegate } from './Screenshotter';

export class Page extends EventEmitter {
  private _closed = false;
  private _closedCallback: () => void;
  private _closedPromise: Promise<void>;
  private _disconnected = false;
  private _disconnectedCallback: (e: Error) => void;
  private _disconnectedPromise: Promise<Error>;
  _session: TargetSession;
  private _browserContext: BrowserContext;
  private _keyboard: input.Keyboard;
  private _mouse: input.Mouse;
  private _timeoutSettings: TimeoutSettings;
  private _frameManager: FrameManager;
  private _bootstrapScripts: string[] = [];
  _javascriptEnabled = true;
  _userAgent: string | null = null;
  _emulatedMediaType: string | undefined;
  private _viewport: types.Viewport | null = null;
  _screenshotter: Screenshotter;
  private _fileChooserInterceptors = new Set<(chooser: FileChooser) => void>();

  constructor(browserContext: BrowserContext) {
    super();
    this._closedPromise = new Promise(f => this._closedCallback = f);
    this._disconnectedPromise = new Promise(f => this._disconnectedCallback = f);
    this._timeoutSettings = new TimeoutSettings();
    this._frameManager = new FrameManager(this, this._timeoutSettings);

    this._browserContext = browserContext;

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
    this._frameManager.disconnectFromTarget();
    this._disconnectedCallback(new Error('Target closed'));
  }

  _initialize(session: TargetSession) {
    this._session = session;
    this._keyboard = new input.Keyboard(new RawKeyboardImpl(session));
    this._mouse = new input.Mouse(new RawMouseImpl(session), this._keyboard);
    this._screenshotter = new Screenshotter(this, new WKScreenshotDelegate(session), this._browserContext.browser());
    return this._frameManager.initialize(session);
  }

  browser(): Browser {
    return this._browserContext.browser();
  }

  browserContext(): BrowserContext {
    return this._browserContext;
  }

  _onTargetCrashed() {
    this.emit('error', new Error('Page crashed!'));
  }

  _addConsoleMessage(type: string, args: js.JSHandle[], location: console.ConsoleMessageLocation, text?: string) {
    if (!this.listenerCount(Events.Page.Console)) {
      args.forEach(arg => arg.dispose());
      return;
    }
    this.emit(Events.Page.Console, new console.ConsoleMessage(type, text, args, location));
  }

  mainFrame(): frames.Frame {
    return this._frameManager.mainFrame();
  }

  get keyboard(): input.Keyboard {
    return this._keyboard;
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

  async $(selector: string | types.Selector): Promise<dom.ElementHandle | null> {
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

  async $$(selector: string | types.Selector): Promise<dom.ElementHandle[]> {
    return this.mainFrame().$$(selector);
  }

  async $x(expression: string): Promise<dom.ElementHandle[]> {
    return this.mainFrame().$x(expression);
  }

  async addScriptTag(options: { url?: string; path?: string; content?: string; type?: string; }): Promise<dom.ElementHandle> {
    return this.mainFrame().addScriptTag(options);
  }

  async addStyleTag(options: { url?: string; path?: string; content?: string; }): Promise<dom.ElementHandle> {
    return this.mainFrame().addStyleTag(options);
  }

  async setExtraHTTPHeaders(headers: { [s: string]: string; }) {
    return this._frameManager.networkManager().setExtraHTTPHeaders(headers);
  }

  async setUserAgent(userAgent: string) {
    this._userAgent = userAgent;
    this._frameManager.setUserAgent(userAgent);
  }

  url(): string {
    return this.mainFrame().url();
  }

  async content(): Promise<string> {
    return await this._frameManager.mainFrame().content();
  }

  async setContent(html: string, options: { timeout?: number; waitUntil?: string | string[]; } = {}) {
    await this._frameManager.mainFrame().setContent(html, options);
  }

  async goto(url: string, options: { referer?: string; timeout?: number; waitUntil?: string | string[]; } = {}): Promise<network.Response | null> {
    return await this._frameManager.mainFrame().goto(url, options);
  }

  async reload(): Promise<network.Response | null> {
    const [response] = await Promise.all([
      this.waitForNavigation(),
      this._session.send('Page.reload')
    ]);
    return response;
  }

  async goBack(): Promise<network.Response | null> {
    return await this._go('Page.goBack');
  }

  async goForward(): Promise<network.Response | null> {
    return await this._go('Page.goForward');
  }

  async _go<T extends keyof Protocol.CommandParameters>(command: T): Promise<network.Response | null> {
    const [response] = await Promise.all([
      this.waitForNavigation(),
      this._session.send(command).then(() => null),
    ]).catch(error => {
      if (error instanceof Error && error.message.includes(`Protocol error (${command}): Failed to go`))
        return [null];
      throw error;
    });
    return response;
  }

  async waitForNavigation(): Promise<network.Response | null> {
    return await this._frameManager.mainFrame().waitForNavigation();
  }

  async waitForRequest(urlOrPredicate: (string | Function), options: { timeout?: number; } = {}): Promise<Request> {
    const {
      timeout = this._timeoutSettings.timeout(),
    } = options;
    return helper.waitForEvent(this._frameManager.networkManager(), NetworkManagerEvents.Request, request => {
      if (helper.isString(urlOrPredicate))
        return (urlOrPredicate === request.url());
      if (typeof urlOrPredicate === 'function')
        return !!(urlOrPredicate(request));
      return false;
    }, timeout, this._disconnectedPromise);
  }

  async waitForResponse(urlOrPredicate: (string | Function), options: { timeout?: number; } = {}): Promise<Response> {
    const {
      timeout = this._timeoutSettings.timeout(),
    } = options;
    return helper.waitForEvent(this._frameManager.networkManager(), NetworkManagerEvents.Response, response => {
      if (helper.isString(urlOrPredicate))
        return (urlOrPredicate === response.url());
      if (typeof urlOrPredicate === 'function')
        return !!(urlOrPredicate(response));
      return false;
    }, timeout, this._disconnectedPromise);
  }

  async emulate(options: { viewport: types.Viewport; userAgent: string; }) {
    await Promise.all([
      this.setViewport(options.viewport),
      this.setUserAgent(options.userAgent)
    ]);
  }

  async emulateMedia(options: {
      type?: string | null,
      colorScheme?: 'dark' | 'light' | 'no-preference' | null }) {
    assert(!options.type || mediaTypes.has(options.type), 'Unsupported media type: ' + options.type);
    assert(!options.colorScheme || mediaColorSchemes.has(options.colorScheme), 'Unsupported color scheme: ' + options.colorScheme);
    assert(!options.colorScheme, 'Media feature emulation is not supported');
    this._emulatedMediaType = typeof options.type === 'undefined' ? this._emulatedMediaType : options.type;
    this._frameManager.setEmulatedMedia(this._emulatedMediaType);
  }

  async setViewport(viewport: types.Viewport) {
    this._viewport = viewport;
    const width = viewport.width;
    const height = viewport.height;
    await this._session.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: viewport.deviceScaleFactor || 1 });
  }

  viewport(): types.Viewport | null {
    return this._viewport;
  }

  evaluate: types.Evaluate = (pageFunction, ...args) => {
    return this._frameManager.mainFrame().evaluate(pageFunction, ...args as any);
  }

  async evaluateOnNewDocument(pageFunction: Function | string, ...args: Array<any>) {
    const script = helper.evaluationString(pageFunction, ...args);
    this._bootstrapScripts.push(script);
    const source = this._bootstrapScripts.join(';');
    // TODO(yurys): support process swap on navigation.
    await this._session.send('Page.setBootstrapScript', { source });
  }

  setJavaScriptEnabled(enabled: boolean) {
    if (this._javascriptEnabled === enabled)
      return;
    this._javascriptEnabled = enabled;
    return this._frameManager.setJavaScriptEnabled(enabled);
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

  async close() {
    assert(!this._disconnected, 'Protocol error: Connection closed. Most likely the page has been closed.');
    this.browser()._closePage(this);
    await this._closedPromise;
  }

  isClosed(): boolean {
    return this._closed;
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

  get mouse(): input.Mouse {
    return this._mouse;
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

  hover(selector: string | types.Selector) {
    return this.mainFrame().hover(selector);
  }

  fill(selector: string | types.Selector, value: string) {
    return this.mainFrame().fill(selector, value);
  }

  focus(selector: string | types.Selector) {
    return this.mainFrame().focus(selector);
  }

  select(selector: string | types.Selector, ...values: string[]): Promise<string[]> {
    return this.mainFrame().select(selector, ...values);
  }

  type(selector: string | types.Selector, text: string, options?: { delay: (number | undefined); }) {
    return this.mainFrame().type(selector, text, options);
  }

  waitFor(selectorOrFunctionOrTimeout: (string | number | Function), options?: { visible?: boolean; hidden?: boolean; timeout?: number; polling?: string | number; }, ...args: any[]): Promise<js.JSHandle> {
    return this.mainFrame().waitFor(selectorOrFunctionOrTimeout, options, ...args);
  }

  waitForSelector(selector: string | types.Selector, options?: types.TimeoutOptions): Promise<dom.ElementHandle | null> {
    return this.mainFrame().waitForSelector(selector, options);
  }

  waitForXPath(xpath: string, options?: types.TimeoutOptions): Promise<dom.ElementHandle | null> {
    return this.mainFrame().waitForXPath(xpath, options);
  }

  waitForFunction(pageFunction: Function | string, options?: types.WaitForFunctionOptions, ...args: any[]): Promise<js.JSHandle> {
    return this.mainFrame().waitForFunction(pageFunction, options, ...args);
  }
}

type FileChooser = {
  element: dom.ElementHandle,
  multiple: boolean
};
