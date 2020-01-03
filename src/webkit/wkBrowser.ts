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

import * as browser from '../browser';
import { BrowserContext, BrowserContextOptions } from '../browserContext';
import { assert, debugError, helper, RegisteredListener } from '../helper';
import * as network from '../network';
import { Page } from '../page';
import { ConnectionTransport } from '../transport';
import * as types from '../types';
import { Protocol } from './protocol';
import { WKConnection, WKConnectionEvents, WKPageProxySession } from './wkConnection';
import { WKPageProxy } from './wkPageProxy';

export class WKBrowser extends browser.Browser {
  readonly _connection: WKConnection;
  private readonly _defaultContext: BrowserContext;
  private readonly _contexts = new Map<string, BrowserContext>();
  private readonly _pageProxies = new Map<string, WKPageProxy>();
  private readonly _eventListeners: RegisteredListener[];

  private _firstPageProxyCallback?: () => void;
  private readonly _firstPageProxyPromise: Promise<void>;

  constructor(transport: ConnectionTransport) {
    super();
    this._connection = new WKConnection(transport);

    this._defaultContext = this._createBrowserContext(undefined, {});

    this._eventListeners = [
      helper.addEventListener(this._connection, WKConnectionEvents.PageProxyCreated, this._onPageProxyCreated.bind(this)),
      helper.addEventListener(this._connection, WKConnectionEvents.PageProxyDestroyed, this._onPageProxyDestroyed.bind(this))
    ];

    this._firstPageProxyPromise = new Promise<void>(resolve => this._firstPageProxyCallback = resolve);

    // Intercept provisional targets during cross-process navigation.
    this._connection.send('Target.setPauseOnStart', { pauseOnStart: true }).catch(e => {
      debugError(e);
      throw e;
    });
  }

  async newContext(options: BrowserContextOptions = {}): Promise<BrowserContext> {
    const { browserContextId } = await this._connection.send('Browser.createContext');
    const context = this._createBrowserContext(browserContextId, options);
    if (options.ignoreHTTPSErrors)
      await this._connection.send('Browser.setIgnoreCertificateErrors', { browserContextId, ignore: true });
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

  _onPageProxyCreated(session: WKPageProxySession, pageProxyInfo: Protocol.Browser.PageProxyInfo) {
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
    const pageProxy = new WKPageProxy(this, session, context);
    this._pageProxies.set(pageProxyInfo.pageProxyId, pageProxy);

    if (pageProxyInfo.openerId) {
      const opener = this._pageProxies.get(pageProxyInfo.openerId);
      if (opener)
        opener.onPopupCreated(pageProxy);
    }

    if (this._firstPageProxyCallback) {
      this._firstPageProxyCallback();
      this._firstPageProxyCallback = null;
    }
  }

  _onPageProxyDestroyed(pageProxyId: Protocol.Browser.PageProxyID) {
    const pageProxy = this._pageProxies.get(pageProxyId);
    pageProxy.dispose();
    this._pageProxies.delete(pageProxyId);
  }

  disconnect() {
    throw new Error('Unsupported operation');
  }

  isConnected(): boolean {
    return true;
  }

  async close() {
    helper.removeEventListeners(this._eventListeners);
    await this._connection.send('Browser.close');
  }

  _createBrowserContext(browserContextId: string | undefined, options: BrowserContextOptions): BrowserContext {
    const context = new BrowserContext({
      pages: async (): Promise<Page[]> => {
        const pageProxies = Array.from(this._pageProxies.values()).filter(proxy => proxy._browserContext === context);
        const pages = await Promise.all(pageProxies.map(proxy => proxy.page()));
        return pages.filter(page => !!page);
      },

      newPage: async (): Promise<Page> => {
        const { pageProxyId } = await this._connection.send('Browser.createPage', { browserContextId });
        const pageProxy = this._pageProxies.get(pageProxyId);
        return await pageProxy.page();
      },

      close: async (): Promise<void> => {
        assert(browserContextId, 'Non-incognito profiles cannot be closed!');
        await this._connection.send('Browser.deleteContext', { browserContextId });
        this._contexts.delete(browserContextId);
      },

      cookies: async (): Promise<network.NetworkCookie[]> => {
        const { cookies } = await this._connection.send('Browser.getAllCookies', { browserContextId });
        return cookies.map((c: network.NetworkCookie) => ({
          ...c,
          expires: c.expires === 0 ? -1 : c.expires
        }));
      },

      clearCookies: async (): Promise<void> => {
        await this._connection.send('Browser.deleteAllCookies', { browserContextId });
      },

      setCookies: async (cookies: network.SetNetworkCookieParam[]): Promise<void> => {
        const cc = cookies.map(c => ({ ...c, session: c.expires === -1 || c.expires === undefined })) as Protocol.Browser.SetCookieParam[];
        await this._connection.send('Browser.setCookies', { cookies: cc, browserContextId });
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
        await this._connection.send('Browser.grantPermissions', { origin, browserContextId, permissions: filtered });
      },

      clearPermissions: async () => {
        await this._connection.send('Browser.resetPermissions', { browserContextId });
      },

      setGeolocation: async (geolocation: types.Geolocation | null): Promise<void> => {
        const payload: any = geolocation ? { ...geolocation, timestamp: Date.now() } : undefined;
        await this._connection.send('Browser.setGeolocationOverride', { browserContextId, geolocation: payload });
      }
    }, options);
    return context;
  }
}
