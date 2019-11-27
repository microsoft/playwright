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
import { assert, debugError, helper, RegisteredListener } from '../helper';
import { ClickOptions, mediaColorSchemes, mediaTypes, MultiClickOptions } from '../input';
import { TimeoutSettings } from '../TimeoutSettings';
import { Browser, BrowserContext } from './Browser';
import { TargetSession, TargetSessionEvents } from './Connection';
import { Events } from './events';
import { Frame, FrameManager, FrameManagerEvents } from './FrameManager';
import { RawKeyboardImpl, RawMouseImpl } from './Input';
import { createJSHandle, ElementHandle } from './JSHandle';
import { JSHandle, toRemoteObject } from './ExecutionContext';
import { NetworkManagerEvents, Response } from './NetworkManager';
import { Protocol } from './protocol';
import { valueFromRemoteObject } from './protocolHelper';
import { Target } from './Target';
import { TaskQueue } from './TaskQueue';
import * as input from '../input';
import * as types from '../types';
import { Dialog, DialogType } from './Dialog';

const writeFileAsync = helper.promisify(fs.writeFile);

export type Viewport = {
  width: number;
  height: number;
}

export class Page extends EventEmitter {
  private _closed = false;
  _session: TargetSession;
  private _target: Target;
  private _keyboard: input.Keyboard;
  private _mouse: input.Mouse;
  private _timeoutSettings: TimeoutSettings;
  private _frameManager: FrameManager;
  private _bootstrapScripts: string[] = [];
  _javascriptEnabled = true;
  private _viewport: Viewport | null = null;
  private _screenshotTaskQueue: TaskQueue;
  private _workers = new Map<string, Worker>();
  private _disconnectPromise: Promise<Error> | undefined;
  private _sessionListeners: RegisteredListener[] = [];
  private _emulatedMediaType: string | undefined;

  static async create(session: TargetSession, target: Target, defaultViewport: Viewport | null, screenshotTaskQueue: TaskQueue): Promise<Page> {
    const page = new Page(session, target, screenshotTaskQueue);
    await page._initialize();
    if (defaultViewport)
      await page.setViewport(defaultViewport);
    return page;
  }

  constructor(session: TargetSession, target: Target, screenshotTaskQueue: TaskQueue) {
    super();
    this._keyboard = new input.Keyboard(new RawKeyboardImpl(session));
    this._mouse = new input.Mouse(new RawMouseImpl(session), this._keyboard);
    this._timeoutSettings = new TimeoutSettings();
    this._frameManager = new FrameManager(session, this, this._timeoutSettings);

    this._screenshotTaskQueue = screenshotTaskQueue;

    this._setSession(session);
    this._setTarget(target);

    this._frameManager.on(FrameManagerEvents.FrameAttached, event => this.emit(Events.Page.FrameAttached, event));
    this._frameManager.on(FrameManagerEvents.FrameDetached, event => this.emit(Events.Page.FrameDetached, event));
    this._frameManager.on(FrameManagerEvents.FrameNavigated, event => this.emit(Events.Page.FrameNavigated, event));

    const networkManager = this._frameManager.networkManager();
    networkManager.on(NetworkManagerEvents.Request, event => this.emit(Events.Page.Request, event));
    networkManager.on(NetworkManagerEvents.Response, event => this.emit(Events.Page.Response, event));
    networkManager.on(NetworkManagerEvents.RequestFailed, event => this.emit(Events.Page.RequestFailed, event));
    networkManager.on(NetworkManagerEvents.RequestFinished, event => this.emit(Events.Page.RequestFinished, event));
  }

  async _initialize() {
    return Promise.all([
      this._frameManager.initialize(),
      this._session.send('Console.enable'),
      this._session.send('Dialog.enable'),
    ]);
  }

  _setSession(newSession: TargetSession) {
    helper.removeEventListeners(this._sessionListeners);
    this._session = newSession;
    this._sessionListeners = [
      helper.addEventListener(this._session, TargetSessionEvents.Disconnected, () => this._frameManager.disconnectFromTarget()),
      helper.addEventListener(this._session, 'Page.loadEventFired', event => this.emit(Events.Page.Load)),
      helper.addEventListener(this._session, 'Console.messageAdded', event => this._onConsoleMessage(event)),
      helper.addEventListener(this._session, 'Page.domContentEventFired', event => this.emit(Events.Page.DOMContentLoaded)),
      helper.addEventListener(this._session, 'Dialog.javascriptDialogOpening', event => this._onDialog(event))
    ];
  }

  _onDialog(event: Protocol.Dialog.javascriptDialogOpeningPayload) {
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
    const dialog = new Dialog(this._session, dialogType, event.message, event.defaultPrompt);
    this.emit(Events.Page.Dialog, dialog);
  }

  _setTarget(newTarget: Target) {
    this._target = newTarget;
    this._target._isClosedPromise.then(() => {
      if (this._target !== newTarget)
        return;
      this.emit(Events.Page.Close);
      this._closed = true;
    });
  }

  async _swapTargetOnNavigation(newSession : TargetSession, newTarget : Target) {
    this._setSession(newSession);
    this._setTarget(newTarget);
    await this._frameManager._swapTargetOnNavigation(newSession);
    await this._initialize().catch(e => debugError('failed to enable agents after swap: ' + e));
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

  async _onConsoleMessage(event: Protocol.Console.messageAddedPayload) {
    const { type, level, text, parameters, url, line: lineNumber, column: columnNumber } = event.message;
    let derivedType: string = type;
    if (type === 'log')
      derivedType = level;
    else if (type === 'timing')
      derivedType = 'timeEnd';
    const mainFrameContext = await this.mainFrame().executionContext();
    const handles = (parameters || []).map(p => {
      let context = null;
      if (p.objectId) {
        const objectId = JSON.parse(p.objectId);
        context = this._frameManager._contextIdToContext.get(objectId.injectedScriptId);
      } else {
        context = mainFrameContext;
      }
      return createJSHandle(context, p);
    });
    const textTokens = [];
    for (const handle of handles) {
      const remoteObject = toRemoteObject(handle);
      if (remoteObject.objectId)
        textTokens.push(handle.toString());
      else
        textTokens.push(valueFromRemoteObject(remoteObject));
    }
    const location = {url, lineNumber, columnNumber};
    const formattedText = textTokens.length ? textTokens.join(' ') : text;
    this.emit(Events.Page.Console, new ConsoleMessage(derivedType, formattedText, handles, location));
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

  workers(): Worker[] {
    return Array.from(this._workers.values());
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

  evaluateHandle: types.EvaluateHandle<JSHandle> = async (pageFunction, ...args) => {
    const context = await this.mainFrame().executionContext();
    return context.evaluateHandle(pageFunction, ...args as any);
  }

  $eval: types.$Eval<JSHandle> = (selector, pageFunction, ...args) => {
    return this.mainFrame().$eval(selector, pageFunction, ...args as any);
  }

  $$eval: types.$$Eval<JSHandle> = (selector, pageFunction, ...args) => {
    return this.mainFrame().$$eval(selector, pageFunction, ...args as any);
  }

  async $$(selector: string): Promise<ElementHandle[]> {
    return this.mainFrame().$$(selector);
  }

  async $x(expression: string): Promise<ElementHandle[]> {
    return this.mainFrame().$x(expression);
  }

  async addScriptTag(options: { url?: string; path?: string; content?: string; type?: string; }): Promise<ElementHandle> {
    return this.mainFrame().addScriptTag(options);
  }

  async addStyleTag(options: { url?: string; path?: string; content?: string; }): Promise<ElementHandle> {
    return this.mainFrame().addStyleTag(options);
  }

  async setExtraHTTPHeaders(headers: { [s: string]: string; }) {
    return this._frameManager.networkManager().setExtraHTTPHeaders(headers);
  }

  async setUserAgent(userAgent: string) {
    await this._session.send('Page.overrideUserAgent', { value: userAgent });
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

  async reload(): Promise<Response | null> {
    const [response] = await Promise.all([
      this.waitForNavigation(),
      this._session.send('Page.reload')
    ]);
    return response;
  }

  async waitForNavigation(): Promise<Response | null> {
    return await this._frameManager.mainFrame().waitForNavigation();
  }

  _sessionClosePromise() {
    if (!this._disconnectPromise)
      this._disconnectPromise = new Promise(fulfill => this._session.once(TargetSessionEvents.Disconnected, () => fulfill(new Error('Target closed'))));
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

  async emulate(options: { viewport: Viewport; userAgent: string; }) {
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
    const media = typeof options.type === 'undefined' ? this._emulatedMediaType : options.type;
    await this._session.send('Page.setEmulatedMedia', { media: media || '' });
    this._emulatedMediaType = options.type;
  }

  async setViewport(viewport: Viewport) {
    this._viewport = viewport;
    const width = viewport.width;
    const height = viewport.height;
    await this._session.send('Emulation.setDeviceMetricsOverride', { width, height });
  }

  viewport(): Viewport | null {
    return this._viewport;
  }

  evaluate: types.Evaluate<JSHandle> = (pageFunction, ...args) => {
    return this._frameManager.mainFrame().evaluate(pageFunction, ...args as any);
  }

  async evaluateOnNewDocument(pageFunction: Function | string, ...args: Array<any>) {
    const script = helper.evaluationString(pageFunction, ...args);
    this._bootstrapScripts.push(script);
    const source = this._bootstrapScripts.join(';');
    // TODO(yurys): support process swap on navigation.
    await this._session.send('Page.setBootstrapScript', { source });
  }

  async setCacheEnabled(enabled: boolean = true) {
    await this._frameManager.networkManager().setCacheEnabled(enabled);
  }

  async screenshot(options: ScreenshotOptions = {}): Promise<Buffer | string> {
    let screenshotType = null;
    // options.type takes precedence over inferring the type from options.path
    // because it may be a 0-length file with no extension created beforehand (i.e. as a temp file).
    if (options.type) {
      assert(options.type === 'png', 'Unknown options.type value: ' + options.type);
      screenshotType = options.type;
    } else if (options.path) {
      const mimeType = mime.getType(options.path);
      if (mimeType === 'image/png')
        screenshotType = 'png';
      assert(screenshotType, 'Unsupported screenshot mime type: ' + mimeType);
    }

    if (!screenshotType)
      screenshotType = 'png';

    if (options.quality)
      assert(screenshotType === 'jpeg', 'options.quality is unsupported for the ' + screenshotType + ' screenshots');
    assert(!options.clip || !options.fullPage, 'options.clip and options.fullPage are exclusive');
    if (options.clip) {
      assert(typeof options.clip.x === 'number', 'Expected options.clip.x to be a number but found ' + (typeof options.clip.x));
      assert(typeof options.clip.y === 'number', 'Expected options.clip.y to be a number but found ' + (typeof options.clip.y));
      assert(typeof options.clip.width === 'number', 'Expected options.clip.width to be a number but found ' + (typeof options.clip.width));
      assert(typeof options.clip.height === 'number', 'Expected options.clip.height to be a number but found ' + (typeof options.clip.height));
      assert(options.clip.width !== 0, 'Expected options.clip.width not to be 0.');
      assert(options.clip.height !== 0, 'Expected options.clip.height not to be 0.');
    }
    return this._screenshotTaskQueue.postTask(this._screenshotTask.bind(this, options));
  }

  async _screenshotTask(options?: ScreenshotOptions): Promise<Buffer | string> {
    const params: Protocol.Page.snapshotRectParameters = { x: 0, y: 0, width: 800, height: 600, coordinateSystem: 'Page' };
    if (options.fullPage) {
      const pageSize = await this.evaluate(() =>
        ({
          width: document.body.scrollWidth,
          height: document.body.scrollHeight
        }));
      Object.assign(params, pageSize);
    } else if (options.clip) {
      Object.assign(params, options.clip);
    } else if (this._viewport) {
      Object.assign(params, this._viewport);
    }
    const [, result] = await Promise.all([
      this._session._connection.send('Target.activate', { targetId: this._target._targetId }),
      this._session.send('Page.snapshotRect', params),
    ]).catch(e => {
      debugError('Failed to take screenshot: ' + e);
      throw e;
    });
    const prefix = 'data:image/png;base64,';
    const buffer = Buffer.from(result.dataURL.substr(prefix.length), 'base64');
    if (options.path)
      await writeFileAsync(options.path, buffer);
    return buffer;
  }

  async title(): Promise<string> {
    return this.mainFrame().title();
  }

  async close() {
    this.browser()._connection.send('Target.close', {
      targetId: this._target._targetId
    }).catch(e => {
      debugError(e);
    });
    await this._target._isClosedPromise;
  }

  isClosed(): boolean {
    return this._closed;
  }

  get mouse(): input.Mouse {
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

  hover(selector: string) {
    return this.mainFrame().hover(selector);
  }

  fill(selector: string, value: string) {
    return this.mainFrame().fill(selector, value);
  }

  focus(selector: string) {
    return this.mainFrame().focus(selector);
  }

  select(selector: string, ...values: string[]): Promise<string[]> {
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


type Metrics = {
  Timestamp?: number,
  Documents?: number,
  Frames?: number,
  JSEventListeners?: number,
  Nodes?: number,
  LayoutCount?: number,
  RecalcStyleCount?: number,
  LayoutDuration?: number,
  RecalcStyleDuration?: number,
  ScriptDuration?: number,
  TaskDuration?: number,
  JSHeapUsedSize?: number,
  JSHeapTotalSize?: number,
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

type MediaFeature = {
  name: string,
  value: string
}
