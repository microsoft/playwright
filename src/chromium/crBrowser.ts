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

import { Events } from './events';
import { Events as CommonEvents } from '../events';
import { assert, helper } from '../helper';
import { BrowserContext, BrowserContextOptions, validateBrowserContextOptions, assertBrowserContextIsNotOwned, verifyGeolocation } from '../browserContext';
import { CRConnection, ConnectionEvents, CRSession } from './crConnection';
import { Page } from '../page';
import { CRTarget } from './crTarget';
import { Protocol } from './protocol';
import { CRPage } from './crPage';
import { Browser, createPageInNewContext } from '../browser';
import * as network from '../network';
import * as types from '../types';
import * as platform from '../platform';
import { readProtocolStream } from './crProtocolHelper';
import { ConnectionTransport, SlowMoTransport } from '../transport';
import { TimeoutSettings } from '../timeoutSettings';

export class CRBrowser extends platform.EventEmitter implements Browser {
  _connection: CRConnection;
  _client: CRSession;
  readonly _defaultContext: CRBrowserContext;
  readonly _contexts = new Map<string, CRBrowserContext>();
  _targets = new Map<string, CRTarget>();

  private _tracingRecording = false;
  private _tracingPath: string | null = '';
  private _tracingClient: CRSession | undefined;

  static async connect(transport: ConnectionTransport, slowMo?: number): Promise<CRBrowser> {
    const connection = new CRConnection(SlowMoTransport.wrap(transport, slowMo));
    const browser = new CRBrowser(connection);
    await connection.rootSession.send('Target.setDiscoverTargets', { discover: true });
    return browser;
  }

  constructor(connection: CRConnection) {
    super();
    this._connection = connection;
    this._client = connection.rootSession;

    this._defaultContext = new CRBrowserContext(this, null, validateBrowserContextOptions({}));
    this._connection.on(ConnectionEvents.Disconnected, () => {
      for (const context of this._contexts.values())
        context._browserClosed();
      this.emit(CommonEvents.Browser.Disconnected);
    });
    this._client.on('Target.targetCreated', this._targetCreated.bind(this));
    this._client.on('Target.targetDestroyed', this._targetDestroyed.bind(this));
    this._client.on('Target.targetInfoChanged', this._targetInfoChanged.bind(this));
  }

  async newContext(options: BrowserContextOptions = {}): Promise<BrowserContext> {
    options = validateBrowserContextOptions(options);
    const { browserContextId } = await this._client.send('Target.createBrowserContext');
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

  async _targetCreated(event: Protocol.Target.targetCreatedPayload) {
    const targetInfo = event.targetInfo;
    const {browserContextId} = targetInfo;
    const context = (browserContextId && this._contexts.has(browserContextId)) ? this._contexts.get(browserContextId)! : this._defaultContext;

    const target = new CRTarget(this, targetInfo, context, () => this._connection.createSession(targetInfo));
    assert(!this._targets.has(event.targetInfo.targetId), 'Target should not exist before targetCreated');
    this._targets.set(event.targetInfo.targetId, target);

    if (target._isInitialized || await target._initializedPromise)
      context.emit(Events.CRBrowserContext.TargetCreated, target);
  }

  async _targetDestroyed(event: { targetId: string; }) {
    const target = this._targets.get(event.targetId)!;
    target._initializedCallback(false);
    this._targets.delete(event.targetId);
    target._didClose();
    if (await target._initializedPromise)
      target.context().emit(Events.CRBrowserContext.TargetDestroyed, target);
  }

  _targetInfoChanged(event: Protocol.Target.targetInfoChangedPayload) {
    const target = this._targets.get(event.targetInfo.targetId)!;
    assert(target, 'target should exist before targetInfoChanged');
    const previousURL = target.url();
    const wasInitialized = target._isInitialized;
    target._targetInfoChanged(event.targetInfo);
    if (wasInitialized && previousURL !== target.url())
      target.context().emit(Events.CRBrowserContext.TargetChanged, target);
  }

  async _closePage(page: Page) {
    await this._client.send('Target.closeTarget', { targetId: CRTarget.fromPage(page)._targetId });
  }

  _allTargets(): CRTarget[] {
    return Array.from(this._targets.values()).filter(target => target._isInitialized);
  }

  async close() {
    const disconnected = new Promise(f => this._connection.once(ConnectionEvents.Disconnected, f));
    await Promise.all(this.contexts().map(context => context.close()));
    this._connection.close();
    await disconnected;
  }

  browserTarget(): CRTarget {
    return [...this._targets.values()].find(t => t.type() === 'browser')!;
  }

  async startTracing(page: Page | undefined, options: { path?: string; screenshots?: boolean; categories?: string[]; } = {}) {
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

export class CRBrowserContext extends platform.EventEmitter implements BrowserContext {
  readonly _browser: CRBrowser;
  readonly _browserContextId: string | null;
  readonly _options: BrowserContextOptions;
  readonly _timeoutSettings: TimeoutSettings;
  private _closed = false;

  constructor(browser: CRBrowser, browserContextId: string | null, options: BrowserContextOptions) {
    super();
    this._browser = browser;
    this._browserContextId = browserContextId;
    this._timeoutSettings = new TimeoutSettings();
    this._options = options;
  }

  async _initialize() {
    const entries = Object.entries(this._options.permissions || {});
    await Promise.all(entries.map(entry => this.setPermissions(entry[0], entry[1])));
    if (this._options.geolocation)
      await this.setGeolocation(this._options.geolocation);
  }

  _existingPages(): Page[] {
    const pages: Page[] = [];
    for (const target of this._browser._allTargets()) {
      if (target.context() === this && target._crPage)
        pages.push(target._crPage.page());
    }
    return pages;
  }

  setDefaultNavigationTimeout(timeout: number) {
    this._timeoutSettings.setDefaultNavigationTimeout(timeout);
  }

  setDefaultTimeout(timeout: number) {
    this._timeoutSettings.setDefaultTimeout(timeout);
  }

  async pages(): Promise<Page[]> {
    const targets = this._browser._allTargets().filter(target => target.context() === this && target.type() === 'page');
    const pages = await Promise.all(targets.map(target => target.page()));
    return pages.filter(page => !!page) as Page[];
  }

  async newPage(): Promise<Page> {
    assertBrowserContextIsNotOwned(this);
    const { targetId } = await this._browser._client.send('Target.createTarget', { url: 'about:blank', browserContextId: this._browserContextId || undefined });
    const target = this._browser._targets.get(targetId)!;
    assert(await target._initializedPromise, 'Failed to create target for page');
    const page = await target.page();
    return page!;
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

  async close() {
    if (this._closed)
      return;
    assert(this._browserContextId, 'Non-incognito profiles cannot be closed!');
    await this._browser._client.send('Target.disposeBrowserContext', { browserContextId: this._browserContextId });
    this._browser._contexts.delete(this._browserContextId);
    this._closed = true;
    this.emit(CommonEvents.BrowserContext.Close);
  }

  pageTarget(page: Page): CRTarget {
    return CRTarget.fromPage(page);
  }

  targets(): CRTarget[] {
    return this._browser._allTargets().filter(t => t.context() === this);
  }

  async waitForTarget(predicate: (arg0: CRTarget) => boolean, options: { timeout?: number; } = {}): Promise<CRTarget> {
    const { timeout = 30000 } = options;
    const existingTarget = this._browser._allTargets().find(predicate);
    if (existingTarget)
      return existingTarget;
    let resolve: (target: CRTarget) => void;
    const targetPromise = new Promise<CRTarget>(x => resolve = x);
    this.on(Events.CRBrowserContext.TargetCreated, check);
    this.on(Events.CRBrowserContext.TargetChanged, check);
    try {
      if (!timeout)
        return await targetPromise;
      return await helper.waitWithTimeout(targetPromise, 'target', timeout);
    } finally {
      this.removeListener(Events.CRBrowserContext.TargetCreated, check);
      this.removeListener(Events.CRBrowserContext.TargetChanged, check);
    }

    function check(target: CRTarget) {
      if (predicate(target))
        resolve(target);
    }
  }

  _browserClosed() {
    this._closed = true;
    for (const page of this._existingPages())
      page._didClose();
    this.emit(CommonEvents.BrowserContext.Close);
  }
}
