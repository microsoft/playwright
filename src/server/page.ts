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
import { EventEmitter } from 'events';
import { FileChooser } from './fileChooser';
import { ProgressController, runAbortableTask } from './progress';
import { assert, isError } from '../utils/utils';
import { debugLogger } from '../utils/debugLogger';
import { Selectors } from './selectors';

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
  startScreencast(options: types.PageScreencastOptions): Promise<void>;
  stopScreencast(): Promise<void>;
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
    Request: 'request',
    Response: 'response',
    RequestFailed: 'requestfailed',
    RequestFinished: 'requestfinished',
    FrameAttached: 'frameattached',
    FrameDetached: 'framedetached',
    FrameNavigated: 'framenavigated',
    Load: 'load',
    Popup: 'popup',
    Worker: 'worker',
    VideoStarted: 'videostarted',
  };

  private _closedState: 'open' | 'closing' | 'closed' = 'open';
  private _closedCallback: () => void;
  private _closedPromise: Promise<void>;
  private _disconnected = false;
  private _disconnectedCallback: (e: Error) => void;
  readonly _disconnectedPromise: Promise<Error>;
  private _crashedCallback: (e: Error) => void;
  readonly _crashedPromise: Promise<Error>;
  readonly _browserContext: BrowserContext;
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
  private _requestInterceptor?: network.RouteHandler;
  _ownedContext: BrowserContext | undefined;
  readonly selectors: Selectors;

  constructor(delegate: PageDelegate, browserContext: BrowserContext) {
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
    this.keyboard = new input.Keyboard(delegate.rawKeyboard, this);
    this.mouse = new input.Mouse(delegate.rawMouse, this);
    this._timeoutSettings = new TimeoutSettings(browserContext._timeoutSettings);
    this._screenshotter = new Screenshotter(this);
    this._frameManager = new frames.FrameManager(this);
    if (delegate.pdf)
      this.pdf = delegate.pdf.bind(delegate);
    this.coverage = delegate.coverage ? delegate.coverage() : null;
    this.selectors = browserContext.selectors();
  }

  async _doSlowMo() {
    const slowMo = this._browserContext._browser._options.slowMo;
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
    const multiple = await handle.evaluate(element => !!(element as HTMLInputElement).multiple);
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

  async exposeBinding(name: string, needsHandle: boolean, playwrightBinding: frames.FunctionWithSource) {
    if (this._pageBindings.has(name))
      throw new Error(`Function "${name}" has been already registered`);
    if (this._browserContext._pageBindings.has(name))
      throw new Error(`Function "${name}" has been already registered in the browser context`);
    const binding = new PageBinding(name, playwrightBinding, needsHandle);
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
    if (intercepted || !this.listenerCount(Page.Events.Console))
      args.forEach(arg => arg.dispose());
    else
      this.emit(Page.Events.Console, message);
  }

  async reload(controller: ProgressController, options: types.NavigateOptions): Promise<network.Response | null> {
    this.mainFrame().setupNavigationProgressController(controller);
    const response = await controller.run(async progress => {
      const waitPromise = this.mainFrame()._waitForNavigation(progress, options);
      await this._delegate.reload();
      return waitPromise;
    }, this._timeoutSettings.navigationTimeout(options));
    await this._doSlowMo();
    return response;
  }

  async goBack(controller: ProgressController, options: types.NavigateOptions): Promise<network.Response | null> {
    this.mainFrame().setupNavigationProgressController(controller);
    const response = await controller.run(async progress => {
      const waitPromise = this.mainFrame()._waitForNavigation(progress, options);
      const result = await this._delegate.goBack();
      if (!result) {
        waitPromise.catch(() => {});
        return null;
      }
      return waitPromise;
    }, this._timeoutSettings.navigationTimeout(options));
    await this._doSlowMo();
    return response;
  }

  async goForward(controller: ProgressController, options: types.NavigateOptions): Promise<network.Response | null> {
    this.mainFrame().setupNavigationProgressController(controller);
    const response = await controller.run(async progress => {
      const waitPromise = this.mainFrame()._waitForNavigation(progress, options);
      const result = await this._delegate.goForward();
      if (!result) {
        waitPromise.catch(() => {});
        return null;
      }
      return waitPromise;
    }, this._timeoutSettings.navigationTimeout(options));
    await this._doSlowMo();
    return response;
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
    await this._doSlowMo();
  }

  async setViewportSize(viewportSize: types.Size) {
    this._state.viewportSize = { ...viewportSize };
    await this._delegate.setViewportSize(this._state.viewportSize);
    await this._doSlowMo();
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
    return !!this._requestInterceptor || !!this._browserContext._requestInterceptor;
  }

  async _setRequestInterceptor(handler: network.RouteHandler | undefined): Promise<void> {
    this._requestInterceptor = handler;
    await this._delegate.updateRequestInterception();
  }

  _requestStarted(request: network.Request) {
    this.emit(Page.Events.Request, request);
    const route = request._route();
    if (!route)
      return;
    if (this._requestInterceptor) {
      this._requestInterceptor(route, request);
      return;
    }
    if (this._browserContext._requestInterceptor) {
      this._browserContext._requestInterceptor(route, request);
      return;
    }
    route.continue();
  }

  async screenshot(options: types.ScreenshotOptions = {}): Promise<Buffer> {
    return runAbortableTask(
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
}

export class Worker extends EventEmitter {
  static Events = {
    Close: 'close',
  };

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
  readonly needsHandle: boolean;

  constructor(name: string, playwrightFunction: frames.FunctionWithSource, needsHandle: boolean) {
    this.name = name;
    this.playwrightFunction = playwrightFunction;
    this.source = `(${addPageBinding.toString()})(${JSON.stringify(name)}, ${needsHandle})`;
    this.needsHandle = needsHandle;
  }

  static async dispatch(page: Page, payload: string, context: dom.FrameExecutionContext) {
    const {name, seq, args} = JSON.parse(payload);
    try {
      let binding = page._pageBindings.get(name);
      if (!binding)
        binding = page._browserContext._pageBindings.get(name);
      let result: any;
      if (binding!.needsHandle) {
        const handle = await context.evaluateHandleInternal(takeHandle, { name, seq }).catch(e => null);
        result = await binding!.playwrightFunction({ frame: context.frame, page, context: page._browserContext }, handle);
      } else {
        result = await binding!.playwrightFunction({ frame: context.frame, page, context: page._browserContext }, ...args);
      }
      context.evaluateInternal(deliverResult, { name, seq, result }).catch(e => debugLogger.log('error', e));
    } catch (error) {
      if (isError(error))
        context.evaluateInternal(deliverError, { name, seq, message: error.message, stack: error.stack }).catch(e => debugLogger.log('error', e));
      else
        context.evaluateInternal(deliverErrorValue, { name, seq, error }).catch(e => debugLogger.log('error', e));
    }

    function takeHandle(arg: { name: string, seq: number }) {
      const handle = (window as any)[arg.name]['handles'].get(arg.seq);
      (window as any)[arg.name]['handles'].delete(arg.seq);
      return handle;
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

function addPageBinding(bindingName: string, needsHandle: boolean) {
  const binding = (window as any)[bindingName];
  if (binding.__installed)
    return;
  (window as any)[bindingName] = (...args: any[]) => {
    const me = (window as any)[bindingName];
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
  (window as any)[bindingName].__installed = true;
}
