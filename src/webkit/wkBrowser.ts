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

import { helper, RegisteredListener, debugError, assert } from '../helper';
import * as browser from '../browser';
import * as network from '../network';
import * as types from '../types';
import { WKConnection, WKConnectionEvents, WKTargetSession } from './wkConnection';
import { Page } from '../page';
import { WKTarget } from './wkTarget';
import { Protocol } from './protocol';
import { Events } from '../events';
import { BrowserContext, BrowserContextOptions } from '../browserContext';
import { ConnectionTransport } from '../transport';

export class WKBrowser extends browser.Browser {
  readonly _connection: WKConnection;
  private readonly _defaultContext: BrowserContext;
  private readonly _contexts = new Map<string, BrowserContext>();
  private readonly _targets = new Map<string, WKTarget>();
  private readonly _eventListeners: RegisteredListener[];

  private _firstTargetCallback?: () => void;
  private readonly _firstTargetPromise: Promise<void>;

  constructor(transport: ConnectionTransport) {
    super();
    this._connection = new WKConnection(transport);

    /** @type {!Map<string, !WKTarget>} */
    this._targets = new Map();

    this._defaultContext = this._createBrowserContext(undefined, {});
    /** @type {!Map<string, !BrowserContext>} */
    this._contexts = new Map();

    this._eventListeners = [
      helper.addEventListener(this._connection, WKConnectionEvents.TargetCreated, this._onTargetCreated.bind(this)),
      helper.addEventListener(this._connection, WKConnectionEvents.TargetDestroyed, this._onTargetDestroyed.bind(this)),
      helper.addEventListener(this._connection, WKConnectionEvents.DidCommitProvisionalTarget, this._onProvisionalTargetCommitted.bind(this)),
    ];

    this._firstTargetPromise = new Promise<void>(resolve => this._firstTargetCallback = resolve);

    // Intercept provisional targets during cross-process navigation.
    this._connection.send('Target.setPauseOnStart', { pauseOnStart: true }).catch(e => {
      debugError(e);
      throw e;
    });
  }

  async newContext(options: BrowserContextOptions = {}): Promise<BrowserContext> {
    const { browserContextId } = await this._connection.send('Browser.createContext');
    const context = this._createBrowserContext(browserContextId, options);
    if (options.ignoreHTTPSErrors)
      await this._connection.send('Browser.setIgnoreCertificateErrors', { browserContextId, ignore: true });
    this._contexts.set(browserContextId, context);
    return context;
  }

  browserContexts(): BrowserContext[] {
    return [this._defaultContext, ...Array.from(this._contexts.values())];
  }

  defaultContext(): BrowserContext {
    return this._defaultContext;
  }

  async _waitForFirstPageTarget(timeout: number): Promise<void> {
    assert(!this._targets.size);
    await helper.waitWithTimeout(this._firstTargetPromise, 'target', timeout);
  }

  _onTargetCreated(session: WKTargetSession, targetInfo: Protocol.Target.TargetInfo) {
    assert(targetInfo.type === 'page', 'Only page targets are expected in WebKit, received: ' + targetInfo.type);
    let context = null;
    if (targetInfo.browserContextId) {
      // FIXME: we don't know about the default context id, so assume that all targets from
      // unknown contexts are created in the 'default' context which can in practice be represented
      // by multiple actual contexts in WebKit. Solving this properly will require adding context
      // lifecycle events.
      context = this._contexts.get(targetInfo.browserContextId);
      // if (!context)
      //   throw new Error(`Target ${targetId} created in unknown browser context ${browserContextId}.`);
    }
    if (!context)
      context =  this._defaultContext;
    const target = new WKTarget(this, session, targetInfo, context);
    this._targets.set(targetInfo.targetId, target);
    if (targetInfo.isProvisional) {
      const oldTarget = this._targets.get(targetInfo.oldTargetId);
      if (oldTarget)
        oldTarget._initializeSession(session);
    }
    if (this._firstTargetCallback) {
      this._firstTargetCallback();
      this._firstTargetCallback = null;
    }
    if (!targetInfo.oldTargetId && targetInfo.openerId) {
      const opener = this._targets.get(targetInfo.openerId);
      if (!opener)
        return;
      const openerPage = opener._wkPage ? opener._wkPage._page : null;
      if (!openerPage || !openerPage.listenerCount(Events.Page.Popup))
        return;
      target.page().then(page => openerPage.emit(Events.Page.Popup, page));
    }
    if (targetInfo.isPaused)
      this._connection.send('Target.resume', { targetId: targetInfo.targetId }).catch(debugError);
  }

  _onTargetDestroyed({targetId, crashed}) {
    const target = this._targets.get(targetId);
    this._targets.delete(targetId);
    target._didClose(crashed);
  }

  _closePage(targetId: string, runBeforeUnload: boolean) {
    this._connection.send('Target.close', {
      targetId,
      runBeforeUnload
    }).catch(debugError);
  }

  async _onProvisionalTargetCommitted({oldTargetId, newTargetId}) {
    const oldTarget = this._targets.get(oldTargetId);
    const newTarget = this._targets.get(newTargetId);
    newTarget._swapWith(oldTarget);
  }

  disconnect() {
    throw new Error('Unsupported operation');
  }

  isConnected(): boolean {
    return true;
  }

  async close() {
    helper.removeEventListeners(this._eventListeners);
    await this._connection.send('Browser.close');
  }

  _createBrowserContext(browserContextId: string | undefined, options: BrowserContextOptions): BrowserContext {
    const context = new BrowserContext({
      pages: async (): Promise<Page[]> => {
        const targets = Array.from(this._targets.values()).filter(target => target._browserContext === context && !target._session.isProvisional());
        const pages = await Promise.all(targets.map(target => target.page()));
        return pages.filter(page => !!page);
      },

      newPage: async (): Promise<Page> => {
        const { targetId } = await this._connection.send('Browser.createPage', { browserContextId });
        const target = this._targets.get(targetId);
        return await target.page();
      },

      close: async (): Promise<void> => {
        assert(browserContextId, 'Non-incognito profiles cannot be closed!');
        await this._connection.send('Browser.deleteContext', { browserContextId });
        this._contexts.delete(browserContextId);
      },

      cookies: async (): Promise<network.NetworkCookie[]> => {
        const { cookies } = await this._connection.send('Browser.getAllCookies', { browserContextId });
        return cookies.map((c: network.NetworkCookie) => ({
          ...c,
          expires: c.expires === 0 ? -1 : c.expires
        }));
      },

      clearCookies: async (): Promise<void> => {
        await this._connection.send('Browser.deleteAllCookies', { browserContextId });
      },

      setCookies: async (cookies: network.SetNetworkCookieParam[]): Promise<void> => {
        const cc = cookies.map(c => ({ ...c, session: c.expires === -1 || c.expires === undefined })) as Protocol.Browser.SetCookieParam[];
        await this._connection.send('Browser.setCookies', { cookies: cc, browserContextId });
      },


      setPermissions: async (origin: string, permissions: string[]): Promise<void> => {
        const webPermissionToProtocol = new Map<string, string>([
          ['geolocation', 'geolocation'],
        ]);
        const filtered = permissions.map(permission => {
          const protocolPermission = webPermissionToProtocol.get(permission);
          if (!protocolPermission)
            throw new Error('Unknown permission: ' + permission);
          return protocolPermission;
        });
        await this._connection.send('Browser.grantPermissions', { origin, browserContextId, permissions: filtered });
      },

      clearPermissions: async () => {
        await this._connection.send('Browser.resetPermissions', { browserContextId });
      },

      setGeolocation: async (geolocation: types.Geolocation | null): Promise<void> => {
        const payload: any = geolocation ? { ...geolocation, timestamp: Date.now() } : undefined;
        await this._connection.send('Browser.setGeolocationOverride', { browserContextId, geolocation: payload });
      }
    }, options);
    return context;
  }
}
