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

import type * as dom from './dom';
import * as frames from './frames';
import * as input from './input';
import * as js from './javascript';
import * as network from './network';
import type * as channels from '@protocol/channels';
import type { ScreenshotOptions } from './screenshotter';
import { Screenshotter, validateScreenshotOptions } from './screenshotter';
import { TimeoutSettings } from '../common/timeoutSettings';
import type * as types from './types';
import { BrowserContext } from './browserContext';
import { ConsoleMessage } from './console';
import * as accessibility from './accessibility';
import { FileChooser } from './fileChooser';
import type { Progress } from './progress';
import { ProgressController } from './progress';
import { assert, isError } from '../utils';
import { ManualPromise } from '../utils/manualPromise';
import { debugLogger } from '../common/debugLogger';
import type { ImageComparatorOptions } from '../utils/comparators';
import { getComparator } from '../utils/comparators';
import type { CallMetadata } from './instrumentation';
import { SdkObject } from './instrumentation';
import type { Artifact } from './artifact';
import type { TimeoutOptions } from '../common/types';
import { isInvalidSelectorError } from './isomorphic/selectorParser';
import { parseEvaluationResultValue, source } from './isomorphic/utilityScriptSerializers';
import type { SerializedValue } from './isomorphic/utilityScriptSerializers';

export interface PageDelegate {
  readonly rawMouse: input.RawMouse;
  readonly rawKeyboard: input.RawKeyboard;
  readonly rawTouchscreen: input.RawTouchscreen;

  reload(): Promise<void>;
  goBack(): Promise<boolean>;
  goForward(): Promise<boolean>;
  exposeBinding(binding: PageBinding): Promise<void>;
  removeExposedBindings(): Promise<void>;
  addInitScript(source: string): Promise<void>;
  removeInitScripts(): Promise<void>;
  closePage(runBeforeUnload: boolean): Promise<void>;
  potentiallyUninitializedPage(): Page;
  pageOrError(): Promise<Page | Error>;

  navigateFrame(frame: frames.Frame, url: string, referrer: string | undefined): Promise<frames.GotoResult>;

  updateExtraHTTPHeaders(): Promise<void>;
  updateEmulatedViewportSize(preserveWindowBoundaries?: boolean): Promise<void>;
  updateEmulateMedia(): Promise<void>;
  updateRequestInterception(): Promise<void>;
  updateFileChooserInterception(): Promise<void>;
  bringToFront(): Promise<void>;

  setBackgroundColor(color?: { r: number; g: number; b: number; a: number; }): Promise<void>;
  takeScreenshot(progress: Progress, format: string, documentRect: types.Rect | undefined, viewportRect: types.Rect | undefined, quality: number | undefined, fitsViewport: boolean, scale: 'css' | 'device'): Promise<Buffer>;

  isElementHandle(remoteObject: any): boolean;
  adoptElementHandle<T extends Node>(handle: dom.ElementHandle<T>, to: dom.FrameExecutionContext): Promise<dom.ElementHandle<T>>;
  getContentFrame(handle: dom.ElementHandle): Promise<frames.Frame | null>;  // Only called for frame owner elements.
  getOwnerFrame(handle: dom.ElementHandle): Promise<string | null>; // Returns frameId.
  getContentQuads(handle: dom.ElementHandle): Promise<types.Quad[] | null>;
  setInputFiles(handle: dom.ElementHandle<HTMLInputElement>, files: types.FilePayload[]): Promise<void>;
  setInputFilePaths(handle: dom.ElementHandle<HTMLInputElement>, files: string[]): Promise<void>;
  getBoundingBox(handle: dom.ElementHandle): Promise<types.Rect | null>;
  getFrameElement(frame: frames.Frame): Promise<dom.ElementHandle>;
  scrollRectIntoViewIfNeeded(handle: dom.ElementHandle, rect?: types.Rect): Promise<'error:notvisible' | 'error:notconnected' | 'done'>;
  setScreencastOptions(options: { width: number, height: number, quality: number } | null): Promise<void>;

  getAccessibilityTree(needle?: dom.ElementHandle): Promise<{tree: accessibility.AXNode, needle: accessibility.AXNode | null}>;
  pdf?: (options: channels.PagePdfParams) => Promise<Buffer>;
  coverage?: () => any;

  // Work around WebKit's raf issues on Windows.
  rafCountForStablePosition(): number;
  // Work around Chrome's non-associated input and protocol.
  inputActionEpilogue(): Promise<void>;
  // Work around for asynchronously dispatched CSP errors in Firefox.
  readonly cspErrorsAsynchronousForInlineScipts?: boolean;
}

type EmulatedSize = { screen: types.Size, viewport: types.Size };

type EmulatedMedia = {
  media: types.MediaType;
  colorScheme: types.ColorScheme;
  reducedMotion: types.ReducedMotion;
  forcedColors: types.ForcedColors;
};

type ExpectScreenshotOptions = {
  timeout?: number,
  expected?: Buffer,
  isNot?: boolean,
  locator?: {
    frame: frames.Frame,
    selector: string,
  },
  comparatorOptions?: ImageComparatorOptions,
  screenshotOptions?: ScreenshotOptions,
};

export class Page extends SdkObject {
  static Events = {
    Close: 'close',
    Crash: 'crash',
    Console: 'console',
    Dialog: 'dialog',
    Download: 'download',
    FileChooser: 'filechooser',
    // Can't use just 'error' due to node.js special treatment of error events.
    // @see https://nodejs.org/api/events.html#events_error_events
    PageError: 'pageerror',
    FrameAttached: 'frameattached',
    FrameDetached: 'framedetached',
    InternalFrameNavigatedToNewDocument: 'internalframenavigatedtonewdocument',
    ScreencastFrame: 'screencastframe',
    Video: 'video',
    WebSocket: 'websocket',
    Worker: 'worker',
  };

  private _closedState: 'open' | 'closing' | 'closed' = 'open';
  private _closedPromise = new ManualPromise<void>();
  private _disconnected = false;
  private _initialized = false;
  readonly _disconnectedPromise = new ManualPromise<Error>();
  readonly _crashedPromise = new ManualPromise<Error>();
  readonly _browserContext: BrowserContext;
  readonly keyboard: input.Keyboard;
  readonly mouse: input.Mouse;
  readonly touchscreen: input.Touchscreen;
  readonly _timeoutSettings: TimeoutSettings;
  readonly _delegate: PageDelegate;
  _emulatedSize: EmulatedSize | undefined;
  private _extraHTTPHeaders: types.HeadersArray | undefined;
  private _emulatedMedia: Partial<EmulatedMedia> = {};
  private _interceptFileChooser = false;
  private readonly _pageBindings = new Map<string, PageBinding>();
  readonly initScripts: string[] = [];
  readonly _screenshotter: Screenshotter;
  readonly _frameManager: frames.FrameManager;
  readonly accessibility: accessibility.Accessibility;
  private _workers = new Map<string, Worker>();
  readonly pdf: ((options: channels.PagePdfParams) => Promise<Buffer>) | undefined;
  readonly coverage: any;
  _clientRequestInterceptor: network.RouteHandler | undefined;
  _serverRequestInterceptor: network.RouteHandler | undefined;
  _ownedContext: BrowserContext | undefined;
  _pageIsError: Error | undefined;
  _video: Artifact | null = null;
  _opener: Page | undefined;
  private _isServerSideOnly = false;

  // Aiming at 25 fps by default - each frame is 40ms, but we give some slack with 35ms.
  // When throttling for tracing, 200ms between frames, except for 10 frames around the action.
  private _frameThrottler = new FrameThrottler(10, 35, 200);

  constructor(delegate: PageDelegate, browserContext: BrowserContext) {
    super(browserContext, 'page');
    this.attribution.page = this;
    this._delegate = delegate;
    this._browserContext = browserContext;
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
  }

  async initOpener(opener: PageDelegate | null) {
    if (!opener)
      return;
    const openerPage = await opener.pageOrError();
    if (openerPage instanceof Page && !openerPage.isClosed())
      this._opener = openerPage;
  }

  reportAsNew(error: Error | undefined = undefined, contextEvent: string = BrowserContext.Events.Page) {
    if (error) {
      // Initialization error could have happened because of
      // context/browser closure. Just ignore the page.
      if (this._browserContext.isClosingOrClosed())
        return;
      this._setIsError(error);
    }
    this._initialized = true;
    this.emitOnContext(contextEvent, this);
    // I may happen that page initialization finishes after Close event has already been sent,
    // in that case we fire another Close event to ensure that each reported Page will have
    // corresponding Close event after it is reported on the context.
    if (this.isClosed())
      this.emit(Page.Events.Close);
    this.instrumentation.onPageOpen(this);
  }

  initializedOrUndefined() {
    return this._initialized ? this : undefined;
  }

  emitOnContext(event: string | symbol, ...args: any[]) {
    if (this._isServerSideOnly)
      return;
    this._browserContext.emit(event, ...args);
  }

  async resetForReuse(metadata: CallMetadata) {
    this.setDefaultNavigationTimeout(undefined);
    this.setDefaultTimeout(undefined);

    await this._removeExposedBindings();
    await this._removeInitScripts();
    await this.setClientRequestInterceptor(undefined);
    await this._setServerRequestInterceptor(undefined);
    await this.setFileChooserIntercepted(false);
    // Re-navigate once init scripts are gone.
    await this.mainFrame().goto(metadata, 'about:blank');
    this._emulatedSize = undefined;
    this._emulatedMedia = {};
    this._extraHTTPHeaders = undefined;
    this._interceptFileChooser = false;

    await Promise.all([
      this._delegate.updateEmulatedViewportSize(),
      this._delegate.updateEmulateMedia(),
      this._delegate.updateFileChooserInterception(),
    ]);
  }

  _didClose() {
    this._frameManager.dispose();
    this._frameThrottler.dispose();
    assert(this._closedState !== 'closed', 'Page closed twice');
    this._closedState = 'closed';
    this.emit(Page.Events.Close);
    this._closedPromise.resolve();
    this.instrumentation.onPageClose(this);
  }

  _didCrash() {
    this._frameManager.dispose();
    this._frameThrottler.dispose();
    this.emit(Page.Events.Crash);
    this._crashedPromise.resolve(new Error('Page crashed'));
    this.instrumentation.onPageClose(this);
  }

  _didDisconnect() {
    this._frameManager.dispose();
    this._frameThrottler.dispose();
    assert(!this._disconnected, 'Page disconnected twice');
    this._disconnected = true;
    this._disconnectedPromise.resolve(new Error('Page closed'));
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

  setDefaultNavigationTimeout(timeout: number | undefined) {
    this._timeoutSettings.setDefaultNavigationTimeout(timeout);
  }

  setDefaultTimeout(timeout: number | undefined) {
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

  async _removeExposedBindings() {
    for (const key of this._pageBindings.keys()) {
      if (!key.startsWith('__pw'))
        this._pageBindings.delete(key);
    }
    await this._delegate.removeExposedBindings();
  }

  setExtraHTTPHeaders(headers: types.HeadersArray) {
    this._extraHTTPHeaders = headers;
    return this._delegate.updateExtraHTTPHeaders();
  }

  extraHTTPHeaders(): types.HeadersArray | undefined {
    return this._extraHTTPHeaders;
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
    return controller.run(progress => this.mainFrame().raceNavigationAction(progress, options, async () => {
      // Note: waitForNavigation may fail before we get response to reload(),
      // so we should await it immediately.
      const [response] = await Promise.all([
        // Reload must be a new document, and should not be confused with a stray pushState.
        this.mainFrame()._waitForNavigation(progress, true /* requiresNewDocument */, options),
        this._delegate.reload(),
      ]);
      return response;
    }), this._timeoutSettings.navigationTimeout(options));
  }

  async goBack(metadata: CallMetadata, options: types.NavigateOptions): Promise<network.Response | null> {
    const controller = new ProgressController(metadata, this);
    return controller.run(progress => this.mainFrame().raceNavigationAction(progress, options, async () => {
      // Note: waitForNavigation may fail before we get response to goBack,
      // so we should catch it immediately.
      let error: Error | undefined;
      const waitPromise = this.mainFrame()._waitForNavigation(progress, false /* requiresNewDocument */, options).catch(e => {
        error = e;
        return null;
      });
      const result = await this._delegate.goBack();
      if (!result)
        return null;
      const response = await waitPromise;
      if (error)
        throw error;
      return response;
    }), this._timeoutSettings.navigationTimeout(options));
  }

  async goForward(metadata: CallMetadata, options: types.NavigateOptions): Promise<network.Response | null> {
    const controller = new ProgressController(metadata, this);
    return controller.run(progress => this.mainFrame().raceNavigationAction(progress, options, async () => {
      // Note: waitForNavigation may fail before we get response to goForward,
      // so we should catch it immediately.
      let error: Error | undefined;
      const waitPromise = this.mainFrame()._waitForNavigation(progress, false /* requiresNewDocument */, options).catch(e => {
        error = e;
        return null;
      });
      const result = await this._delegate.goForward();
      if (!result)
        return null;
      const response = await waitPromise;
      if (error)
        throw error;
      return response;
    }), this._timeoutSettings.navigationTimeout(options));
  }

  async emulateMedia(options: Partial<EmulatedMedia>) {
    if (options.media !== undefined)
      this._emulatedMedia.media = options.media;
    if (options.colorScheme !== undefined)
      this._emulatedMedia.colorScheme = options.colorScheme;
    if (options.reducedMotion !== undefined)
      this._emulatedMedia.reducedMotion = options.reducedMotion;
    if (options.forcedColors !== undefined)
      this._emulatedMedia.forcedColors = options.forcedColors;

    await this._delegate.updateEmulateMedia();
  }

  emulatedMedia(): EmulatedMedia {
    const contextOptions = this._browserContext._options;
    return {
      media: this._emulatedMedia.media || 'no-override',
      colorScheme: this._emulatedMedia.colorScheme !== undefined ? this._emulatedMedia.colorScheme : contextOptions.colorScheme ?? 'light',
      reducedMotion: this._emulatedMedia.reducedMotion !== undefined ? this._emulatedMedia.reducedMotion : contextOptions.reducedMotion ?? 'no-preference',
      forcedColors: this._emulatedMedia.forcedColors !== undefined ? this._emulatedMedia.forcedColors : contextOptions.forcedColors ?? 'none',
    };
  }

  async setViewportSize(viewportSize: types.Size) {
    this._emulatedSize = { viewport: { ...viewportSize }, screen: { ...viewportSize } };
    await this._delegate.updateEmulatedViewportSize();
  }

  viewportSize(): types.Size | null {
    return this.emulatedSize()?.viewport || null;
  }

  emulatedSize(): EmulatedSize | null {
    if (this._emulatedSize)
      return this._emulatedSize;
    const contextOptions = this._browserContext._options;
    return contextOptions.viewport ? { viewport: contextOptions.viewport, screen: contextOptions.screen || contextOptions.viewport } : null;
  }

  async bringToFront(): Promise<void> {
    await this._delegate.bringToFront();
  }

  async addInitScript(source: string) {
    this.initScripts.push(source);
    await this._delegate.addInitScript(source);
  }

  async _removeInitScripts() {
    this.initScripts.splice(0, this.initScripts.length);
    await this._delegate.removeInitScripts();
  }

  needsRequestInterception(): boolean {
    return !!this._clientRequestInterceptor || !!this._serverRequestInterceptor || !!this._browserContext._requestInterceptor;
  }

  async setClientRequestInterceptor(handler: network.RouteHandler | undefined): Promise<void> {
    this._clientRequestInterceptor = handler;
    await this._delegate.updateRequestInterception();
  }

  async _setServerRequestInterceptor(handler: network.RouteHandler | undefined): Promise<void> {
    this._serverRequestInterceptor = handler;
    await this._delegate.updateRequestInterception();
  }

  async expectScreenshot(metadata: CallMetadata, options: ExpectScreenshotOptions = {}): Promise<{ actual?: Buffer, previous?: Buffer, diff?: Buffer, errorMessage?: string, log?: string[] }> {
    const locator = options.locator;
    const rafrafScreenshot = locator ? async (progress: Progress, timeout: number) => {
      return await locator.frame.rafrafTimeoutScreenshotElementWithProgress(progress, locator.selector, timeout, options.screenshotOptions || {});
    } : async (progress: Progress, timeout: number) => {
      await this.mainFrame().rafrafTimeout(timeout);
      return await this._screenshotter.screenshotPage(progress, options.screenshotOptions || {});
    };

    const comparator = getComparator('image/png');
    const controller = new ProgressController(metadata, this);
    if (!options.expected && options.isNot)
      return { errorMessage: '"not" matcher requires expected result' };
    try {
      const format = validateScreenshotOptions(options.screenshotOptions || {});
      if (format !== 'png')
        throw new Error('Only PNG screenshots are supported');
    } catch (error) {
      return { errorMessage: error.message };
    }
    let intermediateResult: {
      actual?: Buffer,
      previous?: Buffer,
      errorMessage: string,
      diff?: Buffer,
    } | undefined = undefined;
    const areEqualScreenshots = (actual: Buffer | undefined, expected: Buffer | undefined, previous: Buffer | undefined) => {
      const comparatorResult = actual && expected ? comparator(actual, expected, options.comparatorOptions) : undefined;
      if (comparatorResult !== undefined && !!comparatorResult === !!options.isNot)
        return true;
      if (comparatorResult)
        intermediateResult = { errorMessage: comparatorResult.errorMessage, diff: comparatorResult.diff, actual, previous };
      return false;
    };
    const callTimeout = this._timeoutSettings.timeout(options);
    return controller.run(async progress => {
      let actual: Buffer | undefined;
      let previous: Buffer | undefined;
      const pollIntervals = [0, 100, 250, 500];
      progress.log(`${metadata.apiName}${callTimeout ? ` with timeout ${callTimeout}ms` : ''}`);
      if (options.expected)
        progress.log(`  verifying given screenshot expectation`);
      else
        progress.log(`  generating new stable screenshot expectation`);
      let isFirstIteration = true;
      while (true) {
        progress.throwIfAborted();
        if (this.isClosed())
          throw new Error('The page has closed');
        const screenshotTimeout = pollIntervals.shift() ?? 1000;
        if (screenshotTimeout)
          progress.log(`waiting ${screenshotTimeout}ms before taking screenshot`);
        previous = actual;
        actual = await rafrafScreenshot(progress, screenshotTimeout).catch(e => {
          progress.log(`failed to take screenshot - ` + e.message);
          return undefined;
        });
        if (!actual)
          continue;
        // Compare against expectation for the first iteration.
        const expectation = options.expected && isFirstIteration ? options.expected : previous;
        if (areEqualScreenshots(actual, expectation, previous))
          break;
        if (intermediateResult)
          progress.log(intermediateResult.errorMessage);
        isFirstIteration = false;
      }

      if (!isFirstIteration)
        progress.log(`captured a stable screenshot`);

      if (!options.expected)
        return { actual };

      if (isFirstIteration) {
        progress.log(`screenshot matched expectation`);
        return {};
      }

      if (areEqualScreenshots(actual, options.expected, previous)) {
        progress.log(`screenshot matched expectation`);
        return {};
      }
      throw new Error(intermediateResult!.errorMessage);
    }, callTimeout).catch(e => {
      // Q: Why not throw upon isSessionClosedError(e) as in other places?
      // A: We want user to receive a friendly diff between actual and expected/previous.
      if (js.isJavaScriptErrorInEvaluate(e) || isInvalidSelectorError(e))
        throw e;
      return {
        log: e.message ? [...metadata.log, e.message] : metadata.log,
        ...intermediateResult,
        errorMessage: e.message,
      };
    });
  }

  async screenshot(metadata: CallMetadata, options: ScreenshotOptions & TimeoutOptions = {}): Promise<Buffer> {
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
      assert(!this._disconnected, 'Target closed');
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
    this._frameManager.createDummyMainFrameIfNeeded();
  }

  isClosed(): boolean {
    return this._closedState === 'closed';
  }

  isClosedOrClosingOrCrashed() {
    return this._closedState !== 'open' || this._crashedPromise.isDone();
  }

  _addWorker(workerId: string, worker: Worker) {
    this._workers.set(workerId, worker);
    this.emit(Page.Events.Worker, worker);
  }

  _removeWorker(workerId: string) {
    const worker = this._workers.get(workerId);
    if (!worker)
      return;
    worker.didClose();
    this._workers.delete(workerId);
  }

  _clearWorkers() {
    for (const [workerId, worker] of this._workers) {
      worker.didClose();
      this._workers.delete(workerId);
    }
  }

  async setFileChooserIntercepted(enabled: boolean): Promise<void> {
    this._interceptFileChooser = enabled;
    await this._delegate.updateFileChooserInterception();
  }

  fileChooserIntercepted() {
    return this._interceptFileChooser;
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

  getBinding(name: string) {
    return this._pageBindings.get(name) || this._browserContext._pageBindings.get(name);
  }

  setScreencastOptions(options: { width: number, height: number, quality: number } | null) {
    this._delegate.setScreencastOptions(options).catch(e => debugLogger.log('error', e));
    this._frameThrottler.setThrottlingEnabled(!!options);
  }

  throttleScreencastFrameAck(ack: () => void) {
    // Don't ack immediately, tracing has smart throttling logic that is implemented here.
    this._frameThrottler.ack(ack);
  }

  temporarlyDisableTracingScreencastThrottling() {
    this._frameThrottler.recharge();
  }

  firePageError(error: Error) {
    this.emit(Page.Events.PageError, error);
  }

  async hideHighlight() {
    await Promise.all(this.frames().map(frame => frame.hideHighlight().catch(() => {})));
  }

  markAsServerSideOnly() {
    this._isServerSideOnly = true;
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

  didClose() {
    if (this._existingExecutionContext)
      this._existingExecutionContext.contextDestroyed(new Error('Worker was closed'));
    this.emit(Worker.Events.Close, this);
  }

  async evaluateExpression(expression: string, isFunction: boolean | undefined, arg: any): Promise<any> {
    return js.evaluateExpression(await this._executionContextPromise, expression, { returnByValue: true, isFunction }, arg);
  }

  async evaluateExpressionHandle(expression: string, isFunction: boolean | undefined, arg: any): Promise<any> {
    return js.evaluateExpression(await this._executionContextPromise, expression, { returnByValue: false, isFunction }, arg);
  }
}

type BindingPayload = {
  name: string;
  seq: number;
  serializedArgs?: SerializedValue[],
};

export class PageBinding {
  readonly name: string;
  readonly playwrightFunction: frames.FunctionWithSource;
  readonly source: string;
  readonly needsHandle: boolean;

  constructor(name: string, playwrightFunction: frames.FunctionWithSource, needsHandle: boolean) {
    this.name = name;
    this.playwrightFunction = playwrightFunction;
    this.source = `(${addPageBinding.toString()})(${JSON.stringify(name)}, ${needsHandle}, (${source})())`;
    this.needsHandle = needsHandle;
  }

  static async dispatch(page: Page, payload: string, context: dom.FrameExecutionContext) {
    const { name, seq, serializedArgs } = JSON.parse(payload) as BindingPayload;
    try {
      assert(context.world);
      const binding = page.getBinding(name)!;
      let result: any;
      if (binding.needsHandle) {
        const handle = await context.evaluateHandle(takeHandle, { name, seq }).catch(e => null);
        result = await binding.playwrightFunction({ frame: context.frame, page, context: page._browserContext }, handle);
      } else {
        const args = serializedArgs!.map(a => parseEvaluationResultValue(a));
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

function addPageBinding(bindingName: string, needsHandle: boolean, utilityScriptSerializers: ReturnType<typeof source>) {
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
    const seq: number = (me['lastSeq'] || 0) + 1;
    me['lastSeq'] = seq;
    let handles = me['handles'];
    if (!handles) {
      handles = new Map();
      me['handles'] = handles;
    }
    const promise = new Promise((resolve, reject) => callbacks.set(seq, { resolve, reject }));
    let payload: BindingPayload;
    if (needsHandle) {
      handles.set(seq, args[0]);
      payload = { name: bindingName, seq };
    } else {
      const serializedArgs = args.map(a => utilityScriptSerializers.serializeAsCallArgument(a, v => {
        return { fallThrough: v };
      }));
      payload = { name: bindingName, seq, serializedArgs };
    }
    binding(JSON.stringify(payload));
    return promise;
  };
  (globalThis as any)[bindingName].__installed = true;
}

class FrameThrottler {
  private _acks: (() => void)[] = [];
  private _defaultInterval: number;
  private _throttlingInterval: number;
  private _nonThrottledFrames: number;
  private _budget: number;
  private _throttlingEnabled = false;
  private _timeoutId: NodeJS.Timeout | undefined;

  constructor(nonThrottledFrames: number, defaultInterval: number, throttlingInterval: number) {
    this._nonThrottledFrames = nonThrottledFrames;
    this._budget = nonThrottledFrames;
    this._defaultInterval = defaultInterval;
    this._throttlingInterval = throttlingInterval;
    this._tick();
  }

  dispose() {
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = undefined;
    }
  }

  setThrottlingEnabled(enabled: boolean) {
    this._throttlingEnabled = enabled;
  }

  recharge() {
    // Send all acks, reset budget.
    for (const ack of this._acks)
      ack();
    this._acks = [];
    this._budget = this._nonThrottledFrames;
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._tick();
    }
  }

  ack(ack: () => void) {
    if (!this._timeoutId) {
      // Already disposed.
      ack();
      return;
    }
    this._acks.push(ack);
  }

  private _tick() {
    const ack = this._acks.shift();
    if (ack) {
      --this._budget;
      ack();
    }

    if (this._throttlingEnabled && this._budget <= 0) {
      // Non-throttled frame budget is exceeded. Next ack will be throttled.
      this._timeoutId = setTimeout(() => this._tick(), this._throttlingInterval);
    } else {
      // Either not throttling, or still under budget. Next ack will be after the default timeout.
      this._timeoutId = setTimeout(() => this._tick(), this._defaultInterval);
    }
  }
}
