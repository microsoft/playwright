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

import path from 'path';

import { assert } from '../../utils/isomorphic/assert';
import { createGuid } from '../utils/crypto';
import { Artifact } from '../artifact';
import { Browser } from '../browser';
import { BrowserContext, verifyGeolocation } from '../browserContext';
import { Frame } from '../frames';
import * as network from '../network';
import { Page } from '../page';
import { CRConnection, ConnectionEvents } from './crConnection';
import { CRPage } from './crPage';
import { saveProtocolStream } from './crProtocolHelper';
import { CRServiceWorker } from './crServiceWorker';

import type { InitScript, Worker } from '../page';
import type { ConnectionTransport } from '../transport';
import type * as types from '../types';
import type { CDPSession, CRSession } from './crConnection';
import type { CRDevTools } from './crDevTools';
import type { Protocol } from './protocol';
import type { BrowserOptions } from '../browser';
import type { SdkObject } from '../instrumentation';
import type * as channels from '@protocol/channels';

export class CRBrowser extends Browser {
  readonly _connection: CRConnection;
  _session: CRSession;
  private _clientRootSessionPromise: Promise<CDPSession> | null = null;
  readonly _contexts = new Map<string, CRBrowserContext>();
  _crPages = new Map<string, CRPage>();
  _backgroundPages = new Map<string, CRPage>();
  _serviceWorkers = new Map<string, CRServiceWorker>();
  _devtools?: CRDevTools;
  private _version = '';

  private _tracingRecording = false;
  private _tracingClient: CRSession | undefined;
  private _userAgent: string = '';

  static async connect(parent: SdkObject, transport: ConnectionTransport, options: BrowserOptions, devtools?: CRDevTools): Promise<CRBrowser> {
    // Make a copy in case we need to update `headful` property below.
    options = { ...options };
    const connection = new CRConnection(parent, transport, options.protocolLogger, options.browserLogsCollector);
    const browser = new CRBrowser(parent, connection, options);
    browser._devtools = devtools;
    if (browser.isClank())
      browser._isCollocatedWithServer = false;
    const session = connection.rootSession;
    if ((options as any).__testHookOnConnectToBrowser)
      await (options as any).__testHookOnConnectToBrowser();

    const version = await session.send('Browser.getVersion');
    browser._version = version.product.substring(version.product.indexOf('/') + 1);
    browser._userAgent = version.userAgent;
    // We don't trust the option as it may lie in case of connectOverCDP where remote browser
    // may have been launched with different options.
    browser.options.headful = !version.userAgent.includes('Headless');
    if (!options.persistent) {
      await session.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
      return browser;
    }
    browser._defaultContext = new CRBrowserContext(browser, undefined, options.persistent);
    await Promise.all([
      session.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }).then(async () => {
        // Target.setAutoAttach has a bug where it does not wait for new Targets being attached.
        // However making a dummy call afterwards fixes this.
        // This can be removed after https://chromium-review.googlesource.com/c/chromium/src/+/2885888 lands in stable.
        await session.send('Target.getTargetInfo');
      }),
      (browser._defaultContext as CRBrowserContext)._initialize(),
    ]);
    await browser._waitForAllPagesToBeInitialized();
    return browser;
  }

  constructor(parent: SdkObject, connection: CRConnection, options: BrowserOptions) {
    super(parent, options);
    this._connection = connection;
    this._session = this._connection.rootSession;
    this._connection.on(ConnectionEvents.Disconnected, () => this._didDisconnect());
    this._session.on('Target.attachedToTarget', this._onAttachedToTarget.bind(this));
    this._session.on('Target.detachedFromTarget', this._onDetachedFromTarget.bind(this));
    this._session.on('Browser.downloadWillBegin', this._onDownloadWillBegin.bind(this));
    this._session.on('Browser.downloadProgress', this._onDownloadProgress.bind(this));
  }

  async doCreateNewContext(options: types.BrowserContextOptions): Promise<BrowserContext> {
    const proxy = options.proxyOverride || options.proxy;
    let proxyBypassList = undefined;
    if (proxy) {
      if (process.env.PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK)
        proxyBypassList = proxy.bypass;
      else
        proxyBypassList = '<-loopback>' + (proxy.bypass ? `,${proxy.bypass}` : '');
    }

    const { browserContextId } = await this._session.send('Target.createBrowserContext', {
      disposeOnDetach: true,
      proxyServer: proxy ? proxy.server : undefined,
      proxyBypassList,
    });
    const context = new CRBrowserContext(this, browserContextId, options);
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

  userAgent(): string {
    return this._userAgent;
  }

  _platform(): 'mac' | 'linux' | 'win' {
    if (this._userAgent.includes('Windows'))
      return 'win';
    if (this._userAgent.includes('Macintosh'))
      return 'mac';
    return 'linux';
  }

  isClank(): boolean {
    return this.options.name === 'clank';
  }

  async _waitForAllPagesToBeInitialized() {
    await Promise.all([...this._crPages.values()].map(crPage => crPage._page.waitForInitializedOrError()));
  }

  _onAttachedToTarget({ targetInfo, sessionId, waitingForDebugger }: Protocol.Target.attachedToTargetPayload) {
    if (targetInfo.type === 'browser')
      return;
    const session = this._session.createChildSession(sessionId);
    assert(targetInfo.browserContextId, 'targetInfo: ' + JSON.stringify(targetInfo, null, 2));
    let context = this._contexts.get(targetInfo.browserContextId) || null;
    if (!context) {
      // TODO: auto attach only to pages from our contexts.
      // assert(this._defaultContext);
      context = this._defaultContext as CRBrowserContext;
    }

    if (targetInfo.type === 'other' && targetInfo.url.startsWith('devtools://devtools') && this._devtools) {
      this._devtools.install(session);
      return;
    }

    const treatOtherAsPage = targetInfo.type === 'other' && process.env.PW_CHROMIUM_ATTACH_TO_OTHER;

    if (!context || (targetInfo.type === 'other' && !treatOtherAsPage)) {
      session.detach().catch(() => {});
      return;
    }

    assert(!this._crPages.has(targetInfo.targetId), 'Duplicate target ' + targetInfo.targetId);
    assert(!this._backgroundPages.has(targetInfo.targetId), 'Duplicate target ' + targetInfo.targetId);
    assert(!this._serviceWorkers.has(targetInfo.targetId), 'Duplicate target ' + targetInfo.targetId);

    if (targetInfo.type === 'background_page') {
      const backgroundPage = new CRPage(session, targetInfo.targetId, context, null, { hasUIWindow: false, isBackgroundPage: true });
      this._backgroundPages.set(targetInfo.targetId, backgroundPage);
      return;
    }

    if (targetInfo.type === 'page' || treatOtherAsPage) {
      const opener = targetInfo.openerId ? this._crPages.get(targetInfo.openerId) || null : null;
      const crPage = new CRPage(session, targetInfo.targetId, context, opener, { hasUIWindow: targetInfo.type === 'page', isBackgroundPage: false });
      this._crPages.set(targetInfo.targetId, crPage);
      return;
    }

    if (targetInfo.type === 'service_worker') {
      const serviceWorker = new CRServiceWorker(context, session, targetInfo.url);
      this._serviceWorkers.set(targetInfo.targetId, serviceWorker);
      context.emit(CRBrowserContext.CREvents.ServiceWorker, serviceWorker);
      return;
    }

    // Detach from any targets we are not interested in, to avoid side-effects.
    //
    // One example of a side effect: upon shared worker restart, we receive
    // Inspector.targetReloadedAfterCrash and backend waits for Runtime.runIfWaitingForDebugger
    // from any attached client. If we do not resume, shared worker will stall.
    session.detach().catch(() => {});
  }

  _onDetachedFromTarget(payload: Protocol.Target.detachedFromTargetPayload) {
    const targetId = payload.targetId!;
    const crPage = this._crPages.get(targetId);
    if (crPage) {
      this._crPages.delete(targetId);
      crPage.didClose();
      return;
    }
    const backgroundPage = this._backgroundPages.get(targetId);
    if (backgroundPage) {
      this._backgroundPages.delete(targetId);
      backgroundPage.didClose();
      return;
    }
    const serviceWorker = this._serviceWorkers.get(targetId);
    if (serviceWorker) {
      this._serviceWorkers.delete(targetId);
      serviceWorker.didClose();
      return;
    }
  }

  private _didDisconnect() {
    for (const crPage of this._crPages.values())
      crPage.didClose();
    this._crPages.clear();
    for (const backgroundPage of this._backgroundPages.values())
      backgroundPage.didClose();
    this._backgroundPages.clear();
    for (const serviceWorker of this._serviceWorkers.values())
      serviceWorker.didClose();
    this._serviceWorkers.clear();
    this._didClose();
  }

  private _findOwningPage(frameId: string) {
    for (const crPage of this._crPages.values()) {
      const frame = crPage._page.frameManager.frame(frameId);
      if (frame)
        return crPage;
    }
    return null;
  }

  _onDownloadWillBegin(payload: Protocol.Browser.downloadWillBeginPayload) {
    const page = this._findOwningPage(payload.frameId);
    if (!page) {
      // There might be no page when download originates from something unusual, like
      // a DevTools window or maybe an extension page.
      // See https://github.com/microsoft/playwright/issues/22551.
      return;
    }
    page.willBeginDownload();

    let originPage = page._page.initializedOrUndefined();
    // If it's a new window download, report it on the opener page.
    if (!originPage && page._opener)
      originPage = page._opener._page.initializedOrUndefined();
    if (!originPage)
      return;
    this._downloadCreated(originPage, payload.guid, payload.url, payload.suggestedFilename);
  }

  _onDownloadProgress(payload: any) {
    if (payload.state === 'completed')
      this._downloadFinished(payload.guid, '');
    if (payload.state === 'canceled')
      this._downloadFinished(payload.guid, this._closeReason || 'canceled');
  }

  async _closePage(crPage: CRPage) {
    await this._session.send('Target.closeTarget', { targetId: crPage._targetId });
  }

  async newBrowserCDPSession(): Promise<CDPSession> {
    return await this._connection.createBrowserSession();
  }

  async startTracing(page?: Page, options: { screenshots?: boolean; categories?: string[]; } = {}) {
    assert(!this._tracingRecording, 'Cannot start recording trace while already recording trace.');
    this._tracingClient = page ? (page.delegate as CRPage)._mainFrameSession._client : this._session;

    const defaultCategories = [
      '-*', 'devtools.timeline', 'v8.execute', 'disabled-by-default-devtools.timeline',
      'disabled-by-default-devtools.timeline.frame', 'toplevel',
      'blink.console', 'blink.user_timing', 'latencyInfo', 'disabled-by-default-devtools.timeline.stack',
      'disabled-by-default-v8.cpu_profiler', 'disabled-by-default-v8.cpu_profiler.hires'
    ];
    const {
      screenshots = false,
      categories = defaultCategories,
    } = options;

    if (screenshots)
      categories.push('disabled-by-default-devtools.screenshot');

    this._tracingRecording = true;
    await this._tracingClient.send('Tracing.start', {
      transferMode: 'ReturnAsStream',
      categories: categories.join(',')
    });
  }

  async stopTracing(): Promise<Artifact> {
    assert(this._tracingClient, 'Tracing was not started.');
    const [event] = await Promise.all([
      new Promise(f => this._tracingClient!.once('Tracing.tracingComplete', f)),
      this._tracingClient.send('Tracing.end')
    ]);
    const tracingPath = path.join(this.options.artifactsDir, createGuid() + '.crtrace');
    await saveProtocolStream(this._tracingClient, (event as any).stream!, tracingPath);
    this._tracingRecording = false;
    const artifact = new Artifact(this, tracingPath);
    artifact.reportFinished();
    return artifact;
  }

  isConnected(): boolean {
    return !this._connection._closed;
  }

  async _clientRootSession(): Promise<CDPSession> {
    if (!this._clientRootSessionPromise)
      this._clientRootSessionPromise = this._connection.createBrowserSession();
    return this._clientRootSessionPromise;
  }
}

export class CRBrowserContext extends BrowserContext {
  static CREvents = {
    BackgroundPage: 'backgroundpage',
    ServiceWorker: 'serviceworker',
  };

  declare readonly _browser: CRBrowser;

  constructor(browser: CRBrowser, browserContextId: string | undefined, options: types.BrowserContextOptions) {
    super(browser, options, browserContextId);
    this._authenticateProxyViaCredentials();
  }

  override async _initialize() {
    assert(!Array.from(this._browser._crPages.values()).some(page => page._browserContext === this));
    const promises: Promise<any>[] = [super._initialize()];
    if (this._browser.options.name !== 'clank' && this._options.acceptDownloads !== 'internal-browser-default') {
      promises.push(this._browser._session.send('Browser.setDownloadBehavior', {
        behavior: this._options.acceptDownloads === 'accept' ? 'allowAndName' : 'deny',
        browserContextId: this._browserContextId,
        downloadPath: this._browser.options.downloadsPath,
        eventsEnabled: true,
      }));
    }
    await Promise.all(promises);
  }

  private _crPages() {
    return [...this._browser._crPages.values()].filter(crPage => crPage._browserContext === this);
  }

  override possiblyUninitializedPages(): Page[] {
    return this._crPages().map(crPage => crPage._page);
  }

  override async doCreateNewPage(markAsServerSideOnly?: boolean): Promise<Page> {
    const { targetId } = await this._browser._session.send('Target.createTarget', { url: 'about:blank', browserContextId: this._browserContextId });
    const page = this._browser._crPages.get(targetId)!._page;
    if (markAsServerSideOnly)
      page.markAsServerSideOnly();
    return page;
  }

  async doGetCookies(urls: string[]): Promise<channels.NetworkCookie[]> {
    const { cookies } = await this._browser._session.send('Storage.getCookies', { browserContextId: this._browserContextId });
    return network.filterCookies(cookies.map(c => {
      const { name, value, domain, path, expires, httpOnly, secure, sameSite } = c;
      const copy: channels.NetworkCookie = {
        name,
        value,
        domain,
        path,
        expires,
        httpOnly,
        secure,
        sameSite: sameSite ?? 'Lax',
      };
      // If hasCrossSiteAncestor is false, the cookie is a partitioned first party cookie,
      // this is Chromium specific, see https://chromestatus.com/feature/5144832583663616
      // and https://github.com/explainers-by-googlers/CHIPS-spec.
      if (c.partitionKey) {
        copy._crHasCrossSiteAncestor = c.partitionKey.hasCrossSiteAncestor;
        copy.partitionKey = c.partitionKey.topLevelSite;
      }
      return copy;
    }), urls);
  }

  async addCookies(cookies: channels.SetNetworkCookie[]) {
    function toChromiumCookie(cookie: channels.SetNetworkCookie) {
      const { name, value, url, domain, path, expires, httpOnly, secure, sameSite, partitionKey, _crHasCrossSiteAncestor } = cookie;
      const copy: Protocol.Network.CookieParam = {
        name,
        value,
        url,
        domain,
        path,
        expires,
        httpOnly,
        secure,
        sameSite
      };
      if (partitionKey) {
        copy.partitionKey = {
          topLevelSite: partitionKey,
          // _crHasCrossSiteAncestor is non-standard, set it true by default if the cookie is partitioned.
          hasCrossSiteAncestor: _crHasCrossSiteAncestor ?? true,
        };
      }
      return copy;
    }

    await this._browser._session.send('Storage.setCookies', {
      cookies: network.rewriteCookies(cookies).map(toChromiumCookie),
      browserContextId: this._browserContextId
    });
  }

  async doClearCookies() {
    await this._browser._session.send('Storage.clearCookies', { browserContextId: this._browserContextId });
  }

  async doGrantPermissions(origin: string, permissions: string[]) {
    const webPermissionToProtocol = new Map<string, Protocol.Browser.PermissionType>([
      ['geolocation', 'geolocation'],
      ['midi', 'midi'],
      ['notifications', 'notifications'],
      ['camera', 'videoCapture'],
      ['microphone', 'audioCapture'],
      ['background-sync', 'backgroundSync'],
      ['ambient-light-sensor', 'sensors'],
      ['accelerometer', 'sensors'],
      ['gyroscope', 'sensors'],
      ['magnetometer', 'sensors'],
      ['clipboard-read', 'clipboardReadWrite'],
      ['clipboard-write', 'clipboardSanitizedWrite'],
      ['payment-handler', 'paymentHandler'],
      // chrome-specific permissions we have.
      ['midi-sysex', 'midiSysex'],
      ['storage-access', 'storageAccess'],
      ['local-fonts', 'localFonts'],
    ]);
    const filtered = permissions.map(permission => {
      const protocolPermission = webPermissionToProtocol.get(permission);
      if (!protocolPermission)
        throw new Error('Unknown permission: ' + permission);
      return protocolPermission;
    });
    await this._browser._session.send('Browser.grantPermissions', { origin: origin === '*' ? undefined : origin, browserContextId: this._browserContextId, permissions: filtered });
  }

  async doClearPermissions() {
    await this._browser._session.send('Browser.resetPermissions', { browserContextId: this._browserContextId });
  }

  async setGeolocation(geolocation?: types.Geolocation): Promise<void> {
    verifyGeolocation(geolocation);
    this._options.geolocation = geolocation;
    for (const page of this.pages())
      await (page.delegate as CRPage).updateGeolocation();
  }

  async doUpdateExtraHTTPHeaders(): Promise<void> {
    for (const page of this.pages())
      await (page.delegate as CRPage).updateExtraHTTPHeaders();
    for (const sw of this.serviceWorkers())
      await (sw as CRServiceWorker).updateExtraHTTPHeaders();
  }

  async setUserAgent(userAgent: string | undefined): Promise<void> {
    this._options.userAgent = userAgent;
    for (const page of this.pages())
      await (page.delegate as CRPage).updateUserAgent();
    // TODO: service workers don't have Emulation domain?
  }

  async doUpdateOffline(): Promise<void> {
    for (const page of this.pages())
      await (page.delegate as CRPage).updateOffline();
    for (const sw of this.serviceWorkers())
      await (sw as CRServiceWorker).updateOffline();
  }

  async doSetHTTPCredentials(httpCredentials?: types.Credentials): Promise<void> {
    this._options.httpCredentials = httpCredentials;
    for (const page of this.pages())
      await (page.delegate as CRPage).updateHttpCredentials();
    for (const sw of this.serviceWorkers())
      await (sw as CRServiceWorker).updateHttpCredentials();
  }

  async doAddInitScript(initScript: InitScript) {
    for (const page of this.pages())
      await (page.delegate as CRPage).addInitScript(initScript);
  }

  async doRemoveInitScripts(initScripts: InitScript[]) {
    for (const page of this.pages())
      await (page.delegate as CRPage).removeInitScripts(initScripts);
  }

  async doUpdateRequestInterception(): Promise<void> {
    for (const page of this.pages())
      await (page.delegate as CRPage).updateRequestInterception();
    for (const sw of this.serviceWorkers())
      await (sw as CRServiceWorker).updateRequestInterception();
  }

  override async doUpdateDefaultViewport() {
    // No-op, because each page resets its own viewport.
  }

  override async doUpdateDefaultEmulatedMedia() {
    // No-op, because each page resets its own color scheme.
  }

  override async doExposePlaywrightBinding() {
    for (const page of this._crPages())
      await page.exposePlaywrightBinding();
  }

  async doClose(reason: string | undefined) {
    // Headful chrome cannot dispose browser context with opened 'beforeunload'
    // dialogs, so we should close all that are currently opened.
    // We also won't get new ones since `Target.disposeBrowserContext` does not trigger
    // beforeunload.
    await this.dialogManager.closeBeforeUnloadDialogs();

    if (!this._browserContextId) {
      await this.stopVideoRecording();
      // Closing persistent context should close the browser.
      await this._browser.close({ reason });
      return;
    }

    await this._browser._session.send('Target.disposeBrowserContext', { browserContextId: this._browserContextId });
    this._browser._contexts.delete(this._browserContextId);
    for (const [targetId, serviceWorker] of this._browser._serviceWorkers) {
      if (serviceWorker.browserContext !== this)
        continue;
      // When closing a browser context, service workers are shutdown
      // asynchronously and we get detached from them later.
      // To avoid the wrong order of notifications, we manually fire
      // "close" event here and forget about the service worker.
      serviceWorker.didClose();
      this._browser._serviceWorkers.delete(targetId);
    }
  }

  async stopVideoRecording() {
    await Promise.all(this._crPages().map(crPage => crPage._mainFrameSession._stopVideoRecording()));
  }

  onClosePersistent() {
    // When persistent context is closed, we do not necessary get Target.detachedFromTarget
    // for all the background pages.
    for (const [targetId, backgroundPage] of this._browser._backgroundPages.entries()) {
      if (backgroundPage._browserContext === this && backgroundPage._page.initializedOrUndefined()) {
        backgroundPage.didClose();
        this._browser._backgroundPages.delete(targetId);
      }
    }
  }

  override async clearCache(): Promise<void> {
    for (const page of this._crPages())
      await page._networkManager.clearCache();
  }

  async cancelDownload(guid: string) {
    // The upstream CDP method is implemented in a way that no explicit error would be given
    // regarding the requested `guid`, even if the download is in a state not suitable for
    // cancellation (finished, cancelled, etc.) or the guid is invalid at all.
    await this._browser._session.send('Browser.cancelDownload', {
      guid: guid,
      browserContextId: this._browserContextId,
    });
  }

  backgroundPages(): Page[] {
    const result: Page[] = [];
    for (const backgroundPage of this._browser._backgroundPages.values()) {
      if (backgroundPage._browserContext === this && backgroundPage._page.initializedOrUndefined())
        result.push(backgroundPage._page);
    }
    return result;
  }

  serviceWorkers(): Worker[] {
    return Array.from(this._browser._serviceWorkers.values()).filter(serviceWorker => serviceWorker.browserContext === this);
  }

  async newCDPSession(page: Page | Frame): Promise<CDPSession> {
    let targetId: string | null = null;
    if (page instanceof Page) {
      targetId = (page.delegate as CRPage)._targetId;
    } else if (page instanceof Frame) {
      const session = (page._page.delegate as CRPage)._sessions.get(page._id);
      if (!session)
        throw new Error(`This frame does not have a separate CDP session, it is a part of the parent frame's session`);
      targetId = session._targetId;
    } else {
      throw new Error('page: expected Page or Frame');
    }

    const rootSession = await this._browser._clientRootSession();
    return rootSession.attachToTarget(targetId);
  }
}
