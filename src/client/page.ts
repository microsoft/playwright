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

import { Events } from './events';
import { assert } from '../utils/utils';
import { TimeoutSettings } from '../utils/timeoutSettings';
import * as channels from '../protocol/channels';
import { parseError, serializeError } from '../protocol/serializers';
import { Accessibility } from './accessibility';
import { BrowserContext } from './browserContext';
import { ChannelOwner } from './channelOwner';
import { ConsoleMessage } from './consoleMessage';
import { Dialog } from './dialog';
import { Download } from './download';
import { ElementHandle, determineScreenshotType } from './elementHandle';
import { Worker } from './worker';
import { Frame, verifyLoadState, WaitForNavigationOptions } from './frame';
import { Keyboard, Mouse, Touchscreen } from './input';
import { assertMaxArguments, serializeArgument, parseResult, JSHandle } from './jsHandle';
import { Request, Response, Route, RouteHandler, WebSocket, validateHeaders } from './network';
import { FileChooser } from './fileChooser';
import { Buffer } from 'buffer';
import { Coverage } from './coverage';
import { Waiter } from './waiter';
import * as api from '../../types/types';
import * as structs from '../../types/structs';
import fs from 'fs';
import path from 'path';
import { Size, URLMatch, Headers, LifecycleEvent, WaitForEventOptions, SelectOption, SelectOptionOptions, FilePayload, WaitForFunctionOptions } from './types';
import { evaluationScript, urlMatches } from './clientHelper';
import { isString, isRegExp, isObject, mkdirIfNeeded, headersObjectToArray } from '../utils/utils';
import { isSafeCloseError } from '../utils/errors';
import { Video } from './video';
import { Artifact } from './artifact';

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
type Listener = (...args: any[]) => void;

export class Page extends ChannelOwner<channels.PageChannel, channels.PageInitializer> implements api.Page {
  private _browserContext: BrowserContext;
  _ownedContext: BrowserContext | undefined;

  private _mainFrame: Frame;
  private _frames = new Set<Frame>();
  _workers = new Set<Worker>();
  private _closed = false;
  _closedOrCrashedPromise: Promise<void>;
  private _viewportSize: Size | null;
  private _routes: { url: URLMatch, handler: RouteHandler }[] = [];

  readonly accessibility: Accessibility;
  readonly coverage: Coverage;
  readonly keyboard: Keyboard;
  readonly mouse: Mouse;
  readonly touchscreen: Touchscreen;

  readonly _bindings = new Map<string, (source: structs.BindingSource, ...args: any[]) => any>();
  readonly _timeoutSettings: TimeoutSettings;
  _isPageCall = false;
  private _video: Video | null = null;
  readonly _opener: Page | null;

  static from(page: channels.PageChannel): Page {
    return (page as any)._object;
  }

  static fromNullable(page: channels.PageChannel | undefined): Page | null {
    return page ? Page.from(page) : null;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.PageInitializer) {
    super(parent, type, guid, initializer);
    this._browserContext = parent as BrowserContext;
    this._timeoutSettings = new TimeoutSettings(this._browserContext._timeoutSettings);

    this.accessibility = new Accessibility(this._channel);
    this.keyboard = new Keyboard(this._channel);
    this.mouse = new Mouse(this._channel);
    this.touchscreen = new Touchscreen(this._channel);

    this._mainFrame = Frame.from(initializer.mainFrame);
    this._mainFrame._page = this;
    this._frames.add(this._mainFrame);
    this._viewportSize = initializer.viewportSize || null;
    this._closed = initializer.isClosed;
    this._opener = Page.fromNullable(initializer.opener);

    this._channel.on('bindingCall', ({ binding }) => this._onBinding(BindingCall.from(binding)));
    this._channel.on('close', () => this._onClose());
    this._channel.on('console', ({ message }) => this.emit(Events.Page.Console, ConsoleMessage.from(message)));
    this._channel.on('crash', () => this._onCrash());
    this._channel.on('dialog', ({ dialog }) => {
      if (!this.emit(Events.Page.Dialog, Dialog.from(dialog)))
        dialog.dismiss().catch(() => {});
    });
    this._channel.on('domcontentloaded', () => this.emit(Events.Page.DOMContentLoaded, this));
    this._channel.on('download', ({ url, suggestedFilename, artifact }) => {
      const artifactObject = Artifact.from(artifact);
      artifactObject._isRemote = !!this._browserContext._browser && !!this._browserContext._browser._remoteType;
      artifactObject._apiName = 'download';
      this.emit(Events.Page.Download, new Download(this, url, suggestedFilename, artifactObject));
    });
    this._channel.on('fileChooser', ({ element, isMultiple }) => this.emit(Events.Page.FileChooser, new FileChooser(this, ElementHandle.from(element), isMultiple)));
    this._channel.on('frameAttached', ({ frame }) => this._onFrameAttached(Frame.from(frame)));
    this._channel.on('frameDetached', ({ frame }) => this._onFrameDetached(Frame.from(frame)));
    this._channel.on('load', () => this.emit(Events.Page.Load, this));
    this._channel.on('pageError', ({ error }) => this.emit(Events.Page.PageError, parseError(error)));
    this._channel.on('route', ({ route, request }) => this._onRoute(Route.from(route), Request.from(request)));
    this._channel.on('video', ({ artifact }) => {
      const artifactObject = Artifact.from(artifact);
      artifactObject._apiName = 'video';
      this._forceVideo()._artifactReady(artifactObject);
    });
    this._channel.on('webSocket', ({ webSocket }) => this.emit(Events.Page.WebSocket, WebSocket.from(webSocket)));
    this._channel.on('worker', ({ worker }) => this._onWorker(Worker.from(worker)));

    this.coverage = new Coverage(this._channel);

    this._closedOrCrashedPromise = Promise.race([
      new Promise<void>(f => this.once(Events.Page.Close, f)),
      new Promise<void>(f => this.once(Events.Page.Crash, f)),
    ]);
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

  private _onRoute(route: Route, request: Request) {
    for (const {url, handler} of this._routes) {
      if (urlMatches(request.url(), url)) {
        handler(route, request);
        return;
      }
    }
    this._browserContext._onRoute(route, request);
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
      return urlMatches(f.url(), url);
    }) || null;
  }

  frames(): Frame[] {
    return [...this._frames];
  }

  setDefaultNavigationTimeout(timeout: number) {
    this._timeoutSettings.setDefaultNavigationTimeout(timeout);
    this._channel.setDefaultNavigationTimeoutNoReply({ timeout });
  }

  setDefaultTimeout(timeout: number) {
    this._timeoutSettings.setDefaultTimeout(timeout);
    this._channel.setDefaultTimeoutNoReply({ timeout });
  }

  private _forceVideo(): Video {
    if (!this._video)
      this._video = new Video(this);
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

  private _attributeToPage<T>(func: () => T): T {
    try {
      this._isPageCall = true;
      return func();
    } finally {
      this._isPageCall = false;
    }
  }

  async $(selector: string): Promise<ElementHandle<SVGElement | HTMLElement> | null> {
    return this._attributeToPage(() => this._mainFrame.$(selector));
  }

  waitForSelector(selector: string, options: channels.FrameWaitForSelectorOptions & { state: 'attached' | 'visible' }): Promise<ElementHandle<SVGElement | HTMLElement>>;
  waitForSelector(selector: string, options?: channels.FrameWaitForSelectorOptions): Promise<ElementHandle<SVGElement | HTMLElement> | null>;
  async waitForSelector(selector: string, options?: channels.FrameWaitForSelectorOptions): Promise<ElementHandle<SVGElement | HTMLElement> | null> {
    return this._attributeToPage(() => this._mainFrame.waitForSelector(selector, options));
  }

  async dispatchEvent(selector: string, type: string, eventInit?: any, options?: channels.FrameDispatchEventOptions): Promise<void> {
    return this._attributeToPage(() => this._mainFrame.dispatchEvent(selector, type, eventInit, options));
  }

  async evaluateHandle<R, Arg>(pageFunction: structs.PageFunction<Arg, R>, arg?: Arg): Promise<structs.SmartHandle<R>> {
    assertMaxArguments(arguments.length, 2);
    return this._attributeToPage(() => this._mainFrame.evaluateHandle(pageFunction, arg));
  }

  async $eval<R, Arg>(selector: string, pageFunction: structs.PageFunctionOn<Element, Arg, R>, arg?: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 3);
    return this._attributeToPage(() => this._mainFrame.$eval(selector, pageFunction, arg));
  }

  async $$eval<R, Arg>(selector: string, pageFunction: structs.PageFunctionOn<Element[], Arg, R>, arg?: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 3);
    return this._attributeToPage(() => this._mainFrame.$$eval(selector, pageFunction, arg));
  }

  async $$(selector: string): Promise<ElementHandle<SVGElement | HTMLElement>[]> {
    return this._attributeToPage(() => this._mainFrame.$$(selector));
  }

  async addScriptTag(options: { url?: string; path?: string; content?: string; type?: string; } = {}): Promise<ElementHandle> {
    return this._attributeToPage(() => this._mainFrame.addScriptTag(options));
  }

  async addStyleTag(options: { url?: string; path?: string; content?: string; } = {}): Promise<ElementHandle> {
    return this._attributeToPage(() => this._mainFrame.addStyleTag(options));
  }

  async exposeFunction(name: string, callback: Function) {
    return this._wrapApiCall('page.exposeFunction', async (channel: channels.PageChannel) => {
      await channel.exposeBinding({ name });
      const binding = (source: structs.BindingSource, ...args: any[]) => callback(...args);
      this._bindings.set(name, binding);
    });
  }

  async exposeBinding(name: string, callback: (source: structs.BindingSource, ...args: any[]) => any, options: { handle?: boolean } = {}) {
    return this._wrapApiCall('page.exposeBinding', async (channel: channels.PageChannel) => {
      await channel.exposeBinding({ name, needsHandle: options.handle });
      this._bindings.set(name, callback);
    });
  }

  async setExtraHTTPHeaders(headers: Headers) {
    return this._wrapApiCall('page.setExtraHTTPHeaders', async (channel: channels.PageChannel) => {
      validateHeaders(headers);
      await channel.setExtraHTTPHeaders({ headers: headersObjectToArray(headers) });
    });
  }

  url(): string {
    return this._attributeToPage(() => this._mainFrame.url());
  }

  async content(): Promise<string> {
    return this._attributeToPage(() => this._mainFrame.content());
  }

  async setContent(html: string, options?: channels.FrameSetContentOptions): Promise<void> {
    return this._attributeToPage(() => this._mainFrame.setContent(html, options));
  }

  async goto(url: string, options?: channels.FrameGotoOptions): Promise<Response | null> {
    return this._attributeToPage(() => this._mainFrame.goto(url, options));
  }

  async reload(options: channels.PageReloadOptions = {}): Promise<Response | null> {
    return this._wrapApiCall('page.reload', async (channel: channels.PageChannel) => {
      const waitUntil = verifyLoadState('waitUntil', options.waitUntil === undefined ? 'load' : options.waitUntil);
      return Response.fromNullable((await channel.reload({ ...options, waitUntil })).response);
    });
  }

  async waitForLoadState(state?: LifecycleEvent, options?: { timeout?: number }): Promise<void> {
    return this._attributeToPage(() => this._mainFrame.waitForLoadState(state, options));
  }

  async waitForNavigation(options?: WaitForNavigationOptions): Promise<Response | null> {
    return this._attributeToPage(() => this._mainFrame.waitForNavigation(options));
  }

  async waitForURL(url: URLMatch, options?: { waitUntil?: LifecycleEvent, timeout?: number }): Promise<void> {
    return this._attributeToPage(() => this._mainFrame.waitForURL(url, options));
  }

  async waitForRequest(urlOrPredicate: string | RegExp | ((r: Request) => boolean | Promise<boolean>), options: { timeout?: number } = {}): Promise<Request> {
    return this._wrapApiCall('page.waitForRequest', async (channel: channels.PageChannel) => {
      const predicate = (request: Request) => {
        if (isString(urlOrPredicate) || isRegExp(urlOrPredicate))
          return urlMatches(request.url(), urlOrPredicate);
        return urlOrPredicate(request);
      };
      const trimmedUrl = trimUrl(urlOrPredicate);
      const logLine = trimmedUrl ? `waiting for request ${trimmedUrl}` : undefined;
      return this._waitForEvent(Events.Page.Request, { predicate, timeout: options.timeout }, logLine);
    });
  }

  async waitForResponse(urlOrPredicate: string | RegExp | ((r: Response) => boolean | Promise<boolean>), options: { timeout?: number } = {}): Promise<Response> {
    return this._wrapApiCall('page.waitForResponse', async (channel: channels.PageChannel) => {
      const predicate = (response: Response) => {
        if (isString(urlOrPredicate) || isRegExp(urlOrPredicate))
          return urlMatches(response.url(), urlOrPredicate);
        return urlOrPredicate(response);
      };
      const trimmedUrl = trimUrl(urlOrPredicate);
      const logLine = trimmedUrl ? `waiting for response ${trimmedUrl}` : undefined;
      return this._waitForEvent(Events.Page.Response, { predicate, timeout: options.timeout }, logLine);
    });
  }

  async waitForEvent(event: string, optionsOrPredicate: WaitForEventOptions = {}): Promise<any> {
    return this._wrapApiCall('page.waitForEvent', async (channel: channels.PageChannel) => {
      return this._waitForEvent(event, optionsOrPredicate, `waiting for event "${event}"`);
    });
  }

  private async _waitForEvent(event: string, optionsOrPredicate: WaitForEventOptions, logLine?: string): Promise<any> {
    const timeout = this._timeoutSettings.timeout(typeof optionsOrPredicate === 'function' ? {} : optionsOrPredicate);
    const predicate = typeof optionsOrPredicate === 'function' ? optionsOrPredicate : optionsOrPredicate.predicate;
    const waiter = Waiter.createForEvent(this, 'page', event);
    if (logLine)
      waiter.log(logLine);
    waiter.rejectOnTimeout(timeout, `Timeout while waiting for event "${event}"`);
    if (event !== Events.Page.Crash)
      waiter.rejectOnEvent(this, Events.Page.Crash, new Error('Page crashed'));
    if (event !== Events.Page.Close)
      waiter.rejectOnEvent(this, Events.Page.Close, new Error('Page closed'));
    const result = await waiter.waitForEvent(this, event, predicate as any);
    waiter.dispose();
    return result;
  }

  async goBack(options: channels.PageGoBackOptions = {}): Promise<Response | null> {
    return this._wrapApiCall('page.goBack', async (channel: channels.PageChannel) => {
      const waitUntil = verifyLoadState('waitUntil', options.waitUntil === undefined ? 'load' : options.waitUntil);
      return Response.fromNullable((await channel.goBack({ ...options, waitUntil })).response);
    });
  }

  async goForward(options: channels.PageGoForwardOptions = {}): Promise<Response | null> {
    return this._wrapApiCall('page.goForward', async (channel: channels.PageChannel) => {
      const waitUntil = verifyLoadState('waitUntil', options.waitUntil === undefined ? 'load' : options.waitUntil);
      return Response.fromNullable((await channel.goForward({ ...options, waitUntil })).response);
    });
  }

  async emulateMedia(options: { media?: 'screen' | 'print' | null, colorScheme?: 'dark' | 'light' | 'no-preference' | null, reducedMotion?: 'reduce' | 'no-preference' | null } = {}) {
    return this._wrapApiCall('page.emulateMedia', async (channel: channels.PageChannel) => {
      await channel.emulateMedia({
        media: options.media === null ? 'null' : options.media,
        colorScheme: options.colorScheme === null ? 'null' : options.colorScheme,
        reducedMotion: options.reducedMotion === null ? 'null' : options.reducedMotion,
      });
    });
  }

  async setViewportSize(viewportSize: Size) {
    return this._wrapApiCall('page.setViewportSize', async (channel: channels.PageChannel) => {
      this._viewportSize = viewportSize;
      await channel.setViewportSize({ viewportSize });
    });
  }

  viewportSize(): Size | null {
    return this._viewportSize;
  }

  async evaluate<R, Arg>(pageFunction: structs.PageFunction<Arg, R>, arg?: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 2);
    return this._attributeToPage(() => this._mainFrame.evaluate(pageFunction, arg));
  }

  async addInitScript(script: Function | string | { path?: string, content?: string }, arg?: any) {
    return this._wrapApiCall('page.addInitScript', async (channel: channels.PageChannel) => {
      const source = await evaluationScript(script, arg);
      await channel.addInitScript({ source });
    });
  }

  async route(url: URLMatch, handler: RouteHandler): Promise<void> {
    return this._wrapApiCall('page.route', async (channel: channels.PageChannel) => {
      this._routes.push({ url, handler });
      if (this._routes.length === 1)
        await channel.setNetworkInterceptionEnabled({ enabled: true });
    });
  }

  async unroute(url: URLMatch, handler?: RouteHandler): Promise<void> {
    return this._wrapApiCall('page.unroute', async (channel: channels.PageChannel) => {
      this._routes = this._routes.filter(route => route.url !== url || (handler && route.handler !== handler));
      if (this._routes.length === 0)
        await channel.setNetworkInterceptionEnabled({ enabled: false });
    });
  }

  async screenshot(options: channels.PageScreenshotOptions & { path?: string } = {}): Promise<Buffer> {
    return this._wrapApiCall('page.screenshot', async (channel: channels.PageChannel) => {
      const copy = { ...options };
      if (!copy.type)
        copy.type = determineScreenshotType(options);
      const result = await channel.screenshot(copy);
      const buffer = Buffer.from(result.binary, 'base64');
      if (options.path) {
        await mkdirIfNeeded(options.path);
        await fs.promises.writeFile(options.path, buffer);
      }
      return buffer;
    });
  }

  async title(): Promise<string> {
    return this._attributeToPage(() => this._mainFrame.title());
  }

  async bringToFront(): Promise<void> {
    return this._wrapApiCall('page.bringToFront', async (channel: channels.PageChannel) => {
      await channel.bringToFront();
    });
  }

  async close(options: { runBeforeUnload?: boolean } = {runBeforeUnload: undefined}) {
    try {
      await this._wrapApiCall('page.close', async (channel: channels.PageChannel) => {
        await channel.close(options);
        if (this._ownedContext)
          await this._ownedContext.close();
      });
    } catch (e) {
      if (isSafeCloseError(e))
        return;
      throw e;
    }
  }

  isClosed(): boolean {
    return this._closed;
  }

  async click(selector: string, options?: channels.FrameClickOptions) {
    return this._attributeToPage(() => this._mainFrame.click(selector, options));
  }

  async dblclick(selector: string, options?: channels.FrameDblclickOptions) {
    return this._attributeToPage(() => this._mainFrame.dblclick(selector, options));
  }

  async tap(selector: string, options?: channels.FrameTapOptions) {
    return this._attributeToPage(() => this._mainFrame.tap(selector, options));
  }

  async fill(selector: string, value: string, options?: channels.FrameFillOptions) {
    return this._attributeToPage(() => this._mainFrame.fill(selector, value, options));
  }

  async focus(selector: string, options?: channels.FrameFocusOptions) {
    return this._attributeToPage(() => this._mainFrame.focus(selector, options));
  }

  async textContent(selector: string, options?: channels.FrameTextContentOptions): Promise<null|string> {
    return this._attributeToPage(() => this._mainFrame.textContent(selector, options));
  }

  async innerText(selector: string, options?: channels.FrameInnerTextOptions): Promise<string> {
    return this._attributeToPage(() => this._mainFrame.innerText(selector, options));
  }

  async innerHTML(selector: string, options?: channels.FrameInnerHTMLOptions): Promise<string> {
    return this._attributeToPage(() => this._mainFrame.innerHTML(selector, options));
  }

  async getAttribute(selector: string, name: string, options?: channels.FrameGetAttributeOptions): Promise<string | null> {
    return this._attributeToPage(() => this._mainFrame.getAttribute(selector, name, options));
  }

  async isChecked(selector: string, options?: channels.FrameIsCheckedOptions): Promise<boolean> {
    return this._attributeToPage(() => this._mainFrame.isChecked(selector, options));
  }

  async isDisabled(selector: string, options?: channels.FrameIsDisabledOptions): Promise<boolean> {
    return this._attributeToPage(() => this._mainFrame.isDisabled(selector, options));
  }

  async isEditable(selector: string, options?: channels.FrameIsEditableOptions): Promise<boolean> {
    return this._attributeToPage(() => this._mainFrame.isEditable(selector, options));
  }

  async isEnabled(selector: string, options?: channels.FrameIsEnabledOptions): Promise<boolean> {
    return this._attributeToPage(() => this._mainFrame.isEnabled(selector, options));
  }

  async isHidden(selector: string, options?: channels.FrameIsHiddenOptions): Promise<boolean> {
    return this._attributeToPage(() => this._mainFrame.isHidden(selector, options));
  }

  async isVisible(selector: string, options?: channels.FrameIsVisibleOptions): Promise<boolean> {
    return this._attributeToPage(() => this._mainFrame.isVisible(selector, options));
  }

  async hover(selector: string, options?: channels.FrameHoverOptions) {
    return this._attributeToPage(() => this._mainFrame.hover(selector, options));
  }

  async selectOption(selector: string, values: string | api.ElementHandle | SelectOption | string[] | api.ElementHandle[] | SelectOption[] | null, options?: SelectOptionOptions): Promise<string[]> {
    return this._attributeToPage(() => this._mainFrame.selectOption(selector, values, options));
  }

  async setInputFiles(selector: string, files: string | FilePayload | string[] | FilePayload[], options?: channels.FrameSetInputFilesOptions): Promise<void> {
    return this._attributeToPage(() => this._mainFrame.setInputFiles(selector, files, options));
  }

  async type(selector: string, text: string, options?: channels.FrameTypeOptions) {
    return this._attributeToPage(() => this._mainFrame.type(selector, text, options));
  }

  async press(selector: string, key: string, options?: channels.FramePressOptions) {
    return this._attributeToPage(() => this._mainFrame.press(selector, key, options));
  }

  async check(selector: string, options?: channels.FrameCheckOptions) {
    return this._attributeToPage(() => this._mainFrame.check(selector, options));
  }

  async uncheck(selector: string, options?: channels.FrameUncheckOptions) {
    return this._attributeToPage(() => this._mainFrame.uncheck(selector, options));
  }

  async waitForTimeout(timeout: number) {
    return this._attributeToPage(() => this._mainFrame.waitForTimeout(timeout));
  }

  async waitForFunction<R, Arg>(pageFunction: structs.PageFunction<Arg, R>, arg?: Arg, options?: WaitForFunctionOptions): Promise<structs.SmartHandle<R>> {
    return this._attributeToPage(() => this._mainFrame.waitForFunction(pageFunction, arg, options));
  }

  workers(): Worker[] {
    return [...this._workers];
  }

  on(event: string | symbol, listener: Listener): this {
    if (event === Events.Page.FileChooser && !this.listenerCount(event))
      this._channel.setFileChooserInterceptedNoReply({ intercepted: true });
    super.on(event, listener);
    return this;
  }

  addListener(event: string | symbol, listener: Listener): this {
    if (event === Events.Page.FileChooser && !this.listenerCount(event))
      this._channel.setFileChooserInterceptedNoReply({ intercepted: true });
    super.addListener(event, listener);
    return this;
  }

  off(event: string | symbol, listener: Listener): this {
    super.off(event, listener);
    if (event === Events.Page.FileChooser && !this.listenerCount(event))
      this._channel.setFileChooserInterceptedNoReply({ intercepted: false });
    return this;
  }

  removeListener(event: string | symbol, listener: Listener): this {
    super.removeListener(event, listener);
    if (event === Events.Page.FileChooser && !this.listenerCount(event))
      this._channel.setFileChooserInterceptedNoReply({ intercepted: false });
    return this;
  }

  async pause() {
    return this.context()._wrapApiCall('page.pause', async (channel: channels.BrowserContextChannel) => {
      await channel.pause();
    });
  }

  async pdf(options: PDFOptions = {}): Promise<Buffer> {
    return this._wrapApiCall('page.pdf', async (channel: channels.PageChannel) => {
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
      const result = await channel.pdf(transportOptions);
      const buffer = Buffer.from(result.pdf, 'base64');
      if (options.path) {
        await fs.promises.mkdir(path.dirname(options.path), { recursive: true });
        await fs.promises.writeFile(options.path, buffer);
      }
      return buffer;
    });
  }
}

export class BindingCall extends ChannelOwner<channels.BindingCallChannel, channels.BindingCallInitializer> {
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

function trimEnd(s: string): string {
  if (s.length > 50)
    s = s.substring(0, 50) + '\u2026';
  return s;
}

function trimUrl(param: any): string | undefined {
  if (isRegExp(param))
    return `/${trimEnd(param.source)}/${param.flags}`;
  if (isString(param))
    return `"${trimEnd(param)}"`;
}
