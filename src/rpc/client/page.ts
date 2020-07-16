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

import { TimeoutError } from '../../errors';
import { Events } from '../../events';
import { assert, assertMaxArguments, helper, Listener } from '../../helper';
import { TimeoutSettings } from '../../timeoutSettings';
import * as types from '../../types';
import { BindingCallChannel, BindingCallInitializer, PageChannel, PageInitializer, PDFOptions } from '../channels';
import { parseError, serializeError, headersObjectToArray } from '../serializers';
import { Accessibility } from './accessibility';
import { BrowserContext } from './browserContext';
import { ChannelOwner } from './channelOwner';
import { ConsoleMessage } from './consoleMessage';
import { Dialog } from './dialog';
import { Download } from './download';
import { ElementHandle } from './elementHandle';
import { Worker } from './worker';
import { Frame, FunctionWithSource, GotoOptions } from './frame';
import { Keyboard, Mouse } from './input';
import { Func1, FuncOn, SmartHandle, serializeArgument } from './jsHandle';
import { Request, Response, Route, RouteHandler } from './network';
import { FileChooser } from './fileChooser';
import { Buffer } from 'buffer';
import { Coverage } from './coverage';
import { Waiter } from './waiter';

import * as fs from 'fs';
import * as util from 'util';

const fsWriteFileAsync = util.promisify(fs.writeFile.bind(fs));

export class Page extends ChannelOwner<PageChannel, PageInitializer> {
  private _browserContext: BrowserContext;
  _ownedContext: BrowserContext | undefined;

  private _mainFrame: Frame;
  private _frames = new Set<Frame>();
  _workers = new Set<Worker>();
  private _closed = false;
  private _viewportSize: types.Size | null;
  private _routes: { url: types.URLMatch, handler: RouteHandler }[] = [];

  readonly accessibility: Accessibility;
  readonly keyboard: Keyboard;
  readonly mouse: Mouse;
  coverage: Coverage | null = null;
  pdf?: (options?: types.PDFOptions) => Promise<Buffer>;

  readonly _bindings = new Map<string, FunctionWithSource>();
  readonly _timeoutSettings: TimeoutSettings;
  _isPageCall = false;

  static from(page: PageChannel): Page {
    return (page as any)._object;
  }

  static fromNullable(page: PageChannel | null): Page | null {
    return page ? Page.from(page) : null;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: PageInitializer) {
    super(parent, type, guid, initializer);
    this.setMaxListeners(0);
    this._browserContext = parent as BrowserContext;
    this._timeoutSettings = new TimeoutSettings(this._browserContext._timeoutSettings);

    this.accessibility = new Accessibility(this._channel);
    this.keyboard = new Keyboard(this._channel);
    this.mouse = new Mouse(this._channel);

    this._mainFrame = Frame.from(initializer.mainFrame);
    this._mainFrame._page = this;
    this._frames.add(this._mainFrame);
    this._viewportSize = initializer.viewportSize;
    this._closed = initializer.isClosed;

    this._channel.on('bindingCall', ({ binding }) => this._onBinding(BindingCall.from(binding)));
    this._channel.on('close', () => this._onClose());
    this._channel.on('console', ({ message }) => this.emit(Events.Page.Console, ConsoleMessage.from(message)));
    this._channel.on('crash', () => this._onCrash());
    this._channel.on('dialog', ({ dialog }) => this.emit(Events.Page.Dialog, Dialog.from(dialog)));
    this._channel.on('domcontentloaded', () => this.emit(Events.Page.DOMContentLoaded));
    this._channel.on('download', ({ download }) => this.emit(Events.Page.Download, Download.from(download)));
    this._channel.on('fileChooser', ({ element, isMultiple }) => this.emit(Events.Page.FileChooser, new FileChooser(this, ElementHandle.from(element), isMultiple)));
    this._channel.on('frameAttached', ({ frame }) => this._onFrameAttached(Frame.from(frame)));
    this._channel.on('frameDetached', ({ frame }) => this._onFrameDetached(Frame.from(frame)));
    this._channel.on('load', () => this.emit(Events.Page.Load));
    this._channel.on('pageError', ({ error }) => this.emit(Events.Page.PageError, parseError(error)));
    this._channel.on('popup', ({ page }) => this.emit(Events.Page.Popup, Page.from(page)));
    this._channel.on('request', ({ request }) => this.emit(Events.Page.Request, Request.from(request)));
    this._channel.on('requestFailed', ({ request, failureText }) => this._onRequestFailed(Request.from(request), failureText));
    this._channel.on('requestFinished', ({ request }) => this.emit(Events.Page.RequestFinished, Request.from(request)));
    this._channel.on('response', ({ response }) => this.emit(Events.Page.Response, Response.from(response)));
    this._channel.on('route', ({ route, request }) => this._onRoute(Route.from(route), Request.from(request)));
    this._channel.on('worker', ({ worker }) => this._onWorker(Worker.from(worker)));

    if (this._browserContext._browserName === 'chromium') {
      this.coverage = new Coverage(this._channel);
      this.pdf = options => this._pdf(options);
    }
  }

  private _onRequestFailed(request: Request, failureText: string | null) {
    request._failureText = failureText;
    this.emit(Events.Page.RequestFailed,  request);
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
      if (helper.urlMatches(request.url(), url)) {
        handler(route, request);
        return;
      }
    }
    this._browserContext._onRoute(route, request);
  }

  async _onBinding(bindingCall: BindingCall) {
    const func = this._bindings.get(bindingCall._initializer.name);
    if (func) {
      bindingCall.call(func);
      return;
    }
    this._browserContext._onBinding(bindingCall);
  }

  _onWorker(worker: Worker): void {
    this._workers.add(worker);
    worker._page = this;
    this.emit(Events.Page.Worker, worker);
  }

  private _onClose() {
    this._closed = true;
    this._browserContext._pages.delete(this);
    this.emit(Events.Page.Close);
  }

  private _onCrash() {
    this.emit(Events.Page.Crash);
  }

  context(): BrowserContext {
    return this._browserContext;
  }

  async opener(): Promise<Page | null> {
    return Page.fromNullable((await this._channel.opener()).page);
  }

  mainFrame(): Frame {
    return this._mainFrame;
  }

  frame(options: string | { name?: string, url?: types.URLMatch }): Frame | null {
    const name = helper.isString(options) ? options : options.name;
    const url = helper.isObject(options) ? options.url : undefined;
    assert(name || url, 'Either name or url matcher should be specified');
    return this.frames().find(f => {
      if (name)
        return f.name() === name;
      return helper.urlMatches(f.url(), url);
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

  private _attributeToPage<T>(func: () => T): T {
    try {
      this._isPageCall = true;
      return func();
    } finally {
      this._isPageCall = false;
    }
  }

  async $(selector: string): Promise<ElementHandle<Element> | null> {
    return this._attributeToPage(() => this._mainFrame.$(selector));
  }

  async waitForSelector(selector: string, options?: types.WaitForElementOptions): Promise<ElementHandle<Element> | null> {
    return this._attributeToPage(() => this._mainFrame.waitForSelector(selector, options));
  }

  async dispatchEvent(selector: string, type: string, eventInit?: any, options?: types.TimeoutOptions): Promise<void> {
    return this._attributeToPage(() => this._mainFrame.dispatchEvent(selector, type, eventInit, options));
  }

  async evaluateHandle<R, Arg>(pageFunction: Func1<Arg, R>, arg: Arg): Promise<SmartHandle<R>>;
  async evaluateHandle<R>(pageFunction: Func1<void, R>, arg?: any): Promise<SmartHandle<R>>;
  async evaluateHandle<R, Arg>(pageFunction: Func1<Arg, R>, arg: Arg): Promise<SmartHandle<R>> {
    assertMaxArguments(arguments.length, 2);
    return this._attributeToPage(() => this._mainFrame.evaluateHandle(pageFunction, arg));
  }

  async $eval<R, Arg>(selector: string, pageFunction: FuncOn<Element, Arg, R>, arg: Arg): Promise<R>;
  async $eval<R>(selector: string, pageFunction: FuncOn<Element, void, R>, arg?: any): Promise<R>;
  async $eval<R, Arg>(selector: string, pageFunction: FuncOn<Element, Arg, R>, arg: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 3);
    return this._attributeToPage(() => this._mainFrame.$eval(selector, pageFunction, arg));
  }

  async $$eval<R, Arg>(selector: string, pageFunction: FuncOn<Element[], Arg, R>, arg: Arg): Promise<R>;
  async $$eval<R>(selector: string, pageFunction: FuncOn<Element[], void, R>, arg?: any): Promise<R>;
  async $$eval<R, Arg>(selector: string, pageFunction: FuncOn<Element[], Arg, R>, arg: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 3);
    return this._attributeToPage(() => this._mainFrame.$$eval(selector, pageFunction, arg));
  }

  async $$(selector: string): Promise<ElementHandle<Element>[]> {
    return this._attributeToPage(() => this._mainFrame.$$(selector));
  }

  async addScriptTag(options: { url?: string; path?: string; content?: string; type?: string; }): Promise<ElementHandle> {
    return this._attributeToPage(() => this._mainFrame.addScriptTag(options));
  }

  async addStyleTag(options: { url?: string; path?: string; content?: string; }): Promise<ElementHandle> {
    return  await this._mainFrame.addStyleTag(options);
  }

  async exposeFunction(name: string, playwrightFunction: Function) {
    await this.exposeBinding(name, (options, ...args: any) => playwrightFunction(...args));
  }

  async exposeBinding(name: string, binding: FunctionWithSource) {
    if (this._bindings.has(name))
      throw new Error(`Function "${name}" has been already registered`);
    if (this._browserContext._bindings.has(name))
      throw new Error(`Function "${name}" has been already registered in the browser context`);
    this._bindings.set(name, binding);
    await this._channel.exposeBinding({ name });
  }

  async setExtraHTTPHeaders(headers: types.Headers) {
    await this._channel.setExtraHTTPHeaders({ headers: headersObjectToArray(headers) });
  }

  url(): string {
    return this._attributeToPage(() => this._mainFrame.url());
  }

  async content(): Promise<string> {
    return this._attributeToPage(() => this._mainFrame.content());
  }

  async setContent(html: string, options?: types.NavigateOptions): Promise<void> {
    return this._attributeToPage(() => this._mainFrame.setContent(html, options));
  }

  async goto(url: string, options?: GotoOptions): Promise<Response | null> {
    return this._attributeToPage(() => this._mainFrame.goto(url, options));
  }

  async reload(options: types.NavigateOptions = {}): Promise<Response | null> {
    return Response.fromNullable((await this._channel.reload(options)).response);
  }

  async waitForLoadState(state?: types.LifecycleEvent, options?: types.TimeoutOptions): Promise<void> {
    return this._attributeToPage(() => this._mainFrame.waitForLoadState(state, options));
  }

  async waitForNavigation(options?: types.WaitForNavigationOptions): Promise<Response | null> {
    return this._attributeToPage(() => this._mainFrame.waitForNavigation(options));
  }

  async waitForRequest(urlOrPredicate: string | RegExp | ((r: Request) => boolean), options: types.TimeoutOptions = {}): Promise<Request> {
    const predicate = (request: Request) => {
      if (helper.isString(urlOrPredicate) || helper.isRegExp(urlOrPredicate))
        return helper.urlMatches(request.url(), urlOrPredicate);
      return urlOrPredicate(request);
    };
    return this.waitForEvent(Events.Page.Request, { predicate, timeout: options.timeout });
  }

  async waitForResponse(urlOrPredicate: string | RegExp | ((r: Response) => boolean), options: types.TimeoutOptions = {}): Promise<Response> {
    const predicate = (response: Response) => {
      if (helper.isString(urlOrPredicate) || helper.isRegExp(urlOrPredicate))
        return helper.urlMatches(response.url(), urlOrPredicate);
      return urlOrPredicate(response);
    };
    return this.waitForEvent(Events.Page.Response, { predicate, timeout: options.timeout });
  }

  async waitForEvent(event: string, optionsOrPredicate: types.WaitForEventOptions = {}): Promise<any> {
    const timeout = this._timeoutSettings.timeout(optionsOrPredicate instanceof Function ? {} : optionsOrPredicate);
    const predicate = optionsOrPredicate instanceof Function ? optionsOrPredicate : optionsOrPredicate.predicate;
    const waiter = new Waiter();
    waiter.rejectOnTimeout(timeout, new TimeoutError(`Timeout while waiting for event "${event}"`));
    if (event !== Events.Page.Crash)
      waiter.rejectOnEvent(this, Events.Page.Crash, new Error('Page crashed'));
    if (event !== Events.Page.Close)
      waiter.rejectOnEvent(this, Events.Page.Close, new Error('Page closed'));
    const result = await waiter.waitForEvent(this, event, predicate as any);
    waiter.dispose();
    return result;
  }

  async goBack(options: types.NavigateOptions = {}): Promise<Response | null> {
    return Response.fromNullable((await this._channel.goBack(options)).response);
  }

  async goForward(options: types.NavigateOptions = {}): Promise<Response | null> {
    return Response.fromNullable((await this._channel.goForward(options)).response);
  }

  async emulateMedia(options: { media?: types.MediaType, colorScheme?: types.ColorScheme }) {
    await this._channel.emulateMedia(options);
  }

  async setViewportSize(viewportSize: types.Size) {
    this._viewportSize = viewportSize;
    await this._channel.setViewportSize({ viewportSize });
  }

  viewportSize(): types.Size | null {
    return this._viewportSize;
  }

  async evaluate<R, Arg>(pageFunction: Func1<Arg, R>, arg: Arg): Promise<R>;
  async evaluate<R>(pageFunction: Func1<void, R>, arg?: any): Promise<R>;
  async evaluate<R, Arg>(pageFunction: Func1<Arg, R>, arg: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 2);
    return this._attributeToPage(() => this._mainFrame.evaluate(pageFunction, arg));
  }

  async addInitScript(script: Function | string | { path?: string, content?: string }, arg?: any) {
    const source = await helper.evaluationScript(script, arg);
    await this._channel.addInitScript({ source });
  }

  async route(url: types.URLMatch, handler: RouteHandler): Promise<void> {
    this._routes.push({ url, handler });
    if (this._routes.length === 1)
      await this._channel.setNetworkInterceptionEnabled({ enabled: true });
  }

  async unroute(url: types.URLMatch, handler?: RouteHandler): Promise<void> {
    this._routes = this._routes.filter(route => route.url !== url || (handler && route.handler !== handler));
    if (this._routes.length === 0)
      await this._channel.setNetworkInterceptionEnabled({ enabled: false });
  }

  async screenshot(options: types.ScreenshotOptions = {}): Promise<Buffer> {
    return this._wrapApiCall('page.screenshot', async () => {
      return Buffer.from((await this._channel.screenshot(options)).binary, 'base64');
    });
  }

  async title(): Promise<string> {
    return this._attributeToPage(() => this._mainFrame.title());
  }

  async close(options: { runBeforeUnload?: boolean } = {runBeforeUnload: undefined}) {
    await this._channel.close(options);
    if (this._ownedContext)
      await this._ownedContext.close();
  }

  isClosed(): boolean {
    return this._closed;
  }

  async click(selector: string, options?: types.MouseClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions) {
    return this._attributeToPage(() => this._mainFrame.click(selector, options));
  }

  async dblclick(selector: string, options?: types.MouseMultiClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions) {
    return this._attributeToPage(() => this._mainFrame.dblclick(selector, options));
  }

  async fill(selector: string, value: string, options?: types.NavigatingActionWaitOptions) {
    return this._attributeToPage(() => this._mainFrame.fill(selector, value, options));
  }

  async focus(selector: string, options?: types.TimeoutOptions) {
    return this._attributeToPage(() => this._mainFrame.focus(selector, options));
  }

  async textContent(selector: string, options?: types.TimeoutOptions): Promise<null|string> {
    return this._attributeToPage(() => this._mainFrame.textContent(selector, options));
  }

  async innerText(selector: string, options?: types.TimeoutOptions): Promise<string> {
    return this._attributeToPage(() => this._mainFrame.innerText(selector, options));
  }

  async innerHTML(selector: string, options?: types.TimeoutOptions): Promise<string> {
    return this._attributeToPage(() => this._mainFrame.innerHTML(selector, options));
  }

  async getAttribute(selector: string, name: string, options?: types.TimeoutOptions): Promise<string | null> {
    return this._attributeToPage(() => this._mainFrame.getAttribute(selector, name, options));
  }

  async hover(selector: string, options?: types.PointerActionOptions & types.PointerActionWaitOptions) {
    return this._attributeToPage(() => this._mainFrame.hover(selector, options));
  }

  async selectOption(selector: string, values: string | ElementHandle | types.SelectOption | string[] | ElementHandle[] | types.SelectOption[] | null, options?: types.NavigatingActionWaitOptions): Promise<string[]> {
    return this._attributeToPage(() => this._mainFrame.selectOption(selector, values, options));
  }

  async setInputFiles(selector: string, files: string | types.FilePayload | string[] | types.FilePayload[], options?: types.NavigatingActionWaitOptions): Promise<void> {
    return this._attributeToPage(() => this._mainFrame.setInputFiles(selector, files, options));
  }

  async type(selector: string, text: string, options?: { delay?: number } & types.NavigatingActionWaitOptions) {
    return this._attributeToPage(() => this._mainFrame.type(selector, text, options));
  }

  async press(selector: string, key: string, options?: { delay?: number } & types.NavigatingActionWaitOptions) {
    return this._attributeToPage(() => this._mainFrame.press(selector, key, options));
  }

  async check(selector: string, options?: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions) {
    return this._attributeToPage(() => this._mainFrame.check(selector, options));
  }

  async uncheck(selector: string, options?: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions) {
    return this._attributeToPage(() => this._mainFrame.uncheck(selector, options));
  }

  async waitForTimeout(timeout: number) {
    await this._mainFrame.waitForTimeout(timeout);
  }

  async waitForFunction<R, Arg>(pageFunction: Func1<Arg, R>, arg: Arg, options?: types.WaitForFunctionOptions): Promise<SmartHandle<R>>;
  async waitForFunction<R>(pageFunction: Func1<void, R>, arg?: any, options?: types.WaitForFunctionOptions): Promise<SmartHandle<R>>;
  async waitForFunction<R, Arg>(pageFunction: Func1<Arg, R>, arg: Arg, options?: types.WaitForFunctionOptions): Promise<SmartHandle<R>> {
    return this._attributeToPage(() => this._mainFrame.waitForFunction(pageFunction, arg, options));
  }

  workers(): Worker[] {
    return [...this._workers];
  }

  on(event: string | symbol, listener: Listener): this {
    if (event === Events.Page.FileChooser) {
      if (!this.listenerCount(event))
        this._channel.setFileChooserInterceptedNoReply({ intercepted: true });
    }
    super.on(event, listener);
    return this;
  }

  removeListener(event: string | symbol, listener: Listener): this {
    super.removeListener(event, listener);
    if (event === Events.Page.FileChooser && !this.listenerCount(event))
      this._channel.setFileChooserInterceptedNoReply({ intercepted: false });
    return this;
  }

  async _pdf(options: types.PDFOptions = {}): Promise<Buffer> {
    const path = options.path;
    const transportOptions: PDFOptions = { ...options } as PDFOptions;
    if (path)
      delete (transportOptions as any).path;
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
    const buffer = Buffer.from(result.pdf, 'base64');
    if (path)
      await fsWriteFileAsync(path, buffer);
    return buffer;
  }
}

export class BindingCall extends ChannelOwner<BindingCallChannel, BindingCallInitializer> {
  static from(channel: BindingCallChannel): BindingCall {
    return (channel as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: BindingCallInitializer) {
    super(parent, type, guid, initializer);
  }

  async call(func: FunctionWithSource) {
    try {
      const frame = Frame.from(this._initializer.frame);
      const source = {
        context: frame._page!.context(),
        page: frame._page!,
        frame
      };
      const result = await func(source, ...this._initializer.args);
      this._channel.resolve({ result: serializeArgument(result) });
    } catch (e) {
      this._channel.reject({ error: serializeError(e) });
    }
  }
}
