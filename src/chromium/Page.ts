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
import { assert, debugError, helper } from '../helper';
import { ClickOptions, MultiClickOptions, PointerActionOptions, SelectOption, mediaTypes, mediaColorSchemes } from '../input';
import { TimeoutSettings } from '../TimeoutSettings';
import { Browser } from './Browser';
import { BrowserContext } from './BrowserContext';
import { CDPSession, CDPSessionEvents } from './Connection';
import { EmulationManager } from './EmulationManager';
import { Events } from './events';
import { Accessibility } from './features/accessibility';
import { Coverage } from './features/coverage';
import { Overrides } from './features/overrides';
import { Interception } from './features/interception';
import { PDF } from './features/pdf';
import { Workers } from './features/workers';
import { FrameManager, FrameManagerEvents } from './FrameManager';
import { RawMouseImpl, RawKeyboardImpl } from './Input';
import { NetworkManagerEvents } from './NetworkManager';
import { Protocol } from './protocol';
import { getExceptionMessage, releaseObject } from './protocolHelper';
import { Target } from './Target';
import * as input from '../input';
import * as types from '../types';
import * as frames from '../frames';
import * as js from '../javascript';
import * as dom from '../dom';
import * as network from '../network';
import * as dialog from '../dialog';
import * as console from '../console';
import { DOMWorldDelegate } from './JSHandle';
import { Screenshotter, ScreenshotOptions } from './Screenshotter';

export type Viewport = {
  width: number;
  height: number;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  isLandscape?: boolean;
  hasTouch?: boolean;
}

export class Page extends EventEmitter {
  private _closed = false;
  _client: CDPSession;
  private _target: Target;
  private _keyboard: input.Keyboard;
  private _mouse: input.Mouse;
  private _timeoutSettings: TimeoutSettings;
  private _frameManager: FrameManager;
  private _emulationManager: EmulationManager;
  readonly accessibility: Accessibility;
  readonly coverage: Coverage;
  readonly overrides: Overrides;
  readonly interception: Interception;
  readonly pdf: PDF;
  readonly workers: Workers;
  private _pageBindings = new Map<string, Function>();
  _javascriptEnabled = true;
  private _viewport: Viewport | null = null;
  _screenshotter: Screenshotter;
  private _fileChooserInterceptors = new Set<(chooser: FileChooser) => void>();
  private _disconnectPromise: Promise<Error> | undefined;
  private _emulatedMediaType: string | undefined;

  static async create(client: CDPSession, target: Target, ignoreHTTPSErrors: boolean, defaultViewport: Viewport | null, screenshotter: Screenshotter): Promise<Page> {
    const page = new Page(client, target, ignoreHTTPSErrors, screenshotter);
    await page._initialize();
    if (defaultViewport)
      await page.setViewport(defaultViewport);
    return page;
  }

  constructor(client: CDPSession, target: Target, ignoreHTTPSErrors: boolean, screenshotter: Screenshotter) {
    super();
    this._client = client;
    this._target = target;
    this._keyboard = new input.Keyboard(new RawKeyboardImpl(client));
    this._mouse = new input.Mouse(new RawMouseImpl(client), this._keyboard);
    this._timeoutSettings = new TimeoutSettings();
    this.accessibility = new Accessibility(client);
    this._frameManager = new FrameManager(client, this, ignoreHTTPSErrors, this._timeoutSettings);
    this._emulationManager = new EmulationManager(client);
    this.coverage = new Coverage(client);
    this.pdf = new PDF(client);
    this.workers = new Workers(client, this._addConsoleMessage.bind(this), this._handleException.bind(this));
    this.overrides = new Overrides(client);
    this.interception = new Interception(this._frameManager.networkManager());

    this._screenshotter = screenshotter;

    client.on('Target.attachedToTarget', event => {
      if (event.targetInfo.type !== 'worker') {
        // If we don't detach from service workers, they will never die.
        client.send('Target.detachFromTarget', {
          sessionId: event.sessionId
        }).catch(debugError);
        return;
      }
    });

    this._frameManager.on(FrameManagerEvents.FrameAttached, event => this.emit(Events.Page.FrameAttached, event));
    this._frameManager.on(FrameManagerEvents.FrameDetached, event => this.emit(Events.Page.FrameDetached, event));
    this._frameManager.on(FrameManagerEvents.FrameNavigated, event => this.emit(Events.Page.FrameNavigated, event));

    const networkManager = this._frameManager.networkManager();
    networkManager.on(NetworkManagerEvents.Request, event => this.emit(Events.Page.Request, event));
    networkManager.on(NetworkManagerEvents.Response, event => this.emit(Events.Page.Response, event));
    networkManager.on(NetworkManagerEvents.RequestFailed, event => this.emit(Events.Page.RequestFailed, event));
    networkManager.on(NetworkManagerEvents.RequestFinished, event => this.emit(Events.Page.RequestFinished, event));

    client.on('Page.domContentEventFired', event => this.emit(Events.Page.DOMContentLoaded));
    client.on('Page.loadEventFired', event => this.emit(Events.Page.Load));
    client.on('Runtime.consoleAPICalled', event => this._onConsoleAPI(event));
    client.on('Runtime.bindingCalled', event => this._onBindingCalled(event));
    client.on('Page.javascriptDialogOpening', event => this._onDialog(event));
    client.on('Runtime.exceptionThrown', exception => this._handleException(exception.exceptionDetails));
    client.on('Inspector.targetCrashed', event => this._onTargetCrashed());
    client.on('Log.entryAdded', event => this._onLogEntryAdded(event));
    client.on('Page.fileChooserOpened', event => this._onFileChooserOpened(event));
    this._target._isClosedPromise.then(() => {
      this.emit(Events.Page.Close);
      this._closed = true;
    });
  }

  async _initialize() {
    await Promise.all([
      this._frameManager.initialize(),
      this._client.send('Target.setAutoAttach', {autoAttach: true, waitForDebuggerOnStart: false, flatten: true}),
      this._client.send('Performance.enable', {}),
      this._client.send('Log.enable', {}),
      this._client.send('Page.setInterceptFileChooserDialog', {enabled: true})
    ]);
  }

  async _onFileChooserOpened(event: Protocol.Page.fileChooserOpenedPayload) {
    if (!this._fileChooserInterceptors.size)
      return;
    const frame = this._frameManager.frame(event.frameId);
    const utilityWorld = await frame._utilityDOMWorld();
    const handle = await (utilityWorld.delegate as DOMWorldDelegate).adoptBackendNodeId(event.backendNodeId, utilityWorld);
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

  target(): Target {
    return this._target;
  }

  browser(): Browser {
    return this._target.browser();
  }

  browserContext(): BrowserContext {
    return this._target.browserContext();
  }

  _onTargetCrashed() {
    this.emit('error', new Error('Page crashed!'));
  }

  _onLogEntryAdded(event: Protocol.Log.entryAddedPayload) {
    const {level, text, args, source, url, lineNumber} = event.entry;
    if (args)
      args.map(arg => releaseObject(this._client, arg));
    if (source !== 'worker')
      this.emit(Events.Page.Console, new console.ConsoleMessage(level, text, [], {url, lineNumber}));
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

  async exposeFunction(name: string, playwrightFunction: Function) {
    if (this._pageBindings.has(name))
      throw new Error(`Failed to add page binding with name ${name}: window['${name}'] already exists!`);
    this._pageBindings.set(name, playwrightFunction);

    const expression = helper.evaluationString(addPageBinding, name);
    await this._client.send('Runtime.addBinding', {name: name});
    await this._client.send('Page.addScriptToEvaluateOnNewDocument', {source: expression});
    await Promise.all(this.frames().map(frame => frame.evaluate(expression).catch(debugError)));

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

  _handleException(exceptionDetails: Protocol.Runtime.ExceptionDetails) {
    const message = getExceptionMessage(exceptionDetails);
    const err = new Error(message);
    err.stack = ''; // Don't report clientside error with a node stack attached
    this.emit(Events.Page.PageError, err);
  }

  async _onConsoleAPI(event: Protocol.Runtime.consoleAPICalledPayload) {
    if (event.executionContextId === 0) {
      // DevTools protocol stores the last 1000 console messages. These
      // messages are always reported even for removed execution contexts. In
      // this case, they are marked with executionContextId = 0 and are
      // reported upon enabling Runtime agent.
      //
      // Ignore these messages since:
      // - there's no execution context we can use to operate with message
      //   arguments
      // - these messages are reported before Playwright clients can subscribe
      //   to the 'console'
      //   page event.
      //
      // @see https://github.com/GoogleChrome/puppeteer/issues/3865
      return;
    }
    const context = this._frameManager.executionContextById(event.executionContextId);
    const values = event.args.map(arg => context._createHandle(arg));
    this._addConsoleMessage(event.type, values, event.stackTrace);
  }

  async _onBindingCalled(event: Protocol.Runtime.bindingCalledPayload) {
    const {name, seq, args} = JSON.parse(event.payload);
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
    this._client.send('Runtime.evaluate', { expression, contextId: event.executionContextId }).catch(debugError);

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

  _addConsoleMessage(type: string, args: js.JSHandle[], stackTrace: Protocol.Runtime.StackTrace | undefined) {
    if (!this.listenerCount(Events.Page.Console)) {
      args.forEach(arg => arg.dispose());
      return;
    }
    const location = stackTrace && stackTrace.callFrames.length ? {
      url: stackTrace.callFrames[0].url,
      lineNumber: stackTrace.callFrames[0].lineNumber,
      columnNumber: stackTrace.callFrames[0].columnNumber,
    } : {};
    this.emit(Events.Page.Console, new console.ConsoleMessage(type, undefined, args, location));
  }

  _onDialog(event : Protocol.Page.javascriptDialogOpeningPayload) {
    this.emit(Events.Page.Dialog, new dialog.Dialog(
      event.type as dialog.DialogType,
      event.message,
      async (accept: boolean, promptText?: string) => {
        await this._client.send('Page.handleJavaScriptDialog', { accept, promptText });
      },
      event.defaultPrompt));
  }

  url(): string {
    return this.mainFrame().url();
  }

  async content(): Promise<string> {
    return await this._frameManager.mainFrame().content();
  }

  async setContent(html: string, options: { timeout?: number; waitUntil?: string | string[]; } | undefined) {
    await this._frameManager.mainFrame().setContent(html, options);
  }

  async goto(url: string, options: { referer?: string; timeout?: number; waitUntil?: string | string[]; } | undefined): Promise<network.Response | null> {
    return await this._frameManager.mainFrame().goto(url, options);
  }

  async reload(options: { timeout?: number; waitUntil?: string | string[]; } = {}): Promise<network.Response | null> {
    const [response] = await Promise.all([
      this.waitForNavigation(options),
      this._client.send('Page.reload')
    ]);
    return response;
  }

  async waitForNavigation(options: { timeout?: number; waitUntil?: string | string[]; } = {}): Promise<network.Response | null> {
    return await this._frameManager.mainFrame().waitForNavigation(options);
  }

  _sessionClosePromise() {
    if (!this._disconnectPromise)
      this._disconnectPromise = new Promise(fulfill => this._client.once(CDPSessionEvents.Disconnected, () => fulfill(new Error('Target closed'))));
    return this._disconnectPromise;
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
    }, timeout, this._sessionClosePromise());
  }

  async waitForResponse(urlOrPredicate: (string | Function), options: { timeout?: number; } = {}): Promise<network.Response> {
    const {
      timeout = this._timeoutSettings.timeout(),
    } = options;
    return helper.waitForEvent(this._frameManager.networkManager(), NetworkManagerEvents.Response, response => {
      if (helper.isString(urlOrPredicate))
        return (urlOrPredicate === response.url());
      if (typeof urlOrPredicate === 'function')
        return !!(urlOrPredicate(response));
      return false;
    }, timeout, this._sessionClosePromise());
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

  async emulate(options: { viewport: Viewport; userAgent: string; }) {
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

  async setViewport(viewport: Viewport) {
    const needsReload = await this._emulationManager.emulateViewport(viewport);
    this._viewport = viewport;
    if (needsReload)
      await this.reload();
  }

  viewport(): Viewport | null {
    return this._viewport;
  }

  evaluate: types.Evaluate = (pageFunction, ...args) => {
    return this._frameManager.mainFrame().evaluate(pageFunction, ...args as any);
  }

  async evaluateOnNewDocument(pageFunction: Function | string, ...args: any[]) {
    const source = helper.evaluationString(pageFunction, ...args);
    await this._client.send('Page.addScriptToEvaluateOnNewDocument', { source });
  }

  async setCacheEnabled(enabled: boolean = true) {
    await this._frameManager.networkManager().setCacheEnabled(enabled);
  }

  screenshot(options: ScreenshotOptions = {}): Promise<Buffer | string> {
    return this._screenshotter.screenshotPage(this, options);
  }

  async title(): Promise<string> {
    return this.mainFrame().title();
  }

  async close(options: { runBeforeUnload: (boolean | undefined); } = {runBeforeUnload: undefined}) {
    assert(!!this._client._connection, 'Protocol error: Connection closed. Most likely the page has been closed.');
    const runBeforeUnload = !!options.runBeforeUnload;
    if (runBeforeUnload) {
      await this._client.send('Page.close');
    } else {
      await this.browser()._closeTarget(this._target);
      await this._target._isClosedPromise;
    }
  }

  isClosed(): boolean {
    return this._closed;
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

type MediaFeature = {
  name: string,
  value: string
}

type FileChooser = {
  element: dom.ElementHandle,
  multiple: boolean
};
