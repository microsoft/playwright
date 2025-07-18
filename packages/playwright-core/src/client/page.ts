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

import { Accessibility } from './accessibility';
import { Artifact } from './artifact';
import { ChannelOwner } from './channelOwner';
import { evaluationScript } from './clientHelper';
import { Coverage } from './coverage';
import { Download } from './download';
import { ElementHandle, determineScreenshotType } from './elementHandle';
import { TargetClosedError, isTargetClosedError, serializeError } from './errors';
import { Events } from './events';
import { FileChooser } from './fileChooser';
import { Frame, verifyLoadState } from './frame';
import { HarRouter } from './harRouter';
import { Keyboard, Mouse, Touchscreen } from './input';
import { JSHandle, assertMaxArguments, parseResult, serializeArgument } from './jsHandle';
import { Response, Route, RouteHandler, WebSocket,  WebSocketRoute, WebSocketRouteHandler, validateHeaders } from './network';
import { Video } from './video';
import { Waiter } from './waiter';
import { Worker } from './worker';
import { TimeoutSettings } from './timeoutSettings';
import { assert } from '../utils/isomorphic/assert';
import { mkdirIfNeeded } from './fileUtils';
import { headersObjectToArray } from '../utils/isomorphic/headers';
import { trimStringWithEllipsis  } from '../utils/isomorphic/stringUtils';
import { urlMatches, urlMatchesEqual } from '../utils/isomorphic/urlMatch';
import { LongStandingScope } from '../utils/isomorphic/manualPromise';
import { isObject, isRegExp, isString } from '../utils/isomorphic/rtti';

import type { BrowserContext } from './browserContext';
import type { Clock } from './clock';
import type { APIRequestContext } from './fetch';
import type { WaitForNavigationOptions } from './frame';
import type { FrameLocator, Locator, LocatorOptions } from './locator';
import type { Request, RouteHandlerCallback, WebSocketRouteHandlerCallback } from './network';
import type { FilePayload, Headers, LifecycleEvent, SelectOption, SelectOptionOptions, Size, TimeoutOptions, WaitForEventOptions, WaitForFunctionOptions } from './types';
import type * as structs from '../../types/structs';
import type * as api from '../../types/types';
import type { ByRoleOptions } from '../utils/isomorphic/locatorUtils';
import type { URLMatch } from '../utils/isomorphic/urlMatch';
import type * as channels from '@protocol/channels';

type PDFOptions = Omit<channels.PagePdfParams, 'width' | 'height' | 'margin'> & {
  width?: string | number,
  height?: string | number,
  margin?: {
    top?: string | number,
    bottom?: string | number,
    left?: string | number,
    right?: string | number
  },
  path?: string,
};

export type ExpectScreenshotOptions = Omit<channels.PageExpectScreenshotOptions, 'locator' | 'expected' | 'mask'> & {
  expected?: Buffer,
  locator?: api.Locator,
  timeout: number,
  isNot: boolean,
  mask?: api.Locator[],
};

export class Page extends ChannelOwner<channels.PageChannel> implements api.Page {
  private _browserContext: BrowserContext;
  _ownedContext: BrowserContext | undefined;

  private _mainFrame: Frame;
  private _frames = new Set<Frame>();
  _workers = new Set<Worker>();
  private _closed = false;
  readonly _closedOrCrashedScope = new LongStandingScope();
  private _viewportSize: Size | undefined;
  _routes: RouteHandler[] = [];
  _webSocketRoutes: WebSocketRouteHandler[] = [];

  readonly accessibility: Accessibility;
  readonly coverage: Coverage;
  readonly keyboard: Keyboard;
  readonly mouse: Mouse;
  readonly request: APIRequestContext;
  readonly touchscreen: Touchscreen;
  readonly clock: Clock;


  readonly _bindings = new Map<string, (source: structs.BindingSource, ...args: any[]) => any>();
  readonly _timeoutSettings: TimeoutSettings;
  private _video: Video | null = null;
  readonly _opener: Page | null;
  private _closeReason: string | undefined;
  _closeWasCalled: boolean = false;
  private _harRouters: HarRouter[] = [];

  private _locatorHandlers = new Map<number, { locator: Locator, handler: (locator: Locator) => any, times: number | undefined }>();

  static from(page: channels.PageChannel): Page {
    return (page as any)._object;
  }

  static fromNullable(page: channels.PageChannel | undefined): Page | null {
    return page ? Page.from(page) : null;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.PageInitializer) {
    super(parent, type, guid, initializer);
    this._browserContext = parent as unknown as BrowserContext;
    this._timeoutSettings = new TimeoutSettings(this._platform, this._browserContext._timeoutSettings);

    this.accessibility = new Accessibility(this._channel);
    this.keyboard = new Keyboard(this);
    this.mouse = new Mouse(this);
    this.request = this._browserContext.request;
    this.touchscreen = new Touchscreen(this);
    this.clock = this._browserContext.clock;

    this._mainFrame = Frame.from(initializer.mainFrame);
    this._mainFrame._page = this;
    this._frames.add(this._mainFrame);
    this._viewportSize = initializer.viewportSize;
    this._closed = initializer.isClosed;
    this._opener = Page.fromNullable(initializer.opener);

    this._channel.on('bindingCall', ({ binding }) => this._onBinding(BindingCall.from(binding)));
    this._channel.on('close', () => this._onClose());
    this._channel.on('crash', () => this._onCrash());
    this._channel.on('download', ({ url, suggestedFilename, artifact }) => {
      const artifactObject = Artifact.from(artifact);
      this.emit(Events.Page.Download, new Download(this, url, suggestedFilename, artifactObject));
    });
    this._channel.on('fileChooser', ({ element, isMultiple }) => this.emit(Events.Page.FileChooser, new FileChooser(this, ElementHandle.from(element), isMultiple)));
    this._channel.on('frameAttached', ({ frame }) => this._onFrameAttached(Frame.from(frame)));
    this._channel.on('frameDetached', ({ frame }) => this._onFrameDetached(Frame.from(frame)));
    this._channel.on('locatorHandlerTriggered', ({ uid }) => this._onLocatorHandlerTriggered(uid));
    this._channel.on('route', ({ route }) => this._onRoute(Route.from(route)));
    this._channel.on('webSocketRoute', ({ webSocketRoute }) => this._onWebSocketRoute(WebSocketRoute.from(webSocketRoute)));
    this._channel.on('video', ({ artifact }) => {
      const artifactObject = Artifact.from(artifact);
      this._forceVideo()._artifactReady(artifactObject);
    });
    this._channel.on('viewportSizeChanged', ({ viewportSize }) => this._viewportSize = viewportSize);
    this._channel.on('webSocket', ({ webSocket }) => this.emit(Events.Page.WebSocket, WebSocket.from(webSocket)));
    this._channel.on('worker', ({ worker }) => this._onWorker(Worker.from(worker)));

    this.coverage = new Coverage(this._channel);

    this.once(Events.Page.Close, () => this._closedOrCrashedScope.close(this._closeErrorWithReason()));
    this.once(Events.Page.Crash, () => this._closedOrCrashedScope.close(new TargetClosedError()));

    this._setEventToSubscriptionMapping(new Map<string, channels.PageUpdateSubscriptionParams['event']>([
      [Events.Page.Console, 'console'],
      [Events.Page.Dialog, 'dialog'],
      [Events.Page.Request, 'request'],
      [Events.Page.Response, 'response'],
      [Events.Page.RequestFinished, 'requestFinished'],
      [Events.Page.RequestFailed, 'requestFailed'],
      [Events.Page.FileChooser, 'fileChooser'],
    ]));
  }

  private _onFrameAttached(frame: Frame) {
    frame._page = this;
    this._frames.add(frame);
    if (frame._parentFrame)
      frame._parentFrame._childFrames.add(frame);
    this.emit(Events.Page.FrameAttached, frame);
  }

  private _onFrameDetached(frame: Frame) {
    this._frames.delete(frame);
    frame._detached = true;
    if (frame._parentFrame)
      frame._parentFrame._childFrames.delete(frame);
    this.emit(Events.Page.FrameDetached, frame);
  }

  private async _onRoute(route: Route) {
    route._context = this.context();
    const routeHandlers = this._routes.slice();
    for (const routeHandler of routeHandlers) {
      // If the page was closed we stall all requests right away.
      if (this._closeWasCalled || this._browserContext._closingStatus !== 'none')
        return;
      if (!routeHandler.matches(route.request().url()))
        continue;
      const index = this._routes.indexOf(routeHandler);
      if (index === -1)
        continue;
      if (routeHandler.willExpire())
        this._routes.splice(index, 1);
      const handled = await routeHandler.handle(route);
      if (!this._routes.length)
        this._updateInterceptionPatterns().catch(() => {});
      if (handled)
        return;
    }

    await this._browserContext._onRoute(route);
  }

  private async _onWebSocketRoute(webSocketRoute: WebSocketRoute) {
    const routeHandler = this._webSocketRoutes.find(route => route.matches(webSocketRoute.url()));
    if (routeHandler)
      await routeHandler.handle(webSocketRoute);
    else
      await this._browserContext._onWebSocketRoute(webSocketRoute);
  }

  async _onBinding(bindingCall: BindingCall) {
    const func = this._bindings.get(bindingCall._initializer.name);
    if (func) {
      await bindingCall.call(func);
      return;
    }
    await this._browserContext._onBinding(bindingCall);
  }

  _onWorker(worker: Worker): void {
    this._workers.add(worker);
    worker._page = this;
    this.emit(Events.Page.Worker, worker);
  }

  _onClose() {
    this._closed = true;
    this._browserContext._pages.delete(this);
    this._browserContext._backgroundPages.delete(this);
    this._disposeHarRouters();
    this.emit(Events.Page.Close, this);
  }

  private _onCrash() {
    this.emit(Events.Page.Crash, this);
  }

  context(): BrowserContext {
    return this._browserContext;
  }

  async opener(): Promise<Page | null> {
    if (!this._opener || this._opener.isClosed())
      return null;
    return this._opener;
  }

  mainFrame(): Frame {
    return this._mainFrame;
  }

  frame(frameSelector: string | { name?: string, url?: URLMatch }): Frame | null {
    const name = isString(frameSelector) ? frameSelector : frameSelector.name;
    const url = isObject(frameSelector) ? frameSelector.url : undefined;
    assert(name || url, 'Either name or url matcher should be specified');
    return this.frames().find(f => {
      if (name)
        return f.name() === name;
      return urlMatches(this._browserContext._options.baseURL, f.url(), url);
    }) || null;
  }

  frames(): Frame[] {
    return [...this._frames];
  }

  setDefaultNavigationTimeout(timeout: number) {
    this._timeoutSettings.setDefaultNavigationTimeout(timeout);
  }

  setDefaultTimeout(timeout: number) {
    this._timeoutSettings.setDefaultTimeout(timeout);
  }

  private _forceVideo(): Video {
    if (!this._video)
      this._video = new Video(this, this._connection);
    return this._video;
  }

  video(): Video | null {
    // Note: we are creating Video object lazily, because we do not know
    // BrowserContextOptions when constructing the page - it is assigned
    // too late during launchPersistentContext.
    if (!this._browserContext._options.recordVideo)
      return null;
    return this._forceVideo();
  }

  async $(selector: string, options?: { strict?: boolean }): Promise<ElementHandle<SVGElement | HTMLElement> | null> {
    return await this._mainFrame.$(selector, options);
  }

  waitForSelector(selector: string, options: channels.FrameWaitForSelectorOptions & TimeoutOptions & { state: 'attached' | 'visible' }): Promise<ElementHandle<SVGElement | HTMLElement>>;
  waitForSelector(selector: string, options?: channels.FrameWaitForSelectorOptions & TimeoutOptions): Promise<ElementHandle<SVGElement | HTMLElement> | null>;
  async waitForSelector(selector: string, options?: channels.FrameWaitForSelectorOptions & TimeoutOptions): Promise<ElementHandle<SVGElement | HTMLElement> | null> {
    return await this._mainFrame.waitForSelector(selector, options);
  }

  async dispatchEvent(selector: string, type: string, eventInit?: any, options?: channels.FrameDispatchEventOptions): Promise<void> {
    return await this._mainFrame.dispatchEvent(selector, type, eventInit, options);
  }

  async evaluateHandle<R, Arg>(pageFunction: structs.PageFunction<Arg, R>, arg?: Arg): Promise<structs.SmartHandle<R>> {
    assertMaxArguments(arguments.length, 2);
    return await this._mainFrame.evaluateHandle(pageFunction, arg);
  }

  async $eval<R, Arg>(selector: string, pageFunction: structs.PageFunctionOn<Element, Arg, R>, arg?: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 3);
    return await this._mainFrame.$eval(selector, pageFunction, arg);
  }

  async $$eval<R, Arg>(selector: string, pageFunction: structs.PageFunctionOn<Element[], Arg, R>, arg?: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 3);
    return await this._mainFrame.$$eval(selector, pageFunction, arg);
  }

  async $$(selector: string): Promise<ElementHandle<SVGElement | HTMLElement>[]> {
    return await this._mainFrame.$$(selector);
  }

  async addScriptTag(options: { url?: string; path?: string; content?: string; type?: string; } = {}): Promise<ElementHandle> {
    return await this._mainFrame.addScriptTag(options);
  }

  async addStyleTag(options: { url?: string; path?: string; content?: string; } = {}): Promise<ElementHandle> {
    return await this._mainFrame.addStyleTag(options);
  }

  async exposeFunction(name: string, callback: Function) {
    await this._channel.exposeBinding({ name });
    const binding = (source: structs.BindingSource, ...args: any[]) => callback(...args);
    this._bindings.set(name, binding);
  }

  async exposeBinding(name: string, callback: (source: structs.BindingSource, ...args: any[]) => any, options: { handle?: boolean } = {}) {
    await this._channel.exposeBinding({ name, needsHandle: options.handle });
    this._bindings.set(name, callback);
  }

  async setExtraHTTPHeaders(headers: Headers) {
    validateHeaders(headers);
    await this._channel.setExtraHTTPHeaders({ headers: headersObjectToArray(headers) });
  }

  url(): string {
    return this._mainFrame.url();
  }

  async content(): Promise<string> {
    return await this._mainFrame.content();
  }

  async setContent(html: string, options?: channels.FrameSetContentOptions & TimeoutOptions): Promise<void> {
    return await this._mainFrame.setContent(html, options);
  }

  async goto(url: string, options?: channels.FrameGotoOptions & TimeoutOptions): Promise<Response | null> {
    return await this._mainFrame.goto(url, options);
  }

  async reload(options: channels.PageReloadOptions & TimeoutOptions = {}): Promise<Response | null> {
    const waitUntil = verifyLoadState('waitUntil', options.waitUntil === undefined ? 'load' : options.waitUntil);
    return Response.fromNullable((await this._channel.reload({ ...options, waitUntil, timeout: this._timeoutSettings.navigationTimeout(options) })).response);
  }

  async addLocatorHandler(locator: Locator, handler: (locator: Locator) => any, options: { times?: number, noWaitAfter?: boolean } = {}): Promise<void> {
    if (locator._frame !== this._mainFrame)
      throw new Error(`Locator must belong to the main frame of this page`);
    if (options.times === 0)
      return;
    const { uid } = await this._channel.registerLocatorHandler({ selector: locator._selector, noWaitAfter: options.noWaitAfter });
    this._locatorHandlers.set(uid, { locator, handler, times: options.times });
  }

  private async _onLocatorHandlerTriggered(uid: number) {
    let remove = false;
    try {
      const handler = this._locatorHandlers.get(uid);
      if (handler && handler.times !== 0) {
        if (handler.times !== undefined)
          handler.times--;
        await handler.handler(handler.locator);
      }
      remove = handler?.times === 0;
    } finally {
      if (remove)
        this._locatorHandlers.delete(uid);
      this._channel.resolveLocatorHandlerNoReply({ uid, remove }).catch(() => {});
    }
  }

  async removeLocatorHandler(locator: Locator): Promise<void> {
    for (const [uid, data] of this._locatorHandlers) {
      if (data.locator._equals(locator)) {
        this._locatorHandlers.delete(uid);
        await this._channel.unregisterLocatorHandler({ uid }).catch(() => {});
      }
    }
  }

  async waitForLoadState(state?: LifecycleEvent, options?: TimeoutOptions): Promise<void> {
    return await this._mainFrame.waitForLoadState(state, options);
  }

  async waitForNavigation(options?: WaitForNavigationOptions): Promise<Response | null> {
    return await this._mainFrame.waitForNavigation(options);
  }

  async waitForURL(url: URLMatch, options?: TimeoutOptions & { waitUntil?: LifecycleEvent }): Promise<void> {
    return await this._mainFrame.waitForURL(url, options);
  }

  async waitForRequest(urlOrPredicate: string | RegExp | ((r: Request) => boolean | Promise<boolean>), options: TimeoutOptions = {}): Promise<Request> {
    const predicate = async (request: Request) => {
      if (isString(urlOrPredicate) || isRegExp(urlOrPredicate))
        return urlMatches(this._browserContext._options.baseURL, request.url(), urlOrPredicate);
      return await urlOrPredicate(request);
    };
    const trimmedUrl = trimUrl(urlOrPredicate);
    const logLine = trimmedUrl ? `waiting for request ${trimmedUrl}` : undefined;
    return await this._waitForEvent(Events.Page.Request, { predicate, timeout: options.timeout }, logLine);
  }

  async waitForResponse(urlOrPredicate: string | RegExp | ((r: Response) => boolean | Promise<boolean>), options: TimeoutOptions = {}): Promise<Response> {
    const predicate = async (response: Response) => {
      if (isString(urlOrPredicate) || isRegExp(urlOrPredicate))
        return urlMatches(this._browserContext._options.baseURL, response.url(), urlOrPredicate);
      return await urlOrPredicate(response);
    };
    const trimmedUrl = trimUrl(urlOrPredicate);
    const logLine = trimmedUrl ? `waiting for response ${trimmedUrl}` : undefined;
    return await this._waitForEvent(Events.Page.Response, { predicate, timeout: options.timeout }, logLine);
  }

  async waitForEvent(event: string, optionsOrPredicate: WaitForEventOptions = {}): Promise<any> {
    return await this._waitForEvent(event, optionsOrPredicate, `waiting for event "${event}"`);
  }

  _closeErrorWithReason(): TargetClosedError {
    return new TargetClosedError(this._closeReason || this._browserContext._effectiveCloseReason());
  }

  private async _waitForEvent(event: string, optionsOrPredicate: WaitForEventOptions, logLine?: string): Promise<any> {
    return await this._wrapApiCall(async () => {
      const timeout = this._timeoutSettings.timeout(typeof optionsOrPredicate === 'function' ? {} : optionsOrPredicate);
      const predicate = typeof optionsOrPredicate === 'function' ? optionsOrPredicate : optionsOrPredicate.predicate;
      const waiter = Waiter.createForEvent(this, event);
      if (logLine)
        waiter.log(logLine);
      waiter.rejectOnTimeout(timeout, `Timeout ${timeout}ms exceeded while waiting for event "${event}"`);
      if (event !== Events.Page.Crash)
        waiter.rejectOnEvent(this, Events.Page.Crash, new Error('Page crashed'));
      if (event !== Events.Page.Close)
        waiter.rejectOnEvent(this, Events.Page.Close, () => this._closeErrorWithReason());
      const result = await waiter.waitForEvent(this, event, predicate as any);
      waiter.dispose();
      return result;
    });
  }

  async goBack(options: channels.PageGoBackOptions & TimeoutOptions = {}): Promise<Response | null> {
    const waitUntil = verifyLoadState('waitUntil', options.waitUntil === undefined ? 'load' : options.waitUntil);
    return Response.fromNullable((await this._channel.goBack({ ...options, waitUntil, timeout: this._timeoutSettings.navigationTimeout(options) })).response);
  }

  async goForward(options: channels.PageGoForwardOptions & TimeoutOptions = {}): Promise<Response | null> {
    const waitUntil = verifyLoadState('waitUntil', options.waitUntil === undefined ? 'load' : options.waitUntil);
    return Response.fromNullable((await this._channel.goForward({ ...options, waitUntil, timeout: this._timeoutSettings.navigationTimeout(options) })).response);
  }

  async requestGC() {
    await this._channel.requestGC();
  }

  async emulateMedia(options: { media?: 'screen' | 'print' | null, colorScheme?: 'dark' | 'light' | 'no-preference' | null, reducedMotion?: 'reduce' | 'no-preference' | null, forcedColors?: 'active' | 'none' | null, contrast?: 'no-preference' | 'more' | null } = {}) {
    await this._channel.emulateMedia({
      media: options.media === null ? 'no-override' : options.media,
      colorScheme: options.colorScheme === null ? 'no-override' : options.colorScheme,
      reducedMotion: options.reducedMotion === null ? 'no-override' : options.reducedMotion,
      forcedColors: options.forcedColors === null ? 'no-override' : options.forcedColors,
      contrast: options.contrast === null ? 'no-override' : options.contrast,
    });
  }

  async setViewportSize(viewportSize: Size) {
    this._viewportSize = viewportSize;
    await this._channel.setViewportSize({ viewportSize });
  }

  viewportSize(): Size | null {
    return this._viewportSize || null;
  }

  async evaluate<R, Arg>(pageFunction: structs.PageFunction<Arg, R>, arg?: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 2);
    return await this._mainFrame.evaluate(pageFunction, arg);
  }

  async _evaluateFunction(functionDeclaration: string) {
    return this._mainFrame._evaluateFunction(functionDeclaration);
  }

  async addInitScript(script: Function | string | { path?: string, content?: string }, arg?: any) {
    const source = await evaluationScript(this._platform, script, arg);
    await this._channel.addInitScript({ source });
  }

  async route(url: URLMatch, handler: RouteHandlerCallback, options: { times?: number } = {}): Promise<void> {
    this._routes.unshift(new RouteHandler(this._platform, this._browserContext._options.baseURL, url, handler, options.times));
    await this._updateInterceptionPatterns();
  }

  async routeFromHAR(har: string, options: { url?: string | RegExp, notFound?: 'abort' | 'fallback', update?: boolean, updateContent?: 'attach' | 'embed', updateMode?: 'minimal' | 'full'} = {}): Promise<void> {
    const localUtils = this._connection.localUtils();
    if (!localUtils)
      throw new Error('Route from har is not supported in thin clients');
    if (options.update) {
      await this._browserContext._recordIntoHAR(har, this, options);
      return;
    }
    const harRouter = await HarRouter.create(localUtils, har, options.notFound || 'abort', { urlMatch: options.url });
    this._harRouters.push(harRouter);
    await harRouter.addPageRoute(this);
  }

  async routeWebSocket(url: URLMatch, handler: WebSocketRouteHandlerCallback): Promise<void> {
    this._webSocketRoutes.unshift(new WebSocketRouteHandler(this._browserContext._options.baseURL, url, handler));
    await this._updateWebSocketInterceptionPatterns();
  }

  private _disposeHarRouters() {
    this._harRouters.forEach(router => router.dispose());
    this._harRouters = [];
  }

  async unrouteAll(options?: { behavior?: 'wait'|'ignoreErrors'|'default' }): Promise<void> {
    await this._unrouteInternal(this._routes, [], options?.behavior);
    this._disposeHarRouters();
  }

  async unroute(url: URLMatch, handler?: RouteHandlerCallback): Promise<void> {
    const removed = [];
    const remaining = [];
    for (const route of this._routes) {
      if (urlMatchesEqual(route.url, url) && (!handler || route.handler === handler))
        removed.push(route);
      else
        remaining.push(route);
    }
    await this._unrouteInternal(removed, remaining, 'default');
  }

  private async _unrouteInternal(removed: RouteHandler[], remaining: RouteHandler[], behavior?: 'wait'|'ignoreErrors'|'default'): Promise<void> {
    this._routes = remaining;
    if (behavior && behavior !== 'default') {
      const promises = removed.map(routeHandler => routeHandler.stop(behavior));
      await Promise.all(promises);
    }
    await this._updateInterceptionPatterns();
  }

  private async _updateInterceptionPatterns() {
    const patterns = RouteHandler.prepareInterceptionPatterns(this._routes);
    await this._channel.setNetworkInterceptionPatterns({ patterns });
  }

  private async _updateWebSocketInterceptionPatterns() {
    const patterns = WebSocketRouteHandler.prepareInterceptionPatterns(this._webSocketRoutes);
    await this._channel.setWebSocketInterceptionPatterns({ patterns });
  }

  async screenshot(options: Omit<channels.PageScreenshotOptions, 'mask'> & TimeoutOptions & { path?: string, mask?: api.Locator[] } = {}): Promise<Buffer> {
    const mask = options.mask as Locator[] | undefined;
    const copy: channels.PageScreenshotParams = { ...options, mask: undefined, timeout: this._timeoutSettings.timeout(options) };
    if (!copy.type)
      copy.type = determineScreenshotType(options);
    if (mask) {
      copy.mask = mask.map(locator => ({
        frame: locator._frame._channel,
        selector: locator._selector,
      }));
    }
    const result = await this._channel.screenshot(copy);
    if (options.path) {
      await mkdirIfNeeded(this._platform, options.path);
      await this._platform.fs().promises.writeFile(options.path, result.binary);
    }
    return result.binary;
  }

  async _expectScreenshot(options: ExpectScreenshotOptions): Promise<{ actual?: Buffer, previous?: Buffer, diff?: Buffer, errorMessage?: string, log?: string[], timedOut?: boolean}> {
    const mask = options?.mask ? options?.mask.map(locator => ({
      frame: (locator as Locator)._frame._channel,
      selector: (locator as Locator)._selector,
    })) : undefined;
    const locator = options.locator ? {
      frame: (options.locator as Locator)._frame._channel,
      selector: (options.locator as Locator)._selector,
    } : undefined;
    return await this._channel.expectScreenshot({
      ...options,
      isNot: !!options.isNot,
      locator,
      mask,
    });
  }

  async title(): Promise<string> {
    return await this._mainFrame.title();
  }

  async bringToFront(): Promise<void> {
    await this._channel.bringToFront();
  }

  async [Symbol.asyncDispose]() {
    await this.close();
  }

  async close(options: { runBeforeUnload?: boolean, reason?: string } = {}) {
    this._closeReason = options.reason;
    this._closeWasCalled = true;
    try {
      if (this._ownedContext)
        await this._ownedContext.close();
      else
        await this._channel.close(options);
    } catch (e) {
      if (isTargetClosedError(e) && !options.runBeforeUnload)
        return;
      throw e;
    }
  }

  isClosed(): boolean {
    return this._closed;
  }

  async click(selector: string, options?: channels.FrameClickOptions & TimeoutOptions) {
    return await this._mainFrame.click(selector, options);
  }

  async dragAndDrop(source: string, target: string, options?: channels.FrameDragAndDropOptions & TimeoutOptions) {
    return await this._mainFrame.dragAndDrop(source, target, options);
  }

  async dblclick(selector: string, options?: channels.FrameDblclickOptions & TimeoutOptions) {
    await this._mainFrame.dblclick(selector, options);
  }

  async tap(selector: string, options?: channels.FrameTapOptions & TimeoutOptions) {
    return await this._mainFrame.tap(selector, options);
  }

  async fill(selector: string, value: string, options?: channels.FrameFillOptions & TimeoutOptions) {
    return await this._mainFrame.fill(selector, value, options);
  }

  locator(selector: string, options?: LocatorOptions): Locator {
    return this.mainFrame().locator(selector, options);
  }

  getByTestId(testId: string | RegExp): Locator {
    return this.mainFrame().getByTestId(testId);
  }

  getByAltText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.mainFrame().getByAltText(text, options);
  }

  getByLabel(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.mainFrame().getByLabel(text, options);
  }

  getByPlaceholder(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.mainFrame().getByPlaceholder(text, options);
  }

  getByText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.mainFrame().getByText(text, options);
  }

  getByTitle(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.mainFrame().getByTitle(text, options);
  }

  getByRole(role: string, options: ByRoleOptions = {}): Locator {
    return this.mainFrame().getByRole(role, options);
  }

  frameLocator(selector: string): FrameLocator {
    return this.mainFrame().frameLocator(selector);
  }

  async focus(selector: string, options?: channels.FrameFocusOptions & TimeoutOptions) {
    return await this._mainFrame.focus(selector, options);
  }

  async textContent(selector: string, options?: channels.FrameTextContentOptions & TimeoutOptions): Promise<null|string> {
    return await this._mainFrame.textContent(selector, options);
  }

  async innerText(selector: string, options?: channels.FrameInnerTextOptions & TimeoutOptions): Promise<string> {
    return await this._mainFrame.innerText(selector, options);
  }

  async innerHTML(selector: string, options?: channels.FrameInnerHTMLOptions & TimeoutOptions): Promise<string> {
    return await this._mainFrame.innerHTML(selector, options);
  }

  async getAttribute(selector: string, name: string, options?: channels.FrameGetAttributeOptions & TimeoutOptions): Promise<string | null> {
    return await this._mainFrame.getAttribute(selector, name, options);
  }

  async inputValue(selector: string, options?: channels.FrameInputValueOptions & TimeoutOptions): Promise<string> {
    return await this._mainFrame.inputValue(selector, options);
  }

  async isChecked(selector: string, options?: channels.FrameIsCheckedOptions & TimeoutOptions): Promise<boolean> {
    return await this._mainFrame.isChecked(selector, options);
  }

  async isDisabled(selector: string, options?: channels.FrameIsDisabledOptions & TimeoutOptions): Promise<boolean> {
    return await this._mainFrame.isDisabled(selector, options);
  }

  async isEditable(selector: string, options?: channels.FrameIsEditableOptions & TimeoutOptions): Promise<boolean> {
    return await this._mainFrame.isEditable(selector, options);
  }

  async isEnabled(selector: string, options?: channels.FrameIsEnabledOptions & TimeoutOptions): Promise<boolean> {
    return await this._mainFrame.isEnabled(selector, options);
  }

  async isHidden(selector: string, options?: channels.FrameIsHiddenOptions & TimeoutOptions): Promise<boolean> {
    return await this._mainFrame.isHidden(selector, options);
  }

  async isVisible(selector: string, options?: channels.FrameIsVisibleOptions & TimeoutOptions): Promise<boolean> {
    return await this._mainFrame.isVisible(selector, options);
  }

  async hover(selector: string, options?: channels.FrameHoverOptions & TimeoutOptions) {
    return await this._mainFrame.hover(selector, options);
  }

  async selectOption(selector: string, values: string | api.ElementHandle | SelectOption | string[] | api.ElementHandle[] | SelectOption[] | null, options?: SelectOptionOptions): Promise<string[]> {
    return await this._mainFrame.selectOption(selector, values, options);
  }

  async setInputFiles(selector: string, files: string | FilePayload | string[] | FilePayload[], options?: channels.FrameSetInputFilesOptions & TimeoutOptions): Promise<void> {
    return await this._mainFrame.setInputFiles(selector, files, options);
  }

  async type(selector: string, text: string, options?: channels.FrameTypeOptions & TimeoutOptions) {
    return await this._mainFrame.type(selector, text, options);
  }

  async press(selector: string, key: string, options?: channels.FramePressOptions & TimeoutOptions) {
    return await this._mainFrame.press(selector, key, options);
  }

  async check(selector: string, options?: channels.FrameCheckOptions & TimeoutOptions) {
    return await this._mainFrame.check(selector, options);
  }

  async uncheck(selector: string, options?: channels.FrameUncheckOptions & TimeoutOptions) {
    return await this._mainFrame.uncheck(selector, options);
  }

  async setChecked(selector: string, checked: boolean, options?: channels.FrameCheckOptions & TimeoutOptions) {
    return await this._mainFrame.setChecked(selector, checked, options);
  }

  async waitForTimeout(timeout: number) {
    return await this._mainFrame.waitForTimeout(timeout);
  }

  async waitForFunction<R, Arg>(pageFunction: structs.PageFunction<Arg, R>, arg?: Arg, options?: WaitForFunctionOptions): Promise<structs.SmartHandle<R>> {
    return await this._mainFrame.waitForFunction(pageFunction, arg, options);
  }

  workers(): Worker[] {
    return [...this._workers];
  }

  async pause(_options?: { __testHookKeepTestTimeout: boolean }) {
    if (this._platform.isJSDebuggerAttached())
      return;
    const defaultNavigationTimeout = this._browserContext._timeoutSettings.defaultNavigationTimeout();
    const defaultTimeout = this._browserContext._timeoutSettings.defaultTimeout();
    this._browserContext.setDefaultNavigationTimeout(0);
    this._browserContext.setDefaultTimeout(0);
    this._instrumentation?.onWillPause({ keepTestTimeout: !!_options?.__testHookKeepTestTimeout });
    await this._closedOrCrashedScope.safeRace(this.context()._channel.pause());
    this._browserContext.setDefaultNavigationTimeout(defaultNavigationTimeout);
    this._browserContext.setDefaultTimeout(defaultTimeout);
  }

  async pdf(options: PDFOptions = {}): Promise<Buffer> {
    const transportOptions: channels.PagePdfParams = { ...options } as channels.PagePdfParams;
    if (transportOptions.margin)
      transportOptions.margin = { ...transportOptions.margin };
    if (typeof options.width === 'number')
      transportOptions.width = options.width + 'px';
    if (typeof options.height === 'number')
      transportOptions.height  = options.height + 'px';
    for (const margin of ['top', 'right', 'bottom', 'left']) {
      const index = margin as 'top' | 'right' | 'bottom' | 'left';
      if (options.margin && typeof options.margin[index] === 'number')
        transportOptions.margin![index] = transportOptions.margin![index] + 'px';
    }
    const result = await this._channel.pdf(transportOptions);
    if (options.path) {
      const platform = this._platform;
      await platform.fs().promises.mkdir(platform.path().dirname(options.path), { recursive: true });
      await platform.fs().promises.writeFile(options.path, result.pdf);
    }
    return result.pdf;
  }

  async _snapshotForAI(options: TimeoutOptions = {}): Promise<string> {
    const result = await this._channel.snapshotForAI({ timeout: this._timeoutSettings.timeout(options) });
    return result.snapshot;
  }
}

export class BindingCall extends ChannelOwner<channels.BindingCallChannel> {
  static from(channel: channels.BindingCallChannel): BindingCall {
    return (channel as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.BindingCallInitializer) {
    super(parent, type, guid, initializer);
  }

  async call(func: (source: structs.BindingSource, ...args: any[]) => any) {
    try {
      const frame = Frame.from(this._initializer.frame);
      const source = {
        context: frame._page!.context(),
        page: frame._page!,
        frame
      };
      let result: any;
      if (this._initializer.handle)
        result = await func(source, JSHandle.from(this._initializer.handle));
      else
        result = await func(source, ...this._initializer.args!.map(parseResult));
      this._channel.resolve({ result: serializeArgument(result) }).catch(() => {});
    } catch (e) {
      this._channel.reject({ error: serializeError(e) }).catch(() => {});
    }
  }
}

function trimUrl(param: any): string | undefined {
  if (isRegExp(param))
    return `/${trimStringWithEllipsis(param.source, 50)}/${param.flags}`;
  if (isString(param))
    return `"${trimStringWithEllipsis(param, 50)}"`;
}
