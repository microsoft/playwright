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

import * as dom from './dom';
import * as frames from './frames';
import { assert, helper, debugLogger } from './helper';
import * as input from './input';
import * as js from './javascript';
import * as network from './network';
import { Screenshotter } from './screenshotter';
import { TimeoutSettings } from './timeoutSettings';
import * as types from './types';
import { Events } from './events';
import { BrowserContext, BrowserContextBase } from './browserContext';
import { ConsoleMessage } from './console';
import * as accessibility from './accessibility';
import { EventEmitter } from 'events';
import { FileChooser } from './fileChooser';
import { Progress, runAbortableTask } from './progress';

export interface PageDelegate {
  readonly rawMouse: input.RawMouse;
  readonly rawKeyboard: input.RawKeyboard;

  opener(): Promise<Page | null>;

  reload(): Promise<void>;
  goBack(): Promise<boolean>;
  goForward(): Promise<boolean>;
  exposeBinding(binding: PageBinding): Promise<void>;
  evaluateOnNewDocument(source: string): Promise<void>;
  closePage(runBeforeUnload: boolean): Promise<void>;

  navigateFrame(frame: frames.Frame, url: string, referrer: string | undefined): Promise<frames.GotoResult>;

  updateExtraHTTPHeaders(): Promise<void>;
  setViewportSize(viewportSize: types.Size): Promise<void>;
  updateEmulateMedia(): Promise<void>;
  updateRequestInterception(): Promise<void>;
  setFileChooserIntercepted(enabled: boolean): Promise<void>;
  bringToFront(): Promise<void>;

  canScreenshotOutsideViewport(): boolean;
  resetViewport(): Promise<void>; // Only called if canScreenshotOutsideViewport() returns false.
  setBackgroundColor(color?: { r: number; g: number; b: number; a: number; }): Promise<void>;
  startVideoRecording(options: types.VideoRecordingOptions): Promise<void>;
  stopVideoRecording(): Promise<void>;
  takeScreenshot(format: string, documentRect: types.Rect | undefined, viewportRect: types.Rect | undefined, quality: number | undefined): Promise<Buffer>;

  isElementHandle(remoteObject: any): boolean;
  adoptElementHandle<T extends Node>(handle: dom.ElementHandle<T>, to: dom.FrameExecutionContext): Promise<dom.ElementHandle<T>>;
  getContentFrame(handle: dom.ElementHandle): Promise<frames.Frame | null>;  // Only called for frame owner elements.
  getOwnerFrame(handle: dom.ElementHandle): Promise<string | null>; // Returns frameId.
  getContentQuads(handle: dom.ElementHandle): Promise<types.Quad[] | null>;
  setInputFiles(handle: dom.ElementHandle<HTMLInputElement>, files: types.FilePayload[]): Promise<void>;
  getBoundingBox(handle: dom.ElementHandle): Promise<types.Rect | null>;
  getFrameElement(frame: frames.Frame): Promise<dom.ElementHandle>;
  scrollRectIntoViewIfNeeded(handle: dom.ElementHandle, rect?: types.Rect): Promise<'error:notvisible' | 'error:notconnected' | 'done'>;

  getAccessibilityTree(needle?: dom.ElementHandle): Promise<{tree: accessibility.AXNode, needle: accessibility.AXNode | null}>;
  pdf?: (options?: types.PDFOptions) => Promise<Buffer>;
  coverage?: () => any;

  // Work around WebKit's raf issues on Windows.
  rafCountForStablePosition(): number;
  // Work around Chrome's non-associated input and protocol.
  inputActionEpilogue(): Promise<void>;
  // Work around for asynchronously dispatched CSP errors in Firefox.
  readonly cspErrorsAsynchronousForInlineScipts?: boolean;
}

type PageState = {
  viewportSize: types.Size | null;
  mediaType: types.MediaType | null;
  colorScheme: types.ColorScheme | null;
  extraHTTPHeaders: types.HeadersArray | null;
};

export class Page extends EventEmitter {
  private _closedState: 'open' | 'closing' | 'closed' = 'open';
  private _closedCallback: () => void;
  private _closedPromise: Promise<void>;
  private _disconnected = false;
  private _disconnectedCallback: (e: Error) => void;
  readonly _disconnectedPromise: Promise<Error>;
  private _crashedCallback: (e: Error) => void;
  readonly _crashedPromise: Promise<Error>;
  readonly _browserContext: BrowserContextBase;
  readonly keyboard: input.Keyboard;
  readonly mouse: input.Mouse;
  readonly _timeoutSettings: TimeoutSettings;
  readonly _delegate: PageDelegate;
  readonly _state: PageState;
  readonly _pageBindings = new Map<string, PageBinding>();
  readonly _evaluateOnNewDocumentSources: string[] = [];
  readonly _screenshotter: Screenshotter;
  readonly _frameManager: frames.FrameManager;
  readonly accessibility: accessibility.Accessibility;
  private _workers = new Map<string, Worker>();
  readonly pdf: ((options?: types.PDFOptions) => Promise<Buffer>) | undefined;
  readonly coverage: any;
  _routes: { url: types.URLMatch, handler: network.RouteHandler }[] = [];
  _ownedContext: BrowserContext | undefined;

  constructor(delegate: PageDelegate, browserContext: BrowserContextBase) {
    super();
    this._delegate = delegate;
    this._closedCallback = () => {};
    this._closedPromise = new Promise(f => this._closedCallback = f);
    this._disconnectedCallback = () => {};
    this._disconnectedPromise = new Promise(f => this._disconnectedCallback = f);
    this._crashedCallback = () => {};
    this._crashedPromise = new Promise(f => this._crashedCallback = f);
    this._browserContext = browserContext;
    this._state = {
      viewportSize: browserContext._options.viewport || null,
      mediaType: null,
      colorScheme: null,
      extraHTTPHeaders: null,
    };
    this.accessibility = new accessibility.Accessibility(delegate.getAccessibilityTree.bind(delegate));
    this.keyboard = new input.Keyboard(delegate.rawKeyboard);
    this.mouse = new input.Mouse(delegate.rawMouse, this.keyboard);
    this._timeoutSettings = new TimeoutSettings(browserContext._timeoutSettings);
    this._screenshotter = new Screenshotter(this);
    this._frameManager = new frames.FrameManager(this);
    if (delegate.pdf)
      this.pdf = delegate.pdf.bind(delegate);
    this.coverage = delegate.coverage ? delegate.coverage() : null;
  }

  _didClose() {
    this._frameManager.dispose();
    assert(this._closedState !== 'closed', 'Page closed twice');
    this._closedState = 'closed';
    this.emit(Events.Page.Close);
    this._closedCallback();
  }

  _didCrash() {
    this._frameManager.dispose();
    this.emit(Events.Page.Crash);
    this._crashedCallback(new Error('Page crashed'));
  }

  _didDisconnect() {
    this._frameManager.dispose();
    assert(!this._disconnected, 'Page disconnected twice');
    this._disconnected = true;
    this._disconnectedCallback(new Error('Page closed'));
  }

  async _runAbortableTask<T>(task: (progress: Progress) => Promise<T>, timeout: number): Promise<T> {
    return runAbortableTask(async progress => {
      return task(progress);
    }, timeout);
  }

  async _onFileChooserOpened(handle: dom.ElementHandle) {
    const multiple = await handle.evaluate(element => !!(element as HTMLInputElement).multiple);
    if (!this.listenerCount(Events.Page.FileChooser)) {
      handle.dispose();
      return;
    }
    const fileChooser = new FileChooser(this, handle, multiple);
    this.emit(Events.Page.FileChooser, fileChooser);
  }

  context(): BrowserContext {
    return this._browserContext;
  }

  async opener(): Promise<Page | null> {
    return await this._delegate.opener();
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

  async exposeBinding(name: string, playwrightBinding: frames.FunctionWithSource) {
    if (this._pageBindings.has(name))
      throw new Error(`Function "${name}" has been already registered`);
    if (this._browserContext._pageBindings.has(name))
      throw new Error(`Function "${name}" has been already registered in the browser context`);
    const binding = new PageBinding(name, playwrightBinding);
    this._pageBindings.set(name, binding);
    await this._delegate.exposeBinding(binding);
  }

  setExtraHTTPHeaders(headers: types.HeadersArray) {
    this._state.extraHTTPHeaders = headers;
    return this._delegate.updateExtraHTTPHeaders();
  }

  async _onBindingCalled(payload: string, context: dom.FrameExecutionContext) {
    if (this._disconnected || this._closedState === 'closed')
      return;
    await PageBinding.dispatch(this, payload, context);
  }

  _addConsoleMessage(type: string, args: js.JSHandle[], location: types.ConsoleMessageLocation, text?: string) {
    const message = new ConsoleMessage(type, text, args, location);
    const intercepted = this._frameManager.interceptConsoleMessage(message);
    if (intercepted || !this.listenerCount(Events.Page.Console))
      args.forEach(arg => arg.dispose());
    else
      this.emit(Events.Page.Console, message);
  }

  async reload(options?: types.NavigateOptions): Promise<network.Response | null> {
    const waitPromise = this.mainFrame().waitForNavigation(options);
    await this._delegate.reload();
    return waitPromise;
  }

  async goBack(options?: types.NavigateOptions): Promise<network.Response | null> {
    const waitPromise = this.mainFrame().waitForNavigation(options);
    const result = await this._delegate.goBack();
    if (!result) {
      waitPromise.catch(() => {});
      return null;
    }
    return waitPromise;
  }

  async goForward(options?: types.NavigateOptions): Promise<network.Response | null> {
    const waitPromise = this.mainFrame().waitForNavigation(options);
    const result = await this._delegate.goForward();
    if (!result) {
      waitPromise.catch(() => {});
      return null;
    }
    return waitPromise;
  }

  async emulateMedia(options: { media?: types.MediaType | null, colorScheme?: types.ColorScheme | null }) {
    if (options.media !== undefined)
      assert(options.media === null || types.mediaTypes.has(options.media), 'media: expected one of (screen|print|null)');
    if (options.colorScheme !== undefined)
      assert(options.colorScheme === null || types.colorSchemes.has(options.colorScheme), 'colorScheme: expected one of (dark|light|no-preference|null)');
    if (options.media !== undefined)
      this._state.mediaType = options.media;
    if (options.colorScheme !== undefined)
      this._state.colorScheme = options.colorScheme;
    await this._delegate.updateEmulateMedia();
  }

  async setViewportSize(viewportSize: types.Size) {
    this._state.viewportSize = { ...viewportSize };
    await this._delegate.setViewportSize(this._state.viewportSize);
  }

  viewportSize(): types.Size | null {
    return this._state.viewportSize;
  }

  async bringToFront(): Promise<void> {
    await this._delegate.bringToFront();
  }

  async _addInitScriptExpression(source: string) {
    this._evaluateOnNewDocumentSources.push(source);
    await this._delegate.evaluateOnNewDocument(source);
  }

  _needsRequestInterception(): boolean {
    return this._routes.length > 0 || this._browserContext._routes.length > 0;
  }

  async route(url: types.URLMatch, handler: network.RouteHandler): Promise<void> {
    this._routes.push({ url, handler });
    await this._delegate.updateRequestInterception();
  }

  async unroute(url: types.URLMatch, handler?: network.RouteHandler): Promise<void> {
    this._routes = this._routes.filter(route => route.url !== url || (handler && route.handler !== handler));
    await this._delegate.updateRequestInterception();
  }

  _requestStarted(request: network.Request) {
    this.emit(Events.Page.Request, request);
    const route = request._route();
    if (!route)
      return;
    for (const { url, handler } of this._routes) {
      if (helper.urlMatches(request.url(), url)) {
        handler(route, request);
        return;
      }
    }
    for (const { url, handler } of this._browserContext._routes) {
      if (helper.urlMatches(request.url(), url)) {
        handler(route, request);
        return;
      }
    }
    route.continue();
  }

  _isRouted(requestURL: string): boolean {
    for (const { url } of this._routes) {
      if (helper.urlMatches(requestURL, url))
        return true;
    }
    for (const { url } of this._browserContext._routes) {
      if (helper.urlMatches(requestURL, url))
        return true;
    }
    return false;
  }

  async screenshot(options: types.ScreenshotOptions = {}): Promise<Buffer> {
    return this._runAbortableTask(
        progress => this._screenshotter.screenshotPage(progress, options),
        this._timeoutSettings.timeout(options));
  }

  async close(options?: { runBeforeUnload?: boolean }) {
    if (this._closedState === 'closed')
      return;
    const runBeforeUnload = !!options && !!options.runBeforeUnload;
    if (this._closedState !== 'closing') {
      this._closedState = 'closing';
      assert(!this._disconnected, 'Protocol error: Connection closed. Most likely the page has been closed.');
      await this._delegate.closePage(runBeforeUnload);
    }
    if (!runBeforeUnload)
      await this._closedPromise;
    if (this._ownedContext)
      await this._ownedContext.close();
  }

  _setIsError() {
    if (!this._frameManager.mainFrame())
      this._frameManager.frameAttached('<dummy>', null);
  }

  isClosed(): boolean {
    return this._closedState === 'closed';
  }

  _addWorker(workerId: string, worker: Worker) {
    this._workers.set(workerId, worker);
    this.emit(Events.Page.Worker, worker);
  }

  _removeWorker(workerId: string) {
    const worker = this._workers.get(workerId);
    if (!worker)
      return;
    worker.emit(Events.Worker.Close, worker);
    this._workers.delete(workerId);
  }

  _clearWorkers() {
    for (const [workerId, worker] of this._workers) {
      worker.emit(Events.Worker.Close, worker);
      this._workers.delete(workerId);
    }
  }

  async _setFileChooserIntercepted(enabled: boolean): Promise<void> {
    await this._delegate.setFileChooserIntercepted(enabled);
  }
}

export class Worker extends EventEmitter {
  private _url: string;
  private _executionContextPromise: Promise<js.ExecutionContext>;
  private _executionContextCallback: (value?: js.ExecutionContext) => void;
  _existingExecutionContext: js.ExecutionContext | null = null;

  constructor(url: string) {
    super();
    this._url = url;
    this._executionContextCallback = () => {};
    this._executionContextPromise = new Promise(x => this._executionContextCallback = x);
  }

  _createExecutionContext(delegate: js.ExecutionContextDelegate) {
    this._existingExecutionContext = new js.ExecutionContext(delegate);
    this._executionContextCallback(this._existingExecutionContext);
  }

  url(): string {
    return this._url;
  }

  async _evaluateExpression(expression: string, isFunction: boolean, arg: any): Promise<any> {
    return js.evaluateExpression(await this._executionContextPromise, true /* returnByValue */, expression, isFunction, arg);
  }

  async _evaluateExpressionHandle(expression: string, isFunction: boolean, arg: any): Promise<any> {
    return js.evaluateExpression(await this._executionContextPromise, false /* returnByValue */, expression, isFunction, arg);
  }
}

export class PageBinding {
  readonly name: string;
  readonly playwrightFunction: frames.FunctionWithSource;
  readonly source: string;

  constructor(name: string, playwrightFunction: frames.FunctionWithSource) {
    this.name = name;
    this.playwrightFunction = playwrightFunction;
    this.source = helper.evaluationString(addPageBinding, name);
  }

  static async dispatch(page: Page, payload: string, context: dom.FrameExecutionContext) {
    const {name, seq, args} = JSON.parse(payload);
    try {
      let binding = page._pageBindings.get(name);
      if (!binding)
        binding = page._browserContext._pageBindings.get(name);
      const result = await binding!.playwrightFunction({ frame: context.frame, page, context: page._browserContext }, ...args);
      context.evaluateInternal(deliverResult, { name, seq, result }).catch(e => debugLogger.log('error', e));
    } catch (error) {
      if (helper.isError(error))
        context.evaluateInternal(deliverError, { name, seq, message: error.message, stack: error.stack }).catch(e => debugLogger.log('error', e));
      else
        context.evaluateInternal(deliverErrorValue, { name, seq, error }).catch(e => debugLogger.log('error', e));
    }

    function deliverResult(arg: { name: string, seq: number, result: any }) {
      (window as any)[arg.name]['callbacks'].get(arg.seq).resolve(arg.result);
      (window as any)[arg.name]['callbacks'].delete(arg.seq);
    }

    function deliverError(arg: { name: string, seq: number, message: string, stack: string | undefined }) {
      const error = new Error(arg.message);
      error.stack = arg.stack;
      (window as any)[arg.name]['callbacks'].get(arg.seq).reject(error);
      (window as any)[arg.name]['callbacks'].delete(arg.seq);
    }

    function deliverErrorValue(arg: { name: string, seq: number, error: any }) {
      (window as any)[arg.name]['callbacks'].get(arg.seq).reject(arg.error);
      (window as any)[arg.name]['callbacks'].delete(arg.seq);
    }
  }
}

function addPageBinding(bindingName: string) {
  const binding = (window as any)[bindingName];
  if (binding.__installed)
    return;
  (window as any)[bindingName] = (...args: any[]) => {
    const me = (window as any)[bindingName];
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
  (window as any)[bindingName].__installed = true;
}
