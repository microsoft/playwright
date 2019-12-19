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

import { EventEmitter } from 'events';
import { helper, RegisteredListener, debugError, assert } from '../helper';
import * as browser from '../browser';
import * as network from '../network';
import { Connection, ConnectionEvents, TargetSession } from './Connection';
import { Page } from '../page';
import { Target } from './Target';
import { Protocol } from './protocol';
import { Events } from '../events';
import { BrowserContext, BrowserContextOptions } from '../browserContext';
import { ConnectionTransport } from '../transport';

export class Browser extends EventEmitter implements browser.Browser {
  readonly _connection: Connection;
  private _defaultContext: BrowserContext;
  private _contexts = new Map<string, BrowserContext>();
  _targets = new Map<string, Target>();
  private _eventListeners: RegisteredListener[];
  private _privateEvents = new EventEmitter();

  constructor(transport: ConnectionTransport) {
    super();
    this._connection = new Connection(transport);

    /** @type {!Map<string, !Target>} */
    this._targets = new Map();

    this._defaultContext = this._createBrowserContext(undefined, {});
    /** @type {!Map<string, !BrowserContext>} */
    this._contexts = new Map();

    this._eventListeners = [
      helper.addEventListener(this._connection, ConnectionEvents.TargetCreated, this._onTargetCreated.bind(this)),
      helper.addEventListener(this._connection, ConnectionEvents.TargetDestroyed, this._onTargetDestroyed.bind(this)),
      helper.addEventListener(this._connection, ConnectionEvents.DidCommitProvisionalTarget, this._onProvisionalTargetCommitted.bind(this)),
    ];

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

  async _waitForTarget(predicate: (arg0: Target) => boolean, options: { timeout?: number; } | undefined = {}): Promise<Target> {
    const {
      timeout = 30000
    } = options;
    const existingTarget = Array.from(this._targets.values()).find(predicate);
    if (existingTarget)
      return existingTarget;
    let resolve : (a: Target) => void;
    const targetPromise = new Promise<Target>(x => resolve = x);
    this._privateEvents.on(BrowserEvents.TargetCreated, check);
    try {
      if (!timeout)
        return await targetPromise;
      return await helper.waitWithTimeout(targetPromise, 'target', timeout);
    } finally {
      this._privateEvents.removeListener(BrowserEvents.TargetCreated, check);
    }

    function check(target: Target) {
      if (predicate(target))
        resolve(target);
    }
  }

  _onTargetCreated(session: TargetSession, targetInfo: Protocol.Target.TargetInfo) {
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
    const target = new Target(this, session, targetInfo, context);
    this._targets.set(targetInfo.targetId, target);
    if (targetInfo.isProvisional) {
      const oldTarget = this._targets.get(targetInfo.oldTargetId);
      if (oldTarget)
        oldTarget._initializeSession(session);
    }
    this._privateEvents.emit(BrowserEvents.TargetCreated, target);
    if (!targetInfo.oldTargetId && targetInfo.openerId) {
      const opener = this._targets.get(targetInfo.openerId);
      if (!opener)
        return;
      const openerPage = opener._frameManager ? opener._frameManager._page : null;
      if (!openerPage || !openerPage.listenerCount(Events.Page.Popup))
        return;
      target.page().then(page => openerPage.emit(Events.Page.Popup, page));
    }
    if (targetInfo.isPaused)
      this._connection.send('Target.resume', { targetId: targetInfo.targetId }).catch(debugError);
  }

  _onTargetDestroyed({targetId}) {
    const target = this._targets.get(targetId);
    this._targets.delete(targetId);
    target._didClose();
  }

  _closePage(page: Page, runBeforeUnload: boolean) {
    this._connection.send('Target.close', {
      targetId: Target.fromPage(page)._targetId,
      runBeforeUnload
    }).catch(debugError);
  }

  async _activatePage(page: Page): Promise<void> {
    await this._connection.send('Target.activate', { targetId: Target.fromPage(page)._targetId });
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
        const targets = Array.from(this._targets.values()).filter(target => target._browserContext === context && target._type === 'page');
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
    }, options);
    return context;
  }
}

const BrowserEvents = {
  TargetCreated: Symbol('BrowserEvents.TargetCreated'),
  TargetDestroyed: Symbol('BrowserEvents.TargetDestroyed'),
};
