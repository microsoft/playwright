/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { BrowserBase, BrowserOptions } from '../browser';
import { assertBrowserContextIsNotOwned, BrowserContext, BrowserContextBase, validateBrowserContextOptions, verifyGeolocation } from '../browserContext';
import { Events } from '../events';
import { assert, helper, RegisteredListener } from '../helper';
import * as network from '../network';
import { Page, PageBinding } from '../page';
import { ConnectionTransport, SlowMoTransport } from '../transport';
import * as types from '../types';
import { ConnectionEvents, FFConnection } from './ffConnection';
import { FFPage } from './ffPage';
import { Protocol } from './protocol';

export class FFBrowser extends BrowserBase {
  _connection: FFConnection;
  readonly _ffPages: Map<string, FFPage>;
  readonly _contexts: Map<string, FFBrowserContext>;
  private _eventListeners: RegisteredListener[];
  private _version = '';

  static async connect(transport: ConnectionTransport, options: BrowserOptions): Promise<FFBrowser> {
    const connection = new FFConnection(SlowMoTransport.wrap(transport, options.slowMo));
    const browser = new FFBrowser(connection, options);
    const promises: Promise<any>[] = [
      connection.send('Browser.enable', { attachToDefaultContext: !!options.persistent }),
      browser._initVersion(),
    ];
    if (options.persistent) {
      browser._defaultContext = new FFBrowserContext(browser, null, options.persistent);
      promises.push((browser._defaultContext as FFBrowserContext)._initialize());
    }
    if (options.proxy) {
      const proxyServer = new URL(options.proxy.server);
      let aType: 'http'|'https'|'socks'|'socks4' = 'http';
      if (proxyServer.protocol === 'socks5:')
        aType = 'socks';
      else if (proxyServer.protocol === 'socks4:')
        aType = 'socks4';
      else if (proxyServer.protocol === 'https:')
        aType = 'https';
      promises.push(browser._connection.send('Browser.setBrowserProxy', {
        type: aType,
        bypass: options.proxy.bypass ? options.proxy.bypass.split(',').map(domain => domain.trim()) : [],
        host: proxyServer.hostname,
        port: parseInt(proxyServer.port, 10),
        username: options.proxy.username,
        password: options.proxy.password,
      }));
    }
    await Promise.all(promises);
    return browser;
  }

  constructor(connection: FFConnection, options: BrowserOptions) {
    super(options);
    this._connection = connection;
    this._ffPages = new Map();
    this._contexts = new Map();
    this._connection.on(ConnectionEvents.Disconnected, () => this._didClose());
    this._eventListeners = [
      helper.addEventListener(this._connection, 'Browser.attachedToTarget', this._onAttachedToTarget.bind(this)),
      helper.addEventListener(this._connection, 'Browser.detachedFromTarget', this._onDetachedFromTarget.bind(this)),
      helper.addEventListener(this._connection, 'Browser.downloadCreated', this._onDownloadCreated.bind(this)),
      helper.addEventListener(this._connection, 'Browser.downloadFinished', this._onDownloadFinished.bind(this)),
    ];
  }

  async _initVersion() {
    const result = await this._connection.send('Browser.getInfo');
    this._version = result.version.substring(result.version.indexOf('/') + 1);
  }

  isConnected(): boolean {
    return !this._connection._closed;
  }

  async newContext(options: types.BrowserContextOptions = {}): Promise<BrowserContext> {
    validateBrowserContextOptions(options);
    if (options.isMobile)
      throw new Error('options.isMobile is not supported in Firefox');
    const { browserContextId } = await this._connection.send('Browser.createBrowserContext', { removeOnDetach: true });
    const context = new FFBrowserContext(this, browserContextId, options);
    await context._initialize();
    this._contexts.set(browserContextId, context);
    return context;
  }

  contexts(): BrowserContext[] {
    return Array.from(this._contexts.values());
  }

  version(): string {
    return this._version;
  }

  _onDetachedFromTarget(payload: Protocol.Browser.detachedFromTargetPayload) {
    const ffPage = this._ffPages.get(payload.targetId)!;
    this._ffPages.delete(payload.targetId);
    ffPage.didClose();
  }

  _onAttachedToTarget(payload: Protocol.Browser.attachedToTargetPayload) {
    const {targetId, browserContextId, openerId, type} = payload.targetInfo;
    assert(type === 'page');
    const context = browserContextId ? this._contexts.get(browserContextId)! : this._defaultContext as FFBrowserContext;
    assert(context, `Unknown context id:${browserContextId}, _defaultContext: ${this._defaultContext}`);
    const session = this._connection.createSession(payload.sessionId, type);
    const opener = openerId ? this._ffPages.get(openerId)! : null;
    const ffPage = new FFPage(session, context, opener);
    this._ffPages.set(targetId, ffPage);

    ffPage.pageOrError().then(async pageOrError => {
      const page = ffPage._page;
      if (pageOrError instanceof Error)
        page._setIsError();
      context.emit(Events.BrowserContext.Page, page);
      if (!opener)
        return;
      const openerPage = await opener.pageOrError();
      if (openerPage instanceof Page && !openerPage.isClosed())
        openerPage.emit(Events.Page.Popup, page);
    });
  }

  _onDownloadCreated(payload: Protocol.Browser.downloadCreatedPayload) {
    const ffPage = this._ffPages.get(payload.pageTargetId)!;
    assert(ffPage);
    if (!ffPage)
      return;
    let originPage = ffPage._initializedPage;
    // If it's a new window download, report it on the opener page.
    if (!originPage) {
      // Resume the page creation with an error. The page will automatically close right
      // after the download begins.
      ffPage._pageCallback(new Error('Starting new page download'));
      if (ffPage._opener)
        originPage = ffPage._opener._initializedPage;
    }
    if (!originPage)
      return;
    this._downloadCreated(originPage, payload.uuid, payload.url, payload.suggestedFileName);
  }

  _onDownloadFinished(payload: Protocol.Browser.downloadFinishedPayload) {
    const error = payload.canceled ? 'canceled' : payload.error;
    this._downloadFinished(payload.uuid, error);
  }
}

export class FFBrowserContext extends BrowserContextBase {
  readonly _browser: FFBrowser;
  readonly _browserContextId: string | null;

  constructor(browser: FFBrowser, browserContextId: string | null, options: types.BrowserContextOptions) {
    super(browser, options, !browserContextId);
    this._browser = browser;
    this._browserContextId = browserContextId;
  }

  async _initialize() {
    assert(!this._ffPages().length);
    const browserContextId = this._browserContextId || undefined;
    const promises: Promise<any>[] = [ super._initialize() ];
    if (this._browser._options.downloadsPath) {
      promises.push(this._browser._connection.send('Browser.setDownloadOptions', {
        browserContextId,
        downloadOptions: {
          behavior: this._options.acceptDownloads ? 'saveToDisk' : 'cancel',
          downloadsDir: this._browser._options.downloadsPath,
        },
      }));
    }
    if (this._options.viewport) {
      const viewport = {
        viewportSize: { width: this._options.viewport.width, height: this._options.viewport.height },
        deviceScaleFactor: this._options.deviceScaleFactor || 1,
      };
      promises.push(this._browser._connection.send('Browser.setDefaultViewport', { browserContextId, viewport }));
    }
    if (this._options.hasTouch)
      promises.push(this._browser._connection.send('Browser.setTouchOverride', { browserContextId, hasTouch: true }));
    if (this._options.userAgent)
      promises.push(this._browser._connection.send('Browser.setUserAgentOverride', { browserContextId, userAgent: this._options.userAgent }));
    if (this._options.bypassCSP)
      promises.push(this._browser._connection.send('Browser.setBypassCSP', { browserContextId, bypassCSP: true }));
    if (this._options.ignoreHTTPSErrors)
      promises.push(this._browser._connection.send('Browser.setIgnoreHTTPSErrors', { browserContextId, ignoreHTTPSErrors: true }));
    if (this._options.javaScriptEnabled === false)
      promises.push(this._browser._connection.send('Browser.setJavaScriptDisabled', { browserContextId, javaScriptDisabled: true }));
    if (this._options.locale)
      promises.push(this._browser._connection.send('Browser.setLocaleOverride', { browserContextId, locale: this._options.locale }));
    if (this._options.timezoneId)
      promises.push(this._browser._connection.send('Browser.setTimezoneOverride', { browserContextId, timezoneId: this._options.timezoneId }));
    if (this._options.permissions)
      promises.push(this.grantPermissions(this._options.permissions));
    if (this._options.extraHTTPHeaders || this._options.locale)
      promises.push(this.setExtraHTTPHeaders(this._options.extraHTTPHeaders || []));
    if (this._options.httpCredentials)
      promises.push(this.setHTTPCredentials(this._options.httpCredentials));
    if (this._options.geolocation)
      promises.push(this.setGeolocation(this._options.geolocation));
    if (this._options.offline)
      promises.push(this.setOffline(this._options.offline));
    if (this._options.colorScheme)
      promises.push(this._browser._connection.send('Browser.setColorScheme', { browserContextId, colorScheme: this._options.colorScheme }));
    await Promise.all(promises);
  }

  _ffPages(): FFPage[] {
    return Array.from(this._browser._ffPages.values()).filter(ffPage => ffPage._browserContext === this);
  }

  pages(): Page[] {
    return this._ffPages().map(ffPage => ffPage._initializedPage).filter(pageOrNull => !!pageOrNull) as Page[];
  }

  async newPage(): Promise<Page> {
    assertBrowserContextIsNotOwned(this);
    const { targetId } = await this._browser._connection.send('Browser.newPage', {
      browserContextId: this._browserContextId || undefined
    }).catch(e =>  {
      if (e.message.includes('Failed to override timezone'))
        throw new Error(`Invalid timezone ID: ${this._options.timezoneId}`);
      throw e;
    });
    const ffPage = this._browser._ffPages.get(targetId)!;
    const pageOrError = await ffPage.pageOrError();
    if (pageOrError instanceof Page) {
      if (pageOrError.isClosed())
        throw new Error('Page has been closed.');
      return pageOrError;
    }
    throw pageOrError;
  }

  async _doCookies(urls: string[]): Promise<types.NetworkCookie[]> {
    const { cookies } = await this._browser._connection.send('Browser.getCookies', { browserContextId: this._browserContextId || undefined });
    return network.filterCookies(cookies.map(c => {
      const copy: any = { ... c };
      delete copy.size;
      delete copy.session;
      return copy as types.NetworkCookie;
    }), urls);
  }

  async addCookies(cookies: types.SetNetworkCookieParam[]) {
    await this._browser._connection.send('Browser.setCookies', { browserContextId: this._browserContextId || undefined, cookies: network.rewriteCookies(cookies) });
  }

  async clearCookies() {
    await this._browser._connection.send('Browser.clearCookies', { browserContextId: this._browserContextId || undefined });
  }

  async _doGrantPermissions(origin: string, permissions: string[]) {
    const webPermissionToProtocol = new Map<string, 'geo' | 'desktop-notification' | 'persistent-storage' | 'push'>([
      ['geolocation', 'geo'],
      ['persistent-storage', 'persistent-storage'],
      ['push', 'push'],
      ['notifications', 'desktop-notification'],
    ]);
    const filtered = permissions.map(permission => {
      const protocolPermission = webPermissionToProtocol.get(permission);
      if (!protocolPermission)
        throw new Error('Unknown permission: ' + permission);
      return protocolPermission;
    });
    await this._browser._connection.send('Browser.grantPermissions', { origin: origin, browserContextId: this._browserContextId || undefined, permissions: filtered});
  }

  async _doClearPermissions() {
    await this._browser._connection.send('Browser.resetPermissions', { browserContextId: this._browserContextId || undefined });
  }

  async setGeolocation(geolocation?: types.Geolocation): Promise<void> {
    verifyGeolocation(geolocation);
    this._options.geolocation = geolocation;
    await this._browser._connection.send('Browser.setGeolocationOverride', { browserContextId: this._browserContextId || undefined, geolocation: geolocation || null });
  }

  async setExtraHTTPHeaders(headers: types.HeadersArray): Promise<void> {
    this._options.extraHTTPHeaders = headers;
    let allHeaders = this._options.extraHTTPHeaders;
    if (this._options.locale)
      allHeaders = network.mergeHeaders([allHeaders, network.singleHeader('Accept-Language', this._options.locale)]);
    await this._browser._connection.send('Browser.setExtraHTTPHeaders', { browserContextId: this._browserContextId || undefined, headers: allHeaders });
  }

  async setOffline(offline: boolean): Promise<void> {
    this._options.offline = offline;
    await this._browser._connection.send('Browser.setOnlineOverride', { browserContextId: this._browserContextId || undefined, override: offline ? 'offline' : 'online' });
  }

  async _doSetHTTPCredentials(httpCredentials?: types.Credentials): Promise<void> {
    this._options.httpCredentials = httpCredentials;
    await this._browser._connection.send('Browser.setHTTPCredentials', { browserContextId: this._browserContextId || undefined, credentials: httpCredentials || null });
  }

  async _doAddInitScript(source: string) {
    await this._browser._connection.send('Browser.addScriptToEvaluateOnNewDocument', { browserContextId: this._browserContextId || undefined, script: source });
  }

  async _doExposeBinding(binding: PageBinding) {
    await this._browser._connection.send('Browser.addBinding', { browserContextId: this._browserContextId || undefined, name: binding.name, script: binding.source });
  }

  async _doUpdateRequestInterception(): Promise<void> {
    await this._browser._connection.send('Browser.setRequestInterception', { browserContextId: this._browserContextId || undefined, enabled: !!this._requestInterceptor });
  }

  async _doClose() {
    assert(this._browserContextId);
    await this._browser._connection.send('Browser.removeBrowserContext', { browserContextId: this._browserContextId });
    this._browser._contexts.delete(this._browserContextId);
  }
}
