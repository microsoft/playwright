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

import { eventsHelper } from '../utils/eventsHelper';
import { Browser } from '../browser';
import { BrowserContext, verifyGeolocation } from '../browserContext';
import * as network from '../network';
import { BidiConnection } from './bidiConnection';
import { bidiBytesValueToString } from './bidiNetworkManager';
import { BidiPage, kPlaywrightBindingChannel } from './bidiPage';
import { PageBinding } from '../page';
import * as bidi from './third_party/bidiProtocol';

import type { RegisteredListener } from '../utils/eventsHelper';
import type { BrowserOptions } from '../browser';
import type { SdkObject } from '../instrumentation';
import type { InitScript, Page } from '../page';
import type { ConnectionTransport } from '../transport';
import type * as types from '../types';
import type { BidiSession } from './bidiConnection';
import type * as channels from '@protocol/channels';


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

    browser._bidiSessionInfo = await browser._browserSession.send('session.new', {
      capabilities: {
        alwaysMatch: {
          acceptInsecureCerts: false,
          proxy: getProxyConfiguration(options.proxy),
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
      const context = new BidiBrowserContext(browser, undefined, options.persistent);
      browser._defaultContext = context;
      await context._initialize();
      // Create default page as we cannot get access to the existing one.
      const page = await browser._defaultContext.doCreateNewPage();
      await page.waitForInitializedOrError();
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
    const { userContext } = await this._browserSession.send('browser.createUserContext', {
      acceptInsecureCerts: options.ignoreHTTPSErrors,
      proxy: getProxyConfiguration(options.proxy),
    });
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
        const parentFrame = page._page.frameManager.frame(parentFrameId);
        if (!parentFrame)
          continue;
        page._session.addFrameBrowsingContext(event.context);
        page._page.frameManager.frameAttached(event.context, parentFrameId);
        const frame = page._page.frameManager.frame(event.context);
        if (frame)
          frame._url = event.url;
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
    page._page.mainFrame()._url = event.url;
    this._bidiPages.set(event.context, page);
  }

  _onBrowsingContextDestroyed(event: bidi.BrowsingContext.Info) {
    if (event.parent) {
      this._browserSession.removeFrameBrowsingContext(event.context);
      const parentFrameId = event.parent;
      for (const page of this._bidiPages.values()) {
        const parentFrame = page._page.frameManager.frame(parentFrameId);
        if (!parentFrame)
          continue;
        page._page.frameManager.frameDetached(event.context);
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
  private _originToPermissions = new Map<string, string[]>();
  private _blockingPageCreations: Set<Promise<unknown>> = new Set();
  private _initScriptIds = new Map<InitScript, string>();

  constructor(browser: BidiBrowser, browserContextId: string | undefined, options: types.BrowserContextOptions) {
    super(browser, options, browserContextId);
    this._authenticateProxyViaHeader();
  }

  private _bidiPages() {
    return [...this._browser._bidiPages.values()].filter(bidiPage => bidiPage._browserContext === this);
  }

  override async _initialize() {
    const promises: Promise<any>[] = [
      super._initialize(),
    ];
    promises.push(this.doUpdateDefaultViewport());
    if (this._options.geolocation)
      promises.push(this.setGeolocation(this._options.geolocation));
    await Promise.all(promises);
  }

  override possiblyUninitializedPages(): Page[] {
    return this._bidiPages().map(bidiPage => bidiPage._page);
  }

  override async doCreateNewPage(markAsServerSideOnly?: boolean): Promise<Page> {
    const promise = this._createNewPageImpl(markAsServerSideOnly);
    if (markAsServerSideOnly)
      this._blockingPageCreations.add(promise);
    try {
      return await promise;
    } finally {
      this._blockingPageCreations.delete(promise);
    }
  }

  private async _createNewPageImpl(markAsServerSideOnly?: boolean): Promise<Page> {
    const { context } = await this._browser._browserSession.send('browsingContext.create', {
      type: bidi.BrowsingContext.CreateType.Window,
      userContext: this._browserContextId,
    });
    const page = this._browser._bidiPages.get(context)!._page;
    if (markAsServerSideOnly)
      page.markAsServerSideOnly();
    return page;
  }

  async waitForBlockingPageCreations() {
    await Promise.all([...this._blockingPageCreations].map(command => command.catch(() => {})));
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
    const currentPermissions = this._originToPermissions.get(origin) || [];
    const toGrant = permissions.filter(permission => !currentPermissions.includes(permission));
    this._originToPermissions.set(origin, [...currentPermissions, ...toGrant]);
    await Promise.all(toGrant.map(permission => this._setPermission(origin, permission, bidi.Permissions.PermissionState.Granted)));
  }

  async doClearPermissions() {
    const currentPermissions = [...this._originToPermissions.entries()];
    this._originToPermissions = new Map();
    await Promise.all(currentPermissions.map(([origin, permissions]) => permissions.map(
        p => this._setPermission(origin, p, bidi.Permissions.PermissionState.Prompt))));
  }

  private async _setPermission(origin: string, permission: string, state: bidi.Permissions.PermissionState) {
    await this._browser._browserSession.send('permissions.setPermission', {
      descriptor: {
        name: permission,
      },
      state,
      origin,
      userContext: this._browserContextId || 'default',
    });
  }

  async setGeolocation(geolocation?: types.Geolocation): Promise<void> {
    verifyGeolocation(geolocation);
    this._options.geolocation = geolocation;
    // Setting geolocation on the user context automatically applies it to all existing
    // pages in the context in Bidi.
    await this._browser._browserSession.send('emulation.setGeolocationOverride', {
      coordinates: geolocation ? {
        latitude: geolocation.latitude,
        longitude: geolocation.longitude,
        accuracy: geolocation.accuracy,
      } : null,
      userContexts: [this._browserContextId || 'default'],
    });
  }

  async doUpdateExtraHTTPHeaders(): Promise<void> {
  }

  async setUserAgent(userAgent: string | undefined): Promise<void> {
  }

  async doUpdateOffline(): Promise<void> {
  }

  async doSetHTTPCredentials(httpCredentials?: types.Credentials): Promise<void> {
    this._options.httpCredentials = httpCredentials;
    for (const page of this.pages())
      await (page.delegate as BidiPage).updateHttpCredentials();
  }

  async doAddInitScript(initScript: InitScript) {
    const { script } = await this._browser._browserSession.send('script.addPreloadScript', {
      // TODO: remove function call from the source.
      functionDeclaration: `() => { return ${initScript.source} }`,
      userContexts: [this._browserContextId || 'default'],
    });
    this._initScriptIds.set(initScript, script);
  }

  async doRemoveInitScripts(initScripts: InitScript[]) {
    const ids: string[] = [];
    for (const script of initScripts) {
      const id = this._initScriptIds.get(script);
      if (id)
        ids.push(id);
      this._initScriptIds.delete(script);
    }
    await Promise.all(ids.map(script => this._browser._browserSession.send('script.removePreloadScript', { script })));
  }

  async doUpdateRequestInterception(): Promise<void> {
  }

  override async doUpdateDefaultViewport() {
    if (!this._options.viewport)
      return;
    await this._browser._browserSession.send('browsingContext.setViewport', {
      viewport: {
        width: this._options.viewport.width,
        height: this._options.viewport.height
      },
      devicePixelRatio: this._options.deviceScaleFactor || 1,
      userContexts: [this._userContextId()],
    });
  }

  override async doUpdateDefaultEmulatedMedia() {
  }

  override async doExposePlaywrightBinding() {
    const args: bidi.Script.ChannelValue[] = [{
      type: 'channel',
      value: {
        channel: kPlaywrightBindingChannel,
        ownership: bidi.Script.ResultOwnership.Root,
      }
    }];
    const functionDeclaration = `function addMainBinding(callback) { globalThis['${PageBinding.kBindingName}'] = callback; }`;
    const promises = [];
    promises.push(this._browser._browserSession.send('script.addPreloadScript', {
      functionDeclaration,
      arguments: args,
      userContexts: [this._userContextId()],
    }));
    promises.push(...this._bidiPages().map(page => {
      const realms = [...page._realmToContext].filter(([realm, context]) => context.world === 'main').map(([realm, context]) => realm);
      return Promise.all(realms.map(realm => {
        return page._session.send('script.callFunction', {
          functionDeclaration,
          arguments: args,
          target: { realm },
          awaitPromise: false,
          userActivation: false,
        });
      }));
    }));
    await Promise.all(promises);
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

  private _userContextId(): bidi.Browser.UserContext {
    if (this._browserContextId)
      return this._browserContextId;
    // Default context always has same id, see
    // https://w3c.github.io/webdriver-bidi/#default-user-context
    return 'default';
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

function getProxyConfiguration(proxySettings?: types.ProxySettings): bidi.Session.ManualProxyConfiguration | undefined {
  if (!proxySettings)
    return undefined;

  const proxy: bidi.Session.ManualProxyConfiguration = {
    proxyType: 'manual',
  };
  const url = new URL(proxySettings.server);  // Validate proxy server.
  switch (url.protocol) {
    case 'http:':
      proxy.httpProxy = url.host;
      break;
    case 'https:':
      proxy.sslProxy = url.host;
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
      throw new Error('Invalid proxy server protocol: ' + proxySettings.server);
  }
  if (proxySettings.bypass)
    proxy.noProxy = proxySettings.bypass.split(',');
  // TODO: support authentication.

  return proxy;
}

export namespace Network {
  export const enum SameSite {
    Strict = 'strict',
    Lax = 'lax',
    None = 'none',
  }
}
