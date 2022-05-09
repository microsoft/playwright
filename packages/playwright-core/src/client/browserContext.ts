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

import { Page, BindingCall } from './page';
import { Frame } from './frame';
import * as network from './network';
import type * as channels from '../protocol/channels';
import fs from 'fs';
import { ChannelOwner } from './channelOwner';
import { evaluationScript } from './clientHelper';
import { Browser } from './browser';
import { Worker } from './worker';
import { Events } from './events';
import { TimeoutSettings } from '../common/timeoutSettings';
import { Waiter } from './waiter';
import type { URLMatch, Headers, WaitForEventOptions, BrowserContextOptions, StorageState, LaunchOptions } from './types';
import { headersObjectToArray } from '../utils';
import { mkdirIfNeeded } from '../utils/fileUtils';
import { isSafeCloseError } from '../common/errors';
import type * as api from '../../types/types';
import type * as structs from '../../types/structs';
import { CDPSession } from './cdpSession';
import { Tracing } from './tracing';
import type { BrowserType } from './browserType';
import { Artifact } from './artifact';
import { APIRequestContext } from './fetch';
import { createInstrumentation } from './clientInstrumentation';
import { rewriteErrorMessage } from '../utils/stackTrace';

export class BrowserContext extends ChannelOwner<channels.BrowserContextChannel> implements api.BrowserContext {
  _pages = new Set<Page>();
  private _routes: network.RouteHandler[] = [];
  readonly _browser: Browser | null = null;
  private _browserType: BrowserType | undefined;
  readonly _bindings = new Map<string, (source: structs.BindingSource, ...args: any[]) => any>();
  _timeoutSettings = new TimeoutSettings();
  _ownerPage: Page | undefined;
  private _closedPromise: Promise<void>;
  _options: channels.BrowserNewContextParams = { };

  readonly request: APIRequestContext;
  readonly tracing: Tracing;
  readonly _backgroundPages = new Set<Page>();
  readonly _serviceWorkers = new Set<Worker>();
  readonly _isChromium: boolean;

  static from(context: channels.BrowserContextChannel): BrowserContext {
    return (context as any)._object;
  }

  static fromNullable(context: channels.BrowserContextChannel | null): BrowserContext | null {
    return context ? BrowserContext.from(context) : null;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.BrowserContextInitializer) {
    super(parent, type, guid, initializer, createInstrumentation());
    if (parent instanceof Browser)
      this._browser = parent;
    this._isChromium = this._browser?._name === 'chromium';
    this.tracing = Tracing.from(initializer.tracing);
    this.request = APIRequestContext.from(initializer.APIRequestContext);

    this._channel.on('bindingCall', ({ binding }) => this._onBinding(BindingCall.from(binding)));
    this._channel.on('close', () => this._onClose());
    this._channel.on('page', ({ page }) => this._onPage(Page.from(page)));
    this._channel.on('route', ({ route, request }) => this._onRoute(network.Route.from(route), network.Request.from(request)));
    this._channel.on('backgroundPage', ({ page }) => {
      const backgroundPage = Page.from(page);
      this._backgroundPages.add(backgroundPage);
      this.emit(Events.BrowserContext.BackgroundPage, backgroundPage);
    });
    this._channel.on('serviceWorker', ({ worker }) => {
      const serviceWorker = Worker.from(worker);
      serviceWorker._context = this;
      this._serviceWorkers.add(serviceWorker);
      this.emit(Events.BrowserContext.ServiceWorker, serviceWorker);
    });
    this._channel.on('request', ({ request, page }) => this._onRequest(network.Request.from(request), Page.fromNullable(page)));
    this._channel.on('requestFailed', ({ request, failureText, responseEndTiming, page }) => this._onRequestFailed(network.Request.from(request), responseEndTiming, failureText, Page.fromNullable(page)));
    this._channel.on('requestFinished', params => this._onRequestFinished(params));
    this._channel.on('response', ({ response, page }) => this._onResponse(network.Response.from(response), Page.fromNullable(page)));
    this._closedPromise = new Promise(f => this.once(Events.BrowserContext.Close, f));
  }

  _setBrowserType(browserType: BrowserType) {
    this._browserType = browserType;
    browserType._contexts.add(this);
  }

  private _onPage(page: Page): void {
    this._pages.add(page);
    this.emit(Events.BrowserContext.Page, page);
    if (page._opener && !page._opener.isClosed())
      page._opener.emit(Events.Page.Popup, page);
  }

  private _onRequest(request: network.Request, page: Page | null) {
    this.emit(Events.BrowserContext.Request, request);
    if (page)
      page.emit(Events.Page.Request, request);
  }

  private _onResponse(response: network.Response, page: Page | null) {
    this.emit(Events.BrowserContext.Response, response);
    if (page)
      page.emit(Events.Page.Response, response);
  }

  private _onRequestFailed(request: network.Request, responseEndTiming: number, failureText: string | undefined, page: Page | null) {
    request._failureText = failureText || null;
    if (request._timing)
      request._timing.responseEnd = responseEndTiming;
    this.emit(Events.BrowserContext.RequestFailed, request);
    if (page)
      page.emit(Events.Page.RequestFailed, request);
  }

  private _onRequestFinished(params: channels.BrowserContextRequestFinishedEvent) {
    const { responseEndTiming } = params;
    const request = network.Request.from(params.request);
    const response = network.Response.fromNullable(params.response);
    const page = Page.fromNullable(params.page);
    if (request._timing)
      request._timing.responseEnd = responseEndTiming;
    this.emit(Events.BrowserContext.RequestFinished, request);
    if (page)
      page.emit(Events.Page.RequestFinished, request);
    if (response)
      response._finishedPromise.resolve();
  }

  _onRoute(route: network.Route, request: network.Request) {
    for (const routeHandler of this._routes) {
      if (routeHandler.matches(request.url())) {
        try {
          routeHandler.handle(route, request);
        } finally {
          if (!routeHandler.isActive()) {
            this._routes.splice(this._routes.indexOf(routeHandler), 1);
            if (!this._routes.length)
              this._wrapApiCall(() => this._disableInterception(), true).catch(() => {});
          }
        }
        return;
      }
    }
    // it can race with BrowserContext.close() which then throws since its closed
    route._internalContinue();
  }

  async _onBinding(bindingCall: BindingCall) {
    const func = this._bindings.get(bindingCall._initializer.name);
    if (!func)
      return;
    await bindingCall.call(func);
  }

  setDefaultNavigationTimeout(timeout: number) {
    this._timeoutSettings.setDefaultNavigationTimeout(timeout);
    this._wrapApiCall(async () => {
      this._channel.setDefaultNavigationTimeoutNoReply({ timeout });
    }, true);
  }

  setDefaultTimeout(timeout: number) {
    this._timeoutSettings.setDefaultTimeout(timeout);
    this._wrapApiCall(async () => {
      this._channel.setDefaultTimeoutNoReply({ timeout });
    }, true);
  }

  browser(): Browser | null {
    return this._browser;
  }

  pages(): Page[] {
    return [...this._pages];
  }

  async newPage(): Promise<Page> {
    if (this._ownerPage)
      throw new Error('Please use browser.newContext()');
    return Page.from((await this._channel.newPage()).page);
  }

  async cookies(urls?: string | string[]): Promise<network.NetworkCookie[]> {
    if (!urls)
      urls = [];
    if (urls && typeof urls === 'string')
      urls = [ urls ];
    return (await this._channel.cookies({ urls: urls as string[] })).cookies;
  }

  async addCookies(cookies: network.SetNetworkCookieParam[]): Promise<void> {
    await this._channel.addCookies({ cookies });
  }

  async clearCookies(): Promise<void> {
    await this._channel.clearCookies();
  }

  async grantPermissions(permissions: string[], options?: { origin?: string }): Promise<void> {
    await this._channel.grantPermissions({ permissions, ...options });
  }

  async clearPermissions(): Promise<void> {
    await this._channel.clearPermissions();
  }

  async setGeolocation(geolocation: { longitude: number, latitude: number, accuracy?: number } | null): Promise<void> {
    await this._channel.setGeolocation({ geolocation: geolocation || undefined });
  }

  async setExtraHTTPHeaders(headers: Headers): Promise<void> {
    network.validateHeaders(headers);
    await this._channel.setExtraHTTPHeaders({ headers: headersObjectToArray(headers) });
  }

  async setOffline(offline: boolean): Promise<void> {
    await this._channel.setOffline({ offline });
  }

  async setHTTPCredentials(httpCredentials: { username: string, password: string } | null): Promise<void> {
    await this._channel.setHTTPCredentials({ httpCredentials: httpCredentials || undefined });
  }

  async addInitScript(script: Function | string | { path?: string, content?: string }, arg?: any): Promise<void> {
    const source = await evaluationScript(script, arg);
    await this._channel.addInitScript({ source });
  }

  async _removeInitScripts() {
    await this._channel.removeInitScripts();
  }

  async exposeBinding(name: string, callback: (source: structs.BindingSource, ...args: any[]) => any, options: { handle?: boolean } = {}): Promise<void> {
    await this._channel.exposeBinding({ name, needsHandle: options.handle });
    this._bindings.set(name, callback);
  }

  async _removeExposedBindings() {
    for (const key of this._bindings.keys()) {
      if (!key.startsWith('__pw_'))
        this._bindings.delete(key);
    }
    await this._channel.removeExposedBindings();
  }

  async exposeFunction(name: string, callback: Function): Promise<void> {
    await this._channel.exposeBinding({ name });
    const binding = (source: structs.BindingSource, ...args: any[]) => callback(...args);
    this._bindings.set(name, binding);
  }

  async route(url: URLMatch, handler: network.RouteHandlerCallback, options: { times?: number } = {}): Promise<void> {
    this._routes.unshift(new network.RouteHandler(this._options.baseURL, url, handler, options.times));
    if (this._routes.length === 1)
      await this._channel.setNetworkInterceptionEnabled({ enabled: true });
  }

  async unroute(url: URLMatch, handler?: network.RouteHandlerCallback): Promise<void> {
    this._routes = this._routes.filter(route => route.url !== url || (handler && route.handler !== handler));
    if (!this._routes.length)
      await this._disableInterception();
  }

  async _unrouteAll() {
    this._routes = [];
    await this._disableInterception();
  }

  private async _disableInterception() {
    await this._channel.setNetworkInterceptionEnabled({ enabled: false });
  }

  async waitForEvent(event: string, optionsOrPredicate: WaitForEventOptions = {}): Promise<any> {
    return this._wrapApiCall(async () => {
      const timeout = this._timeoutSettings.timeout(typeof optionsOrPredicate === 'function'  ? {} : optionsOrPredicate);
      const predicate = typeof optionsOrPredicate === 'function'  ? optionsOrPredicate : optionsOrPredicate.predicate;
      const waiter = Waiter.createForEvent(this, event);
      waiter.rejectOnTimeout(timeout, `Timeout ${timeout}ms exceeded while waiting for event "${event}"`);
      if (event !== Events.BrowserContext.Close)
        waiter.rejectOnEvent(this, Events.BrowserContext.Close, new Error('Context closed'));
      const result = await waiter.waitForEvent(this, event, predicate as any);
      waiter.dispose();
      return result;
    });
  }

  async storageState(options: { path?: string } = {}): Promise<StorageState> {
    const state = await this._channel.storageState();
    if (options.path) {
      await mkdirIfNeeded(options.path);
      await fs.promises.writeFile(options.path, JSON.stringify(state, undefined, 2), 'utf8');
    }
    return state;
  }

  backgroundPages(): Page[] {
    return [...this._backgroundPages];
  }

  serviceWorkers(): Worker[] {
    return [...this._serviceWorkers];
  }

  async newCDPSession(page: Page | Frame): Promise<api.CDPSession> {
    // channelOwner.ts's validation messages don't handle the pseudo-union type, so we're explicit here
    if (!(page instanceof Page) && !(page instanceof Frame))
      throw new Error('page: expected Page or Frame');
    const result = await this._channel.newCDPSession(page instanceof Page ? { page: page._channel } : { frame: page._channel });
    return CDPSession.from(result.session);
  }

  _onClose() {
    if (this._browser)
      this._browser._contexts.delete(this);
    this._browserType?._contexts?.delete(this);
    this.emit(Events.BrowserContext.Close, this);
  }

  async close(): Promise<void> {
    try {
      await this._wrapApiCall(async () => {
        await this._browserType?._onWillCloseContext?.(this);
        if (this._options.recordHar)  {
          const har = await this._channel.harExport();
          const artifact = Artifact.from(har.artifact);
          await artifact.saveAs(this._options.recordHar.path);
          await artifact.delete();
        }
      }, true);
      await this._channel.close();
      await this._closedPromise;
    } catch (e) {
      if (isSafeCloseError(e))
        return;
      throw e;
    }
  }

  async _enableRecorder(params: {
      language: string,
      launchOptions?: LaunchOptions,
      contextOptions?: BrowserContextOptions,
      device?: string,
      saveStorage?: string,
      startRecording?: boolean,
      outputFile?: string
  }) {
    await this._channel.recorderSupplementEnable(params);
  }

  async _resetForReuse() {
    await this._unrouteAll();
    await this._removeInitScripts();
    await this._removeExposedBindings();
  }
}

async function prepareStorageState(options: BrowserContextOptions): Promise<channels.BrowserNewContextParams['storageState']> {
  if (typeof options.storageState !== 'string')
    return options.storageState;
  try {
    return JSON.parse(await fs.promises.readFile(options.storageState, 'utf8'));
  } catch (e) {
    rewriteErrorMessage(e, `Error reading storage state from ${options.storageState}:\n` + e.message);
    throw e;
  }
}

export async function prepareBrowserContextParams(options: BrowserContextOptions): Promise<channels.BrowserNewContextParams> {
  if (options.videoSize && !options.videosPath)
    throw new Error(`"videoSize" option requires "videosPath" to be specified`);
  if (options.extraHTTPHeaders)
    network.validateHeaders(options.extraHTTPHeaders);
  const contextParams: channels.BrowserNewContextParams = {
    ...options,
    viewport: options.viewport === null ? undefined : options.viewport,
    noDefaultViewport: options.viewport === null,
    extraHTTPHeaders: options.extraHTTPHeaders ? headersObjectToArray(options.extraHTTPHeaders) : undefined,
    storageState: await prepareStorageState(options),
  };
  if (!contextParams.recordVideo && options.videosPath) {
    contextParams.recordVideo = {
      dir: options.videosPath,
      size: options.videoSize
    };
  }
  return contextParams;
}
