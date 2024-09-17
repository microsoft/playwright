/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type * as channels from '@protocol/channels';
import type { RegisteredListener } from '../../utils/eventsHelper';
import { eventsHelper } from '../../utils/eventsHelper';
import type { BrowserOptions } from '../browser';
import { Browser } from '../browser';
import { assertBrowserContextIsNotOwned, BrowserContext } from '../browserContext';
import type { SdkObject } from '../instrumentation';
import * as network from '../network';
import type { InitScript, Page, PageDelegate } from '../page';
import type { ConnectionTransport } from '../transport';
import type * as types from '../types';
import type { BidiSession } from './bidiConnection';
import { BidiConnection } from './bidiConnection';
import { bidiBytesValueToString } from './bidiNetworkManager';
import { BidiPage } from './bidiPage';
import * as bidi from './third_party/bidiProtocol';

export class BidiBrowser extends Browser {
  private readonly _connection: BidiConnection;
  readonly _browserSession: BidiSession;
  private _bidiSessionInfo!: bidi.Session.NewResult;
  readonly _contexts = new Map<string, BidiBrowserContext>();
  readonly _bidiPages = new Map<bidi.BrowsingContext.BrowsingContext, BidiPage>();
  private readonly _eventListeners: RegisteredListener[];

  static async connect(parent: SdkObject, transport: ConnectionTransport, options: BrowserOptions): Promise<BidiBrowser> {
    const browser = new BidiBrowser(parent, transport, options);
    if ((options as any).__testHookOnConnectToBrowser)
      await (options as any).__testHookOnConnectToBrowser();

    let proxy: bidi.Session.ManualProxyConfiguration | undefined;
    if (options.proxy) {
      proxy = {
        proxyType: 'manual',
      };
      const url = new URL(options.proxy.server);  // Validate proxy server.
      switch (url.protocol) {
        case 'http:':
          proxy.httpProxy = url.host;
          break;
        case 'https:':
          proxy.httpsProxy = url.host;
          break;
        case 'socks4:':
          proxy.socksProxy = url.host;
          proxy.socksVersion = 4;
          break;
        case 'socks5:':
          proxy.socksProxy = url.host;
          proxy.socksVersion = 5;
          break;
        default:
          throw new Error('Invalid proxy server protocol: ' + options.proxy.server);
      }
      if (options.proxy.bypass)
        proxy.noProxy = options.proxy.bypass.split(',');
      // TODO: support authentication.
    }

    browser._bidiSessionInfo = await browser._browserSession.send('session.new', {
      capabilities: {
        alwaysMatch: {
          acceptInsecureCerts: false,
          proxy,
          unhandledPromptBehavior: {
            default: bidi.Session.UserPromptHandlerType.Ignore,
          },
          webSocketUrl: true
        },
      }
    });

    await browser._browserSession.send('session.subscribe', {
      events: [
        'browsingContext',
        'network',
        'log',
        'script',
      ],
    });

    if (options.persistent) {
      browser._defaultContext = new BidiBrowserContext(browser, undefined, options.persistent);
      await (browser._defaultContext as BidiBrowserContext)._initialize();
      // Create default page as we cannot get access to the existing one.
      const pageDelegate = await browser._defaultContext.newPageDelegate();
      await pageDelegate.pageOrError();
    }
    return browser;
  }

  constructor(parent: SdkObject, transport: ConnectionTransport, options: BrowserOptions) {
    super(parent, options);
    this._connection = new BidiConnection(transport, this._onDisconnect.bind(this), options.protocolLogger, options.browserLogsCollector);
    this._browserSession = this._connection.browserSession;
    this._eventListeners = [
      eventsHelper.addEventListener(this._browserSession, 'browsingContext.contextCreated', this._onBrowsingContextCreated.bind(this)),
      eventsHelper.addEventListener(this._browserSession, 'script.realmDestroyed', this._onScriptRealmDestroyed.bind(this)),
    ];
  }

  _onDisconnect() {
    this._didClose();
  }

  async doCreateNewContext(options: types.BrowserContextOptions): Promise<BrowserContext> {
    const { userContext } = await this._browserSession.send('browser.createUserContext', {});
    const context = new BidiBrowserContext(this, userContext, options);
    await context._initialize();
    this._contexts.set(userContext, context);
    return context;
  }

  contexts(): BrowserContext[] {
    return Array.from(this._contexts.values());
  }

  version(): string {
    return this._bidiSessionInfo.capabilities.browserVersion;
  }

  userAgent(): string {
    return this._bidiSessionInfo.capabilities.userAgent;
  }

  isConnected(): boolean {
    return !this._connection.isClosed();
  }

  private _onBrowsingContextCreated(event: bidi.BrowsingContext.Info) {
    if (event.parent) {
      const parentFrameId = event.parent;
      for (const page of this._bidiPages.values()) {
        const parentFrame = page._page._frameManager.frame(parentFrameId);
        if (!parentFrame)
          continue;
        page._session.addFrameBrowsingContext(event.context);
        page._page._frameManager.frameAttached(event.context, parentFrameId);
        return;
      }
      return;
    }
    let context = this._contexts.get(event.userContext);
    if (!context)
      context = this._defaultContext as BidiBrowserContext;
    if (!context)
      return;
    const session = this._connection.createMainFrameBrowsingContextSession(event.context);
    const opener = event.originalOpener && this._bidiPages.get(event.originalOpener);
    const page = new BidiPage(context, session, opener || null);
    this._bidiPages.set(event.context, page);
  }

  _onBrowsingContextDestroyed(event: bidi.BrowsingContext.Info) {
    if (event.parent) {
      this._browserSession.removeFrameBrowsingContext(event.context);
      const parentFrameId = event.parent;
      for (const page of this._bidiPages.values()) {
        const parentFrame = page._page._frameManager.frame(parentFrameId);
        if (!parentFrame)
          continue;
        page._page._frameManager.frameDetached(event.context);
        return;
      }
      return;
    }
    const bidiPage = this._bidiPages.get(event.context);
    if (!bidiPage)
      return;
    bidiPage.didClose();
    this._bidiPages.delete(event.context);
  }

  private _onScriptRealmDestroyed(event: bidi.Script.RealmDestroyedParameters) {
    for (const page of this._bidiPages.values()) {
      if (page._onRealmDestroyed(event))
        return;
    }
  }
}

export class BidiBrowserContext extends BrowserContext {
  declare readonly _browser: BidiBrowser;

  constructor(browser: BidiBrowser, browserContextId: string | undefined, options: types.BrowserContextOptions) {
    super(browser, options, browserContextId);
    this._authenticateProxyViaHeader();
  }

  private _bidiPages() {
    return [...this._browser._bidiPages.values()].filter(bidiPage => bidiPage._browserContext === this);
  }

  pages(): Page[] {
    return this._bidiPages().map(bidiPage => bidiPage._initializedPage).filter(Boolean) as Page[];
  }

  async newPageDelegate(): Promise<PageDelegate> {
    assertBrowserContextIsNotOwned(this);
    const { context } = await this._browser._browserSession.send('browsingContext.create', {
      type: bidi.BrowsingContext.CreateType.Window,
      userContext: this._browserContextId,
    });
    return this._browser._bidiPages.get(context)!;
  }

  async doGetCookies(urls: string[]): Promise<channels.NetworkCookie[]> {
    const { cookies } = await this._browser._browserSession.send('storage.getCookies',
        { partition: { type: 'storageKey', userContext: this._browserContextId } });
    return network.filterCookies(cookies.map((c: bidi.Network.Cookie) => {
      const copy: channels.NetworkCookie = {
        name: c.name,
        value: bidiBytesValueToString(c.value),
        domain: c.domain,
        path: c.path,
        httpOnly: c.httpOnly,
        secure: c.secure,
        expires: c.expiry ?? -1,
        sameSite: c.sameSite ? fromBidiSameSite(c.sameSite) : 'None',
      };
      return copy;
    }), urls);
  }

  async addCookies(cookies: channels.SetNetworkCookie[]) {
    cookies = network.rewriteCookies(cookies);
    const promises = cookies.map((c: channels.SetNetworkCookie) => {
      const cookie: bidi.Storage.PartialCookie = {
        name: c.name,
        value: { type: 'string', value: c.value },
        domain: c.domain!,
        path: c.path,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite && toBidiSameSite(c.sameSite),
        expiry: (c.expires === -1 || c.expires === undefined) ? undefined : Math.round(c.expires),
      };
      return this._browser._browserSession.send('storage.setCookie',
          { cookie, partition: { type: 'storageKey', userContext: this._browserContextId } });
    });
    await Promise.all(promises);
  }

  async doClearCookies() {
    await this._browser._browserSession.send('storage.deleteCookies',
        { partition: { type: 'storageKey', userContext: this._browserContextId } });
  }

  async doGrantPermissions(origin: string, permissions: string[]) {
  }

  async doClearPermissions() {
  }

  async setGeolocation(geolocation?: types.Geolocation): Promise<void> {
  }

  async setExtraHTTPHeaders(headers: types.HeadersArray): Promise<void> {
  }

  async setUserAgent(userAgent: string | undefined): Promise<void> {
  }

  async setOffline(offline: boolean): Promise<void> {
  }

  async doSetHTTPCredentials(httpCredentials?: types.Credentials): Promise<void> {
    this._options.httpCredentials = httpCredentials;
    for (const page of this.pages())
      await (page._delegate as BidiPage).updateHttpCredentials();
  }

  async doAddInitScript(initScript: InitScript) {
    await Promise.all(this.pages().map(page => (page._delegate as BidiPage).addInitScript(initScript)));
  }

  async doRemoveNonInternalInitScripts() {
  }

  async doUpdateRequestInterception(): Promise<void> {
  }

  onClosePersistent() {}

  override async clearCache(): Promise<void> {
  }

  async doClose(reason: string | undefined) {
    if (!this._browserContextId) {
      // Closing persistent context should close the browser.
      await this._browser.close({ reason });
      return;
    }
    await this._browser._browserSession.send('browser.removeUserContext', {
      userContext: this._browserContextId
    });
    this._browser._contexts.delete(this._browserContextId);
  }

  async cancelDownload(uuid: string) {
  }
}

function fromBidiSameSite(sameSite: bidi.Network.SameSite): channels.NetworkCookie['sameSite'] {
  switch (sameSite) {
    case 'strict': return 'Strict';
    case 'lax': return 'Lax';
    case 'none': return 'None';
  }
  return 'None';
}

function toBidiSameSite(sameSite: channels.SetNetworkCookie['sameSite']): bidi.Network.SameSite {
  switch (sameSite) {
    case 'Strict': return bidi.Network.SameSite.Strict;
    case 'Lax': return bidi.Network.SameSite.Lax;
    case 'None': return bidi.Network.SameSite.None;
  }
  return bidi.Network.SameSite.None;
}

export namespace Network {
  export const enum SameSite {
    Strict = 'strict',
    Lax = 'lax',
    None = 'none',
  }
}
