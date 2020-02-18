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
import { BrowserContext, BrowserContextOptions } from '../browserContext';
import { Events } from '../events';
import { assert, helper, RegisteredListener, debugError } from '../helper';
import * as network from '../network';
import * as types from '../types';
import { Page } from '../page';
import { ConnectionEvents, FFConnection, FFSessionEvents, FFSession } from './ffConnection';
import { FFPage } from './ffPage';
import * as platform from '../platform';
import { Protocol } from './protocol';
import { ConnectionTransport, SlowMoTransport } from '../transport';

export class FFBrowser extends platform.EventEmitter implements Browser {
  _connection: FFConnection;
  _targets: Map<string, Target>;
  readonly _defaultContext: BrowserContext;
  private _contexts: Map<string, BrowserContext>;
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

    this._defaultContext = this._createBrowserContext(null, {});
    this._contexts = new Map();
    this._connection.on(ConnectionEvents.Disconnected, () => {
      for (const context of this.contexts())
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
    let viewport;
    if (options.viewport) {
      viewport = {
        viewportSize: { width: options.viewport.width, height: options.viewport.height },
        isMobile: !!options.viewport.isMobile,
        deviceScaleFactor: options.viewport.deviceScaleFactor || 1,
        hasTouch: !!options.viewport.isMobile,
      };
    } else if (options.viewport !== null) {
      viewport = {
        viewportSize: { width: 1280, height: 720 },
        isMobile: false,
        deviceScaleFactor: 1,
        hasTouch: false,
      };
    }
    const { browserContextId } = await this._connection.send('Target.createBrowserContext', {
      userAgent: options.userAgent,
      bypassCSP: options.bypassCSP,
      javaScriptDisabled: options.javaScriptEnabled === false ? true : undefined,
      viewport,
    });
    // TODO: move ignoreHTTPSErrors to browser context level.
    if (options.ignoreHTTPSErrors)
      await this._connection.send('Browser.setIgnoreHTTPSErrors', { enabled: true });
    const context = this._createBrowserContext(browserContextId, options);
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
    const opener = target.opener();
    if (opener && opener._pagePromise) {
      const openerPage = await opener._pagePromise;
      if (openerPage.listenerCount(Events.Page.Popup)) {
        const popupPage = await target.page();
        openerPage.emit(Events.Page.Popup, popupPage);
      }
    }
  }

  async close() {
    await Promise.all(this.contexts().map(context => context.close()));
    helper.removeEventListeners(this._eventListeners);
    const disconnected = new Promise(f => this.once(Events.Browser.Disconnected, f));
    this._connection.close();
    await disconnected;
  }

  _createBrowserContext(browserContextId: string | null, options: BrowserContextOptions): BrowserContext {
    BrowserContext.validateOptions(options);
    const context = new BrowserContext({
      pages: async (): Promise<Page[]> => {
        const targets = this._allTargets().filter(target => target.context() === context && target.type() === 'page');
        const pages = await Promise.all(targets.map(target => target.page()));
        return pages.filter(page => !!page);
      },

      existingPages: (): Page[] => {
        const pages: Page[] = [];
        for (const target of this._allTargets()) {
          if (target.context() === context && target._ffPage)
            pages.push(target._ffPage._page);
        }
        return pages;
      },

      newPage: async (): Promise<Page> => {
        const {targetId} = await this._connection.send('Target.newPage', {
          browserContextId: browserContextId || undefined
        });
        const target = this._targets.get(targetId)!;
        return target.page();
      },

      close: async (): Promise<void> => {
        assert(browserContextId, 'Non-incognito profiles cannot be closed!');
        await this._connection.send('Target.removeBrowserContext', { browserContextId });
        this._contexts.delete(browserContextId);
      },

      cookies: async (): Promise<network.NetworkCookie[]> => {
        const { cookies } = await this._connection.send('Browser.getCookies', { browserContextId: browserContextId || undefined });
        return cookies.map(c => {
          const copy: any = { ... c };
          delete copy.size;
          return copy as network.NetworkCookie;
        });
      },

      clearCookies: async (): Promise<void> => {
        await this._connection.send('Browser.clearCookies', { browserContextId: browserContextId || undefined });
      },

      setCookies: async (cookies: network.SetNetworkCookieParam[]): Promise<void> => {
        await this._connection.send('Browser.setCookies', { browserContextId: browserContextId || undefined, cookies });
      },

      setPermissions: async (origin: string, permissions: string[]): Promise<void> => {
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
        await this._connection.send('Browser.grantPermissions', {origin, browserContextId: browserContextId || undefined, permissions: filtered});
      },

      clearPermissions: async () => {
        await this._connection.send('Browser.resetPermissions', { browserContextId: browserContextId || undefined });
      },

      setGeolocation: async (geolocation: types.Geolocation | null): Promise<void> => {
        throw new Error('Geolocation emulation is not supported in Firefox');
      }
    }, options);
    return context;
  }

  _setDebugFunction(debugFunction: (message: string) => void) {
    this._connection._debugProtocol = debugFunction;
  }
}

class Target {
  _pagePromise?: Promise<Page>;
  _ffPage: FFPage | null = null;
  private readonly _browser: FFBrowser;
  private readonly _context: BrowserContext;
  private readonly _connection: FFConnection;
  private readonly _targetId: string;
  private readonly _type: 'page' | 'browser';
  _url: string;
  private readonly _openerId: string | undefined;

  constructor(connection: any, browser: FFBrowser, context: BrowserContext, targetId: string, type: 'page' | 'browser', url: string, openerId: string | undefined) {
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

  context(): BrowserContext {
    return this._context;
  }

  async page(): Promise<Page> {
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
        return await openerTarget.page();
      });
      const page = this._ffPage._page;
      session.once(FFSessionEvents.Disconnected, () => page._didDisconnect());
      await this._ffPage._initialize().catch(debugError);
      f(page);
    });
  }

  browser() {
    return this._browser;
  }
}
