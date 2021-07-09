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
import * as input from './input';
import * as js from './javascript';
import * as network from './network';
import { Screenshotter } from './screenshotter';
import { TimeoutSettings } from '../utils/timeoutSettings';
import * as types from './types';
import { BrowserContext } from './browserContext';
import { ConsoleMessage } from './console';
import * as accessibility from './accessibility';
import { FileChooser } from './fileChooser';
import { Progress, ProgressController } from './progress';
import { assert, isError } from '../utils/utils';
import { debugLogger } from '../utils/debugLogger';
import { Selectors } from './selectors';
import { CallMetadata, SdkObject } from './instrumentation';
import { Artifact } from './artifact';

export interface PageDelegate {
  readonly rawMouse: input.RawMouse;
  readonly rawKeyboard: input.RawKeyboard;
  readonly rawTouchscreen: input.RawTouchscreen;

  reload(): Promise<void>;
  goBack(): Promise<boolean>;
  goForward(): Promise<boolean>;
  exposeBinding(binding: PageBinding): Promise<void>;
  evaluateOnNewDocument(source: string): Promise<void>;
  closePage(runBeforeUnload: boolean): Promise<void>;
  pageOrError(): Promise<Page | Error>;

  navigateFrame(frame: frames.Frame, url: string, referrer: string | undefined): Promise<frames.GotoResult>;

  updateExtraHTTPHeaders(): Promise<void>;
  setEmulatedSize(emulatedSize: types.EmulatedSize): Promise<void>;
  updateEmulateMedia(): Promise<void>;
  updateRequestInterception(): Promise<void>;
  setFileChooserIntercepted(enabled: boolean): Promise<void>;
  bringToFront(): Promise<void>;

  canScreenshotOutsideViewport(): boolean;
  resetViewport(): Promise<void>; // Only called if canScreenshotOutsideViewport() returns false.
  setBackgroundColor(color?: { r: number; g: number; b: number; a: number; }): Promise<void>;
  takeScreenshot(progress: Progress, format: string, documentRect: types.Rect | undefined, viewportRect: types.Rect | undefined, quality: number | undefined): Promise<Buffer>;

  isElementHandle(remoteObject: any): boolean;
  adoptElementHandle<T extends Node>(handle: dom.ElementHandle<T>, to: dom.FrameExecutionContext): Promise<dom.ElementHandle<T>>;
  getContentFrame(handle: dom.ElementHandle): Promise<frames.Frame | null>;  // Only called for frame owner elements.
  getOwnerFrame(handle: dom.ElementHandle): Promise<string | null>; // Returns frameId.
  getContentQuads(handle: dom.ElementHandle): Promise<types.Quad[] | null>;
  setInputFiles(handle: dom.ElementHandle<HTMLInputElement>, files: types.FilePayload[]): Promise<void>;
  getBoundingBox(handle: dom.ElementHandle): Promise<types.Rect | null>;
  getFrameElement(frame: frames.Frame): Promise<dom.ElementHandle>;
  scrollRectIntoViewIfNeeded(handle: dom.ElementHandle, rect?: types.Rect): Promise<'error:notvisible' | 'error:notconnected' | 'done'>;
  setScreencastOptions(options: { width: number, height: number, quality: number } | null): Promise<void>;

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
  emulatedSize: { screen: types.Size, viewport: types.Size } | null;
  mediaType: types.MediaType | null;
  colorScheme: types.ColorScheme | null;
  reducedMotion: types.ReducedMotion | null;
  extraHTTPHeaders: types.HeadersArray | null;
};

export class Page extends SdkObject {
  static Events = {
    Close: 'close',
    Crash: 'crash',
    Console: 'console',
    Dialog: 'dialog',
    Download: 'download',
    FileChooser: 'filechooser',
    DOMContentLoaded: 'domcontentloaded',
    // Can't use just 'error' due to node.js special treatment of error events.
    // @see https://nodejs.org/api/events.html#events_error_events
    PageError: 'pageerror',
    FrameAttached: 'frameattached',
    FrameDetached: 'framedetached',
    InternalFrameNavigatedToNewDocument: 'internalframenavigatedtonewdocument',
    Load: 'load',
    ScreencastFrame: 'screencastframe',
    Video: 'video',
    WebSocket: 'websocket',
    Worker: 'worker',
  };

  private _closedState: 'open' | 'closing' | 'closed' = 'open';
  private _closedCallback: () => void;
  private _closedPromise: Promise<void>;
  private _disconnected = false;
  private _initialized = false;
  private _disconnectedCallback: (e: Error) => void;
  readonly _disconnectedPromise: Promise<Error>;
  private _crashedCallback: (e: Error) => void;
  readonly _crashedPromise: Promise<Error>;
  readonly _browserContext: BrowserContext;
  readonly keyboard: input.Keyboard;
  readonly mouse: input.Mouse;
  readonly touchscreen: input.Touchscreen;
  readonly _timeoutSettings: TimeoutSettings;
  readonly _delegate: PageDelegate;
  readonly _state: PageState;
  private readonly _pageBindings = new Map<string, PageBinding>();
  readonly _evaluateOnNewDocumentSources: string[] = [];
  readonly _screenshotter: Screenshotter;
  readonly _frameManager: frames.FrameManager;
  readonly accessibility: accessibility.Accessibility;
  private _workers = new Map<string, Worker>();
  readonly pdf: ((options?: types.PDFOptions) => Promise<Buffer>) | undefined;
  readonly coverage: any;
  private _clientRequestInterceptor: network.RouteHandler | undefined;
  private _serverRequestInterceptor: network.RouteHandler | undefined;
  _ownedContext: BrowserContext | undefined;
  readonly selectors: Selectors;
  _pageIsError: Error | undefined;
  _video: Artifact | null = null;
  _opener: Page | undefined;

  constructor(delegate: PageDelegate, browserContext: BrowserContext) {
    super(browserContext, 'page');
    this.attribution.page = this;
    this._delegate = delegate;
    this._closedCallback = () => {};
    this._closedPromise = new Promise(f => this._closedCallback = f);
    this._disconnectedCallback = () => {};
    this._disconnectedPromise = new Promise(f => this._disconnectedCallback = f);
    this._crashedCallback = () => {};
    this._crashedPromise = new Promise(f => this._crashedCallback = f);
    this._browserContext = browserContext;
    this._state = {
      emulatedSize: browserContext._options.viewport ? { viewport: browserContext._options.viewport, screen: browserContext._options.screen || browserContext._options.viewport } : null,
      mediaType: null,
      colorScheme: browserContext._options.colorScheme !== undefined  ? browserContext._options.colorScheme : 'light',
      reducedMotion: browserContext._options.reducedMotion !== undefined  ? browserContext._options.reducedMotion : 'no-preference',
      extraHTTPHeaders: null,
    };
    this.accessibility = new accessibility.Accessibility(delegate.getAccessibilityTree.bind(delegate));
    this.keyboard = new input.Keyboard(delegate.rawKeyboard, this);
    this.mouse = new input.Mouse(delegate.rawMouse, this);
    this.touchscreen = new input.Touchscreen(delegate.rawTouchscreen, this);
    this._timeoutSettings = new TimeoutSettings(browserContext._timeoutSettings);
    this._screenshotter = new Screenshotter(this);
    this._frameManager = new frames.FrameManager(this);
    if (delegate.pdf)
      this.pdf = delegate.pdf.bind(delegate);
    this.coverage = delegate.coverage ? delegate.coverage() : null;
    this.selectors = browserContext.selectors();
  }

  async initOpener(opener: PageDelegate | null) {
    if (!opener)
      return;
    const openerPage = await opener.pageOrError();
    if (openerPage instanceof Page && !openerPage.isClosed())
      this._opener = openerPage;
  }

  reportAsNew(error?: Error) {
    if (error) {
      // Initialization error could have happened because of
      // context/browser closure. Just ignore the page.
      if (this._browserContext.isClosingOrClosed())
        return;
      this._setIsError(error);
    }
    this._initialized = true;
    this._browserContext.emit(BrowserContext.Events.Page, this);
    // I may happen that page iniatialization finishes after Close event has already been sent,
    // in that case we fire another Close event to ensure that each reported Page will have
    // corresponding Close event after it is reported on the context.
    if (this.isClosed())
      this.emit(Page.Events.Close);
  }

  initializedOrUndefined() {
    return this._initialized ? this : undefined;
  }

  async _doSlowMo() {
    const slowMo = this._browserContext._browser.options.slowMo;
    if (!slowMo)
      return;
    await new Promise(x => setTimeout(x, slowMo));
  }

  _didClose() {
    this._frameManager.dispose();
    assert(this._closedState !== 'closed', 'Page closed twice');
    this._closedState = 'closed';
    this.emit(Page.Events.Close);
    this._closedCallback();
  }

  _didCrash() {
    this._frameManager.dispose();
    this.emit(Page.Events.Crash);
    this._crashedCallback(new Error('Page crashed'));
  }

  _didDisconnect() {
    this._frameManager.dispose();
    assert(!this._disconnected, 'Page disconnected twice');
    this._disconnected = true;
    this._disconnectedCallback(new Error('Page closed'));
  }

  async _onFileChooserOpened(handle: dom.ElementHandle) {
    let multiple;
    try {
      multiple = await handle.evaluate(element => !!(element as HTMLInputElement).multiple);
    } catch (e) {
      // Frame/context may be gone during async processing. Do not throw.
      return;
    }
    if (!this.listenerCount(Page.Events.FileChooser)) {
      handle.dispose();
      return;
    }
    const fileChooser = new FileChooser(this, handle, multiple);
    this.emit(Page.Events.FileChooser, fileChooser);
  }

  context(): BrowserContext {
    return this._browserContext;
  }

  opener(): Page | undefined {
    return this._opener;
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

  async exposeBinding(name: string, needsHandle: boolean, playwrightBinding: frames.FunctionWithSource, world: types.World = 'main') {
    const identifier = PageBinding.identifier(name, world);
    if (this._pageBindings.has(identifier))
      throw new Error(`Function "${name}" has been already registered`);
    if (this._browserContext._pageBindings.has(identifier))
      throw new Error(`Function "${name}" has been already registered in the browser context`);
    const binding = new PageBinding(name, playwrightBinding, needsHandle, world);
    this._pageBindings.set(identifier, binding);
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
    const message = new ConsoleMessage(this, type, text, args, location);
    const intercepted = this._frameManager.interceptConsoleMessage(message);
    if (intercepted || !this.listenerCount(Page.Events.Console))
      args.forEach(arg => arg.dispose());
    else
      this.emit(Page.Events.Console, message);
  }

  async reload(metadata: CallMetadata, options: types.NavigateOptions): Promise<network.Response | null> {
    const controller = new ProgressController(metadata, this);
    return controller.run(progress => this.mainFrame().raceNavigationAction(async () => {
      // Note: waitForNavigation may fail before we get response to reload(),
      // so we should await it immediately.
      const [response] = await Promise.all([
        this.mainFrame()._waitForNavigation(progress, options),
        this._delegate.reload(),
      ]);
      await this._doSlowMo();
      return response;
    }), this._timeoutSettings.navigationTimeout(options));
  }

  async goBack(metadata: CallMetadata, options: types.NavigateOptions): Promise<network.Response | null> {
    const controller = new ProgressController(metadata, this);
    return controller.run(progress => this.mainFrame().raceNavigationAction(async () => {
      // Note: waitForNavigation may fail before we get response to goBack,
      // so we should catch it immediately.
      let error: Error | undefined;
      const waitPromise = this.mainFrame()._waitForNavigation(progress, options).catch(e => {
        error = e;
        return null;
      });
      const result = await this._delegate.goBack();
      if (!result)
        return null;
      const response = await waitPromise;
      if (error)
        throw error;
      await this._doSlowMo();
      return response;
    }), this._timeoutSettings.navigationTimeout(options));
  }

  async goForward(metadata: CallMetadata, options: types.NavigateOptions): Promise<network.Response | null> {
    const controller = new ProgressController(metadata, this);
    return controller.run(progress => this.mainFrame().raceNavigationAction(async () => {
      // Note: waitForNavigation may fail before we get response to goForward,
      // so we should catch it immediately.
      let error: Error | undefined;
      const waitPromise = this.mainFrame()._waitForNavigation(progress, options).catch(e => {
        error = e;
        return null;
      });
      const result = await this._delegate.goForward();
      if (!result)
        return null;
      const response = await waitPromise;
      if (error)
        throw error;
      await this._doSlowMo();
      return response;
    }), this._timeoutSettings.navigationTimeout(options));
  }

  async emulateMedia(options: { media?: types.MediaType | null, colorScheme?: types.ColorScheme | null, reducedMotion?: types.ReducedMotion | null }) {
    if (options.media !== undefined)
      this._state.mediaType = options.media;
    if (options.colorScheme !== undefined)
      this._state.colorScheme = options.colorScheme;
    if (options.reducedMotion !== undefined)
      this._state.reducedMotion = options.reducedMotion;
    await this._delegate.updateEmulateMedia();
    await this._doSlowMo();
  }

  async setViewportSize(viewportSize: types.Size) {
    this._state.emulatedSize = { viewport: { ...viewportSize }, screen: { ...viewportSize } };
    await this._delegate.setEmulatedSize(this._state.emulatedSize);
    await this._doSlowMo();
  }

  viewportSize(): types.Size | null {
    return this._state.emulatedSize?.viewport || null;
  }

  async bringToFront(): Promise<void> {
    await this._delegate.bringToFront();
  }

  async _addInitScriptExpression(source: string) {
    this._evaluateOnNewDocumentSources.push(source);
    await this._delegate.evaluateOnNewDocument(source);
  }

  _needsRequestInterception(): boolean {
    return !!this._clientRequestInterceptor || !!this._serverRequestInterceptor || !!this._browserContext._requestInterceptor;
  }

  async _setClientRequestInterceptor(handler: network.RouteHandler | undefined): Promise<void> {
    this._clientRequestInterceptor = handler;
    await this._delegate.updateRequestInterception();
  }

  async _setServerRequestInterceptor(handler: network.RouteHandler | undefined): Promise<void> {
    this._serverRequestInterceptor = handler;
    await this._delegate.updateRequestInterception();
  }

  _requestStarted(request: network.Request) {
    const route = request._route();
    if (!route)
      return;
    if (this._serverRequestInterceptor) {
      this._serverRequestInterceptor(route, request);
      return;
    }
    if (this._clientRequestInterceptor) {
      this._clientRequestInterceptor(route, request);
      return;
    }
    if (this._browserContext._requestInterceptor) {
      this._browserContext._requestInterceptor(route, request);
      return;
    }
    route.continue();
  }

  async screenshot(metadata: CallMetadata, options: types.ScreenshotOptions = {}): Promise<Buffer> {
    const controller = new ProgressController(metadata, this);
    return controller.run(
        progress => this._screenshotter.screenshotPage(progress, options),
        this._timeoutSettings.timeout(options));
  }

  async close(metadata: CallMetadata, options?: { runBeforeUnload?: boolean }) {
    if (this._closedState === 'closed')
      return;
    const runBeforeUnload = !!options && !!options.runBeforeUnload;
    if (this._closedState !== 'closing') {
      this._closedState = 'closing';
      assert(!this._disconnected, 'Protocol error: Connection closed. Most likely the page has been closed.');
      // This might throw if the browser context containing the page closes
      // while we are trying to close the page.
      await this._delegate.closePage(runBeforeUnload).catch(e => debugLogger.log('error', e));
    }
    if (!runBeforeUnload)
      await this._closedPromise;
    if (this._ownedContext)
      await this._ownedContext.close(metadata);
  }

  private _setIsError(error: Error) {
    this._pageIsError = error;
    if (!this._frameManager.mainFrame())
      this._frameManager.frameAttached('<dummy>', null);
  }

  isClosed(): boolean {
    return this._closedState === 'closed';
  }

  _addWorker(workerId: string, worker: Worker) {
    this._workers.set(workerId, worker);
    this.emit(Page.Events.Worker, worker);
  }

  _removeWorker(workerId: string) {
    const worker = this._workers.get(workerId);
    if (!worker)
      return;
    worker.emit(Worker.Events.Close, worker);
    this._workers.delete(workerId);
  }

  _clearWorkers() {
    for (const [workerId, worker] of this._workers) {
      worker.emit(Worker.Events.Close, worker);
      this._workers.delete(workerId);
    }
  }

  async _setFileChooserIntercepted(enabled: boolean): Promise<void> {
    await this._delegate.setFileChooserIntercepted(enabled);
  }

  frameNavigatedToNewDocument(frame: frames.Frame) {
    this.emit(Page.Events.InternalFrameNavigatedToNewDocument, frame);
    const url = frame.url();
    if (!url.startsWith('http'))
      return;
    const purl = network.parsedURL(url);
    if (purl)
      this._browserContext.addVisitedOrigin(purl.origin);
  }

  allBindings() {
    return [...this._browserContext._pageBindings.values(), ...this._pageBindings.values()];
  }

  getBinding(name: string, world: types.World) {
    const identifier = PageBinding.identifier(name, world);
    return this._pageBindings.get(identifier) || this._browserContext._pageBindings.get(identifier);
  }

  setScreencastOptions(options: { width: number, height: number, quality: number } | null) {
    this._delegate.setScreencastOptions(options).catch(e => debugLogger.log('error', e));
  }

  firePageError(error: Error) {
    this.emit(Page.Events.PageError, error);
  }
}

export class Worker extends SdkObject {
  static Events = {
    Close: 'close',
  };

  private _url: string;
  private _executionContextPromise: Promise<js.ExecutionContext>;
  private _executionContextCallback: (value: js.ExecutionContext) => void;
  _existingExecutionContext: js.ExecutionContext | null = null;

  constructor(parent: SdkObject, url: string) {
    super(parent, 'worker');
    this._url = url;
    this._executionContextCallback = () => {};
    this._executionContextPromise = new Promise(x => this._executionContextCallback = x);
  }

  _createExecutionContext(delegate: js.ExecutionContextDelegate) {
    this._existingExecutionContext = new js.ExecutionContext(this, delegate);
    this._executionContextCallback(this._existingExecutionContext);
  }

  url(): string {
    return this._url;
  }

  async evaluateExpression(expression: string, isFunction: boolean | undefined, arg: any): Promise<any> {
    return js.evaluateExpression(await this._executionContextPromise, true /* returnByValue */, expression, isFunction, arg);
  }

  async evaluateExpressionHandle(expression: string, isFunction: boolean | undefined, arg: any): Promise<any> {
    return js.evaluateExpression(await this._executionContextPromise, false /* returnByValue */, expression, isFunction, arg);
  }
}

export class PageBinding {
  readonly name: string;
  readonly playwrightFunction: frames.FunctionWithSource;
  readonly source: string;
  readonly needsHandle: boolean;
  readonly world: types.World;

  constructor(name: string, playwrightFunction: frames.FunctionWithSource, needsHandle: boolean, world: types.World) {
    this.name = name;
    this.playwrightFunction = playwrightFunction;
    this.source = `(${addPageBinding.toString()})(${JSON.stringify(name)}, ${needsHandle})`;
    this.needsHandle = needsHandle;
    this.world = world;
  }

  static identifier(name: string, world: types.World) {
    return world + ':' + name;
  }

  static async dispatch(page: Page, payload: string, context: dom.FrameExecutionContext) {
    const {name, seq, args} = JSON.parse(payload);
    try {
      assert(context.world);
      const binding = page.getBinding(name, context.world)!;
      let result: any;
      if (binding.needsHandle) {
        const handle = await context.evaluateHandle(takeHandle, { name, seq }).catch(e => null);
        result = await binding.playwrightFunction({ frame: context.frame, page, context: page._browserContext }, handle);
      } else {
        result = await binding.playwrightFunction({ frame: context.frame, page, context: page._browserContext }, ...args);
      }
      context.evaluate(deliverResult, { name, seq, result }).catch(e => debugLogger.log('error', e));
    } catch (error) {
      if (isError(error))
        context.evaluate(deliverError, { name, seq, message: error.message, stack: error.stack }).catch(e => debugLogger.log('error', e));
      else
        context.evaluate(deliverErrorValue, { name, seq, error }).catch(e => debugLogger.log('error', e));
    }

    function takeHandle(arg: { name: string, seq: number }) {
      const handle = (globalThis as any)[arg.name]['handles'].get(arg.seq);
      (globalThis as any)[arg.name]['handles'].delete(arg.seq);
      return handle;
    }

    function deliverResult(arg: { name: string, seq: number, result: any }) {
      (globalThis as any)[arg.name]['callbacks'].get(arg.seq).resolve(arg.result);
      (globalThis as any)[arg.name]['callbacks'].delete(arg.seq);
    }

    function deliverError(arg: { name: string, seq: number, message: string, stack: string | undefined }) {
      const error = new Error(arg.message);
      error.stack = arg.stack;
      (globalThis as any)[arg.name]['callbacks'].get(arg.seq).reject(error);
      (globalThis as any)[arg.name]['callbacks'].delete(arg.seq);
    }

    function deliverErrorValue(arg: { name: string, seq: number, error: any }) {
      (globalThis as any)[arg.name]['callbacks'].get(arg.seq).reject(arg.error);
      (globalThis as any)[arg.name]['callbacks'].delete(arg.seq);
    }
  }
}

function addPageBinding(bindingName: string, needsHandle: boolean) {
  const binding = (globalThis as any)[bindingName];
  if (binding.__installed)
    return;
  (globalThis as any)[bindingName] = (...args: any[]) => {
    const me = (globalThis as any)[bindingName];
    if (needsHandle && args.slice(1).some(arg => arg !== undefined))
      throw new Error(`exposeBindingHandle supports a single argument, ${args.length} received`);
    let callbacks = me['callbacks'];
    if (!callbacks) {
      callbacks = new Map();
      me['callbacks'] = callbacks;
    }
    const seq = (me['lastSeq'] || 0) + 1;
    me['lastSeq'] = seq;
    let handles = me['handles'];
    if (!handles) {
      handles = new Map();
      me['handles'] = handles;
    }
    const promise = new Promise((resolve, reject) => callbacks.set(seq, {resolve, reject}));
    if (needsHandle) {
      handles.set(seq, args[0]);
      binding(JSON.stringify({name: bindingName, seq}));
    } else {
      binding(JSON.stringify({name: bindingName, seq, args}));
    }
    return promise;
  };
  (globalThis as any)[bindingName].__installed = true;
}
