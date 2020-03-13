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
import { ConnectionEvents, FFConnection } from './ffConnection';
import { headersArray } from './ffNetworkManager';
import { FFPage } from './ffPage';
import { Protocol } from './protocol';

export class FFBrowser extends platform.EventEmitter implements Browser {
  _connection: FFConnection;
  readonly _ffPages: Map<string, FFPage>;
  readonly _defaultContext: FFBrowserContext;
  readonly _contexts: Map<string, FFBrowserContext>;
  private _eventListeners: RegisteredListener[];
  readonly _firstPagePromise: Promise<void>;
  private _firstPageCallback = () => {};

  static async connect(transport: ConnectionTransport, attachToDefaultContext: boolean, slowMo?: number): Promise<FFBrowser> {
    const connection = new FFConnection(SlowMoTransport.wrap(transport, slowMo));
    const browser = new FFBrowser(connection);
    await connection.send('Browser.enable', { attachToDefaultContext });
    return browser;
  }

  constructor(connection: FFConnection) {
    super();
    this._connection = connection;
    this._ffPages = new Map();

    this._defaultContext = new FFBrowserContext(this, null, validateBrowserContextOptions({}));
    this._contexts = new Map();
    this._connection.on(ConnectionEvents.Disconnected, () => {
      for (const context of this._contexts.values())
        context._browserClosed();
      this.emit(Events.Browser.Disconnected);
    });
    this._eventListeners = [
      helper.addEventListener(this._connection, 'Browser.attachedToTarget', this._onAttachedToTarget.bind(this)),
      helper.addEventListener(this._connection, 'Browser.detachedFromTarget', this._onDetachedFromTarget.bind(this)),
    ];
    this._firstPagePromise = new Promise(f => this._firstPageCallback = f);
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
    const { browserContextId } = await this._connection.send('Browser.createBrowserContext', {
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

  _onDetachedFromTarget(payload: Protocol.Browser.detachedFromTargetPayload) {
    const ffPage = this._ffPages.get(payload.targetId)!;
    this._ffPages.delete(payload.targetId);
    ffPage.didClose();
  }

  _onAttachedToTarget(payload: Protocol.Browser.attachedToTargetPayload) {
    const {targetId, browserContextId, openerId, type} = payload.targetInfo;
    assert(type === 'page');
    const context = browserContextId ? this._contexts.get(browserContextId)! : this._defaultContext;
    const session = this._connection.createSession(payload.sessionId, type);
    const opener = openerId ? this._ffPages.get(openerId)! : null;
    const ffPage = new FFPage(session, context, opener);
    this._ffPages.set(targetId, ffPage);

    const pageEvent = new PageEvent(context, ffPage.pageOrError());
    for (const barrier of context._pendingSignalBarriers)
      barrier.addPageEvent(pageEvent);
    ffPage.pageOrError().then(async () => {
      this._firstPageCallback();
      context.emit(Events.BrowserContext.Page, pageEvent);
      if (!opener)
        return;
      const openerPage = await opener.pageOrError();
      if (openerPage instanceof Page && !openerPage.isClosed())
        openerPage.emit(Events.Page.Popup, pageEvent);
    });
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

export class FFBrowserContext extends BrowserContextBase {
  readonly _browser: FFBrowser;
  readonly _browserContextId: string | null;
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
    if (this._options.httpCredentials)
      await this.setHTTPCredentials(this._options.httpCredentials);
  }

  _ffPages(): FFPage[] {
    return Array.from(this._browser._ffPages.values()).filter(ffPage => ffPage._browserContext === this);
  }

  setDefaultNavigationTimeout(timeout: number) {
    this._timeoutSettings.setDefaultNavigationTimeout(timeout);
  }

  setDefaultTimeout(timeout: number) {
    this._timeoutSettings.setDefaultTimeout(timeout);
  }

  pages(): Page[] {
    return this._ffPages().map(ffPage => ffPage._initializedPage()).filter(pageOrNull => !!pageOrNull) as Page[];
  }

  async newPage(): Promise<Page> {
    assertBrowserContextIsNotOwned(this);
    const { targetId } = await this._browser._connection.send('Browser.newPage', {
      browserContextId: this._browserContextId || undefined
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

  async cookies(urls?: string | string[]): Promise<network.NetworkCookie[]> {
    const { cookies } = await this._browser._connection.send('Browser.getCookies', { browserContextId: this._browserContextId || undefined });
    return network.filterCookies(cookies.map(c => {
      const copy: any = { ... c };
      delete copy.size;
      delete copy.session;
      return copy as network.NetworkCookie;
    }), urls);
  }

  async addCookies(cookies: network.SetNetworkCookieParam[]) {
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

  async setHTTPCredentials(httpCredentials: types.Credentials | null): Promise<void> {
    this._options.httpCredentials = httpCredentials || undefined;
    await this._browser._connection.send('Browser.setHTTPCredentials', { browserContextId: this._browserContextId || undefined, credentials: httpCredentials });
  }

  async addInitScript(script: Function | string | { path?: string, content?: string }, ...args: any[]) {
    const source = await helper.evaluationScript(script, args);
    this._evaluateOnNewDocumentSources.push(source);
    await this._browser._connection.send('Browser.addScriptToEvaluateOnNewDocument', { browserContextId: this._browserContextId || undefined, script: source });
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
    throw new Error('Not implemented');
  }

  async route(url: types.URLMatch, handler: network.RouteHandler): Promise<void> {
    this._routes.push({ url, handler });
    throw new Error('Not implemented');
    // TODO: update interception on the context if this is a first route.
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
    await this._browser._connection.send('Browser.removeBrowserContext', { browserContextId: this._browserContextId });
    this._browser._contexts.delete(this._browserContextId);
    this._didCloseInternal();
  }
}
