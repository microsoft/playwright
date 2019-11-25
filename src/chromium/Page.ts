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
import * as fs from 'fs';
import * as mime from 'mime';
import * as path from 'path';
import { assert, debugError, helper } from '../helper';
import { ClickOptions, MultiClickOptions, PointerActionOptions, SelectOption, mediaTypes, mediaColorSchemes } from '../input';
import { TimeoutSettings } from '../TimeoutSettings';
import { Browser } from './Browser';
import { BrowserContext } from './BrowserContext';
import { CDPSession, CDPSessionEvents } from './Connection';
import { Dialog, DialogType } from './Dialog';
import { EmulationManager } from './EmulationManager';
import { Events } from './events';
import { Accessibility } from './features/accessibility';
import { Coverage } from './features/coverage';
import { Geolocation } from './features/geolocation';
import { Interception } from './features/interception';
import { PDF } from './features/pdf';
import { Workers } from './features/workers';
import { Frame } from './Frame';
import { FrameManager, FrameManagerEvents } from './FrameManager';
import { Mouse, RawKeyboardImpl } from './Input';
import { createJSHandle, ElementHandle, JSHandle } from './JSHandle';
import { NetworkManagerEvents, Response } from './NetworkManager';
import { Protocol } from './protocol';
import { getExceptionMessage, releaseObject, valueFromRemoteObject } from './protocolHelper';
import { Target } from './Target';
import { TaskQueue } from './TaskQueue';
import * as input from '../input';

const writeFileAsync = helper.promisify(fs.writeFile);

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
  private _mouse: Mouse;
  private _timeoutSettings: TimeoutSettings;
  private _frameManager: FrameManager;
  private _emulationManager: EmulationManager;
  readonly accessibility: Accessibility;
  readonly coverage: Coverage;
  readonly geolocation: Geolocation;
  readonly interception: Interception;
  readonly pdf: PDF;
  readonly workers: Workers;
  private _pageBindings = new Map<string, Function>();
  _javascriptEnabled = true;
  private _viewport: Viewport | null = null;
  private _screenshotTaskQueue: TaskQueue;
  private _fileChooserInterceptionIsDisabled = false;
  private _fileChooserInterceptors = new Set<(chooser: FileChooser) => void>();
  private _disconnectPromise: Promise<Error> | undefined;
  private _emulatedMediaType: string | undefined;

  static async create(client: CDPSession, target: Target, ignoreHTTPSErrors: boolean, defaultViewport: Viewport | null, screenshotTaskQueue: TaskQueue): Promise<Page> {
    const page = new Page(client, target, ignoreHTTPSErrors, screenshotTaskQueue);
    await page._initialize();
    if (defaultViewport)
      await page.setViewport(defaultViewport);
    return page;
  }

  constructor(client: CDPSession, target: Target, ignoreHTTPSErrors: boolean, screenshotTaskQueue: TaskQueue) {
    super();
    this._client = client;
    this._target = target;
    this._keyboard = new input.Keyboard(new RawKeyboardImpl(client));
    this._mouse = new Mouse(client, this._keyboard);
    this._timeoutSettings = new TimeoutSettings();
    this.accessibility = new Accessibility(client);
    this._frameManager = new FrameManager(client, this, ignoreHTTPSErrors, this._timeoutSettings);
    this._emulationManager = new EmulationManager(client);
    this.coverage = new Coverage(client);
    this.pdf = new PDF(client);
    this.workers = new Workers(client, this._addConsoleMessage.bind(this), this._handleException.bind(this));
    this.geolocation = new Geolocation(client);
    this.interception = new Interception(this._frameManager.networkManager());

    this._screenshotTaskQueue = screenshotTaskQueue;

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
    client.on('Page.fileChooserOpened', event => this._onFileChooser(event));
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
      this._client.send('Page.setInterceptFileChooserDialog', {enabled: true}).catch(e => {
        this._fileChooserInterceptionIsDisabled = true;
      }),
    ]);
  }

  _onFileChooser(event: Protocol.Page.fileChooserOpenedPayload) {
    if (!this._fileChooserInterceptors.size) {
      this._client.send('Page.handleFileChooser', { action: 'fallback' }).catch(debugError);
      return;
    }
    const interceptors = Array.from(this._fileChooserInterceptors);
    this._fileChooserInterceptors.clear();
    const fileChooser = new FileChooser(this._client, event);
    for (const interceptor of interceptors)
      interceptor.call(null, fileChooser);
  }

  async waitForFileChooser(options: { timeout?: number; } = {}): Promise<FileChooser> {
    if (this._fileChooserInterceptionIsDisabled)
      throw new Error('File chooser handling does not work with multiple connections to the same page');
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
      this.emit(Events.Page.Console, new ConsoleMessage(level, text, [], {url, lineNumber}));
  }

  mainFrame(): Frame {
    return this._frameManager.mainFrame();
  }

  get keyboard(): input.Keyboard {
    return this._keyboard;
  }

  frames(): Frame[] {
    return this._frameManager.frames();
  }

  setOfflineMode(enabled: boolean) {
    return this._frameManager.networkManager().setOfflineMode(enabled);
  }

  setDefaultNavigationTimeout(timeout: number) {
    this._timeoutSettings.setDefaultNavigationTimeout(timeout);
  }

  setDefaultTimeout(timeout: number) {
    this._timeoutSettings.setDefaultTimeout(timeout);
  }

  async $(selector: string): Promise<ElementHandle | null> {
    return this.mainFrame().$(selector);
  }

  async evaluateHandle(pageFunction: Function | string, ...args: any[]): Promise<JSHandle> {
    const context = await this.mainFrame().executionContext();
    return context.evaluateHandle(pageFunction, ...args);
  }

  async $eval(selector: string, pageFunction: Function | string, ...args: any[]): Promise<(object | undefined)> {
    return this.mainFrame().$eval(selector, pageFunction, ...args);
  }

  async $$eval(selector: string, pageFunction: Function | string, ...args: any[]): Promise<(object | undefined)> {
    return this.mainFrame().$$eval(selector, pageFunction, ...args);
  }

  async $$(selector: string): Promise<ElementHandle[]> {
    return this.mainFrame().$$(selector);
  }

  async $x(expression: string): Promise<ElementHandle[]> {
    return this.mainFrame().$x(expression);
  }

  async cookies(...urls: string[]): Promise<NetworkCookie[]> {
    const {cookies} = await this._client.send('Network.getCookies', {
      urls: urls.length ? urls : [this.url()]
    });
    // Chromiums's cookies are missing sameSite when it is 'None'
    return cookies.map(cookie => ({sameSite: 'None', ...cookie}));
  }

  async deleteCookie(...cookies: Protocol.Network.deleteCookiesParameters[]) {
    const pageURL = this.url();
    for (const cookie of cookies) {
      const item = Object.assign({}, cookie);
      if (!cookie.url && pageURL.startsWith('http'))
        item.url = pageURL;
      await this._client.send('Network.deleteCookies', item);
    }
  }

  async setCookie(...cookies: NetworkCookieParam[]) {
    const pageURL = this.url();
    const startsWithHTTP = pageURL.startsWith('http');
    const items = cookies.map(cookie => {
      const item = Object.assign({}, cookie);
      if (!item.url && startsWithHTTP)
        item.url = pageURL;
      assert(item.url !== 'about:blank', `Blank page can not have cookie "${item.name}"`);
      assert(!String.prototype.startsWith.call(item.url || '', 'data:'), `Data URL page can not have cookie "${item.name}"`);
      return item;
    });
    await this.deleteCookie(...items);
    if (items.length)
      await this._client.send('Network.setCookies', { cookies: items });
  }

  async addScriptTag(options: { url?: string; path?: string; content?: string; type?: string; }): Promise<ElementHandle> {
    return this.mainFrame().addScriptTag(options);
  }

  async addStyleTag(options: { url?: string; path?: string; content?: string; }): Promise<ElementHandle> {
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

  async authenticate(credentials: { username: string; password: string; } | null) {
    return this._frameManager.networkManager().authenticate(credentials);
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
    const values = event.args.map(arg => createJSHandle(context, arg));
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

  _addConsoleMessage(type: string, args: JSHandle[], stackTrace: Protocol.Runtime.StackTrace | undefined) {
    if (!this.listenerCount(Events.Page.Console)) {
      args.forEach(arg => arg.dispose());
      return;
    }
    const textTokens = [];
    for (const arg of args) {
      const remoteObject = arg._remoteObject;
      if (remoteObject.objectId)
        textTokens.push(arg.toString());
      else
        textTokens.push(valueFromRemoteObject(remoteObject));
    }
    const location = stackTrace && stackTrace.callFrames.length ? {
      url: stackTrace.callFrames[0].url,
      lineNumber: stackTrace.callFrames[0].lineNumber,
      columnNumber: stackTrace.callFrames[0].columnNumber,
    } : {};
    const message = new ConsoleMessage(type, textTokens.join(' '), args, location);
    this.emit(Events.Page.Console, message);
  }

  _onDialog(event) {
    let dialogType = null;
    if (event.type === 'alert')
      dialogType = DialogType.Alert;
    else if (event.type === 'confirm')
      dialogType = DialogType.Confirm;
    else if (event.type === 'prompt')
      dialogType = DialogType.Prompt;
    else if (event.type === 'beforeunload')
      dialogType = DialogType.BeforeUnload;
    assert(dialogType, 'Unknown javascript dialog type: ' + event.type);
    const dialog = new Dialog(this._client, dialogType, event.message, event.defaultPrompt);
    this.emit(Events.Page.Dialog, dialog);
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

  async goto(url: string, options: { referer?: string; timeout?: number; waitUntil?: string | string[]; } | undefined): Promise<Response | null> {
    return await this._frameManager.mainFrame().goto(url, options);
  }

  async reload(options: { timeout?: number; waitUntil?: string | string[]; } = {}): Promise<Response | null> {
    const [response] = await Promise.all([
      this.waitForNavigation(options),
      this._client.send('Page.reload')
    ]);
    return response;
  }

  async waitForNavigation(options: { timeout?: number; waitUntil?: string | string[]; } = {}): Promise<Response | null> {
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
    }, timeout, this._sessionClosePromise());
  }

  async goBack(options: { timeout?: number; waitUntil?: string | string[]; } | undefined): Promise<Response | null> {
    return this._go(-1, options);
  }

  async goForward(options: { timeout?: number; waitUntil?: string | string[]; } | undefined): Promise<Response | null> {
    return this._go(+1, options);
  }

  async _go(delta, options: { timeout?: number; waitUntil?: string | string[]; } | undefined): Promise<Response | null> {
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

  async bringToFront() {
    await this._client.send('Page.bringToFront');
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

  async emulateTimezone(timezoneId: string | null) {
    try {
      await this._client.send('Emulation.setTimezoneOverride', {timezoneId: timezoneId || ''});
    } catch (exception) {
      if (exception.message.includes('Invalid timezone'))
        throw new Error(`Invalid timezone ID: ${timezoneId}`);
      throw exception;
    }
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

  async evaluate(pageFunction: Function | string, ...args: any[]): Promise<any> {
    return this._frameManager.mainFrame().evaluate(pageFunction, ...args);
  }

  async evaluateOnNewDocument(pageFunction: Function | string, ...args: any[]) {
    const source = helper.evaluationString(pageFunction, ...args);
    await this._client.send('Page.addScriptToEvaluateOnNewDocument', { source });
  }

  async setCacheEnabled(enabled: boolean = true) {
    await this._frameManager.networkManager().setCacheEnabled(enabled);
  }

  async screenshot(options: ScreenshotOptions = {}): Promise<Buffer | string> {
    let screenshotType = null;
    // options.type takes precedence over inferring the type from options.path
    // because it may be a 0-length file with no extension created beforehand (i.e. as a temp file).
    if (options.type) {
      assert(options.type === 'png' || options.type === 'jpeg', 'Unknown options.type value: ' + options.type);
      screenshotType = options.type;
    } else if (options.path) {
      const mimeType = mime.getType(options.path);
      if (mimeType === 'image/png')
        screenshotType = 'png';
      else if (mimeType === 'image/jpeg')
        screenshotType = 'jpeg';
      assert(screenshotType, 'Unsupported screenshot mime type: ' + mimeType);
    }

    if (!screenshotType)
      screenshotType = 'png';

    if (options.quality) {
      assert(screenshotType === 'jpeg', 'options.quality is unsupported for the ' + screenshotType + ' screenshots');
      assert(typeof options.quality === 'number', 'Expected options.quality to be a number but found ' + (typeof options.quality));
      assert(Number.isInteger(options.quality), 'Expected options.quality to be an integer');
      assert(options.quality >= 0 && options.quality <= 100, 'Expected options.quality to be between 0 and 100 (inclusive), got ' + options.quality);
    }
    assert(!options.clip || !options.fullPage, 'options.clip and options.fullPage are exclusive');
    if (options.clip) {
      assert(typeof options.clip.x === 'number', 'Expected options.clip.x to be a number but found ' + (typeof options.clip.x));
      assert(typeof options.clip.y === 'number', 'Expected options.clip.y to be a number but found ' + (typeof options.clip.y));
      assert(typeof options.clip.width === 'number', 'Expected options.clip.width to be a number but found ' + (typeof options.clip.width));
      assert(typeof options.clip.height === 'number', 'Expected options.clip.height to be a number but found ' + (typeof options.clip.height));
      assert(options.clip.width !== 0, 'Expected options.clip.width not to be 0.');
      assert(options.clip.height !== 0, 'Expected options.clip.height not to be 0.');
    }
    return this._screenshotTaskQueue.postTask(this._screenshotTask.bind(this, screenshotType, options));
  }

  async _screenshotTask(format: 'png' | 'jpeg', options?: ScreenshotOptions): Promise<Buffer | string> {
    await this._client.send('Target.activateTarget', {targetId: this._target._targetId});
    let clip = options.clip ? processClip(options.clip) : undefined;

    if (options.fullPage) {
      const metrics = await this._client.send('Page.getLayoutMetrics');
      const width = Math.ceil(metrics.contentSize.width);
      const height = Math.ceil(metrics.contentSize.height);

      // Overwrite clip for full page at all times.
      clip = { x: 0, y: 0, width, height, scale: 1 };
      const {
        isMobile = false,
        deviceScaleFactor = 1,
        isLandscape = false
      } = this._viewport || {};
      const screenOrientation: Protocol.Emulation.ScreenOrientation = isLandscape ? { angle: 90, type: 'landscapePrimary' } : { angle: 0, type: 'portraitPrimary' };
      await this._client.send('Emulation.setDeviceMetricsOverride', { mobile: isMobile, width, height, deviceScaleFactor, screenOrientation });
    }
    const shouldSetDefaultBackground = options.omitBackground && format === 'png';
    if (shouldSetDefaultBackground)
      await this._client.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    const result = await this._client.send('Page.captureScreenshot', { format, quality: options.quality, clip });
    if (shouldSetDefaultBackground)
      await this._client.send('Emulation.setDefaultBackgroundColorOverride');

    if (options.fullPage && this._viewport)
      await this.setViewport(this._viewport);

    const buffer = options.encoding === 'base64' ? result.data : Buffer.from(result.data, 'base64');
    if (options.path)
      await writeFileAsync(options.path, buffer);
    return buffer;

    function processClip(clip) {
      const x = Math.round(clip.x);
      const y = Math.round(clip.y);
      const width = Math.round(clip.width + clip.x - x);
      const height = Math.round(clip.height + clip.y - y);
      return {x, y, width, height, scale: 1};
    }
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

  get mouse(): Mouse {
    return this._mouse;
  }

  click(selector: string, options?: ClickOptions) {
    return this.mainFrame().click(selector, options);
  }

  dblclick(selector: string, options?: MultiClickOptions) {
    return this.mainFrame().dblclick(selector, options);
  }

  tripleclick(selector: string, options?: MultiClickOptions) {
    return this.mainFrame().tripleclick(selector, options);
  }

  fill(selector: string, value: string) {
    return this.mainFrame().fill(selector, value);
  }

  focus(selector: string) {
    return this.mainFrame().focus(selector);
  }

  hover(selector: string, options?: PointerActionOptions) {
    return this.mainFrame().hover(selector, options);
  }

  select(selector: string, ...values: (string | ElementHandle | SelectOption)[]): Promise<string[]> {
    return this.mainFrame().select(selector, ...values);
  }

  type(selector: string, text: string, options: { delay: (number | undefined); } | undefined) {
    return this.mainFrame().type(selector, text, options);
  }

  waitFor(selectorOrFunctionOrTimeout: (string | number | Function), options: { visible?: boolean; hidden?: boolean; timeout?: number; polling?: string | number; } = {}, ...args: any[]): Promise<JSHandle> {
    return this.mainFrame().waitFor(selectorOrFunctionOrTimeout, options, ...args);
  }

  waitForSelector(selector: string, options: { visible?: boolean; hidden?: boolean; timeout?: number; } = {}): Promise<ElementHandle | null> {
    return this.mainFrame().waitForSelector(selector, options);
  }

  waitForXPath(xpath: string, options: { visible?: boolean; hidden?: boolean; timeout?: number; } = {}): Promise<ElementHandle | null> {
    return this.mainFrame().waitForXPath(xpath, options);
  }

  waitForFunction(pageFunction: Function, options: {
      polling?: string | number;
      timeout?: number; } = {},
  ...args: any[]): Promise<JSHandle> {
    return this.mainFrame().waitForFunction(pageFunction, options, ...args);
  }
}

type ScreenshotOptions = {
  type?: string,
  path?: string,
  fullPage?: boolean,
  clip?: {x: number, y: number, width: number, height: number},
  quality?: number,
  omitBackground?: boolean,
  encoding?: string,
}

type MediaFeature = {
  name: string,
  value: string
}

type NetworkCookie = {
  name: string,
  value: string,
  domain: string,
  path: string,
  expires: number,
  size: number,
  httpOnly: boolean,
  secure: boolean,
  session: boolean,
  sameSite: 'Strict'|'Lax'|'Extended'|'None'
};

type NetworkCookieParam = {
  name: string,
  value: string,
  url?: string,
  domain?: string,
  path?: string,
  expires?: number,
  httpOnly?: boolean,
  secure?: boolean,
  sameSite?: 'Strict'|'Lax'
};

type ConsoleMessageLocation = {
  url?: string,
  lineNumber?: number,
  columnNumber?: number
};

export class ConsoleMessage {
  private _type: string;
  private _text: string;
  private _args: JSHandle[];
  private _location: any;

  constructor(type: string, text: string, args: JSHandle[], location: ConsoleMessageLocation = {}) {
    this._type = type;
    this._text = text;
    this._args = args;
    this._location = location;
  }

  type(): string {
    return this._type;
  }

  text(): string {
    return this._text;
  }

  args(): JSHandle[] {
    return this._args;
  }

  location(): object {
    return this._location;
  }
}

export class FileChooser {
  private _client: CDPSession;
  private _multiple: boolean;
  private _handled = false;

  constructor(client: CDPSession, event: Protocol.Page.fileChooserOpenedPayload) {
    this._client = client;
    this._multiple = event.mode !== 'selectSingle';
  }

  isMultiple(): boolean {
    return this._multiple;
  }

  async accept(filePaths: string[]): Promise<any> {
    assert(!this._handled, 'Cannot accept FileChooser which is already handled!');
    this._handled = true;
    const files = filePaths.map(filePath => path.resolve(filePath));
    await this._client.send('Page.handleFileChooser', {
      action: 'accept',
      files,
    });
  }

  async cancel(): Promise<any> {
    assert(!this._handled, 'Cannot cancel FileChooser which is already handled!');
    this._handled = true;
    await this._client.send('Page.handleFileChooser', {
      action: 'cancel',
    });
  }
}
