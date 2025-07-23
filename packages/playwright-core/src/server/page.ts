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

import * as accessibility from './accessibility';
import { BrowserContext } from './browserContext';
import { ConsoleMessage } from './console';
import { TargetClosedError, TimeoutError } from './errors';
import { FileChooser } from './fileChooser';
import * as frames from './frames';
import { helper } from './helper';
import * as input from './input';
import { SdkObject } from './instrumentation';
import * as js from './javascript';
import { Screenshotter, validateScreenshotOptions } from './screenshotter';
import { LongStandingScope, assert, renderTitleForCall, trimStringWithEllipsis } from '../utils';
import { asLocator } from '../utils';
import { getComparator } from './utils/comparators';
import { debugLogger } from './utils/debugLogger';
import { isInvalidSelectorError } from '../utils/isomorphic/selectorParser';
import { ManualPromise } from '../utils/isomorphic/manualPromise';
import { parseEvaluationResultValue } from '../utils/isomorphic/utilityScriptSerializers';
import { compressCallLog } from './callLog';
import * as rawBindingsControllerSource from '../generated/bindingsControllerSource';

import type { Artifact } from './artifact';
import type * as dom from './dom';
import type * as network from './network';
import type { Progress } from './progress';
import type { ScreenshotOptions } from './screenshotter';
import type * as types from './types';
import type { ImageComparatorOptions } from './utils/comparators';
import type * as channels from '@protocol/channels';
import type { BindingPayload } from '@injected/bindingsController';

export interface PageDelegate {
  readonly rawMouse: input.RawMouse;
  readonly rawKeyboard: input.RawKeyboard;
  readonly rawTouchscreen: input.RawTouchscreen;

  reload(): Promise<void>;
  goBack(): Promise<boolean>;
  goForward(): Promise<boolean>;
  requestGC(): Promise<void>;
  addInitScript(initScript: InitScript): Promise<void>;
  removeInitScripts(initScripts: InitScript[]): Promise<void>;
  closePage(runBeforeUnload: boolean): Promise<void>;

  navigateFrame(frame: frames.Frame, url: string, referrer: string | undefined): Promise<frames.GotoResult>;

  updateExtraHTTPHeaders(): Promise<void>;
  updateEmulatedViewportSize(preserveWindowBoundaries?: boolean): Promise<void>;
  updateEmulateMedia(): Promise<void>;
  updateRequestInterception(): Promise<void>;
  updateFileChooserInterception(): Promise<void>;
  bringToFront(): Promise<void>;

  setBackgroundColor(color?: { r: number; g: number; b: number; a: number; }): Promise<void>;
  takeScreenshot(progress: Progress, format: string, documentRect: types.Rect | undefined, viewportRect: types.Rect | undefined, quality: number | undefined, fitsViewport: boolean, scale: 'css' | 'device'): Promise<Buffer>;

  adoptElementHandle<T extends Node>(handle: dom.ElementHandle<T>, to: dom.FrameExecutionContext): Promise<dom.ElementHandle<T>>;
  getContentFrame(handle: dom.ElementHandle): Promise<frames.Frame | null>;  // Only called for frame owner elements.
  getOwnerFrame(handle: dom.ElementHandle): Promise<string | null>; // Returns frameId.
  getContentQuads(handle: dom.ElementHandle): Promise<types.Quad[] | null | 'error:notconnected'>;
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
  readonly cspErrorsAsynchronousForInlineScripts?: boolean;
  // Work around for mouse position in Firefox.
  resetForReuse(progress: Progress): Promise<void>;
  // WebKit hack.
  shouldToggleStyleSheetToSyncAnimations(): boolean;
}

type EmulatedSize = { screen: types.Size, viewport: types.Size };

type EmulatedMedia = {
  media: types.MediaType;
  colorScheme: types.ColorScheme;
  reducedMotion: types.ReducedMotion;
  forcedColors: types.ForcedColors;
  contrast: types.Contrast;
};

type ExpectScreenshotOptions = ImageComparatorOptions & ScreenshotOptions & {
  timeout: number,
  expected?: Buffer,
  isNot?: boolean,
  locator?: {
    frame: frames.Frame,
    selector: string,
  },
};

export class Page extends SdkObject {
  static Events = {
    Close: 'close',
    Crash: 'crash',
    Download: 'download',
    EmulatedSizeChanged: 'emulatedsizechanged',
    FileChooser: 'filechooser',
    FrameAttached: 'frameattached',
    FrameDetached: 'framedetached',
    InternalFrameNavigatedToNewDocument: 'internalframenavigatedtonewdocument',
    LocatorHandlerTriggered: 'locatorhandlertriggered',
    ScreencastFrame: 'screencastframe',
    Video: 'video',
    WebSocket: 'websocket',
    Worker: 'worker',
  };

  private _closedState: 'open' | 'closing' | 'closed' = 'open';
  private _closedPromise = new ManualPromise<void>();
  private _initialized: Page | Error | undefined;
  private _initializedPromise = new ManualPromise<Page | Error>();
  private _eventsToEmitAfterInitialized: { event: string | symbol, args: any[] }[] = [];
  private _crashed = false;
  readonly openScope = new LongStandingScope();
  readonly browserContext: BrowserContext;
  readonly keyboard: input.Keyboard;
  readonly mouse: input.Mouse;
  readonly touchscreen: input.Touchscreen;
  readonly delegate: PageDelegate;
  private _emulatedSize: EmulatedSize | undefined;
  private _extraHTTPHeaders: types.HeadersArray | undefined;
  private _emulatedMedia: Partial<EmulatedMedia> = {};
  private _fileChooserInterceptedBy = new Set<any>();
  private readonly _pageBindings = new Map<string, PageBinding>();
  initScripts: InitScript[] = [];
  readonly screenshotter: Screenshotter;
  readonly frameManager: frames.FrameManager;
  readonly accessibility: accessibility.Accessibility;
  private _workers = new Map<string, Worker>();
  readonly pdf: ((options: channels.PagePdfParams) => Promise<Buffer>) | undefined;
  readonly coverage: any;
  readonly requestInterceptors: network.RouteHandler[] = [];
  video: Artifact | null = null;
  private _opener: Page | undefined;
  private _isServerSideOnly = false;
  private _locatorHandlers = new Map<number, { selector: string, noWaitAfter?: boolean, resolved?: ManualPromise<void> }>();
  private _lastLocatorHandlerUid = 0;
  private _locatorHandlerRunningCounter = 0;

  // Aiming at 25 fps by default - each frame is 40ms, but we give some slack with 35ms.
  // When throttling for tracing, 200ms between frames, except for 10 frames around the action.
  private _frameThrottler = new FrameThrottler(10, 35, 200);
  closeReason: string | undefined;
  lastSnapshotFrameIds: string[] = [];

  constructor(delegate: PageDelegate, browserContext: BrowserContext) {
    super(browserContext, 'page');
    this.attribution.page = this;
    this.delegate = delegate;
    this.browserContext = browserContext;
    this.accessibility = new accessibility.Accessibility(delegate.getAccessibilityTree.bind(delegate));
    this.keyboard = new input.Keyboard(delegate.rawKeyboard, this);
    this.mouse = new input.Mouse(delegate.rawMouse, this);
    this.touchscreen = new input.Touchscreen(delegate.rawTouchscreen, this);
    this.screenshotter = new Screenshotter(this);
    this.frameManager = new frames.FrameManager(this);
    if (delegate.pdf)
      this.pdf = delegate.pdf.bind(delegate);
    this.coverage = delegate.coverage ? delegate.coverage() : null;
  }

  async reportAsNew(opener: Page | undefined, error: Error | undefined = undefined, contextEvent: string = BrowserContext.Events.Page) {
    if (opener) {
      const openerPageOrError = await opener.waitForInitializedOrError();
      if (openerPageOrError instanceof Page && !openerPageOrError.isClosed())
        this._opener = openerPageOrError;
    }
    this._markInitialized(error, contextEvent);
  }

  private _markInitialized(error: Error | undefined = undefined, contextEvent: string = BrowserContext.Events.Page) {
    if (error) {
      // Initialization error could have happened because of
      // context/browser closure. Just ignore the page.
      if (this.browserContext.isClosingOrClosed())
        return;
      this.frameManager.createDummyMainFrameIfNeeded();
    }
    this._initialized = error || this;
    this.emitOnContext(contextEvent, this);

    for (const { event, args } of this._eventsToEmitAfterInitialized)
      this.browserContext.emit(event, ...args);
    this._eventsToEmitAfterInitialized = [];

    // It may happen that page initialization finishes after Close event has already been sent,
    // in that case we fire another Close event to ensure that each reported Page will have
    // corresponding Close event after it is reported on the context.
    if (this.isClosed())
      this.emit(Page.Events.Close);
    else
      this.instrumentation.onPageOpen(this);

    // Note: it is important to resolve _initializedPromise at the end,
    // so that anyone who awaits waitForInitializedOrError got a ready and reported page.
    this._initializedPromise.resolve(this._initialized);
  }

  initializedOrUndefined(): Page | undefined {
    return this._initialized ? this : undefined;
  }

  waitForInitializedOrError(): Promise<Page | Error> {
    return this._initializedPromise;
  }

  emitOnContext(event: string | symbol, ...args: any[]) {
    if (this._isServerSideOnly)
      return;
    this.browserContext.emit(event, ...args);
  }

  emitOnContextOnceInitialized(event: string | symbol, ...args: any[]) {
    if (this._isServerSideOnly)
      return;
    // Some events, like console messages, may come before page is ready.
    // In this case, postpone the event until page is initialized,
    // and dispatch it to the client later, either on the live Page,
    // or on the "errored" Page.
    if (this._initialized)
      this.browserContext.emit(event, ...args);
    else
      this._eventsToEmitAfterInitialized.push({ event, args });
  }

  async resetForReuse(progress: Progress) {
    // Re-navigate once init scripts are gone.
    await this.mainFrame().gotoImpl(progress, 'about:blank', {});

    this._emulatedSize = undefined;
    this._emulatedMedia = {};
    this._extraHTTPHeaders = undefined;
    await Promise.all([
      this.delegate.updateEmulatedViewportSize(),
      this.delegate.updateEmulateMedia(),
      this.delegate.updateExtraHTTPHeaders(),
    ]);

    await this.delegate.resetForReuse(progress);
  }

  _didClose() {
    this.frameManager.dispose();
    this._frameThrottler.dispose();
    assert(this._closedState !== 'closed', 'Page closed twice');
    this._closedState = 'closed';
    this.emit(Page.Events.Close);
    this._closedPromise.resolve();
    this.instrumentation.onPageClose(this);
    this.openScope.close(new TargetClosedError());
  }

  _didCrash() {
    this.frameManager.dispose();
    this._frameThrottler.dispose();
    this.emit(Page.Events.Crash);
    this._crashed = true;
    this.instrumentation.onPageClose(this);
    this.openScope.close(new Error('Page crashed'));
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

  opener(): Page | undefined {
    return this._opener;
  }

  mainFrame(): frames.Frame {
    return this.frameManager.mainFrame();
  }

  frames(): frames.Frame[] {
    return this.frameManager.frames();
  }

  async exposeBinding(progress: Progress, name: string, needsHandle: boolean, playwrightBinding: frames.FunctionWithSource): Promise<PageBinding> {
    if (this._pageBindings.has(name))
      throw new Error(`Function "${name}" has been already registered`);
    if (this.browserContext._pageBindings.has(name))
      throw new Error(`Function "${name}" has been already registered in the browser context`);
    await progress.race(this.browserContext.exposePlaywrightBindingIfNeeded());
    const binding = new PageBinding(name, playwrightBinding, needsHandle);
    this._pageBindings.set(name, binding);
    progress.cleanupWhenAborted(() => this._pageBindings.delete(name));
    await progress.race(this.delegate.addInitScript(binding.initScript));
    await progress.race(this.safeNonStallingEvaluateInAllFrames(binding.initScript.source, 'main'));
    return binding;
  }

  async removeExposedBindings(bindings: PageBinding[]) {
    bindings = bindings.filter(binding => this._pageBindings.get(binding.name) === binding);
    for (const binding of bindings)
      this._pageBindings.delete(binding.name);
    await this.delegate.removeInitScripts(bindings.map(binding => binding.initScript));
    const cleanup = bindings.map(binding => `{ ${binding.cleanupScript} };\n`).join('');
    await this.safeNonStallingEvaluateInAllFrames(cleanup, 'main');
  }

  async setExtraHTTPHeaders(progress: Progress, headers: types.HeadersArray) {
    const oldHeaders = this._extraHTTPHeaders;
    this._extraHTTPHeaders = headers;
    progress.cleanupWhenAborted(async () => {
      this._extraHTTPHeaders = oldHeaders;
      await this.delegate.updateExtraHTTPHeaders();
    });
    await progress.race(this.delegate.updateExtraHTTPHeaders());
  }

  extraHTTPHeaders(): types.HeadersArray | undefined {
    return this._extraHTTPHeaders;
  }

  async onBindingCalled(payload: string, context: dom.FrameExecutionContext) {
    if (this._closedState === 'closed')
      return;
    await PageBinding.dispatch(this, payload, context);
  }

  addConsoleMessage(type: string, args: js.JSHandle[], location: types.ConsoleMessageLocation, text?: string) {
    const message = new ConsoleMessage(this, type, text, args, location);
    const intercepted = this.frameManager.interceptConsoleMessage(message);
    if (intercepted) {
      args.forEach(arg => arg.dispose());
      return;
    }
    this.emitOnContextOnceInitialized(BrowserContext.Events.Console, message);
  }

  async reload(progress: Progress, options: types.NavigateOptions): Promise<network.Response | null> {
    return this.mainFrame().raceNavigationAction(progress, async () => {
      // Note: waitForNavigation may fail before we get response to reload(),
      // so we should await it immediately.
      const [response] = await Promise.all([
        // Reload must be a new document, and should not be confused with a stray pushState.
        this.mainFrame()._waitForNavigation(progress, true /* requiresNewDocument */, options),
        progress.race(this.delegate.reload()),
      ]);
      return response;
    });
  }

  async goBack(progress: Progress, options: types.NavigateOptions): Promise<network.Response | null> {
    return this.mainFrame().raceNavigationAction(progress, async () => {
      // Note: waitForNavigation may fail before we get response to goBack,
      // so we should catch it immediately.
      let error: Error | undefined;
      const waitPromise = this.mainFrame()._waitForNavigation(progress, false /* requiresNewDocument */, options).catch(e => {
        error = e;
        return null;
      });
      const result = await progress.race(this.delegate.goBack());
      if (!result) {
        waitPromise.catch(() => {}); // Avoid an unhandled rejection.
        return null;
      }
      const response = await waitPromise;
      if (error)
        throw error;
      return response;
    });
  }

  async goForward(progress: Progress, options: types.NavigateOptions): Promise<network.Response | null> {
    return this.mainFrame().raceNavigationAction(progress, async () => {
      // Note: waitForNavigation may fail before we get response to goForward,
      // so we should catch it immediately.
      let error: Error | undefined;
      const waitPromise = this.mainFrame()._waitForNavigation(progress, false /* requiresNewDocument */, options).catch(e => {
        error = e;
        return null;
      });
      const result = await progress.race(this.delegate.goForward());
      if (!result) {
        waitPromise.catch(() => {}); // Avoid an unhandled rejection.
        return null;
      }
      const response = await waitPromise;
      if (error)
        throw error;
      return response;
    });
  }

  requestGC(): Promise<void> {
    return this.delegate.requestGC();
  }

  registerLocatorHandler(selector: string, noWaitAfter: boolean | undefined) {
    const uid = ++this._lastLocatorHandlerUid;
    this._locatorHandlers.set(uid, { selector, noWaitAfter });
    return uid;
  }

  resolveLocatorHandler(uid: number, remove: boolean | undefined) {
    const handler = this._locatorHandlers.get(uid);
    if (remove)
      this._locatorHandlers.delete(uid);
    if (handler) {
      handler.resolved?.resolve();
      handler.resolved = undefined;
    }
  }

  unregisterLocatorHandler(uid: number) {
    this._locatorHandlers.delete(uid);
  }

  async performActionPreChecks(progress: Progress) {
    await this._performWaitForNavigationCheck(progress);
    await this._performLocatorHandlersCheckpoint(progress);
    // Wait once again, just in case a locator handler caused a navigation.
    await this._performWaitForNavigationCheck(progress);
  }

  private async _performWaitForNavigationCheck(progress: Progress) {
    const mainFrame = this.frameManager.mainFrame();
    if (!mainFrame || !mainFrame.pendingDocument())
      return;
    const url = mainFrame.pendingDocument()?.request?.url();
    const toUrl = url ? `" ${trimStringWithEllipsis(url, 200)}"` : '';
    progress.log(`  waiting for${toUrl} navigation to finish...`);
    await helper.waitForEvent(progress, mainFrame, frames.Frame.Events.InternalNavigation, (e: frames.NavigationEvent) => {
      if (!e.isPublic)
        return false;
      if (!e.error)
        progress.log(`  navigated to "${trimStringWithEllipsis(mainFrame.url(), 200)}"`);
      return true;
    }).promise;
  }

  private async _performLocatorHandlersCheckpoint(progress: Progress) {
    // Do not run locator handlers from inside locator handler callbacks to avoid deadlocks.
    if (this._locatorHandlerRunningCounter)
      return;
    for (const [uid, handler] of this._locatorHandlers) {
      if (!handler.resolved) {
        if (await this.mainFrame().isVisibleInternal(progress, handler.selector, { strict: true })) {
          handler.resolved = new ManualPromise();
          this.emit(Page.Events.LocatorHandlerTriggered, uid);
        }
      }
      if (handler.resolved) {
        ++this._locatorHandlerRunningCounter;
        progress.log(`  found ${asLocator(this.browserContext._browser.sdkLanguage(), handler.selector)}, intercepting action to run the handler`);
        const promise = handler.resolved.then(async () => {
          if (!handler.noWaitAfter) {
            progress.log(`  locator handler has finished, waiting for ${asLocator(this.browserContext._browser.sdkLanguage(), handler.selector)} to be hidden`);
            await this.mainFrame().waitForSelector(progress, handler.selector, false, { state: 'hidden' });
          } else {
            progress.log(`  locator handler has finished`);
          }
        });
        await progress.race(this.openScope.race(promise)).finally(() => --this._locatorHandlerRunningCounter);
        progress.log(`  interception handler has finished, continuing`);
      }
    }
  }

  async emulateMedia(progress: Progress, options: Partial<EmulatedMedia>) {
    const oldEmulatedMedia = { ...this._emulatedMedia };
    progress.cleanupWhenAborted(async () => {
      this._emulatedMedia = oldEmulatedMedia;
      await this.delegate.updateEmulateMedia();
    });

    if (options.media !== undefined)
      this._emulatedMedia.media = options.media;
    if (options.colorScheme !== undefined)
      this._emulatedMedia.colorScheme = options.colorScheme;
    if (options.reducedMotion !== undefined)
      this._emulatedMedia.reducedMotion = options.reducedMotion;
    if (options.forcedColors !== undefined)
      this._emulatedMedia.forcedColors = options.forcedColors;
    if (options.contrast !== undefined)
      this._emulatedMedia.contrast = options.contrast;

    await progress.race(this.delegate.updateEmulateMedia());
  }

  emulatedMedia(): EmulatedMedia {
    const contextOptions = this.browserContext._options;
    return {
      media: this._emulatedMedia.media || 'no-override',
      colorScheme: this._emulatedMedia.colorScheme !== undefined ? this._emulatedMedia.colorScheme : contextOptions.colorScheme ?? 'light',
      reducedMotion: this._emulatedMedia.reducedMotion !== undefined ? this._emulatedMedia.reducedMotion : contextOptions.reducedMotion ?? 'no-preference',
      forcedColors: this._emulatedMedia.forcedColors !== undefined ? this._emulatedMedia.forcedColors : contextOptions.forcedColors ?? 'none',
      contrast: this._emulatedMedia.contrast !== undefined ? this._emulatedMedia.contrast : contextOptions.contrast ?? 'no-preference',
    };
  }

  async setViewportSize(progress: Progress, viewportSize: types.Size) {
    const oldEmulatedSize = this._emulatedSize;
    progress.cleanupWhenAborted(async () => {
      this._emulatedSize = oldEmulatedSize;
      await this.delegate.updateEmulatedViewportSize();
    });

    this._setEmulatedSize({ viewport: { ...viewportSize }, screen: { ...viewportSize } });
    await progress.race(this.delegate.updateEmulatedViewportSize());
  }

  setEmulatedSizeFromWindowOpen(emulatedSize: EmulatedSize) {
    this._setEmulatedSize(emulatedSize);
  }

  private _setEmulatedSize(emulatedSize: EmulatedSize) {
    this._emulatedSize = emulatedSize;
    this.emit(Page.Events.EmulatedSizeChanged);
  }

  emulatedSize(): EmulatedSize | undefined {
    if (this._emulatedSize)
      return this._emulatedSize;
    const contextOptions = this.browserContext._options;
    return contextOptions.viewport ? { viewport: contextOptions.viewport, screen: contextOptions.screen || contextOptions.viewport } : undefined;
  }

  async bringToFront(): Promise<void> {
    await this.delegate.bringToFront();
  }

  async addInitScript(progress: Progress, source: string) {
    const initScript = new InitScript(source);
    this.initScripts.push(initScript);
    progress.cleanupWhenAborted(() => this.removeInitScripts([initScript]));
    await progress.race(this.delegate.addInitScript(initScript));
    return initScript;
  }

  async removeInitScripts(initScripts: InitScript[]) {
    const set = new Set(initScripts);
    this.initScripts = this.initScripts.filter(script => !set.has(script));
    await this.delegate.removeInitScripts(initScripts);
  }

  needsRequestInterception(): boolean {
    return this.requestInterceptors.length > 0 || this.browserContext.requestInterceptors.length > 0;
  }

  async addRequestInterceptor(progress: Progress, handler: network.RouteHandler, prepend?: 'prepend'): Promise<void> {
    // Note: progress is intentionally ignored, because this operation is not cancellable and should not block in the browser anyway.
    if (prepend)
      this.requestInterceptors.unshift(handler);
    else
      this.requestInterceptors.push(handler);
    await this.delegate.updateRequestInterception();
  }

  async removeRequestInterceptor(handler: network.RouteHandler): Promise<void> {
    const index = this.requestInterceptors.indexOf(handler);
    if (index === -1)
      return;
    this.requestInterceptors.splice(index, 1);
    await this.browserContext.notifyRoutesInFlightAboutRemovedHandler(handler);
    await this.delegate.updateRequestInterception();
  }

  async expectScreenshot(progress: Progress, options: ExpectScreenshotOptions): Promise<{ actual?: Buffer, previous?: Buffer, diff?: Buffer, errorMessage?: string, log?: string[], timedOut?: boolean }> {
    const locator = options.locator;
    const rafrafScreenshot = locator ? async (timeout: number) => {
      return await locator.frame.rafrafTimeoutScreenshotElementWithProgress(progress, locator.selector, timeout, options || {});
    } : async (timeout: number) => {
      await this.performActionPreChecks(progress);
      await this.mainFrame().rafrafTimeout(progress, timeout);
      return await this.screenshotter.screenshotPage(progress, options || {});
    };

    const comparator = getComparator('image/png');
    if (!options.expected && options.isNot)
      return { errorMessage: '"not" matcher requires expected result' };
    try {
      const format = validateScreenshotOptions(options || {});
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
    } | undefined;
    const areEqualScreenshots = (actual: Buffer | undefined, expected: Buffer | undefined, previous: Buffer | undefined) => {
      const comparatorResult = actual && expected ? comparator(actual, expected, options) : undefined;
      if (comparatorResult !== undefined && !!comparatorResult === !!options.isNot)
        return true;
      if (comparatorResult)
        intermediateResult = { errorMessage: comparatorResult.errorMessage, diff: comparatorResult.diff, actual, previous };
      return false;
    };

    try {
      let actual: Buffer | undefined;
      let previous: Buffer | undefined;
      const pollIntervals = [0, 100, 250, 500];
      progress.log(`${renderTitleForCall(progress.metadata)}${options.timeout ? ` with timeout ${options.timeout}ms` : ''}`);
      if (options.expected)
        progress.log(`  verifying given screenshot expectation`);
      else
        progress.log(`  generating new stable screenshot expectation`);
      let isFirstIteration = true;
      while (true) {
        if (this.isClosed())
          throw new Error('The page has closed');
        const screenshotTimeout = pollIntervals.shift() ?? 1000;
        if (screenshotTimeout)
          progress.log(`waiting ${screenshotTimeout}ms before taking screenshot`);
        previous = actual;
        actual = await rafrafScreenshot(screenshotTimeout).catch(e => {
          if (this.mainFrame().isNonRetriableError(e))
            throw e;
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

      if (areEqualScreenshots(actual, options.expected, undefined)) {
        progress.log(`screenshot matched expectation`);
        return {};
      }
      throw new Error(intermediateResult!.errorMessage);
    } catch (e) {
      // Q: Why not throw upon isNonRetriableError(e) as in other places?
      // A: We want user to receive a friendly diff between actual and expected/previous.
      if (js.isJavaScriptErrorInEvaluate(e) || isInvalidSelectorError(e))
        throw e;
      let errorMessage = e.message;
      if (e instanceof TimeoutError && intermediateResult?.previous)
        errorMessage = `Failed to take two consecutive stable screenshots.`;
      return {
        log: compressCallLog(e.message ? [...progress.metadata.log, e.message] : progress.metadata.log),
        ...intermediateResult,
        errorMessage,
        timedOut: (e instanceof TimeoutError),
      };
    }
  }

  async screenshot(progress: Progress, options: ScreenshotOptions): Promise<Buffer> {
    return await this.screenshotter.screenshotPage(progress, options);
  }

  async close(options: { runBeforeUnload?: boolean, reason?: string } = {}) {
    if (this._closedState === 'closed')
      return;
    if (options.reason)
      this.closeReason = options.reason;
    const runBeforeUnload = !!options.runBeforeUnload;
    if (this._closedState !== 'closing') {
      this._closedState = 'closing';
      // This might throw if the browser context containing the page closes
      // while we are trying to close the page.
      await this.delegate.closePage(runBeforeUnload).catch(e => debugLogger.log('error', e));
    }
    if (!runBeforeUnload)
      await this._closedPromise;
  }

  isClosed(): boolean {
    return this._closedState === 'closed';
  }

  hasCrashed() {
    return this._crashed;
  }

  isClosedOrClosingOrCrashed() {
    return this._closedState !== 'open' || this._crashed;
  }

  addWorker(workerId: string, worker: Worker) {
    this._workers.set(workerId, worker);
    this.emit(Page.Events.Worker, worker);
  }

  removeWorker(workerId: string) {
    const worker = this._workers.get(workerId);
    if (!worker)
      return;
    worker.didClose();
    this._workers.delete(workerId);
  }

  clearWorkers() {
    for (const [workerId, worker] of this._workers) {
      worker.didClose();
      this._workers.delete(workerId);
    }
  }

  async setFileChooserInterceptedBy(enabled: boolean, by: any): Promise<void> {
    const wasIntercepted = this.fileChooserIntercepted();
    if (enabled)
      this._fileChooserInterceptedBy.add(by);
    else
      this._fileChooserInterceptedBy.delete(by);
    if (wasIntercepted !== this.fileChooserIntercepted())
      await this.delegate.updateFileChooserInterception();
  }

  fileChooserIntercepted() {
    return this._fileChooserInterceptedBy.size > 0;
  }

  frameNavigatedToNewDocument(frame: frames.Frame) {
    this.emit(Page.Events.InternalFrameNavigatedToNewDocument, frame);
    const origin = frame.origin();
    if (origin)
      this.browserContext.addVisitedOrigin(origin);
  }

  allInitScripts() {
    const bindings = [...this.browserContext._pageBindings.values(), ...this._pageBindings.values()].map(binding => binding.initScript);
    if (this.browserContext.bindingsInitScript)
      bindings.unshift(this.browserContext.bindingsInitScript);
    return [...bindings, ...this.browserContext.initScripts, ...this.initScripts];
  }

  getBinding(name: string) {
    return this._pageBindings.get(name) || this.browserContext._pageBindings.get(name);
  }

  setScreencastOptions(options: { width: number, height: number, quality: number } | null) {
    this.delegate.setScreencastOptions(options).catch(e => debugLogger.log('error', e));
    this._frameThrottler.setThrottlingEnabled(!!options);
  }

  throttleScreencastFrameAck(ack: () => void) {
    // Don't ack immediately, tracing has smart throttling logic that is implemented here.
    this._frameThrottler.ack(ack);
  }

  temporarilyDisableTracingScreencastThrottling() {
    this._frameThrottler.recharge();
  }

  async safeNonStallingEvaluateInAllFrames(expression: string, world: types.World, options: { throwOnJSErrors?: boolean } = {}) {
    await Promise.all(this.frames().map(async frame => {
      try {
        await frame.nonStallingEvaluateInExistingContext(expression, world);
      } catch (e) {
        if (options.throwOnJSErrors && js.isJavaScriptErrorInEvaluate(e))
          throw e;
      }
    }));
  }

  async hideHighlight() {
    await Promise.all(this.frames().map(frame => frame.hideHighlight().catch(() => {})));
  }

  markAsServerSideOnly() {
    this._isServerSideOnly = true;
  }

  async snapshotForAI(progress: Progress): Promise<string> {
    this.lastSnapshotFrameIds = [];
    const snapshot = await snapshotFrameForAI(progress, this.mainFrame(), 0, this.lastSnapshotFrameIds);
    return snapshot.join('\n');
  }
}

export class Worker extends SdkObject {
  static Events = {
    Close: 'close',
  };

  readonly url: string;
  private _executionContextPromise: Promise<js.ExecutionContext>;
  private _executionContextCallback: (value: js.ExecutionContext) => void;
  existingExecutionContext: js.ExecutionContext | null = null;
  readonly openScope = new LongStandingScope();

  constructor(parent: SdkObject, url: string) {
    super(parent, 'worker');
    this.url = url;
    this._executionContextCallback = () => {};
    this._executionContextPromise = new Promise(x => this._executionContextCallback = x);
  }

  createExecutionContext(delegate: js.ExecutionContextDelegate) {
    this.existingExecutionContext = new js.ExecutionContext(this, delegate, 'worker');
    this._executionContextCallback(this.existingExecutionContext);
    return this.existingExecutionContext;
  }

  didClose() {
    if (this.existingExecutionContext)
      this.existingExecutionContext.contextDestroyed('Worker was closed');
    this.emit(Worker.Events.Close, this);
    this.openScope.close(new Error('Worker closed'));
  }

  async evaluateExpression(expression: string, isFunction: boolean | undefined, arg: any): Promise<any> {
    return js.evaluateExpression(await this._executionContextPromise, expression, { returnByValue: true, isFunction }, arg);
  }

  async evaluateExpressionHandle(expression: string, isFunction: boolean | undefined, arg: any): Promise<any> {
    return js.evaluateExpression(await this._executionContextPromise, expression, { returnByValue: false, isFunction }, arg);
  }
}

export class PageBinding {
  private static kController = '__playwright__binding__controller__';
  static kBindingName = '__playwright__binding__';

  static createInitScript() {
    return new InitScript(`
      (() => {
        const module = {};
        ${rawBindingsControllerSource.source}
        const property = '${PageBinding.kController}';
        if (!globalThis[property])
          globalThis[property] = new (module.exports.BindingsController())(globalThis, '${PageBinding.kBindingName}');
      })();
    `);
  }

  readonly name: string;
  readonly playwrightFunction: frames.FunctionWithSource;
  readonly initScript: InitScript;
  readonly needsHandle: boolean;
  readonly cleanupScript: string;
  forClient?: unknown;

  constructor(name: string, playwrightFunction: frames.FunctionWithSource, needsHandle: boolean) {
    this.name = name;
    this.playwrightFunction = playwrightFunction;
    this.initScript = new InitScript(`globalThis['${PageBinding.kController}'].addBinding(${JSON.stringify(name)}, ${needsHandle})`);
    this.needsHandle = needsHandle;
    this.cleanupScript = `globalThis['${PageBinding.kController}'].removeBinding(${JSON.stringify(name)})`;
  }

  static async dispatch(page: Page, payload: string, context: dom.FrameExecutionContext) {
    const { name, seq, serializedArgs } = JSON.parse(payload) as BindingPayload;
    try {
      assert(context.world);
      const binding = page.getBinding(name);
      if (!binding)
        throw new Error(`Function "${name}" is not exposed`);
      let result: any;
      if (binding.needsHandle) {
        const handle = await context.evaluateExpressionHandle(`arg => globalThis['${PageBinding.kController}'].takeBindingHandle(arg)`, { isFunction: true }, { name, seq }).catch(e => null);
        result = await binding.playwrightFunction({ frame: context.frame, page, context: page.browserContext }, handle);
      } else {
        if (!Array.isArray(serializedArgs))
          throw new Error(`serializedArgs is not an array. This can happen when Array.prototype.toJSON is defined incorrectly`);
        const args = serializedArgs!.map(a => parseEvaluationResultValue(a));
        result = await binding.playwrightFunction({ frame: context.frame, page, context: page.browserContext }, ...args);
      }
      context.evaluateExpressionHandle(`arg => globalThis['${PageBinding.kController}'].deliverBindingResult(arg)`, { isFunction: true }, { name, seq, result }).catch(e => debugLogger.log('error', e));
    } catch (error) {
      context.evaluateExpressionHandle(`arg => globalThis['${PageBinding.kController}'].deliverBindingResult(arg)`, { isFunction: true }, { name, seq, error }).catch(e => debugLogger.log('error', e));
    }
  }
}

export class InitScript {
  readonly source: string;

  constructor(source: string) {
    this.source = `(() => {
      ${source}
    })();`;
  }
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

async function snapshotFrameForAI(progress: Progress, frame: frames.Frame, frameOrdinal: number, frameIds: string[]): Promise<string[]> {
  // Only await the topmost navigations, inner frames will be empty when racing.
  const snapshot = await frame.retryWithProgressAndTimeouts(progress, [1000, 2000, 4000, 8000], async continuePolling => {
    try {
      const context = await progress.race(frame._utilityContext());
      const injectedScript = await progress.race(context.injectedScript());
      const snapshotOrRetry = await progress.race(injectedScript.evaluate((injected, refPrefix) => {
        const node = injected.document.body;
        if (!node)
          return true;
        return injected.ariaSnapshot(node, { forAI: true, refPrefix });
      }, frameOrdinal ? 'f' + frameOrdinal : ''));
      if (snapshotOrRetry === true)
        return continuePolling;
      return snapshotOrRetry;
    } catch (e) {
      if (frame.isNonRetriableError(e))
        throw e;
      return continuePolling;
    }
  });

  const lines = snapshot.split('\n');
  const result = [];
  for (const line of lines) {
    const match = line.match(/^(\s*)- iframe (?:\[active\] )?\[ref=(.*)\]/);
    if (!match) {
      result.push(line);
      continue;
    }

    const leadingSpace = match[1];
    const ref = match[2];
    const frameSelector = `aria-ref=${ref} >> internal:control=enter-frame`;
    const frameBodySelector = `${frameSelector} >> body`;
    const child = await progress.race(frame.selectors.resolveFrameForSelector(frameBodySelector, { strict: true }));
    if (!child) {
      result.push(line);
      continue;
    }
    const frameOrdinal = frameIds.length + 1;
    frameIds.push(child.frame._id);
    try {
      const childSnapshot = await snapshotFrameForAI(progress, child.frame, frameOrdinal, frameIds);
      result.push(line + ':', ...childSnapshot.map(l => leadingSpace + '  ' + l));
    } catch {
      result.push(line);
    }
  }
  return result;
}
