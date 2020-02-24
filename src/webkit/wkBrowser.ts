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

import { Browser, createPageInNewContext } from '../browser';
import { BrowserContext, BrowserContextOptions, validateBrowserContextOptions, assertBrowserContextIsNotOwned, verifyGeolocation } from '../browserContext';
import { assert, helper, RegisteredListener } from '../helper';
import * as network from '../network';
import { Page } from '../page';
import { ConnectionTransport, SlowMoTransport } from '../transport';
import * as types from '../types';
import { Events } from '../events';
import { Protocol } from './protocol';
import { WKConnection, WKSession, kPageProxyMessageReceived, PageProxyMessageReceivedPayload } from './wkConnection';
import { WKPageProxy } from './wkPageProxy';
import * as platform from '../platform';
import { TimeoutSettings } from '../timeoutSettings';

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.4 Safari/605.1.15';

export class WKBrowser extends platform.EventEmitter implements Browser {
  private readonly _connection: WKConnection;
  readonly _browserSession: WKSession;
  readonly _defaultContext: BrowserContext;
  readonly _contexts = new Map<string, WKBrowserContext>();
  readonly _pageProxies = new Map<string, WKPageProxy>();
  private readonly _eventListeners: RegisteredListener[];

  private _firstPageProxyCallback?: () => void;
  private readonly _firstPageProxyPromise: Promise<void>;

  static async connect(transport: ConnectionTransport, slowMo: number = 0): Promise<WKBrowser> {
    const browser = new WKBrowser(SlowMoTransport.wrap(transport, slowMo));
    return browser;
  }

  constructor(transport: ConnectionTransport) {
    super();
    this._connection = new WKConnection(transport, this._onDisconnect.bind(this));
    this._browserSession = this._connection.browserSession;

    this._defaultContext = new WKBrowserContext(this, undefined, validateBrowserContextOptions({}));

    this._eventListeners = [
      helper.addEventListener(this._browserSession, 'Browser.pageProxyCreated', this._onPageProxyCreated.bind(this)),
      helper.addEventListener(this._browserSession, 'Browser.pageProxyDestroyed', this._onPageProxyDestroyed.bind(this)),
      helper.addEventListener(this._browserSession, 'Browser.provisionalLoadFailed', event => this._onProvisionalLoadFailed(event)),
      helper.addEventListener(this._browserSession, kPageProxyMessageReceived, this._onPageProxyMessageReceived.bind(this)),
    ];

    this._firstPageProxyPromise = new Promise<void>(resolve => this._firstPageProxyCallback = resolve);
  }

  _onDisconnect() {
    for (const context of this._contexts.values())
      context._browserClosed();
    for (const pageProxy of this._pageProxies.values())
      pageProxy.dispose();
    this._pageProxies.clear();
    this.emit(Events.Browser.Disconnected);
  }

  async newContext(options: BrowserContextOptions = {}): Promise<BrowserContext> {
    options = validateBrowserContextOptions(options);
    const { browserContextId } = await this._browserSession.send('Browser.createContext');
    options.userAgent = options.userAgent || DEFAULT_USER_AGENT;
    const context = new WKBrowserContext(this, browserContextId, options);
    await context._initialize();
    this._contexts.set(browserContextId, context);
    return context;
  }

  contexts(): BrowserContext[] {
    return Array.from(this._contexts.values());
  }

  async newPage(options?: BrowserContextOptions): Promise<Page> {
    return createPageInNewContext(this, options);
  }

  async _waitForFirstPageTarget(): Promise<void> {
    assert(!this._pageProxies.size);
    return this._firstPageProxyPromise;
  }

  _onPageProxyCreated(event: Protocol.Browser.pageProxyCreatedPayload) {
    const { pageProxyInfo } = event;
    const pageProxyId = pageProxyInfo.pageProxyId;
    let context = null;
    if (pageProxyInfo.browserContextId) {
      // FIXME: we don't know about the default context id, so assume that all targets from
      // unknown contexts are created in the 'default' context which can in practice be represented
      // by multiple actual contexts in WebKit. Solving this properly will require adding context
      // lifecycle events.
      context = this._contexts.get(pageProxyInfo.browserContextId);
    }
    if (!context)
      context =  this._defaultContext;
    const pageProxySession = new WKSession(this._connection, pageProxyId, `The page has been closed.`, (message: any) => {
      this._connection.rawSend({ ...message, pageProxyId });
    });
    const pageProxy = new WKPageProxy(pageProxySession, context, () => {
      if (!pageProxyInfo.openerId)
        return null;
      const opener = this._pageProxies.get(pageProxyInfo.openerId);
      if (!opener)
        return null;
      return opener;
    });
    this._pageProxies.set(pageProxyId, pageProxy);

    if (pageProxyInfo.openerId) {
      const opener = this._pageProxies.get(pageProxyInfo.openerId);
      if (opener)
        opener.onPopupCreated(pageProxy);
    }

    if (this._firstPageProxyCallback) {
      this._firstPageProxyCallback();
      this._firstPageProxyCallback = undefined;
    }
  }

  _onPageProxyDestroyed(event: Protocol.Browser.pageProxyDestroyedPayload) {
    const pageProxyId = event.pageProxyId;
    const pageProxy = this._pageProxies.get(pageProxyId)!;
    pageProxy.didClose();
    pageProxy.dispose();
    this._pageProxies.delete(pageProxyId);
  }

  _onPageProxyMessageReceived(event: PageProxyMessageReceivedPayload) {
    const pageProxy = this._pageProxies.get(event.pageProxyId)!;
    pageProxy.dispatchMessageToSession(event.message);
  }

  _onProvisionalLoadFailed(event: Protocol.Browser.provisionalLoadFailedPayload) {
    const pageProxy = this._pageProxies.get(event.pageProxyId)!;
    pageProxy.handleProvisionalLoadFailed(event);
  }

  isConnected(): boolean {
    return !this._connection.isClosed();
  }

  async close() {
    helper.removeEventListeners(this._eventListeners);
    const disconnected = new Promise(f => this.once(Events.Browser.Disconnected, f));
    await Promise.all(this.contexts().map(context => context.close()));
    this._connection.close();
    await disconnected;
  }

  _setDebugFunction(debugFunction: (message: string) => void) {
    this._connection._debugFunction = debugFunction;
  }
}

export class WKBrowserContext extends platform.EventEmitter implements BrowserContext {
  readonly _browser: WKBrowser;
  readonly _browserContextId: string | undefined;
  readonly _options: BrowserContextOptions;
  readonly _timeoutSettings: TimeoutSettings;
  private _closed = false;

  constructor(browser: WKBrowser, browserContextId: string | undefined, options: BrowserContextOptions) {
    super();
    this._browser = browser;
    this._browserContextId = browserContextId;
    this._timeoutSettings = new TimeoutSettings();
    this._options = options;
  }

  async _initialize() {
    if (this._options.ignoreHTTPSErrors)
      await this._browser._browserSession.send('Browser.setIgnoreCertificateErrors', { browserContextId: this._browserContextId, ignore: true });
    if (this._options.locale)
      await this._browser._browserSession.send('Browser.setLanguages', { browserContextId: this._browserContextId, languages: [this._options.locale] });
    const entries = Object.entries(this._options.permissions || {});
    await Promise.all(entries.map(entry => this.setPermissions(entry[0], entry[1])));
    if (this._options.geolocation)
      await this.setGeolocation(this._options.geolocation);
  }

  _existingPages(): Page[] {
    const pages: Page[] = [];
    for (const pageProxy of this._browser._pageProxies.values()) {
      if (pageProxy._browserContext !== this)
        continue;
      const page = pageProxy.existingPage();
      if (page)
        pages.push(page);
    }
    return pages;
  }

  setDefaultNavigationTimeout(timeout: number) {
    this._timeoutSettings.setDefaultNavigationTimeout(timeout);
  }

  setDefaultTimeout(timeout: number) {
    this._timeoutSettings.setDefaultTimeout(timeout);
  }

  async pages(): Promise<Page[]> {
    const pageProxies = Array.from(this._browser._pageProxies.values()).filter(proxy => proxy._browserContext === this);
    return await Promise.all(pageProxies.map(proxy => proxy.page()));
  }

  async newPage(): Promise<Page> {
    assertBrowserContextIsNotOwned(this);
    const { pageProxyId } = await this._browser._browserSession.send('Browser.createPage', { browserContextId: this._browserContextId });
    const pageProxy = this._browser._pageProxies.get(pageProxyId)!;
    return await pageProxy.page();
  }

  async cookies(...urls: string[]): Promise<network.NetworkCookie[]> {
    const { cookies } = await this._browser._browserSession.send('Browser.getAllCookies', { browserContextId: this._browserContextId });
    return network.filterCookies(cookies.map((c: network.NetworkCookie) => ({
      ...c,
      expires: c.expires === 0 ? -1 : c.expires
    })), urls);
  }

  async setCookies(cookies: network.SetNetworkCookieParam[]) {
    const cc = network.rewriteCookies(cookies).map(c => ({ ...c, session: c.expires === -1 || c.expires === undefined })) as Protocol.Browser.SetCookieParam[];
    await this._browser._browserSession.send('Browser.setCookies', { cookies: cc, browserContextId: this._browserContextId });
  }

  async clearCookies() {
    await this._browser._browserSession.send('Browser.deleteAllCookies', { browserContextId: this._browserContextId });
  }

  async setPermissions(origin: string, permissions: string[]): Promise<void> {
    const webPermissionToProtocol = new Map<string, string>([
      ['geolocation', 'geolocation'],
    ]);
    const filtered = permissions.map(permission => {
      const protocolPermission = webPermissionToProtocol.get(permission);
      if (!protocolPermission)
        throw new Error('Unknown permission: ' + permission);
      return protocolPermission;
    });
    await this._browser._browserSession.send('Browser.grantPermissions', { origin, browserContextId: this._browserContextId, permissions: filtered });
  }

  async clearPermissions() {
    await this._browser._browserSession.send('Browser.resetPermissions', { browserContextId: this._browserContextId });
  }

  async setGeolocation(geolocation: types.Geolocation | null): Promise<void> {
    if (geolocation)
      geolocation = verifyGeolocation(geolocation);
    this._options.geolocation = geolocation || undefined;
    const payload: any = geolocation ? { ...geolocation, timestamp: Date.now() } : undefined;
    await this._browser._browserSession.send('Browser.setGeolocationOverride', { browserContextId: this._browserContextId, geolocation: payload });
  }

  async close() {
    if (this._closed)
      return;
    assert(this._browserContextId, 'Non-incognito profiles cannot be closed!');
    await this._browser._browserSession.send('Browser.deleteContext', { browserContextId: this._browserContextId });
    this._browser._contexts.delete(this._browserContextId);
    this._closed = true;
    this.emit(Events.BrowserContext.Close);
  }

  _browserClosed() {
    this._closed = true;
    for (const page of this._existingPages())
      page._didClose();
    this.emit(Events.BrowserContext.Close);
  }
}
