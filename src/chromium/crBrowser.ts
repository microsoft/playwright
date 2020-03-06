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

import { Browser, createPageInNewContext } from '../browser';
import { assertBrowserContextIsNotOwned, BrowserContext, BrowserContextBase, BrowserContextOptions, validateBrowserContextOptions, verifyGeolocation } from '../browserContext';
import { Events as CommonEvents } from '../events';
import { assert, debugError, helper } from '../helper';
import * as network from '../network';
import { Page, PageBinding, PageEvent } from '../page';
import * as platform from '../platform';
import { ConnectionTransport, SlowMoTransport } from '../transport';
import * as types from '../types';
import { ConnectionEvents, CRConnection, CRSession } from './crConnection';
import { CRPage } from './crPage';
import { readProtocolStream } from './crProtocolHelper';
import { CRTarget } from './crTarget';
import { Events } from './events';
import { Protocol } from './protocol';

export class CRBrowser extends platform.EventEmitter implements Browser {
  _connection: CRConnection;
  _client: CRSession;
  readonly _defaultContext: CRBrowserContext;
  readonly _contexts = new Map<string, CRBrowserContext>();
  _targets = new Map<string, CRTarget>();

  private _tracingRecording = false;
  private _tracingPath: string | null = '';
  private _tracingClient: CRSession | undefined;

  static async connect(transport: ConnectionTransport, isPersistent: boolean, slowMo?: number): Promise<CRBrowser> {
    const connection = new CRConnection(SlowMoTransport.wrap(transport, slowMo));
    const browser = new CRBrowser(connection);
    const session = connection.rootSession;
    const promises = [
      session.send('Target.setDiscoverTargets', { discover: true }),
      session.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }),
    ];
    const existingPageAttachPromises: Promise<any>[] = [];
    if (isPersistent) {
      // First page and background pages in the persistent context are created automatically
      // and may be initialized before we enable auto-attach.
      function attachToExistingPage({targetInfo}: Protocol.Target.targetCreatedPayload) {
        if (!CRTarget.isPageType(targetInfo.type))
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
    this._client = this._connection.rootSession;

    this._defaultContext = new CRBrowserContext(this, null, validateBrowserContextOptions({}));
    this._connection.on(ConnectionEvents.Disconnected, () => {
      for (const context of this._contexts.values())
        context._browserClosed();
      this.emit(CommonEvents.Browser.Disconnected);
    });
    this._client.on('Target.targetCreated', this._targetCreated.bind(this));
    this._client.on('Target.targetDestroyed', this._targetDestroyed.bind(this));
    this._client.on('Target.targetInfoChanged', this._targetInfoChanged.bind(this));
    this._client.on('Target.attachedToTarget', this._onAttachedToTarget.bind(this));
  }

  async newContext(options: BrowserContextOptions = {}): Promise<BrowserContext> {
    options = validateBrowserContextOptions(options);
    const { browserContextId } = await this._client.send('Target.createBrowserContext', { disposeOnDetach: true });
    const context = new CRBrowserContext(this, browserContextId, options);
    await context._initialize();
    this._contexts.set(browserContextId, context);
    return context;
  }

  contexts(): BrowserContext[] {
    return Array.from(this._contexts.values());
  }

  async newPage(options?: BrowserContextOptions): Promise<Page> {
    return createPageInNewContext(this, options);
  }

  async _onAttachedToTarget(event: Protocol.Target.attachedToTargetPayload) {
    if (!CRTarget.isPageType(event.targetInfo.type))
      return;
    const target = this._targets.get(event.targetInfo.targetId);
    const session = this._connection.session(event.sessionId)!;
    await target!.initializePageSession(session).catch(debugError);
  }

  async _targetCreated({targetInfo}: Protocol.Target.targetCreatedPayload) {
    const {browserContextId} = targetInfo;
    const context = (browserContextId && this._contexts.has(browserContextId)) ? this._contexts.get(browserContextId)! : this._defaultContext;
    const target = new CRTarget(this, targetInfo, context, () => this._connection.createSession(targetInfo));
    assert(!this._targets.has(targetInfo.targetId), 'Target should not exist before targetCreated');
    this._targets.set(targetInfo.targetId, target);

    try {
      switch (targetInfo.type) {
        case 'page': {
          const event = new PageEvent(target.pageOrError());
          context.emit(CommonEvents.BrowserContext.Page, event);
          const opener = target.opener();
          if (!opener)
            break;
          const openerPage = await opener.pageOrError();
          if (openerPage instanceof Page && !openerPage.isClosed())
            openerPage.emit(CommonEvents.Page.Popup, new PageEvent(target.pageOrError()));
          break;
        }
        case 'background_page': {
          const event = new PageEvent(target.pageOrError());
          context.emit(Events.CRBrowserContext.BackgroundPage, event);
          break;
        }
        case 'service_worker': {
          const serviceWorker = await target.serviceWorker();
          context.emit(Events.CRBrowserContext.ServiceWorker, serviceWorker);
          break;
        }
      }
    } catch (e) {
      // Do not dispatch the event if initialization failed.
      debugError(e);
    }
  }

  async _targetDestroyed(event: { targetId: string; }) {
    const target = this._targets.get(event.targetId)!;
    this._targets.delete(event.targetId);
    target._didClose();
  }

  _targetInfoChanged(event: Protocol.Target.targetInfoChangedPayload) {
    const target = this._targets.get(event.targetInfo.targetId)!;
    assert(target, 'target should exist before targetInfoChanged');
    target._targetInfoChanged(event.targetInfo);
  }

  async _closePage(page: Page) {
    await this._client.send('Target.closeTarget', { targetId: CRTarget.fromPage(page)._targetId });
  }

  _allTargets(): CRTarget[] {
    return Array.from(this._targets.values());
  }

  async close() {
    const disconnected = new Promise(f => this._connection.once(ConnectionEvents.Disconnected, f));
    await Promise.all(this.contexts().map(context => context.close()));
    this._connection.close();
    await disconnected;
  }

  async createBrowserSession(): Promise<CRSession> {
    return await this._connection.createBrowserSession();
  }

  async startTracing(page?: Page, options: { path?: string; screenshots?: boolean; categories?: string[]; } = {}) {
    assert(!this._tracingRecording, 'Cannot start recording trace while already recording trace.');
    this._tracingClient = page ? (page._delegate as CRPage)._client : this._client;

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

  async stopTracing(): Promise<platform.BufferType> {
    assert(this._tracingClient, 'Tracing was not started.');
    let fulfill: (buffer: platform.BufferType) => void;
    const contentPromise = new Promise<platform.BufferType>(x => fulfill = x);
    this._tracingClient.once('Tracing.tracingComplete', event => {
      readProtocolStream(this._tracingClient!, event.stream!, this._tracingPath).then(fulfill);
    });
    await this._tracingClient.send('Tracing.end');
    this._tracingRecording = false;
    return contentPromise;
  }

  isConnected(): boolean {
    return !this._connection._closed;
  }

  _setDebugFunction(debugFunction: (message: string) => void) {
    this._connection._debugProtocol = debugFunction;
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
    const entries = Object.entries(this._options.permissions || {});
    await Promise.all(entries.map(entry => this.setPermissions(entry[0], entry[1])));
    if (this._options.geolocation)
      await this.setGeolocation(this._options.geolocation);
    if (this._options.offline)
      await this.setOffline(this._options.offline);
  }

  _existingPages(): Page[] {
    const pages: Page[] = [];
    for (const target of this._browser._allTargets()) {
      if (target.context() === this && target._crPage)
        pages.push(target._crPage.page());
    }
    return pages;
  }

  async pages(): Promise<Page[]> {
    const targets = this._browser._allTargets().filter(target => target.context() === this && target.type() === 'page');
    const pages = await Promise.all(targets.map(target => target.pageOrError()));
    return pages.filter(page => (page instanceof Page) && !page.isClosed()) as Page[];
  }

  async newPage(): Promise<Page> {
    assertBrowserContextIsNotOwned(this);
    const { targetId } = await this._browser._client.send('Target.createTarget', { url: 'about:blank', browserContextId: this._browserContextId || undefined });
    const target = this._browser._targets.get(targetId)!;
    const result = await target.pageOrError();
    if (result instanceof Page) {
      if (result.isClosed())
        throw new Error('Page has been closed.');
      return result;
    }
    throw result;
  }

  async cookies(...urls: string[]): Promise<network.NetworkCookie[]> {
    const { cookies } = await this._browser._client.send('Storage.getCookies', { browserContextId: this._browserContextId || undefined });
    return network.filterCookies(cookies.map(c => {
      const copy: any = { sameSite: 'None', ...c };
      delete copy.size;
      delete copy.priority;
      return copy as network.NetworkCookie;
    }), urls);
  }

  async setCookies(cookies: network.SetNetworkCookieParam[]) {
    await this._browser._client.send('Storage.setCookies', { cookies: network.rewriteCookies(cookies), browserContextId: this._browserContextId || undefined });
  }

  async clearCookies() {
    await this._browser._client.send('Storage.clearCookies', { browserContextId: this._browserContextId || undefined });
  }

  async setPermissions(origin: string, permissions: string[]): Promise<void> {
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
    await this._browser._client.send('Browser.grantPermissions', { origin, browserContextId: this._browserContextId || undefined, permissions: filtered });
  }

  async clearPermissions() {
    await this._browser._client.send('Browser.resetPermissions', { browserContextId: this._browserContextId || undefined });
  }

  async setGeolocation(geolocation: types.Geolocation | null): Promise<void> {
    if (geolocation)
      geolocation = verifyGeolocation(geolocation);
    this._options.geolocation = geolocation || undefined;
    for (const page of this._existingPages())
      await (page._delegate as CRPage)._client.send('Emulation.setGeolocationOverride', geolocation || {});
  }

  async setExtraHTTPHeaders(headers: network.Headers): Promise<void> {
    this._options.extraHTTPHeaders = network.verifyHeaders(headers);
    for (const page of this._existingPages())
      await (page._delegate as CRPage).updateExtraHTTPHeaders();
  }

  async setOffline(offline: boolean): Promise<void> {
    this._options.offline = offline;
    for (const page of this._existingPages())
      await (page._delegate as CRPage)._networkManager.setOffline(offline);
  }

  async addInitScript(script: Function | string | { path?: string, content?: string }, ...args: any[]) {
    const source = await helper.evaluationScript(script, args);
    this._evaluateOnNewDocumentSources.push(source);
    for (const page of this._existingPages())
      await (page._delegate as CRPage).evaluateOnNewDocument(source);
  }

  async exposeFunction(name: string, playwrightFunction: Function): Promise<void> {
    for (const page of this._existingPages()) {
      if (page._pageBindings.has(name))
        throw new Error(`Function "${name}" has been already registered in one of the pages`);
    }
    if (this._pageBindings.has(name))
      throw new Error(`Function "${name}" has been already registered`);
    const binding = new PageBinding(name, playwrightFunction);
    this._pageBindings.set(name, binding);
    for (const page of this._existingPages())
      await (page._delegate as CRPage).exposeBinding(binding);
  }

  async close() {
    if (this._closed)
      return;
    assert(this._browserContextId, 'Non-incognito profiles cannot be closed!');
    await this._browser._client.send('Target.disposeBrowserContext', { browserContextId: this._browserContextId });
    this._browser._contexts.delete(this._browserContextId);
    this._didCloseInternal();
  }

  async backgroundPages(): Promise<Page[]> {
    const targets = this._browser._allTargets().filter(target => target.context() === this && target.type() === 'background_page');
    const pages = await Promise.all(targets.map(target => target.pageOrError()));
    return pages.filter(page => (page instanceof Page) && !page.isClosed()) as Page[];
  }

  async createSession(page: Page): Promise<CRSession> {
    return CRTarget.fromPage(page).sessionFactory();
  }
}
