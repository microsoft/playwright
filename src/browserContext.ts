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

import { isUnderTest, helper, deprecate} from './helper';
import * as network from './network';
import { Page, PageBinding } from './page';
import { TimeoutSettings } from './timeoutSettings';
import * as frames from './frames';
import * as types from './types';
import { Events } from './events';
import { Download } from './download';
import { BrowserBase } from './browser';
import { Loggers, Logger } from './logger';
import { EventEmitter } from 'events';
import { ProgressController } from './progress';
import { DebugController } from './debug/debugController';
import { LoggerSink } from './loggerSink';

export interface BrowserContext {
  setDefaultNavigationTimeout(timeout: number): void;
  setDefaultTimeout(timeout: number): void;
  pages(): Page[];
  newPage(): Promise<Page>;
  cookies(urls?: string | string[]): Promise<types.NetworkCookie[]>;
  addCookies(cookies: types.SetNetworkCookieParam[]): Promise<void>;
  clearCookies(): Promise<void>;
  grantPermissions(permissions: string[], options?: { origin?: string }): Promise<void>;
  clearPermissions(): Promise<void>;
  setGeolocation(geolocation: types.Geolocation | null): Promise<void>;
  setExtraHTTPHeaders(headers: types.Headers): Promise<void>;
  setOffline(offline: boolean): Promise<void>;
  setHTTPCredentials(httpCredentials: types.Credentials | null): Promise<void>;
  addInitScript(script: Function | string | { path?: string, content?: string }, arg?: any): Promise<void>;
  exposeBinding(name: string, playwrightBinding: frames.FunctionWithSource): Promise<void>;
  exposeFunction(name: string, playwrightFunction: Function): Promise<void>;
  route(url: types.URLMatch, handler: network.RouteHandler): Promise<void>;
  unroute(url: types.URLMatch, handler?: network.RouteHandler): Promise<void>;
  waitForEvent(event: string, optionsOrPredicate?: Function | (types.TimeoutOptions & { predicate?: Function })): Promise<any>;
  close(): Promise<void>;
}

type BrowserContextOptions = types.BrowserContextOptions & { logger?: LoggerSink };

export abstract class BrowserContextBase extends EventEmitter implements BrowserContext {
  readonly _timeoutSettings = new TimeoutSettings();
  readonly _pageBindings = new Map<string, PageBinding>();
  readonly _options: BrowserContextOptions;
  _routes: { url: types.URLMatch, handler: network.RouteHandler }[] = [];
  private _isPersistentContext: boolean;
  private _closedStatus: 'open' | 'closing' | 'closed' = 'open';
  readonly _closePromise: Promise<Error>;
  private _closePromiseFulfill: ((error: Error) => void) | undefined;
  readonly _permissions = new Map<string, string[]>();
  readonly _downloads = new Set<Download>();
  readonly _browserBase: BrowserBase;
  readonly _apiLogger: Logger;

  constructor(browserBase: BrowserBase, options: BrowserContextOptions, isPersistentContext: boolean) {
    super();
    this._browserBase = browserBase;
    this._options = options;
    const loggers = options.logger ? new Loggers(options.logger) : browserBase._options.loggers;
    this._apiLogger = loggers.api;
    this._isPersistentContext = isPersistentContext;
    this._closePromise = new Promise(fulfill => this._closePromiseFulfill = fulfill);
  }

  async _initialize() {
    if (helper.isDebugMode())
      new DebugController(this);
  }

  async waitForEvent(event: string, optionsOrPredicate: types.WaitForEventOptions = {}): Promise<any> {
    const options = typeof optionsOrPredicate === 'function' ? { predicate: optionsOrPredicate } : optionsOrPredicate;
    const progressController = new ProgressController(this._apiLogger, this._timeoutSettings.timeout(options), 'browserContext.waitForEvent');
    if (event !== Events.BrowserContext.Close)
      this._closePromise.then(error => progressController.abort(error));
    return progressController.run(progress => helper.waitForEvent(progress, this, event, options.predicate).promise);
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
  abstract setGeolocation(geolocation: types.Geolocation | null): Promise<void>;
  abstract _doSetHTTPCredentials(httpCredentials: types.Credentials | null): Promise<void>;
  abstract setExtraHTTPHeaders(headers: types.Headers): Promise<void>;
  abstract setOffline(offline: boolean): Promise<void>;
  abstract _doAddInitScript(expression: string): Promise<void>;
  abstract _doExposeBinding(binding: PageBinding): Promise<void>;
  abstract route(url: types.URLMatch, handler: network.RouteHandler): Promise<void>;
  abstract unroute(url: types.URLMatch, handler?: network.RouteHandler): Promise<void>;
  abstract _doClose(): Promise<void>;

  async cookies(urls: string | string[] | undefined = []): Promise<types.NetworkCookie[]> {
    if (urls && !Array.isArray(urls))
      urls = [ urls ];
    return await this._doCookies(urls as string[]);
  }

  async exposeFunction(name: string, playwrightFunction: Function): Promise<void> {
    await this.exposeBinding(name, (options, ...args: any) => playwrightFunction(...args));
  }

  setHTTPCredentials(httpCredentials: types.Credentials | null): Promise<void> {
    if (!isUnderTest())
      deprecate(`context.setHTTPCredentials`, `warning: method |context.setHTTPCredentials()| is deprecated. Instead of changing credentials, create another browser context with new credentials.`);
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

  async _loadDefaultContext() {
    if (!this.pages().length)
      await this.waitForEvent('page');
    const pages = this.pages();
    await pages[0].waitForLoadState();
    if (pages.length !== 1 || pages[0].url() !== 'about:blank')
      throw new Error(`Arguments can not specify page to be opened (first url is ${pages[0].url()})`);
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
    const proxy = this._browserBase._options.proxy || { username: undefined, password: undefined };
    const { username, password } = proxy;
    if (username) {
      this._options.httpCredentials = { username, password: password! };
      this._options.extraHTTPHeaders = this._options.extraHTTPHeaders || {};
      const token = Buffer.from(`${username}:${password}`).toString('base64');
      this._options.extraHTTPHeaders['Proxy-Authorization'] = `Basic ${token}`;
    }
  }

  protected _authenticateProxyViaCredentials() {
    const proxy = this._browserBase._options.proxy;
    if (!proxy)
      return;
    const { username, password } = proxy;
    if (username && password)
      this._options.httpCredentials = { username, password };
  }

  async close() {
    if (this._isPersistentContext) {
      // Default context is only created in 'persistent' mode and closing it should close
      // the browser.
      await this._browserBase.close();
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

export function assertBrowserContextIsNotOwned(context: BrowserContextBase) {
  for (const page of context.pages()) {
    if (page._ownedContext)
      throw new Error('Please use browser.newContext() for multi-page scripts that share the context.');
  }
}

export function validateBrowserContextOptions(options: BrowserContextOptions): BrowserContextOptions {
  // Copy all fields manually to strip any extra junk.
  // Especially useful when we share context and launch options for launchPersistent.
  const result: BrowserContextOptions = {
    ignoreHTTPSErrors: options.ignoreHTTPSErrors,
    bypassCSP: options.bypassCSP,
    locale: options.locale,
    timezoneId: options.timezoneId,
    offline: options.offline,
    colorScheme: options.colorScheme,
    acceptDownloads: options.acceptDownloads,
    viewport: options.viewport,
    javaScriptEnabled: options.javaScriptEnabled,
    userAgent: options.userAgent,
    geolocation: options.geolocation,
    permissions: options.permissions,
    extraHTTPHeaders: options.extraHTTPHeaders,
    httpCredentials: options.httpCredentials,
    deviceScaleFactor: options.deviceScaleFactor,
    isMobile: options.isMobile,
    hasTouch: options.hasTouch,
    logger: options.logger,
  };
  if (result.viewport === null && result.deviceScaleFactor !== undefined)
    throw new Error(`"deviceScaleFactor" option is not supported with null "viewport"`);
  if (result.viewport === null && result.isMobile !== undefined)
    throw new Error(`"isMobile" option is not supported with null "viewport"`);
  if (!result.viewport && result.viewport !== null)
    result.viewport = { width: 1280, height: 720 };
  if (result.viewport)
    result.viewport = { ...result.viewport };
  if (result.geolocation)
    result.geolocation = verifyGeolocation(result.geolocation);
  if (result.extraHTTPHeaders)
    result.extraHTTPHeaders = network.verifyHeaders(result.extraHTTPHeaders);
  return result;
}

export function verifyGeolocation(geolocation: types.Geolocation): types.Geolocation {
  const result = { ...geolocation };
  result.accuracy = result.accuracy || 0;
  const { longitude, latitude, accuracy } = result;
  if (!helper.isNumber(longitude) || longitude < -180 || longitude > 180)
    throw new Error(`Invalid longitude "${longitude}": precondition -180 <= LONGITUDE <= 180 failed.`);
  if (!helper.isNumber(latitude) || latitude < -90 || latitude > 90)
    throw new Error(`Invalid latitude "${latitude}": precondition -90 <= LATITUDE <= 90 failed.`);
  if (!helper.isNumber(accuracy) || accuracy < 0)
    throw new Error(`Invalid accuracy "${accuracy}": precondition 0 <= ACCURACY failed.`);
  return result;
}

export function verifyProxySettings(proxy: types.ProxySettings): types.ProxySettings {
  let { server, bypass } = proxy;
  if (!helper.isString(server))
    throw new Error(`Invalid proxy.server: ` + server);
  let url = new URL(server);
  if (!['http:', 'https:', 'socks4:', 'socks5:'].includes(url.protocol)) {
    url = new URL('http://' + server);
    server = `${url.protocol}//${url.host}`;
  }
  if (bypass)
    bypass = bypass.split(',').map(t => t.trim()).join(',');
  return { ...proxy, server, bypass };
}
