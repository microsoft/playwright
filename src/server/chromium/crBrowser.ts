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

import { Browser, BrowserOptions } from '../browser';
import { assertBrowserContextIsNotOwned, BrowserContext, validateBrowserContextOptions, verifyGeolocation } from '../browserContext';
import { assert } from '../../utils/utils';
import * as network from '../network';
import { Page, PageBinding, Worker } from '../page';
import { ConnectionTransport } from '../transport';
import * as types from '../types';
import { ConnectionEvents, CRConnection, CRSession } from './crConnection';
import { CRPage } from './crPage';
import { readProtocolStream } from './crProtocolHelper';
import { Protocol } from './protocol';
import { CRExecutionContext } from './crExecutionContext';
import { CRDevTools } from './crDevTools';

export class CRBrowser extends Browser {
  readonly _connection: CRConnection;
  _session: CRSession;
  private _clientRootSessionPromise: Promise<CRSession> | null = null;
  readonly _contexts = new Map<string, CRBrowserContext>();
  _crPages = new Map<string, CRPage>();
  _backgroundPages = new Map<string, CRPage>();
  _serviceWorkers = new Map<string, CRServiceWorker>();
  _devtools?: CRDevTools;
  _isMac = false;
  private _version = '';

  private _tracingRecording = false;
  private _tracingPath: string | null = '';
  private _tracingClient: CRSession | undefined;

  static async connect(transport: ConnectionTransport, options: BrowserOptions, devtools?: CRDevTools): Promise<CRBrowser> {
    const connection = new CRConnection(transport);
    const browser = new CRBrowser(connection, options);
    browser._devtools = devtools;
    const session = connection.rootSession;
    const version = await session.send('Browser.getVersion');
    browser._isMac = version.userAgent.includes('Macintosh');
    browser._version = version.product.substring(version.product.indexOf('/') + 1);
    if (!options.persistent) {
      await session.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
      return browser;
    }
    browser._defaultContext = new CRBrowserContext(browser, undefined, options.persistent);

    const existingTargetAttachPromises: Promise<any>[] = [];
    // First page, background pages and their service workers in the persistent context
    // are created automatically and may be initialized before we enable auto-attach.
    function attachToExistingPage({targetInfo}: Protocol.Target.targetCreatedPayload) {
      if (targetInfo.type !== 'page' && targetInfo.type !== 'background_page' && targetInfo.type !== 'service_worker')
        return;
      // TODO: should we handle the error during 'Target.attachToTarget'? Can the target disappear?
      existingTargetAttachPromises.push(session.send('Target.attachToTarget', {targetId: targetInfo.targetId, flatten: true}));
    }
    session.on('Target.targetCreated', attachToExistingPage);

    const startDiscover = session.send('Target.setDiscoverTargets', { discover: true });
    const autoAttachAndStopDiscover = session.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }).then(() => {
      // All targets collected before setAutoAttach response will not be auto-attached, the rest will be.
      // TODO: We should fix this upstream and remove this tricky logic.
      session.off('Target.targetCreated', attachToExistingPage);
      return session.send('Target.setDiscoverTargets', { discover: false });
    });
    await Promise.all([
      startDiscover,
      autoAttachAndStopDiscover,
      (browser._defaultContext as CRBrowserContext)._initialize(),
    ]);

    // Wait for initial targets to arrive.
    await Promise.all(existingTargetAttachPromises);
    return browser;
  }

  constructor(connection: CRConnection, options: BrowserOptions) {
    super(options);
    this._connection = connection;
    this._session = this._connection.rootSession;
    this._connection.on(ConnectionEvents.Disconnected, () => this._didClose());
    this._session.on('Target.attachedToTarget', this._onAttachedToTarget.bind(this));
    this._session.on('Target.detachedFromTarget', this._onDetachedFromTarget.bind(this));
  }

  async newContext(options: types.BrowserContextOptions = {}): Promise<BrowserContext> {
    validateBrowserContextOptions(options, this._options);
    const { browserContextId } = await this._session.send('Target.createBrowserContext', { disposeOnDetach: true });
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

  _onAttachedToTarget({targetInfo, sessionId, waitingForDebugger}: Protocol.Target.attachedToTargetPayload) {
    if (targetInfo.type === 'browser')
      return;
    const session = this._connection.session(sessionId)!;
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

    if (targetInfo.type === 'other' || !context) {
      if (waitingForDebugger) {
        // Ideally, detaching should resume any target, but there is a bug in the backend.
        session._sendMayFail('Runtime.runIfWaitingForDebugger').then(() => {
          this._session._sendMayFail('Target.detachFromTarget', { sessionId });
        });
      }
      return;
    }

    assert(!this._crPages.has(targetInfo.targetId), 'Duplicate target ' + targetInfo.targetId);
    assert(!this._backgroundPages.has(targetInfo.targetId), 'Duplicate target ' + targetInfo.targetId);
    assert(!this._serviceWorkers.has(targetInfo.targetId), 'Duplicate target ' + targetInfo.targetId);

    if (targetInfo.type === 'background_page') {
      const backgroundPage = new CRPage(session, targetInfo.targetId, context, null, false);
      this._backgroundPages.set(targetInfo.targetId, backgroundPage);
      backgroundPage.pageOrError().then(() => {
        context!.emit(CRBrowserContext.CREvents.BackgroundPage, backgroundPage._page);
      });
      return;
    }

    if (targetInfo.type === 'page') {
      const opener = targetInfo.openerId ? this._crPages.get(targetInfo.openerId) || null : null;
      const crPage = new CRPage(session, targetInfo.targetId, context, opener, true);
      this._crPages.set(targetInfo.targetId, crPage);
      crPage.pageOrError().then(pageOrError => {
        const page = crPage._page;
        if (pageOrError instanceof Error)
          page._setIsError();
        context!.emit(BrowserContext.Events.Page, page);
        if (opener) {
          opener.pageOrError().then(openerPage => {
            if (openerPage instanceof Page && !openerPage.isClosed())
              openerPage.emit(Page.Events.Popup, page);
          });
        }
      });
      return;
    }

    if (targetInfo.type === 'service_worker') {
      const serviceWorker = new CRServiceWorker(context, session, targetInfo.url);
      this._serviceWorkers.set(targetInfo.targetId, serviceWorker);
      context.emit(CRBrowserContext.CREvents.ServiceWorker, serviceWorker);
      return;
    }

    assert(false, 'Unknown target type: ' + targetInfo.type);
  }

  _onDetachedFromTarget(payload: Protocol.Target.detachFromTargetParameters) {
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
      serviceWorker.emit(Worker.Events.Close);
      return;
    }
  }

  async _closePage(crPage: CRPage) {
    await this._session.send('Target.closeTarget', { targetId: crPage._targetId });
  }

  async newBrowserCDPSession(): Promise<CRSession> {
    return await this._connection.createBrowserSession();
  }

  async startTracing(page?: Page, options: { path?: string; screenshots?: boolean; categories?: string[]; } = {}) {
    assert(!this._tracingRecording, 'Cannot start recording trace while already recording trace.');
    this._tracingClient = page ? (page._delegate as CRPage)._mainFrameSession._client : this._session;

    const defaultCategories = [
      '-*', 'devtools.timeline', 'v8.execute', 'disabled-by-default-devtools.timeline',
      'disabled-by-default-devtools.timeline.frame', 'toplevel',
      'blink.console', 'blink.user_timing', 'latencyInfo', 'disabled-by-default-devtools.timeline.stack',
      'disabled-by-default-v8.cpu_profiler', 'disabled-by-default-v8.cpu_profiler.hires'
    ];
    const {
      path = null,
      screenshots = false,
      categories = defaultCategories,
    } = options;

    if (screenshots)
      categories.push('disabled-by-default-devtools.screenshot');

    this._tracingPath = path;
    this._tracingRecording = true;
    await this._tracingClient.send('Tracing.start', {
      transferMode: 'ReturnAsStream',
      categories: categories.join(',')
    });
  }

  async stopTracing(): Promise<Buffer> {
    assert(this._tracingClient, 'Tracing was not started.');
    const [event] = await Promise.all([
      new Promise(f => this._tracingClient!.once('Tracing.tracingComplete', f)),
      this._tracingClient.send('Tracing.end')
    ]);
    const result = await readProtocolStream(this._tracingClient, (event as any).stream!, this._tracingPath);
    this._tracingRecording = false;
    return result;
  }

  isConnected(): boolean {
    return !this._connection._closed;
  }

  async _clientRootSession(): Promise<CRSession> {
    if (!this._clientRootSessionPromise)
      this._clientRootSessionPromise = this._connection.createBrowserSession();
    return this._clientRootSessionPromise;
  }
}

class CRServiceWorker extends Worker {
  readonly _browserContext: CRBrowserContext;

  constructor(browserContext: CRBrowserContext, session: CRSession, url: string) {
    super(url);
    this._browserContext = browserContext;
    session.once('Runtime.executionContextCreated', event => {
      this._createExecutionContext(new CRExecutionContext(session, event.context));
    });
    // This might fail if the target is closed before we receive all execution contexts.
    session.send('Runtime.enable', {}).catch(e => {});
    session.send('Runtime.runIfWaitingForDebugger').catch(e => {});
  }
}

export class CRBrowserContext extends BrowserContext {
  static CREvents = {
    BackgroundPage: 'backgroundpage',
    ServiceWorker: 'serviceworker',
  };

  readonly _browser: CRBrowser;
  readonly _evaluateOnNewDocumentSources: string[];

  constructor(browser: CRBrowser, browserContextId: string | undefined, options: types.BrowserContextOptions) {
    super(browser, options, browserContextId);
    this._browser = browser;
    this._evaluateOnNewDocumentSources = [];
    this._authenticateProxyViaCredentials();
  }

  async _initialize() {
    assert(!Array.from(this._browser._crPages.values()).some(page => page._browserContext === this));
    const promises: Promise<any>[] = [ super._initialize() ];
    if (this._browser._options.downloadsPath) {
      promises.push(this._browser._session.send('Browser.setDownloadBehavior', {
        behavior: this._options.acceptDownloads ? 'allowAndName' : 'deny',
        browserContextId: this._browserContextId,
        downloadPath: this._browser._options.downloadsPath
      }));
    }
    if (this._options.permissions)
      promises.push(this.grantPermissions(this._options.permissions));
    await Promise.all(promises);
  }

  pages(): Page[] {
    const result: Page[] = [];
    for (const crPage of this._browser._crPages.values()) {
      if (crPage._browserContext === this && crPage._initializedPage)
        result.push(crPage._initializedPage);
    }
    return result;
  }

  async newPage(): Promise<Page> {
    assertBrowserContextIsNotOwned(this);
    const { targetId } = await this._browser._session.send('Target.createTarget', { url: 'about:blank', browserContextId: this._browserContextId });
    const crPage = this._browser._crPages.get(targetId)!;
    const result = await crPage.pageOrError();
    if (result instanceof Page) {
      if (result.isClosed())
        throw new Error('Page has been closed.');
      return result;
    }
    throw result;
  }

  async _doCookies(urls: string[]): Promise<types.NetworkCookie[]> {
    const { cookies } = await this._browser._session.send('Storage.getCookies', { browserContextId: this._browserContextId });
    return network.filterCookies(cookies.map(c => {
      const copy: any = { sameSite: 'None', ...c };
      delete copy.size;
      delete copy.priority;
      delete copy.session;
      return copy as types.NetworkCookie;
    }), urls);
  }

  async addCookies(cookies: types.SetNetworkCookieParam[]) {
    await this._browser._session.send('Storage.setCookies', { cookies: network.rewriteCookies(cookies), browserContextId: this._browserContextId });
  }

  async clearCookies() {
    await this._browser._session.send('Storage.clearCookies', { browserContextId: this._browserContextId });
  }

  async _doGrantPermissions(origin: string, permissions: string[]) {
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
      ['accessibility-events', 'accessibilityEvents'],
      ['clipboard-read', 'clipboardReadWrite'],
      ['clipboard-write', 'clipboardSanitizedWrite'],
      ['payment-handler', 'paymentHandler'],
      // chrome-specific permissions we have.
      ['midi-sysex', 'midiSysex'],
    ]);
    const filtered = permissions.map(permission => {
      const protocolPermission = webPermissionToProtocol.get(permission);
      if (!protocolPermission)
        throw new Error('Unknown permission: ' + permission);
      return protocolPermission;
    });
    await this._browser._session.send('Browser.grantPermissions', { origin: origin === '*' ? undefined : origin, browserContextId: this._browserContextId, permissions: filtered });
  }

  async _doClearPermissions() {
    await this._browser._session.send('Browser.resetPermissions', { browserContextId: this._browserContextId });
  }

  async setGeolocation(geolocation?: types.Geolocation): Promise<void> {
    verifyGeolocation(geolocation);
    this._options.geolocation = geolocation;
    for (const page of this.pages())
      await (page._delegate as CRPage).updateGeolocation();
  }

  async setExtraHTTPHeaders(headers: types.HeadersArray): Promise<void> {
    this._options.extraHTTPHeaders = headers;
    for (const page of this.pages())
      await (page._delegate as CRPage).updateExtraHTTPHeaders();
  }

  async setOffline(offline: boolean): Promise<void> {
    this._options.offline = offline;
    for (const page of this.pages())
      await (page._delegate as CRPage).updateOffline();
  }

  async _doSetHTTPCredentials(httpCredentials?: types.Credentials): Promise<void> {
    this._options.httpCredentials = httpCredentials;
    for (const page of this.pages())
      await (page._delegate as CRPage).updateHttpCredentials();
  }

  async _doAddInitScript(source: string) {
    this._evaluateOnNewDocumentSources.push(source);
    for (const page of this.pages())
      await (page._delegate as CRPage).evaluateOnNewDocument(source);
  }

  async _doExposeBinding(binding: PageBinding) {
    for (const page of this.pages())
      await (page._delegate as CRPage).exposeBinding(binding);
  }

  async _doUpdateRequestInterception(): Promise<void> {
    for (const page of this.pages())
      await (page._delegate as CRPage).updateRequestInterception();
  }

  async _doClose() {
    assert(this._browserContextId);
    await this._browser._session.send('Target.disposeBrowserContext', { browserContextId: this._browserContextId });
    this._browser._contexts.delete(this._browserContextId);
    for (const [targetId, serviceWorker] of this._browser._serviceWorkers) {
      if (serviceWorker._browserContext !== this)
        continue;
      // When closing a browser context, service workers are shutdown
      // asynchronously and we get detached from them later.
      // To avoid the wrong order of notifications, we manually fire
      // "close" event here and forget about the serivce worker.
      serviceWorker.emit(Worker.Events.Close);
      this._browser._serviceWorkers.delete(targetId);
    }
  }

  backgroundPages(): Page[] {
    const result: Page[] = [];
    for (const backgroundPage of this._browser._backgroundPages.values()) {
      if (backgroundPage._browserContext === this && backgroundPage._initializedPage)
        result.push(backgroundPage._initializedPage);
    }
    return result;
  }

  serviceWorkers(): Worker[] {
    return Array.from(this._browser._serviceWorkers.values()).filter(serviceWorker => serviceWorker._browserContext === this);
  }

  async newCDPSession(page: Page): Promise<CRSession> {
    if (!(page instanceof Page))
      throw new Error('page: expected Page');
    const targetId = (page._delegate as CRPage)._targetId;
    const rootSession = await this._browser._clientRootSession();
    const { sessionId } = await rootSession.send('Target.attachToTarget', { targetId, flatten: true });
    return this._browser._connection.session(sessionId)!;
  }
}
