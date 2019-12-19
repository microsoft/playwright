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

import * as childProcess from 'child_process';
import { EventEmitter } from 'events';
import { Events } from './events';
import { assert, helper } from '../helper';
import { BrowserContext, BrowserContextOptions } from '../browserContext';
import { Connection, ConnectionEvents, CDPSession } from './Connection';
import { Page } from '../page';
import { Target } from './Target';
import { Protocol } from './protocol';
import { Chromium } from './features/chromium';
import { FrameManager } from './FrameManager';
import * as network from '../network';
import { Permissions } from './features/permissions';
import { Overrides } from './features/overrides';
import { ConnectionTransport } from '../transport';

export class Browser extends EventEmitter {
  private _process: childProcess.ChildProcess;
  _connection: Connection;
  _client: CDPSession;
  private _defaultContext: BrowserContext;
  private _contexts = new Map<string, BrowserContext>();
  _targets = new Map<string, Target>();
  readonly chromium: Chromium;

  static async create(
    browserWSEndpoint: string,
    transport: ConnectionTransport,
    process: childProcess.ChildProcess | null) {
    const connection = new Connection(transport);

    const { browserContextIds } = await connection.rootSession.send('Target.getBrowserContexts');
    const browser = new Browser(browserWSEndpoint, connection, browserContextIds, process);
    await connection.rootSession.send('Target.setDiscoverTargets', { discover: true });
    return browser;
  }

  constructor(
    browserWSEndpoint: string,
    connection: Connection,
    contextIds: string[],
    process: childProcess.ChildProcess | null) {
    super();
    this._connection = connection;
    this._client = connection.rootSession;
    this._process = process;
    this.chromium = new Chromium(this, browserWSEndpoint);

    this._defaultContext = this._createBrowserContext(null, {});
    for (const contextId of contextIds)
      this._contexts.set(contextId, this._createBrowserContext(contextId, {}));

    this._connection.on(ConnectionEvents.Disconnected, () => this.emit(Events.Browser.Disconnected));
    this._client.on('Target.targetCreated', this._targetCreated.bind(this));
    this._client.on('Target.targetDestroyed', this._targetDestroyed.bind(this));
    this._client.on('Target.targetInfoChanged', this._targetInfoChanged.bind(this));
  }

  _createBrowserContext(contextId: string | null, options: BrowserContextOptions): BrowserContext {
    let overrides: Overrides | null = null;
    const context = new BrowserContext({
      pages: async (): Promise<Page[]> => {
        const targets = this._allTargets().filter(target => target.browserContext() === context && target.type() === 'page');
        const pages = await Promise.all(targets.map(target => target.page()));
        return pages.filter(page => !!page);
      },

      newPage: async (): Promise<Page> => {
        const { targetId } = await this._client.send('Target.createTarget', { url: 'about:blank', browserContextId: contextId || undefined });
        const target = this._targets.get(targetId);
        assert(await target._initializedPromise, 'Failed to create target for page');
        const page = await target.page();
        const session = (page._delegate as FrameManager)._client;
        const promises: Promise<any>[] = [ overrides._applyOverrides(page) ];
        if (options.bypassCSP)
          promises.push(session.send('Page.setBypassCSP', { enabled: true }));
        if (options.ignoreHTTPSErrors)
          promises.push(session.send('Security.setIgnoreCertificateErrors', { ignore: true }));
        if (options.viewport)
          promises.push(page._delegate.setViewport(options.viewport));
        if (options.javaScriptEnabled === false)
          promises.push(session.send('Emulation.setScriptExecutionDisabled', { value: true }));
        if (options.userAgent)
          (page._delegate as FrameManager)._networkManager.setUserAgent(options.userAgent);
        if (options.mediaType || options.colorScheme) {
          const features = options.colorScheme ? [{ name: 'prefers-color-scheme', value: options.colorScheme }] : [];
          promises.push(session.send('Emulation.setEmulatedMedia', { media: options.mediaType || '', features }));
        }
        if (options.timezoneId)
          promises.push(emulateTimezone(session, options.timezoneId));
        await Promise.all(promises);
        return page;
      },

      close: async (): Promise<void> => {
        assert(contextId, 'Non-incognito profiles cannot be closed!');
        await this._client.send('Target.disposeBrowserContext', {browserContextId: contextId || undefined});
        this._contexts.delete(contextId);
      },

      cookies: async (): Promise<network.NetworkCookie[]> => {
        const { cookies } = await this._client.send('Storage.getCookies', { browserContextId: contextId || undefined });
        return cookies.map(c => {
          const copy: any = { sameSite: 'None', ...c };
          delete copy.size;
          delete copy.priority;
          return copy as network.NetworkCookie;
        });
      },

      clearCookies: async (): Promise<void> => {
        await this._client.send('Storage.clearCookies', { browserContextId: contextId || undefined });
      },

      setCookies: async (cookies: network.SetNetworkCookieParam[]): Promise<void> => {
        await this._client.send('Storage.setCookies', { cookies, browserContextId: contextId || undefined });
      },
    }, options);
    overrides = new Overrides(context);
    (context as any).permissions = new Permissions(this._client, contextId);
    (context as any).overrides = overrides;
    return context;
  }

  process(): childProcess.ChildProcess | null {
    return this._process;
  }

  async newContext(options: BrowserContextOptions = {}): Promise<BrowserContext> {
    const { browserContextId } = await this._client.send('Target.createBrowserContext');
    const context = this._createBrowserContext(browserContextId, options);
    this._contexts.set(browserContextId, context);
    return context;
  }

  browserContexts(): BrowserContext[] {
    return [this._defaultContext, ...Array.from(this._contexts.values())];
  }

  defaultContext(): BrowserContext {
    return this._defaultContext;
  }

  async _targetCreated(event: Protocol.Target.targetCreatedPayload) {
    const targetInfo = event.targetInfo;
    const {browserContextId} = targetInfo;
    const context = (browserContextId && this._contexts.has(browserContextId)) ? this._contexts.get(browserContextId) : this._defaultContext;

    const target = new Target(this, targetInfo, context, () => this._connection.createSession(targetInfo));
    assert(!this._targets.has(event.targetInfo.targetId), 'Target should not exist before targetCreated');
    this._targets.set(event.targetInfo.targetId, target);

    if (await target._initializedPromise)
      this.chromium.emit(Events.Chromium.TargetCreated, target);
  }

  async _targetDestroyed(event: { targetId: string; }) {
    const target = this._targets.get(event.targetId);
    target._initializedCallback(false);
    this._targets.delete(event.targetId);
    target._didClose();
    if (await target._initializedPromise)
      this.chromium.emit(Events.Chromium.TargetDestroyed, target);
  }

  _targetInfoChanged(event: Protocol.Target.targetInfoChangedPayload) {
    const target = this._targets.get(event.targetInfo.targetId);
    assert(target, 'target should exist before targetInfoChanged');
    const previousURL = target.url();
    const wasInitialized = target._isInitialized;
    target._targetInfoChanged(event.targetInfo);
    if (wasInitialized && previousURL !== target.url())
      this.chromium.emit(Events.Chromium.TargetChanged, target);
  }

  async _closePage(page: Page) {
    await this._client.send('Target.closeTarget', { targetId: Target.fromPage(page)._targetId });
  }

  _allTargets(): Target[] {
    return Array.from(this._targets.values()).filter(target => target._isInitialized);
  }

  async _activatePage(page: Page) {
    await (page._delegate as FrameManager)._client.send('Target.activateTarget', {targetId: Target.fromPage(page)._targetId});
  }

  async _waitForTarget(predicate: (arg0: Target) => boolean, options: { timeout?: number; } | undefined = {}): Promise<Target> {
    const {
      timeout = 30000
    } = options;
    const existingTarget = this._allTargets().find(predicate);
    if (existingTarget)
      return existingTarget;
    let resolve: (target: Target) => void;
    const targetPromise = new Promise<Target>(x => resolve = x);
    this.chromium.on(Events.Chromium.TargetCreated, check);
    this.chromium.on(Events.Chromium.TargetChanged, check);
    try {
      if (!timeout)
        return await targetPromise;
      return await helper.waitWithTimeout(targetPromise, 'target', timeout);
    } finally {
      this.chromium.removeListener(Events.Chromium.TargetCreated, check);
      this.chromium.removeListener(Events.Chromium.TargetChanged, check);
    }

    function check(target: Target) {
      if (predicate(target))
        resolve(target);
    }
  }

  async close() {
    await this._connection.rootSession.send('Browser.close');
    this.disconnect();
  }

  disconnect() {
    this._connection.dispose();
  }

  isConnected(): boolean {
    return !this._connection._closed;
  }
}

async function emulateTimezone(session: CDPSession, timezoneId: string) {
  try {
    await session.send('Emulation.setTimezoneOverride', { timezoneId: timezoneId });
  } catch (exception) {
    if (exception.message.includes('Invalid timezone'))
      throw new Error(`Invalid timezone ID: ${timezoneId}`);
    throw exception;
  }
}
