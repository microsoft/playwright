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

import { helper } from './helper';
import * as network from './network';
import { Page, PageBinding } from './page';
import { TimeoutSettings } from './timeoutSettings';
import * as frames from './frames';
import * as types from './types';
import { Events } from './events';
import { Download } from './download';
import { Browser } from './browser';
import { EventEmitter } from 'events';
import { Progress } from './progress';
import { DebugController } from './debug/debugController';

export abstract class BrowserContext extends EventEmitter {
  readonly _timeoutSettings = new TimeoutSettings();
  readonly _pageBindings = new Map<string, PageBinding>();
  readonly _options: types.BrowserContextOptions;
  _requestInterceptor?: network.RouteHandler;
  private _isPersistentContext: boolean;
  private _closedStatus: 'open' | 'closing' | 'closed' = 'open';
  readonly _closePromise: Promise<Error>;
  private _closePromiseFulfill: ((error: Error) => void) | undefined;
  readonly _permissions = new Map<string, string[]>();
  readonly _downloads = new Set<Download>();
  readonly _browser: Browser;

  constructor(browser: Browser, options: types.BrowserContextOptions, isPersistentContext: boolean) {
    super();
    this._browser = browser;
    this._options = options;
    this._isPersistentContext = isPersistentContext;
    this._closePromise = new Promise(fulfill => this._closePromiseFulfill = fulfill);
  }

  async _initialize() {
    if (helper.isDebugMode())
      new DebugController(this);
  }

  _browserClosed() {
    for (const page of this.pages())
      page._didClose();
    this._didCloseInternal();
  }

  private _didCloseInternal() {
    if (this._closedStatus === 'closed') {
      // We can come here twice if we close browser context and browser
      // at the same time.
      return;
    }
    this._closedStatus = 'closed';
    this._downloads.clear();
    this._closePromiseFulfill!(new Error('Context closed'));
    this.emit(Events.BrowserContext.Close);
  }

  // BrowserContext methods.
  abstract pages(): Page[];
  abstract newPage(): Promise<Page>;
  abstract _doCookies(urls: string[]): Promise<types.NetworkCookie[]>;
  abstract addCookies(cookies: types.SetNetworkCookieParam[]): Promise<void>;
  abstract clearCookies(): Promise<void>;
  abstract _doGrantPermissions(origin: string, permissions: string[]): Promise<void>;
  abstract _doClearPermissions(): Promise<void>;
  abstract setGeolocation(geolocation?: types.Geolocation): Promise<void>;
  abstract _doSetHTTPCredentials(httpCredentials?: types.Credentials): Promise<void>;
  abstract setExtraHTTPHeaders(headers: types.HeadersArray): Promise<void>;
  abstract setOffline(offline: boolean): Promise<void>;
  abstract _doAddInitScript(expression: string): Promise<void>;
  abstract _doExposeBinding(binding: PageBinding): Promise<void>;
  abstract _doUpdateRequestInterception(): Promise<void>;
  abstract _doClose(): Promise<void>;

  async cookies(urls: string | string[] | undefined = []): Promise<types.NetworkCookie[]> {
    if (urls && !Array.isArray(urls))
      urls = [ urls ];
    return await this._doCookies(urls as string[]);
  }

  setHTTPCredentials(httpCredentials?: types.Credentials): Promise<void> {
    return this._doSetHTTPCredentials(httpCredentials);
  }

  async exposeBinding(name: string, playwrightBinding: frames.FunctionWithSource): Promise<void> {
    for (const page of this.pages()) {
      if (page._pageBindings.has(name))
        throw new Error(`Function "${name}" has been already registered in one of the pages`);
    }
    if (this._pageBindings.has(name))
      throw new Error(`Function "${name}" has been already registered`);
    const binding = new PageBinding(name, playwrightBinding);
    this._pageBindings.set(name, binding);
    this._doExposeBinding(binding);
  }

  async addInitScript(script: string | Function | { path?: string | undefined; content?: string | undefined; }, arg?: any): Promise<void> {
    const source = await helper.evaluationScript(script, arg);
    await this._doAddInitScript(source);
  }

  async grantPermissions(permissions: string[], options?: { origin?: string }) {
    let origin = '*';
    if (options && options.origin) {
      const url = new URL(options.origin);
      origin = url.origin;
    }
    const existing = new Set(this._permissions.get(origin) || []);
    permissions.forEach(p => existing.add(p));
    const list = [...existing.values()];
    this._permissions.set(origin, list);
    await this._doGrantPermissions(origin, list);
  }

  async clearPermissions() {
    this._permissions.clear();
    await this._doClearPermissions();
  }

  setDefaultNavigationTimeout(timeout: number) {
    this._timeoutSettings.setDefaultNavigationTimeout(timeout);
  }

  setDefaultTimeout(timeout: number) {
    this._timeoutSettings.setDefaultTimeout(timeout);
  }

  async _loadDefaultContext(progress: Progress) {
    if (!this.pages().length) {
      const waitForEvent = helper.waitForEvent(progress, this, Events.BrowserContext.Page);
      progress.cleanupWhenAborted(() => waitForEvent.dispose);
      await waitForEvent.promise;
    }
    const pages = this.pages();
    await pages[0].mainFrame().waitForLoadState();
    if (pages.length !== 1 || pages[0].mainFrame().url() !== 'about:blank')
      throw new Error(`Arguments can not specify page to be opened (first url is ${pages[0].mainFrame().url()})`);
    if (this._options.isMobile || this._options.locale) {
      // Workaround for:
      // - chromium fails to change isMobile for existing page;
      // - webkit fails to change locale for existing page.
      const oldPage = pages[0];
      await this.newPage();
      await oldPage.close();
    }
  }

  protected _authenticateProxyViaHeader() {
    const proxy = this._browser._options.proxy || { username: undefined, password: undefined };
    const { username, password } = proxy;
    if (username) {
      this._options.httpCredentials = { username, password: password! };
      const token = Buffer.from(`${username}:${password}`).toString('base64');
      this._options.extraHTTPHeaders = network.mergeHeaders([
        this._options.extraHTTPHeaders,
        network.singleHeader('Proxy-Authorization', `Basic ${token}`),
      ]);
    }
  }

  protected _authenticateProxyViaCredentials() {
    const proxy = this._browser._options.proxy;
    if (!proxy)
      return;
    const { username, password } = proxy;
    if (username && password)
      this._options.httpCredentials = { username, password };
  }

  async _setRequestInterceptor(handler: network.RouteHandler | undefined): Promise<void> {
    this._requestInterceptor = handler;
    await this._doUpdateRequestInterception();
  }

  async close() {
    if (this._isPersistentContext) {
      // Default context is only created in 'persistent' mode and closing it should close
      // the browser.
      await this._browser.close();
      return;
    }
    if (this._closedStatus === 'open') {
      this._closedStatus = 'closing';
      await this._doClose();
      await Promise.all([...this._downloads].map(d => d.delete()));
      this._didCloseInternal();
    }
    await this._closePromise;
  }
}

export function assertBrowserContextIsNotOwned(context: BrowserContext) {
  for (const page of context.pages()) {
    if (page._ownedContext)
      throw new Error('Please use browser.newContext() for multi-page scripts that share the context.');
  }
}

export function validateBrowserContextOptions(options: types.BrowserContextOptions) {
  if (options.noDefaultViewport && options.deviceScaleFactor !== undefined)
    throw new Error(`"deviceScaleFactor" option is not supported with null "viewport"`);
  if (options.noDefaultViewport && options.isMobile !== undefined)
    throw new Error(`"isMobile" option is not supported with null "viewport"`);
  if (!options.viewport && !options.noDefaultViewport)
    options.viewport = { width: 1280, height: 720 };
  verifyGeolocation(options.geolocation);
}

export function verifyGeolocation(geolocation?: types.Geolocation) {
  if (!geolocation)
    return;
  geolocation.accuracy = geolocation.accuracy || 0;
  const { longitude, latitude, accuracy } = geolocation;
  if (!helper.isNumber(longitude))
    throw new Error(`geolocation.longitude: expected number, got ${typeof longitude}`);
  if (longitude < -180 || longitude > 180)
    throw new Error(`geolocation.longitude: precondition -180 <= LONGITUDE <= 180 failed.`);
  if (!helper.isNumber(latitude))
    throw new Error(`geolocation.latitude: expected number, got ${typeof latitude}`);
  if (latitude < -90 || latitude > 90)
    throw new Error(`geolocation.latitude: precondition -90 <= LATITUDE <= 90 failed.`);
  if (!helper.isNumber(accuracy))
    throw new Error(`geolocation.accuracy: expected number, got ${typeof accuracy}`);
  if (accuracy < 0)
    throw new Error(`geolocation.accuracy: precondition 0 <= ACCURACY failed.`);
}

export function verifyProxySettings(proxy: types.ProxySettings): types.ProxySettings {
  let { server, bypass } = proxy;
  if (!helper.isString(server))
    throw new Error(`Invalid proxy.server: ` + server);
  let url = new URL(server);
  if (!['http:', 'https:', 'socks5:'].includes(url.protocol)) {
    url = new URL('http://' + server);
    server = `${url.protocol}//${url.host}`;
  }
  if (bypass)
    bypass = bypass.split(',').map(t => t.trim()).join(',');
  return { ...proxy, server, bypass };
}
