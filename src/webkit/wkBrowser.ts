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
import { BrowserContext, BrowserContextOptions } from '../browserContext';
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

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.4 Safari/605.1.15';

export class WKBrowser extends platform.EventEmitter implements Browser {
  private readonly _connection: WKConnection;
  private readonly _browserSession: WKSession;
  readonly _defaultContext: BrowserContext;
  private readonly _contexts = new Map<string, BrowserContext>();
  private readonly _pageProxies = new Map<string, WKPageProxy>();
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

    this._defaultContext = this._createBrowserContext(undefined, {});

    this._eventListeners = [
      helper.addEventListener(this._browserSession, 'Browser.pageProxyCreated', this._onPageProxyCreated.bind(this)),
      helper.addEventListener(this._browserSession, 'Browser.pageProxyDestroyed', this._onPageProxyDestroyed.bind(this)),
      helper.addEventListener(this._browserSession, 'Browser.provisionalLoadFailed', event => this._onProvisionalLoadFailed(event)),
      helper.addEventListener(this._browserSession, kPageProxyMessageReceived, this._onPageProxyMessageReceived.bind(this)),
    ];

    this._firstPageProxyPromise = new Promise<void>(resolve => this._firstPageProxyCallback = resolve);
  }

  _onDisconnect() {
    for (const context of this.contexts())
      context._browserClosed();
    for (const pageProxy of this._pageProxies.values())
      pageProxy.dispose();
    this._pageProxies.clear();
    this.emit(Events.Browser.Disconnected);
  }

  async newContext(options: BrowserContextOptions = {}): Promise<BrowserContext> {
    const { browserContextId } = await this._browserSession.send('Browser.createContext');
    options.userAgent = options.userAgent || DEFAULT_USER_AGENT;
    const context = this._createBrowserContext(browserContextId, options);
    if (options.ignoreHTTPSErrors)
      await this._browserSession.send('Browser.setIgnoreCertificateErrors', { browserContextId, ignore: true });
    if (options.locale)
      await this._browserSession.send('Browser.setLanguages', { browserContextId, languages: [options.locale] });
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

  _createBrowserContext(browserContextId: string | undefined, options: BrowserContextOptions): BrowserContext {
    BrowserContext.validateOptions(options);
    const context = new BrowserContext({
      pages: async (): Promise<Page[]> => {
        const pageProxies = Array.from(this._pageProxies.values()).filter(proxy => proxy._browserContext === context);
        return await Promise.all(pageProxies.map(proxy => proxy.page()));
      },

      existingPages: (): Page[] => {
        const pages: Page[] = [];
        for (const pageProxy of this._pageProxies.values()) {
          if (pageProxy._browserContext !== context)
            continue;
          const page = pageProxy.existingPage();
          if (page)
            pages.push(page);
        }
        return pages;
      },

      newPage: async (): Promise<Page> => {
        const { pageProxyId } = await this._browserSession.send('Browser.createPage', { browserContextId });
        const pageProxy = this._pageProxies.get(pageProxyId)!;
        return await pageProxy.page();
      },

      close: async (): Promise<void> => {
        assert(browserContextId, 'Non-incognito profiles cannot be closed!');
        await this._browserSession.send('Browser.deleteContext', { browserContextId: browserContextId });
        this._contexts.delete(browserContextId);
      },

      cookies: async (): Promise<network.NetworkCookie[]> => {
        const { cookies } = await this._browserSession.send('Browser.getAllCookies', { browserContextId });
        return cookies.map((c: network.NetworkCookie) => ({
          ...c,
          expires: c.expires === 0 ? -1 : c.expires
        }));
      },

      clearCookies: async (): Promise<void> => {
        await this._browserSession.send('Browser.deleteAllCookies', { browserContextId });
      },

      setCookies: async (cookies: network.SetNetworkCookieParam[]): Promise<void> => {
        const cc = cookies.map(c => ({ ...c, session: c.expires === -1 || c.expires === undefined })) as Protocol.Browser.SetCookieParam[];
        await this._browserSession.send('Browser.setCookies', { cookies: cc, browserContextId });
      },

      setPermissions: async (origin: string, permissions: string[]): Promise<void> => {
        const webPermissionToProtocol = new Map<string, string>([
          ['geolocation', 'geolocation'],
        ]);
        const filtered = permissions.map(permission => {
          const protocolPermission = webPermissionToProtocol.get(permission);
          if (!protocolPermission)
            throw new Error('Unknown permission: ' + permission);
          return protocolPermission;
        });
        await this._browserSession.send('Browser.grantPermissions', { origin, browserContextId, permissions: filtered });
      },

      clearPermissions: async () => {
        await this._browserSession.send('Browser.resetPermissions', { browserContextId });
      },

      setGeolocation: async (geolocation: types.Geolocation | null): Promise<void> => {
        const payload: any = geolocation ? { ...geolocation, timestamp: Date.now() } : undefined;
        await this._browserSession.send('Browser.setGeolocationOverride', { browserContextId, geolocation: payload });
      }
    }, options);
    return context;
  }

  _setDebugFunction(debugFunction: (message: string) => void) {
    this._connection._debugFunction = debugFunction;
  }
}
