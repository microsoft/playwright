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
import { Events as CommonEvents } from '../events';
import { assert, debugError, helper } from '../helper';
import * as network from '../network';
import { Page, PageBinding, Worker } from '../page';
import { ConnectionTransport, SlowMoTransport } from '../transport';
import * as types from '../types';
import { ConnectionEvents, CRConnection, CRSession } from './crConnection';
import { CRPage } from './crPage';
import { readProtocolStream } from './crProtocolHelper';
import { Events } from './events';
import { Protocol } from './protocol';
import { CRExecutionContext } from './crExecutionContext';
import { BrowserServer } from '../server/browserServer';

export class CRBrowser extends BrowserBase {
  readonly _connection: CRConnection;
  _session: CRSession;
  private _clientRootSessionPromise: Promise<CRSession> | null = null;
  readonly _defaultContext: CRBrowserContext;
  readonly _contexts = new Map<string, CRBrowserContext>();
  _crPages = new Map<string, CRPage>();
  _backgroundPages = new Map<string, CRPage>();
  _serviceWorkers = new Map<string, CRServiceWorker>();
  readonly _firstPagePromise: Promise<void>;
  private _firstPageCallback = () => {};

  private _tracingRecording = false;
  private _tracingPath: string | null = '';
  private _tracingClient: CRSession | undefined;
  _ownedServer: BrowserServer | null = null;

  static async connect(transport: ConnectionTransport, isPersistent: boolean, slowMo?: number): Promise<CRBrowser> {
    const connection = new CRConnection(SlowMoTransport.wrap(transport, slowMo));
    const browser = new CRBrowser(connection);
    const session = connection.rootSession;
    const promises = [
      session.send('Target.setDiscoverTargets', { discover: true }),
      session.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }),
      session.send('Target.setDiscoverTargets', { discover: false }),
    ];
    const existingPageAttachPromises: Promise<any>[] = [];
    if (isPersistent) {
      // First page and background pages in the persistent context are created automatically
      // and may be initialized before we enable auto-attach.
      function attachToExistingPage({targetInfo}: Protocol.Target.targetCreatedPayload) {
        if (targetInfo.type !== 'page' && targetInfo.type !== 'background_page')
          return;
        existingPageAttachPromises.push(session.send('Target.attachToTarget', {targetId: targetInfo.targetId, flatten: true}));
      }
      session.on('Target.targetCreated', attachToExistingPage);
      Promise.all(promises).then(() => session.off('Target.targetCreated', attachToExistingPage)).catch(debugError);
    }
    await Promise.all(promises);
    await Promise.all(existingPageAttachPromises);
    return browser;
  }

  constructor(connection: CRConnection) {
    super();
    this._connection = connection;
    this._session = this._connection.rootSession;

    this._defaultContext = new CRBrowserContext(this, null, validateBrowserContextOptions({}));
    this._connection.on(ConnectionEvents.Disconnected, () => {
      for (const context of this._contexts.values())
        context._browserClosed();
      this.emit(CommonEvents.Browser.Disconnected);
    });
    this._session.on('Target.attachedToTarget', this._onAttachedToTarget.bind(this));
    this._session.on('Target.detachedFromTarget', this._onDetachedFromTarget.bind(this));
    this._firstPagePromise = new Promise(f => this._firstPageCallback = f);
  }

  async newContext(options: BrowserContextOptions = {}): Promise<BrowserContext> {
    options = validateBrowserContextOptions(options);
    const { browserContextId } = await this._session.send('Target.createBrowserContext', { disposeOnDetach: true });
    const context = new CRBrowserContext(this, browserContextId, options);
    await context._initialize();
    this._contexts.set(browserContextId, context);
    return context;
  }

  contexts(): BrowserContext[] {
    return Array.from(this._contexts.values());
  }

  _onAttachedToTarget({targetInfo, sessionId, waitingForDebugger}: Protocol.Target.attachedToTargetPayload) {
    const session = this._connection.session(sessionId)!;
    const context = (targetInfo.browserContextId && this._contexts.has(targetInfo.browserContextId)) ?
        this._contexts.get(targetInfo.browserContextId)! : this._defaultContext;

    assert(!this._crPages.has(targetInfo.targetId), 'Duplicate target ' + targetInfo.targetId);
    assert(!this._backgroundPages.has(targetInfo.targetId), 'Duplicate target ' + targetInfo.targetId);
    assert(!this._serviceWorkers.has(targetInfo.targetId), 'Duplicate target ' + targetInfo.targetId);

    if (targetInfo.type === 'background_page') {
      const backgroundPage = new CRPage(session, targetInfo.targetId, context, null);
      this._backgroundPages.set(targetInfo.targetId, backgroundPage);
      backgroundPage.pageOrError().then(() => {
        context.emit(Events.CRBrowserContext.BackgroundPage, backgroundPage._page);
      });
      return;
    }

    if (targetInfo.type === 'page') {
      const opener = targetInfo.openerId ? this._crPages.get(targetInfo.openerId) || null : null;
      const crPage = new CRPage(session, targetInfo.targetId, context, opener);
      this._crPages.set(targetInfo.targetId, crPage);
      crPage.pageOrError().then(() => {
        this._firstPageCallback();
        context.emit(CommonEvents.BrowserContext.Page, crPage._page);
        if (opener) {
          opener.pageOrError().then(openerPage => {
            if (openerPage instanceof Page && !openerPage.isClosed())
              openerPage.emit(CommonEvents.Page.Popup, crPage._page);
          });
        }
      });
      return;
    }

    if (targetInfo.type === 'service_worker') {
      const serviceWorker = new CRServiceWorker(context, session, targetInfo.url);
      this._serviceWorkers.set(targetInfo.targetId, serviceWorker);
      context.emit(Events.CRBrowserContext.ServiceWorker, serviceWorker);
      return;
    }

    assert(targetInfo.type === 'browser' || targetInfo.type === 'other');
    if (waitingForDebugger) {
      // Ideally, detaching should resume any target, but there is a bug in the backend.
      session.send('Runtime.runIfWaitingForDebugger').catch(debugError).then(() => {
        this._session.send('Target.detachFromTarget', { sessionId }).catch(debugError);
      });
    }
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
      serviceWorker.emit(CommonEvents.Worker.Close);
      return;
    }
  }

  async _closePage(crPage: CRPage) {
    await this._session.send('Target.closeTarget', { targetId: crPage._targetId });
  }

  async _disconnect() {
    const disconnected = new Promise(f => this._connection.once(ConnectionEvents.Disconnected, f));
    await Promise.all(this.contexts().map(context => context.close()));
    this._connection.close();
    await disconnected;
  }

  async close() {
    if (this._ownedServer)
      await this._ownedServer.close();
    else
      await this._disconnect();
  }

  async newBrowserCDPSession(): Promise<CRSession> {
    return await this._connection.createBrowserSession();
  }

  async startTracing(page?: Page, options: { path?: string; screenshots?: boolean; categories?: string[]; } = {}) {
    assert(!this._tracingRecording, 'Cannot start recording trace while already recording trace.');
    this._tracingClient = page ? (page._delegate as CRPage)._client : this._session;

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

export class CRBrowserContext extends BrowserContextBase {
  readonly _browser: CRBrowser;
  readonly _browserContextId: string | null;
  readonly _evaluateOnNewDocumentSources: string[];

  constructor(browser: CRBrowser, browserContextId: string | null, options: BrowserContextOptions) {
    super(options);
    this._browser = browser;
    this._browserContextId = browserContextId;
    this._evaluateOnNewDocumentSources = [];
  }

  async _initialize() {
    const promises: Promise<any>[] = [
      this._browser._session.send('Browser.setDownloadBehavior', {
        behavior: this._options.acceptDownloads ? 'allowAndName' : 'deny',
        browserContextId: this._browserContextId || undefined,
        downloadPath: this._browser._downloadsPath
      })
    ];
    if (this._options.permissions)
      promises.push(this.grantPermissions(this._options.permissions));
    if (this._options.offline)
      promises.push(this.setOffline(this._options.offline));
    if (this._options.httpCredentials)
      promises.push(this.setHTTPCredentials(this._options.httpCredentials));
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
    const { targetId } = await this._browser._session.send('Target.createTarget', { url: 'about:blank', browserContextId: this._browserContextId || undefined });
    const crPage = this._browser._crPages.get(targetId)!;
    const result = await crPage.pageOrError();
    if (result instanceof Page) {
      if (result.isClosed())
        throw new Error('Page has been closed.');
      return result;
    }
    throw result;
  }

  async cookies(urls?: string | string[]): Promise<network.NetworkCookie[]> {
    const { cookies } = await this._browser._session.send('Storage.getCookies', { browserContextId: this._browserContextId || undefined });
    return network.filterCookies(cookies.map(c => {
      const copy: any = { sameSite: 'None', ...c };
      delete copy.size;
      delete copy.priority;
      delete copy.session;
      return copy as network.NetworkCookie;
    }), urls);
  }

  async addCookies(cookies: network.SetNetworkCookieParam[]) {
    cookies = cookies.map(c => {
      const copy = { ...c };
      // Working around setter issue in Chrome. Cookies are now None by default.
      if (copy.sameSite === 'None')
        delete copy.sameSite;
      return copy;
    });
    await this._browser._session.send('Storage.setCookies', { cookies: network.rewriteCookies(cookies), browserContextId: this._browserContextId || undefined });
  }

  async clearCookies() {
    await this._browser._session.send('Storage.clearCookies', { browserContextId: this._browserContextId || undefined });
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
    await this._browser._session.send('Browser.grantPermissions', { origin: origin === '*' ? undefined : origin, browserContextId: this._browserContextId || undefined, permissions: filtered });
  }

  async _doClearPermissions() {
    await this._browser._session.send('Browser.resetPermissions', { browserContextId: this._browserContextId || undefined });
  }

  async setGeolocation(geolocation: types.Geolocation | null): Promise<void> {
    if (geolocation)
      geolocation = verifyGeolocation(geolocation);
    this._options.geolocation = geolocation || undefined;
    for (const page of this.pages())
      await (page._delegate as CRPage)._client.send('Emulation.setGeolocationOverride', geolocation || {});
  }

  async setExtraHTTPHeaders(headers: network.Headers): Promise<void> {
    this._options.extraHTTPHeaders = network.verifyHeaders(headers);
    for (const page of this.pages())
      await (page._delegate as CRPage).updateExtraHTTPHeaders();
  }

  async setOffline(offline: boolean): Promise<void> {
    this._options.offline = offline;
    for (const page of this.pages())
      await (page._delegate as CRPage)._networkManager.setOffline(offline);
  }

  async setHTTPCredentials(httpCredentials: types.Credentials | null): Promise<void> {
    this._options.httpCredentials = httpCredentials || undefined;
    for (const page of this.pages())
      await (page._delegate as CRPage)._networkManager.authenticate(httpCredentials);
  }

  async addInitScript(script: Function | string | { path?: string, content?: string }, arg?: any) {
    const source = await helper.evaluationScript(script, arg);
    this._evaluateOnNewDocumentSources.push(source);
    for (const page of this.pages())
      await (page._delegate as CRPage).evaluateOnNewDocument(source);
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
      await (page._delegate as CRPage).exposeBinding(binding);
  }

  async route(url: types.URLMatch, handler: network.RouteHandler): Promise<void> {
    this._routes.push({ url, handler });
    for (const page of this.pages())
      await (page._delegate as CRPage).updateRequestInterception();
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
    await this._browser._session.send('Target.disposeBrowserContext', { browserContextId: this._browserContextId });
    this._browser._contexts.delete(this._browserContextId);
    await this._didCloseInternal();
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
    const targetId = (page._delegate as CRPage)._targetId;
    const rootSession = await this._browser._clientRootSession();
    const { sessionId } = await rootSession.send('Target.attachToTarget', { targetId, flatten: true });
    return this._browser._connection.session(sessionId)!;
  }
}
