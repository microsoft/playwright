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

import { BrowserBase } from '../browser';
import { assertBrowserContextIsNotOwned, BrowserContext, BrowserContextBase, BrowserContextOptions, validateBrowserContextOptions, verifyGeolocation } from '../browserContext';
import { Events } from '../events';
import { assert, helper, RegisteredListener } from '../helper';
import * as network from '../network';
import { Page, PageBinding } from '../page';
import { ConnectionTransport, SlowMoTransport } from '../transport';
import * as types from '../types';
import { Protocol } from './protocol';
import { kPageProxyMessageReceived, PageProxyMessageReceivedPayload, WKConnection, WKSession } from './wkConnection';
import { WKPage } from './wkPage';
import { InnerLogger } from '../logger';

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.4 Safari/605.1.15';

export class WKBrowser extends BrowserBase {
  private readonly _connection: WKConnection;
  readonly _browserSession: WKSession;
  readonly _defaultContext: WKBrowserContext | null = null;
  readonly _contexts = new Map<string, WKBrowserContext>();
  readonly _wkPages = new Map<string, WKPage>();
  private readonly _eventListeners: RegisteredListener[];

  private _firstPageCallback: () => void = () => {};
  private readonly _firstPagePromise: Promise<void>;

  static async connect(transport: ConnectionTransport, logger: InnerLogger, slowMo: number = 0, attachToDefaultContext: boolean = false): Promise<WKBrowser> {
    const browser = new WKBrowser(SlowMoTransport.wrap(transport, slowMo), logger, attachToDefaultContext);
    return browser;
  }

  constructor(transport: ConnectionTransport, logger: InnerLogger, attachToDefaultContext: boolean) {
    super(logger);
    this._connection = new WKConnection(transport, logger, this._onDisconnect.bind(this));
    this._browserSession = this._connection.browserSession;

    if (attachToDefaultContext)
      this._defaultContext = new WKBrowserContext(this, undefined, validateBrowserContextOptions({}));

    this._eventListeners = [
      helper.addEventListener(this._browserSession, 'Playwright.pageProxyCreated', this._onPageProxyCreated.bind(this)),
      helper.addEventListener(this._browserSession, 'Playwright.pageProxyDestroyed', this._onPageProxyDestroyed.bind(this)),
      helper.addEventListener(this._browserSession, 'Playwright.provisionalLoadFailed', event => this._onProvisionalLoadFailed(event)),
      helper.addEventListener(this._browserSession, 'Playwright.downloadCreated', this._onDownloadCreated.bind(this)),
      helper.addEventListener(this._browserSession, 'Playwright.downloadFinished', this._onDownloadFinished.bind(this)),
      helper.addEventListener(this._browserSession, kPageProxyMessageReceived, this._onPageProxyMessageReceived.bind(this)),
    ];

    this._firstPagePromise = new Promise<void>(resolve => this._firstPageCallback = resolve);
  }

  _onDisconnect() {
    for (const wkPage of this._wkPages.values())
      wkPage.dispose();
    for (const context of this._contexts.values())
      context._browserClosed();
    // Note: previous method uses pages to issue 'close' event on them, so we clear them after.
    this._wkPages.clear();
    this.emit(Events.Browser.Disconnected);
  }

  async newContext(options: BrowserContextOptions = {}): Promise<BrowserContext> {
    options = validateBrowserContextOptions(options);
    const { browserContextId } = await this._browserSession.send('Playwright.createContext');
    options.userAgent = options.userAgent || DEFAULT_USER_AGENT;
    const context = new WKBrowserContext(this, browserContextId, options);
    await context._initialize();
    this._contexts.set(browserContextId, context);
    return context;
  }

  contexts(): BrowserContext[] {
    return Array.from(this._contexts.values());
  }

  async _waitForFirstPageTarget(): Promise<void> {
    assert(!this._wkPages.size);
    return this._firstPagePromise;
  }

  _onDownloadCreated(payload: Protocol.Playwright.downloadCreatedPayload) {
    const page = this._wkPages.get(payload.pageProxyId);
    if (!page)
      return;
    const frameManager = page._page._frameManager;
    const frame = frameManager.frame(payload.frameId);
    if (frame) {
      // In some cases, e.g. blob url download, we receive only frameScheduledNavigation
      // but no signals that the navigation was canceled and replaced by download. Fix it
      // here by simulating cancelled provisional load which matches downloads from network.
      frameManager.provisionalLoadFailed(frame, '', 'Download is starting');
    }
    let originPage = page._initializedPage;
    // If it's a new window download, report it on the opener page.
    if (!originPage) {
      // Resume the page creation with an error. The page will automatically close right
      // after the download begins.
      page._firstNonInitialNavigationCommittedReject(new Error('Starting new page download'));
      if (page._opener)
        originPage = page._opener._initializedPage;
    }
    if (!originPage)
      return;
    this._downloadCreated(originPage, payload.uuid, payload.url);
  }

  _onDownloadFinished(payload: Protocol.Playwright.downloadFinishedPayload) {
    this._downloadFinished(payload.uuid, payload.error);
  }

  _onPageProxyCreated(event: Protocol.Playwright.pageProxyCreatedPayload) {
    const { pageProxyInfo } = event;
    const pageProxyId = pageProxyInfo.pageProxyId;
    let context: WKBrowserContext | null = null;
    if (pageProxyInfo.browserContextId) {
      // FIXME: we don't know about the default context id, so assume that all targets from
      // unknown contexts are created in the 'default' context which can in practice be represented
      // by multiple actual contexts in WebKit. Solving this properly will require adding context
      // lifecycle events.
      context = this._contexts.get(pageProxyInfo.browserContextId) || null;
    }
    if (!context)
      context = this._defaultContext;
    if (!context)
      return;
    const pageProxySession = new WKSession(this._connection, pageProxyId, `The page has been closed.`, (message: any) => {
      this._connection.rawSend({ ...message, pageProxyId });
    });
    const opener = pageProxyInfo.openerId ? this._wkPages.get(pageProxyInfo.openerId) : undefined;
    const wkPage = new WKPage(context, pageProxySession, opener || null);
    this._wkPages.set(pageProxyId, wkPage);

    if (opener && opener._initializedPage) {
      for (const signalBarrier of opener._initializedPage._frameManager._signalBarriers)
        signalBarrier.addPopup(wkPage.pageOrError());
    }
    wkPage.pageOrError().then(async () => {
      this._firstPageCallback();
      const page = wkPage._page;
      context!.emit(Events.BrowserContext.Page, page);
      if (!opener)
        return;
      await opener.pageOrError();
      const openerPage = opener._page;
      if (!openerPage.isClosed())
        openerPage.emit(Events.Page.Popup, page);
    });
  }

  _onPageProxyDestroyed(event: Protocol.Playwright.pageProxyDestroyedPayload) {
    const pageProxyId = event.pageProxyId;
    const wkPage = this._wkPages.get(pageProxyId);
    if (!wkPage)
      return;
    wkPage.didClose();
    wkPage.dispose();
    this._wkPages.delete(pageProxyId);
  }

  _onPageProxyMessageReceived(event: PageProxyMessageReceivedPayload) {
    const wkPage = this._wkPages.get(event.pageProxyId);
    if (!wkPage)
      return;
    wkPage.dispatchMessageToSession(event.message);
  }

  _onProvisionalLoadFailed(event: Protocol.Playwright.provisionalLoadFailedPayload) {
    const wkPage = this._wkPages.get(event.pageProxyId);
    if (!wkPage)
      return;
    wkPage.handleProvisionalLoadFailed(event);
  }

  isConnected(): boolean {
    return !this._connection.isClosed();
  }

  _disconnect() {
    helper.removeEventListeners(this._eventListeners);
    this._connection.close();
  }
}

export class WKBrowserContext extends BrowserContextBase {
  readonly _browser: WKBrowser;
  readonly _browserContextId: string | undefined;
  readonly _evaluateOnNewDocumentSources: string[];

  constructor(browser: WKBrowser, browserContextId: string | undefined, options: BrowserContextOptions) {
    super(browser, options);
    this._browser = browser;
    this._browserContextId = browserContextId;
    this._evaluateOnNewDocumentSources = [];
  }

  async _initialize() {
    const browserContextId = this._browserContextId;
    const promises: Promise<any>[] = [
      this._browser._browserSession.send('Playwright.setDownloadBehavior', {
        behavior: this._options.acceptDownloads ? 'allow' : 'deny',
        downloadPath: this._browser._downloadsPath,
        browserContextId
      })
    ];
    if (this._options.ignoreHTTPSErrors)
      promises.push(this._browser._browserSession.send('Playwright.setIgnoreCertificateErrors', { browserContextId, ignore: true }));
    if (this._options.locale)
      promises.push(this._browser._browserSession.send('Playwright.setLanguages', { browserContextId, languages: [this._options.locale] }));
    if (this._options.permissions)
      promises.push(this.grantPermissions(this._options.permissions));
    if (this._options.geolocation)
      promises.push(this.setGeolocation(this._options.geolocation));
    if (this._options.offline)
      promises.push(this.setOffline(this._options.offline));
    if (this._options.httpCredentials)
      promises.push(this.setHTTPCredentials(this._options.httpCredentials));
    await Promise.all(promises);
  }

  _wkPages(): WKPage[] {
    return Array.from(this._browser._wkPages.values()).filter(wkPage => wkPage._browserContext === this);
  }

  pages(): Page[] {
    return this._wkPages().map(wkPage => wkPage._initializedPage).filter(pageOrNull => !!pageOrNull) as Page[];
  }

  async newPage(): Promise<Page> {
    assertBrowserContextIsNotOwned(this);
    const { pageProxyId } = await this._browser._browserSession.send('Playwright.createPage', { browserContextId: this._browserContextId });
    const wkPage = this._browser._wkPages.get(pageProxyId)!;
    const result = await wkPage.pageOrError();
    if (result instanceof Page) {
      if (result.isClosed())
        throw new Error('Page has been closed.');
      return result;
    }
    throw result;
  }

  async cookies(urls?: string | string[]): Promise<network.NetworkCookie[]> {
    const { cookies } = await this._browser._browserSession.send('Playwright.getAllCookies', { browserContextId: this._browserContextId });
    return network.filterCookies(cookies.map((c: network.NetworkCookie) => {
      const copy: any = { ... c };
      copy.expires = c.expires === -1 ? -1 : c.expires / 1000;
      delete copy.session;
      return copy as network.NetworkCookie;
    }), urls);
  }

  async addCookies(cookies: network.SetNetworkCookieParam[]) {
    const cc = network.rewriteCookies(cookies).map(c => ({
      ...c,
      session: c.expires === -1 || c.expires === undefined,
      expires: c.expires && c.expires !== -1 ? c.expires * 1000 : c.expires
    })) as Protocol.Playwright.SetCookieParam[];
    await this._browser._browserSession.send('Playwright.setCookies', { cookies: cc, browserContextId: this._browserContextId });
  }

  async clearCookies() {
    await this._browser._browserSession.send('Playwright.deleteAllCookies', { browserContextId: this._browserContextId });
  }

  async _doGrantPermissions(origin: string, permissions: string[]) {
    await Promise.all(this.pages().map(page => (page._delegate as WKPage)._grantPermissions(origin, permissions)));
  }

  async _doClearPermissions() {
    await Promise.all(this.pages().map(page => (page._delegate as WKPage)._clearPermissions()));
  }

  async setGeolocation(geolocation: types.Geolocation | null): Promise<void> {
    if (geolocation)
      geolocation = verifyGeolocation(geolocation);
    this._options.geolocation = geolocation || undefined;
    const payload: any = geolocation ? { ...geolocation, timestamp: Date.now() } : undefined;
    await this._browser._browserSession.send('Playwright.setGeolocationOverride', { browserContextId: this._browserContextId, geolocation: payload });
  }

  async setExtraHTTPHeaders(headers: network.Headers): Promise<void> {
    this._options.extraHTTPHeaders = network.verifyHeaders(headers);
    for (const page of this.pages())
      await (page._delegate as WKPage).updateExtraHTTPHeaders();
  }

  async setOffline(offline: boolean): Promise<void> {
    this._options.offline = offline;
    for (const page of this.pages())
      await (page._delegate as WKPage).updateOffline();
  }

  async setHTTPCredentials(httpCredentials: types.Credentials | null): Promise<void> {
    this._options.httpCredentials = httpCredentials || undefined;
    for (const page of this.pages())
      await (page._delegate as WKPage).updateHttpCredentials();
  }

  async addInitScript(script: Function | string | { path?: string, content?: string }, arg?: any) {
    const source = await helper.evaluationScript(script, arg);
    this._evaluateOnNewDocumentSources.push(source);
    for (const page of this.pages())
      await (page._delegate as WKPage)._updateBootstrapScript();
  }

  async exposeFunction(name: string, playwrightFunction: Function): Promise<void> {
    for (const page of this.pages()) {
      if (page._pageBindings.has(name))
        throw new Error(`Function "${name}" has been already registered in one of the pages`);
    }
    if (this._pageBindings.has(name))
      throw new Error(`Function "${name}" has been already registered`);
    const binding = new PageBinding(name, playwrightFunction);
    this._pageBindings.set(name, binding);
    for (const page of this.pages())
      await (page._delegate as WKPage).exposeBinding(binding);
  }

  async route(url: types.URLMatch, handler: network.RouteHandler): Promise<void> {
    this._routes.push({ url, handler });
    for (const page of this.pages())
      await (page._delegate as WKPage).updateRequestInterception();
  }

  async unroute(url: types.URLMatch, handler?: network.RouteHandler): Promise<void> {
    this._routes = this._routes.filter(route => route.url !== url || (handler && route.handler !== handler));
    for (const page of this.pages())
      await (page._delegate as WKPage).updateRequestInterception();
  }

  async close() {
    if (this._closed)
      return;
    if (!this._browserContextId) {
      // Default context is only created in 'persistent' mode and closing it should close
      // the browser.
      await this._browser.close();
      return;
    }
    await this._browser._browserSession.send('Playwright.deleteContext', { browserContextId: this._browserContextId });
    this._browser._contexts.delete(this._browserContextId);
    await this._didCloseInternal();
  }
}
