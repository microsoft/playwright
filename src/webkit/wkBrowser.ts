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

import { Browser } from '../browser';
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

export type WKConnectOptions = {
  slowMo?: number,
  transport: ConnectionTransport;
};

export class WKBrowser extends platform.EventEmitter implements Browser {
  private readonly _connection: WKConnection;
  private readonly _browserSession: WKSession;
  private readonly _defaultContext: BrowserContext;
  private readonly _contexts = new Map<string, BrowserContext>();
  private readonly _pageProxies = new Map<string, WKPageProxy>();
  private readonly _eventListeners: RegisteredListener[];

  private _firstPageProxyCallback?: () => void;
  private readonly _firstPageProxyPromise: Promise<void>;

  static async connect(options: WKConnectOptions): Promise<WKBrowser> {
    const transport = await createTransport(options);
    const browser = new WKBrowser(transport);
    // TODO: figure out the timeout.
    await browser._waitForFirstPageTarget(30000);
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
      helper.addEventListener(this._browserSession, kPageProxyMessageReceived, this._onPageProxyMessageReceived.bind(this)),
    ];

    this._firstPageProxyPromise = new Promise<void>(resolve => this._firstPageProxyCallback = resolve);
  }

  _onDisconnect() {
    for (const pageProxy of this._pageProxies.values())
      pageProxy.dispose();
    this._pageProxies.clear();
    this.emit(Events.Browser.Disconnected);
  }

  async newContext(options: BrowserContextOptions = {}): Promise<BrowserContext> {
    const { browserContextId } = await this._browserSession.send('Browser.createContext');
    const context = this._createBrowserContext(browserContextId, options);
    if (options.ignoreHTTPSErrors)
      await this._browserSession.send('Browser.setIgnoreCertificateErrors', { browserContextId, ignore: true });
    await context._initialize();
    this._contexts.set(browserContextId, context);
    return context;
  }

  browserContexts(): BrowserContext[] {
    return [this._defaultContext, ...Array.from(this._contexts.values())];
  }

  defaultContext(): BrowserContext {
    return this._defaultContext;
  }

  async _waitForFirstPageTarget(timeout: number): Promise<void> {
    assert(!this._pageProxies.size);
    await helper.waitWithTimeout(this._firstPageProxyPromise, 'firstPageProxy', timeout);
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
    const pageProxy = new WKPageProxy(pageProxySession, context);
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

  disconnect() {
    throw new Error('Unsupported operation');
  }

  isConnected(): boolean {
    return true;
  }

  async close() {
    helper.removeEventListeners(this._eventListeners);
    const disconnected = new Promise(f => this.once(Events.Browser.Disconnected, f));
    await this._browserSession.send('Browser.close');
    await disconnected;
  }

  _createBrowserContext(browserContextId: string | undefined, options: BrowserContextOptions): BrowserContext {
    const context = new BrowserContext({
      pages: async (): Promise<Page[]> => {
        const pageProxies = Array.from(this._pageProxies.values()).filter(proxy => proxy._browserContext === context);
        return await Promise.all(pageProxies.map(proxy => proxy.page()));
      },

      newPage: async (): Promise<Page> => {
        const { pageProxyId } = await this._browserSession.send('Browser.createPage', { browserContextId });
        const pageProxy = this._pageProxies.get(pageProxyId)!;
        return await pageProxy.page();
      },

      close: async (): Promise<void> => {
        assert(browserContextId, 'Non-incognito profiles cannot be closed!');
        await this._browserSession.send('Browser.deleteContext', { browserContextId: browserContextId! });
        this._contexts.delete(browserContextId!);
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
}

export async function createTransport(options: WKConnectOptions): Promise<ConnectionTransport> {
  assert(!!options.transport, 'Transport must be passed to connect');
  return SlowMoTransport.wrap(options.transport, options.slowMo);
}
