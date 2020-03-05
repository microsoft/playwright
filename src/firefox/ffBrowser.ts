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

import { Browser, createPageInNewContext } from '../browser';
import { assertBrowserContextIsNotOwned, BrowserContext, BrowserContextBase, BrowserContextOptions, validateBrowserContextOptions } from '../browserContext';
import { Events } from '../events';
import { assert, helper, RegisteredListener } from '../helper';
import * as network from '../network';
import { Page, PageBinding, PageEvent } from '../page';
import * as platform from '../platform';
import { ConnectionTransport, SlowMoTransport } from '../transport';
import * as types from '../types';
import { ConnectionEvents, FFConnection, FFSession, FFSessionEvents } from './ffConnection';
import { headersArray } from './ffNetworkManager';
import { FFPage } from './ffPage';
import { Protocol } from './protocol';

export class FFBrowser extends platform.EventEmitter implements Browser {
  _connection: FFConnection;
  _targets: Map<string, Target>;
  readonly _defaultContext: FFBrowserContext;
  readonly _contexts: Map<string, FFBrowserContext>;
  private _eventListeners: RegisteredListener[];

  static async connect(transport: ConnectionTransport, slowMo?: number): Promise<FFBrowser> {
    const connection = new FFConnection(SlowMoTransport.wrap(transport, slowMo));
    const browser = new FFBrowser(connection);
    await connection.send('Target.enable');
    return browser;
  }

  constructor(connection: FFConnection) {
    super();
    this._connection = connection;
    this._targets = new Map();

    this._defaultContext = new FFBrowserContext(this, null, validateBrowserContextOptions({}));
    this._contexts = new Map();
    this._connection.on(ConnectionEvents.Disconnected, () => {
      for (const context of this._contexts.values())
        context._browserClosed();
      this.emit(Events.Browser.Disconnected);
    });
    this._eventListeners = [
      helper.addEventListener(this._connection, 'Target.targetCreated', this._onTargetCreated.bind(this)),
      helper.addEventListener(this._connection, 'Target.targetDestroyed', this._onTargetDestroyed.bind(this)),
      helper.addEventListener(this._connection, 'Target.targetInfoChanged', this._onTargetInfoChanged.bind(this)),
      helper.addEventListener(this._connection, 'Target.attachedToTarget', this._onAttachedToTarget.bind(this)),
    ];
  }

  isConnected(): boolean {
    return !this._connection._closed;
  }

  async newContext(options: BrowserContextOptions = {}): Promise<BrowserContext> {
    options = validateBrowserContextOptions(options);
    let viewport;
    if (options.viewport) {
      // TODO: remove isMobile/hasTouch from the protocol?
      if (options.viewport.isMobile)
        throw new Error('viewport.isMobile is not supported in Firefox');
      viewport = {
        viewportSize: { width: options.viewport.width, height: options.viewport.height },
        deviceScaleFactor: options.viewport.deviceScaleFactor || 1,
        isMobile: false,
        hasTouch: false,
      };
    } else if (options.viewport !== null) {
      viewport = {
        viewportSize: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      };
    }
    const { browserContextId } = await this._connection.send('Target.createBrowserContext', {
      userAgent: options.userAgent,
      bypassCSP: options.bypassCSP,
      javaScriptDisabled: options.javaScriptEnabled === false ? true : undefined,
      viewport,
      removeOnDetach: true
    });
    // TODO: move ignoreHTTPSErrors to browser context level.
    if (options.ignoreHTTPSErrors)
      await this._connection.send('Browser.setIgnoreHTTPSErrors', { enabled: true });
    const context = new FFBrowserContext(this, browserContextId, options);
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

  async _waitForTarget(predicate: (target: Target) => boolean, options: { timeout?: number; } = {}): Promise<Target> {
    const {
      timeout = 30000
    } = options;
    const existingTarget = this._allTargets().find(predicate);
    if (existingTarget)
      return existingTarget;
    let resolve: (t: Target) => void;
    const targetPromise = new Promise<Target>(x => resolve = x);
    this.on('targetchanged', check);
    try {
      if (!timeout)
        return await targetPromise;
      return await helper.waitWithTimeout(targetPromise, 'target', timeout);
    } finally {
      this.removeListener('targetchanged', check);
    }

    function check(target: Target) {
      if (predicate(target))
        resolve(target);
    }
  }

  _allTargets() {
    return Array.from(this._targets.values());
  }

  async _onTargetCreated(payload: Protocol.Target.targetCreatedPayload) {
    const {targetId, url, browserContextId, openerId, type} = payload;
    const context = browserContextId ? this._contexts.get(browserContextId)! : this._defaultContext;
    const target = new Target(this._connection, this, context, targetId, type, url, openerId);
    this._targets.set(targetId, target);
  }

  _onTargetDestroyed(payload: Protocol.Target.targetDestroyedPayload) {
    const {targetId} = payload;
    const target = this._targets.get(targetId)!;
    this._targets.delete(targetId);
    target._didClose();
  }

  _onTargetInfoChanged(payload: Protocol.Target.targetInfoChangedPayload) {
    const {targetId, url} = payload;
    const target = this._targets.get(targetId)!;
    target._url = url;
  }

  async _onAttachedToTarget(payload: Protocol.Target.attachedToTargetPayload) {
    const {targetId} = payload.targetInfo;
    const target = this._targets.get(targetId)!;
    target._initPagePromise(this._connection.getSession(payload.sessionId)!);

    const pageEvent = new PageEvent(target.pageOrError());
    target.context().emit(Events.BrowserContext.Page, pageEvent);

    const opener = target.opener();
    if (!opener)
      return;
    const openerPage = await opener.pageOrError();
    if (openerPage instanceof Page && !openerPage.isClosed())
      openerPage.emit(Events.Page.Popup, pageEvent);
  }

  async close() {
    await Promise.all(this.contexts().map(context => context.close()));
    helper.removeEventListeners(this._eventListeners);
    const disconnected = new Promise(f => this.once(Events.Browser.Disconnected, f));
    this._connection.close();
    await disconnected;
  }

  _setDebugFunction(debugFunction: (message: string) => void) {
    this._connection._debugProtocol = debugFunction;
  }
}

class Target {
  _pagePromise?: Promise<Page | Error>;
  _ffPage: FFPage | null = null;
  private readonly _browser: FFBrowser;
  private readonly _context: FFBrowserContext;
  private readonly _connection: FFConnection;
  private readonly _targetId: string;
  private readonly _type: 'page' | 'browser';
  _url: string;
  private readonly _openerId: string | undefined;

  constructor(connection: any, browser: FFBrowser, context: FFBrowserContext, targetId: string, type: 'page' | 'browser', url: string, openerId: string | undefined) {
    this._browser = browser;
    this._context = context;
    this._connection = connection;
    this._targetId = targetId;
    this._type = type;
    this._url = url;
    this._openerId = openerId;
  }

  _didClose() {
    if (this._ffPage)
      this._ffPage.didClose();
  }

  opener(): Target | null {
    return this._openerId ? this._browser._targets.get(this._openerId)! : null;
  }

  type(): 'page' | 'browser' {
    return this._type;
  }

  url() {
    return this._url;
  }

  context(): FFBrowserContext {
    return this._context;
  }

  async pageOrError(): Promise<Page | Error> {
    if (this._type !== 'page')
      throw new Error(`Cannot create page for "${this._type}" target`);
    if (!this._pagePromise)
      await this._connection.send('Target.attachToTarget', {targetId: this._targetId});
    return this._pagePromise!;
  }

  _initPagePromise(session: FFSession) {
    this._pagePromise = new Promise(async f => {
      this._ffPage = new FFPage(session, this._context, async () => {
        const openerTarget = this.opener();
        if (!openerTarget)
          return null;
        const result = await openerTarget.pageOrError();
        if (result instanceof Page && !result.isClosed())
          return result;
        return null;
      });
      const page = this._ffPage._page;
      session.once(FFSessionEvents.Disconnected, () => page._didDisconnect());
      let pageOrError: Page | Error;
      try {
        await this._ffPage._initialize();
        pageOrError = page;
      } catch (e) {
        pageOrError = e;
      }
      f(pageOrError);
    });
  }

  browser() {
    return this._browser;
  }
}

export class FFBrowserContext extends BrowserContextBase {
  readonly _browser: FFBrowser;
  readonly _browserContextId: string | null;
  private _closed = false;
  private readonly _evaluateOnNewDocumentSources: string[];

  constructor(browser: FFBrowser, browserContextId: string | null, options: BrowserContextOptions) {
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
    if (this._options.extraHTTPHeaders)
      await this.setExtraHTTPHeaders(this._options.extraHTTPHeaders);
    if (this._options.offline)
      await this.setOffline(this._options.offline);
  }

  _existingPages(): Page[] {
    const pages: Page[] = [];
    for (const target of this._browser._allTargets()) {
      if (target.context() === this && target._ffPage)
        pages.push(target._ffPage._page);
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
    const pages = await Promise.all(targets.map(target => target.pageOrError()));
    return pages.filter(page => page instanceof Page && !page.isClosed()) as Page[];
  }

  async newPage(): Promise<Page> {
    assertBrowserContextIsNotOwned(this);
    const {targetId} = await this._browser._connection.send('Target.newPage', {
      browserContextId: this._browserContextId || undefined
    });
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
    const { cookies } = await this._browser._connection.send('Browser.getCookies', { browserContextId: this._browserContextId || undefined });
    return network.filterCookies(cookies.map(c => {
      const copy: any = { ... c };
      delete copy.size;
      return copy as network.NetworkCookie;
    }), urls);
  }

  async setCookies(cookies: network.SetNetworkCookieParam[]) {
    await this._browser._connection.send('Browser.setCookies', { browserContextId: this._browserContextId || undefined, cookies: network.rewriteCookies(cookies) });
  }

  async clearCookies() {
    await this._browser._connection.send('Browser.clearCookies', { browserContextId: this._browserContextId || undefined });
  }

  async setPermissions(origin: string, permissions: string[]): Promise<void> {
    const webPermissionToProtocol = new Map<string, 'geo' | 'microphone' | 'camera' | 'desktop-notifications'>([
      ['geolocation', 'geo'],
      ['microphone', 'microphone'],
      ['camera', 'camera'],
      ['notifications', 'desktop-notifications'],
    ]);
    const filtered = permissions.map(permission => {
      const protocolPermission = webPermissionToProtocol.get(permission);
      if (!protocolPermission)
        throw new Error('Unknown permission: ' + permission);
      return protocolPermission;
    });
    await this._browser._connection.send('Browser.grantPermissions', {origin, browserContextId: this._browserContextId || undefined, permissions: filtered});
  }

  async clearPermissions() {
    await this._browser._connection.send('Browser.resetPermissions', { browserContextId: this._browserContextId || undefined });
  }

  async setGeolocation(geolocation: types.Geolocation | null): Promise<void> {
    throw new Error('Geolocation emulation is not supported in Firefox');
  }

  async setExtraHTTPHeaders(headers: network.Headers): Promise<void> {
    this._options.extraHTTPHeaders = network.verifyHeaders(headers);
    await this._browser._connection.send('Browser.setExtraHTTPHeaders', { browserContextId: this._browserContextId || undefined, headers: headersArray(this._options.extraHTTPHeaders) });
  }

  async setOffline(offline: boolean): Promise<void> {
    if (offline)
      throw new Error('Offline mode is not implemented in Firefox');
    this._options.offline = offline;
  }

  async addInitScript(script: Function | string | { path?: string, content?: string }, ...args: any[]) {
    const source = await helper.evaluationScript(script, args);
    this._evaluateOnNewDocumentSources.push(source);
    await this._browser._connection.send('Browser.addScriptToEvaluateOnNewDocument', { browserContextId: this._browserContextId || undefined, script: source });
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
    throw new Error('Not implemented');
  }

  async close() {
    if (this._closed)
      return;
    assert(this._browserContextId, 'Non-incognito profiles cannot be closed!');
    await this._browser._connection.send('Target.removeBrowserContext', { browserContextId: this._browserContextId });
    this._browser._contexts.delete(this._browserContextId);
    this._closed = true;
    this.emit(Events.BrowserContext.Close);
  }

  _browserClosed() {
    this._closed = true;
    for (const page of this._existingPages())
      page._didClose();
    this.emit(Events.BrowserContext.Close);
  }
}
