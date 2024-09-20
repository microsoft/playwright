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

import type { BrowserOptions } from '../browser';
import { Browser } from '../browser';
import { assertBrowserContextIsNotOwned, BrowserContext, verifyGeolocation } from '../browserContext';
import { assert } from '../../utils';
import * as network from '../network';
import type { InitScript, Page, PageDelegate } from '../page';
import type { ConnectionTransport } from '../transport';
import type * as types from '../types';
import type * as channels from '@protocol/channels';
import type { Protocol } from './protocol';
import type { PageProxyMessageReceivedPayload } from './wkConnection';
import { kPageProxyMessageReceived, WKConnection, WKSession } from './wkConnection';
import { WKPage } from './wkPage';
import { TargetClosedError } from '../errors';
import type { SdkObject } from '../instrumentation';

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const BROWSER_VERSION = '18.0';

export class WKBrowser extends Browser {
  private readonly _connection: WKConnection;
  readonly _browserSession: WKSession;
  readonly _contexts = new Map<string, WKBrowserContext>();
  readonly _wkPages = new Map<string, WKPage>();

  static async connect(parent: SdkObject, transport: ConnectionTransport, options: BrowserOptions): Promise<WKBrowser> {
    const browser = new WKBrowser(parent, transport, options);
    if ((options as any).__testHookOnConnectToBrowser)
      await (options as any).__testHookOnConnectToBrowser();
    const promises: Promise<any>[] = [
      browser._browserSession.send('Playwright.enable'),
    ];
    if (options.persistent) {
      options.persistent.userAgent ||= DEFAULT_USER_AGENT;
      browser._defaultContext = new WKBrowserContext(browser, undefined, options.persistent);
      promises.push((browser._defaultContext as WKBrowserContext)._initialize());
    }
    await Promise.all(promises);
    return browser;
  }

  constructor(parent: SdkObject, transport: ConnectionTransport, options: BrowserOptions) {
    super(parent, options);
    this._connection = new WKConnection(transport, this._onDisconnect.bind(this), options.protocolLogger, options.browserLogsCollector);
    this._browserSession = this._connection.browserSession;
    this._browserSession.on('Playwright.pageProxyCreated', this._onPageProxyCreated.bind(this));
    this._browserSession.on('Playwright.pageProxyDestroyed', this._onPageProxyDestroyed.bind(this));
    this._browserSession.on('Playwright.provisionalLoadFailed', event => this._onProvisionalLoadFailed(event));
    this._browserSession.on('Playwright.windowOpen', event => this._onWindowOpen(event));
    this._browserSession.on('Playwright.downloadCreated', this._onDownloadCreated.bind(this));
    this._browserSession.on('Playwright.downloadFilenameSuggested', this._onDownloadFilenameSuggested.bind(this));
    this._browserSession.on('Playwright.downloadFinished', this._onDownloadFinished.bind(this));
    this._browserSession.on('Playwright.screencastFinished', this._onScreencastFinished.bind(this));
    this._browserSession.on(kPageProxyMessageReceived, this._onPageProxyMessageReceived.bind(this));
  }

  _onDisconnect() {
    for (const wkPage of this._wkPages.values())
      wkPage.didClose();
    this._wkPages.clear();
    for (const video of this._idToVideo.values())
      video.artifact.reportFinished(new TargetClosedError());
    this._idToVideo.clear();
    this._didClose();
  }

  async doCreateNewContext(options: types.BrowserContextOptions): Promise<BrowserContext> {
    const proxy = options.proxyOverride || options.proxy;
    const createOptions = proxy ? {
      // Enable socks5 hostname resolution on Windows.
      // See https://github.com/microsoft/playwright/issues/20451
      proxyServer: process.platform === 'win32' ? proxy.server.replace(/^socks5:\/\//, 'socks5h://') : proxy.server,
      proxyBypassList: proxy.bypass
    } : undefined;
    const { browserContextId } = await this._browserSession.send('Playwright.createContext', createOptions);
    options.userAgent = options.userAgent || DEFAULT_USER_AGENT;
    const context = new WKBrowserContext(this, browserContextId, options);
    await context._initialize();
    this._contexts.set(browserContextId, context);
    return context;
  }

  contexts(): BrowserContext[] {
    return Array.from(this._contexts.values());
  }

  version(): string {
    return BROWSER_VERSION;
  }

  userAgent(): string {
    return DEFAULT_USER_AGENT;
  }

  _onDownloadCreated(payload: Protocol.Playwright.downloadCreatedPayload) {
    const page = this._wkPages.get(payload.pageProxyId);
    if (!page)
      return;
    // In some cases, e.g. blob url download, we receive only frameScheduledNavigation
    // but no signals that the navigation was canceled and replaced by download. Fix it
    // here by simulating cancelled provisional load which matches downloads from network.
    //
    // TODO: this is racy, because download might be unrelated any navigation, and we will
    // abort navigation that is still running. We should be able to fix this by
    // instrumenting policy decision start/proceed/cancel.
    page._page._frameManager.frameAbortedNavigation(payload.frameId, 'Download is starting');
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

  _onDownloadFilenameSuggested(payload: Protocol.Playwright.downloadFilenameSuggestedPayload) {
    this._downloadFilenameSuggested(payload.uuid, payload.suggestedFilename);
  }

  _onDownloadFinished(payload: Protocol.Playwright.downloadFinishedPayload) {
    this._downloadFinished(payload.uuid, payload.error);
  }

  _onScreencastFinished(payload: Protocol.Playwright.screencastFinishedPayload) {
    this._takeVideo(payload.screencastId)?.reportFinished();
  }

  _onPageProxyCreated(event: Protocol.Playwright.pageProxyCreatedPayload) {
    const pageProxyId = event.pageProxyId;
    let context: WKBrowserContext | null = null;
    if (event.browserContextId) {
      // FIXME: we don't know about the default context id, so assume that all targets from
      // unknown contexts are created in the 'default' context which can in practice be represented
      // by multiple actual contexts in WebKit. Solving this properly will require adding context
      // lifecycle events.
      context = this._contexts.get(event.browserContextId) || null;
    }
    if (!context)
      context = this._defaultContext as WKBrowserContext;
    if (!context)
      return;
    const pageProxySession = new WKSession(this._connection, pageProxyId, (message: any) => {
      this._connection.rawSend({ ...message, pageProxyId });
    });
    const opener = event.openerId ? this._wkPages.get(event.openerId) : undefined;
    const wkPage = new WKPage(context, pageProxySession, opener || null);
    this._wkPages.set(pageProxyId, wkPage);
  }

  _onPageProxyDestroyed(event: Protocol.Playwright.pageProxyDestroyedPayload) {
    const pageProxyId = event.pageProxyId;
    const wkPage = this._wkPages.get(pageProxyId);
    if (!wkPage)
      return;
    wkPage.didClose();
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

  _onWindowOpen(event: Protocol.Playwright.windowOpenPayload) {
    const wkPage = this._wkPages.get(event.pageProxyId);
    if (!wkPage)
      return;
    wkPage.handleWindowOpen(event);
  }

  isConnected(): boolean {
    return !this._connection.isClosed();
  }
}

export class WKBrowserContext extends BrowserContext {
  declare readonly _browser: WKBrowser;

  constructor(browser: WKBrowser, browserContextId: string | undefined, options: types.BrowserContextOptions) {
    super(browser, options, browserContextId);
    this._validateEmulatedViewport(options.viewport);
    this._authenticateProxyViaHeader();
  }

  override async _initialize() {
    assert(!this._wkPages().length);
    const browserContextId = this._browserContextId;
    const promises: Promise<any>[] = [super._initialize()];
    promises.push(this._browser._browserSession.send('Playwright.setDownloadBehavior', {
      behavior: this._options.acceptDownloads === 'accept' ? 'allow' : 'deny',
      downloadPath: this._browser.options.downloadsPath,
      browserContextId
    }));
    if (this._options.ignoreHTTPSErrors || this._options.internalIgnoreHTTPSErrors)
      promises.push(this._browser._browserSession.send('Playwright.setIgnoreCertificateErrors', { browserContextId, ignore: true }));
    if (this._options.locale)
      promises.push(this._browser._browserSession.send('Playwright.setLanguages', { browserContextId, languages: [this._options.locale] }));
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

  async newPageDelegate(): Promise<PageDelegate> {
    assertBrowserContextIsNotOwned(this);
    const { pageProxyId } = await this._browser._browserSession.send('Playwright.createPage', { browserContextId: this._browserContextId });
    return this._browser._wkPages.get(pageProxyId)!;
  }

  async doGetCookies(urls: string[]): Promise<channels.NetworkCookie[]> {
    const { cookies } = await this._browser._browserSession.send('Playwright.getAllCookies', { browserContextId: this._browserContextId });
    return network.filterCookies(cookies.map((c: channels.NetworkCookie) => {
      const copy: any = { ... c };
      copy.expires = c.expires === -1 ? -1 : c.expires / 1000;
      delete copy.session;
      return copy as channels.NetworkCookie;
    }), urls);
  }

  async addCookies(cookies: channels.SetNetworkCookie[]) {
    const cc = network.rewriteCookies(cookies).map(c => ({
      ...c,
      session: c.expires === -1 || c.expires === undefined,
      expires: c.expires && c.expires !== -1 ? c.expires * 1000 : c.expires,
    })) as Protocol.Playwright.SetCookieParam[];
    await this._browser._browserSession.send('Playwright.setCookies', { cookies: cc, browserContextId: this._browserContextId });
  }

  async doClearCookies() {
    await this._browser._browserSession.send('Playwright.deleteAllCookies', { browserContextId: this._browserContextId });
  }

  async doGrantPermissions(origin: string, permissions: string[]) {
    await Promise.all(this.pages().map(page => (page._delegate as WKPage)._grantPermissions(origin, permissions)));
  }

  async doClearPermissions() {
    await Promise.all(this.pages().map(page => (page._delegate as WKPage)._clearPermissions()));
  }

  async setGeolocation(geolocation?: types.Geolocation): Promise<void> {
    verifyGeolocation(geolocation);
    this._options.geolocation = geolocation;
    const payload: any = geolocation ? { ...geolocation, timestamp: Date.now() } : undefined;
    await this._browser._browserSession.send('Playwright.setGeolocationOverride', { browserContextId: this._browserContextId, geolocation: payload });
  }

  async setExtraHTTPHeaders(headers: types.HeadersArray): Promise<void> {
    this._options.extraHTTPHeaders = headers;
    for (const page of this.pages())
      await (page._delegate as WKPage).updateExtraHTTPHeaders();
  }

  async setUserAgent(userAgent: string | undefined): Promise<void> {
    this._options.userAgent = userAgent;
    for (const page of this.pages())
      await (page._delegate as WKPage).updateUserAgent();
  }

  async setOffline(offline: boolean): Promise<void> {
    this._options.offline = offline;
    for (const page of this.pages())
      await (page._delegate as WKPage).updateOffline();
  }

  async doSetHTTPCredentials(httpCredentials?: types.Credentials): Promise<void> {
    this._options.httpCredentials = httpCredentials;
    for (const page of this.pages())
      await (page._delegate as WKPage).updateHttpCredentials();
  }

  async doAddInitScript(initScript: InitScript) {
    for (const page of this.pages())
      await (page._delegate as WKPage)._updateBootstrapScript();
  }

  async doRemoveNonInternalInitScripts() {
    for (const page of this.pages())
      await (page._delegate as WKPage)._updateBootstrapScript();
  }

  async doUpdateRequestInterception(): Promise<void> {
    for (const page of this.pages())
      await (page._delegate as WKPage).updateRequestInterception();
  }

  onClosePersistent() {}

  override async clearCache(): Promise<void> {
    // We use ephemeral contexts so there is no disk cache.
    await this._browser._browserSession.send('Playwright.clearMemoryCache', {
      browserContextId: this._browserContextId!
    });
  }

  async doClose(reason: string | undefined) {
    if (!this._browserContextId) {
      await Promise.all(this._wkPages().map(wkPage => wkPage._stopVideo()));
      // Closing persistent context should close the browser.
      await this._browser.close({ reason });
    } else {
      await this._browser._browserSession.send('Playwright.deleteContext', { browserContextId: this._browserContextId });
      this._browser._contexts.delete(this._browserContextId);
    }
  }

  async cancelDownload(uuid: string) {
    await this._browser._browserSession.send('Playwright.cancelDownload', { uuid });
  }

  _validateEmulatedViewport(viewportSize?: types.Size | null) {
    if (!viewportSize)
      return;
    if (process.platform === 'win32' && this._browser.options.headful && (viewportSize.width < 250 || viewportSize.height < 240))
      throw new Error(`WebKit on Windows has a minimal viewport of 250x240.`);
  }
}
