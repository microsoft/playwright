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
import { Events } from './events';
import { Events as CommonEvents } from '../events';
import { assert, helper } from '../helper';
import { BrowserContext, BrowserContextOptions } from '../browserContext';
import { CRConnection, ConnectionEvents, CRSession } from './crConnection';
import { Page } from '../page';
import { CRTarget } from './crTarget';
import { Protocol } from './protocol';
import { CRFrameManager } from './crFrameManager';
import * as browser from '../browser';
import * as network from '../network';
import { CRPermissions } from './features/crPermissions';
import { CROverrides } from './features/crOverrides';
import { Worker } from './features/crWorkers';
import { ConnectionTransport } from '../transport';
import { readProtocolStream } from './protocolHelper';

export class CRBrowser extends EventEmitter implements browser.Browser {
  _connection: CRConnection;
  _client: CRSession;
  private _defaultContext: BrowserContext;
  private _contexts = new Map<string, BrowserContext>();
  _targets = new Map<string, CRTarget>();

  private _tracingRecording = false;
  private _tracingPath = '';
  private _tracingClient: CRSession | undefined;

  static async create(
    transport: ConnectionTransport) {
    const connection = new CRConnection(transport);

    const { browserContextIds } = await connection.rootSession.send('Target.getBrowserContexts');
    const browser = new CRBrowser(connection, browserContextIds);
    await connection.rootSession.send('Target.setDiscoverTargets', { discover: true });
    await browser.waitForTarget(t => t.type() === 'page');
    return browser;
  }

  constructor(connection: CRConnection, contextIds: string[]) {
    super();
    this._connection = connection;
    this._client = connection.rootSession;

    this._defaultContext = this._createBrowserContext(null, {});
    for (const contextId of contextIds)
      this._contexts.set(contextId, this._createBrowserContext(contextId, {}));

    this._connection.on(ConnectionEvents.Disconnected, () => this.emit(CommonEvents.Browser.Disconnected));
    this._client.on('Target.targetCreated', this._targetCreated.bind(this));
    this._client.on('Target.targetDestroyed', this._targetDestroyed.bind(this));
    this._client.on('Target.targetInfoChanged', this._targetInfoChanged.bind(this));
  }

  _createBrowserContext(contextId: string | null, options: BrowserContextOptions): BrowserContext {
    let overrides: CROverrides | null = null;
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
        const session = (page._delegate as CRFrameManager)._client;
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
          (page._delegate as CRFrameManager)._networkManager.setUserAgent(options.userAgent);
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
    overrides = new CROverrides(context);
    (context as any).permissions = new CRPermissions(this._client, contextId);
    (context as any).overrides = overrides;
    return context;
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

    const target = new CRTarget(this, targetInfo, context, () => this._connection.createSession(targetInfo));
    assert(!this._targets.has(event.targetInfo.targetId), 'Target should not exist before targetCreated');
    this._targets.set(event.targetInfo.targetId, target);

    if (target._isInitialized || await target._initializedPromise)
      this.emit(Events.Browser.TargetCreated, target);
  }

  async _targetDestroyed(event: { targetId: string; }) {
    const target = this._targets.get(event.targetId);
    target._initializedCallback(false);
    this._targets.delete(event.targetId);
    target._didClose();
    if (await target._initializedPromise)
      this.emit(Events.Browser.TargetDestroyed, target);
  }

  _targetInfoChanged(event: Protocol.Target.targetInfoChangedPayload) {
    const target = this._targets.get(event.targetInfo.targetId);
    assert(target, 'target should exist before targetInfoChanged');
    const previousURL = target.url();
    const wasInitialized = target._isInitialized;
    target._targetInfoChanged(event.targetInfo);
    if (wasInitialized && previousURL !== target.url())
      this.emit(Events.Browser.TargetChanged, target);
  }

  async _closePage(page: Page) {
    await this._client.send('Target.closeTarget', { targetId: CRTarget.fromPage(page)._targetId });
  }

  _allTargets(): CRTarget[] {
    return Array.from(this._targets.values()).filter(target => target._isInitialized);
  }

  async _activatePage(page: Page) {
    await (page._delegate as CRFrameManager)._client.send('Target.activateTarget', {targetId: CRTarget.fromPage(page)._targetId});
  }

  async waitForTarget(predicate: (arg0: CRTarget) => boolean, options: { timeout?: number; } | undefined = {}): Promise<CRTarget> {
    const {
      timeout = 30000
    } = options;
    const existingTarget = this._allTargets().find(predicate);
    if (existingTarget)
      return existingTarget;
    let resolve: (target: CRTarget) => void;
    const targetPromise = new Promise<CRTarget>(x => resolve = x);
    this.on(Events.Browser.TargetCreated, check);
    this.on(Events.Browser.TargetChanged, check);
    try {
      if (!timeout)
        return await targetPromise;
      return await helper.waitWithTimeout(targetPromise, 'target', timeout);
    } finally {
      this.removeListener(Events.Browser.TargetCreated, check);
      this.removeListener(Events.Browser.TargetChanged, check);
    }

    function check(target: CRTarget) {
      if (predicate(target))
        resolve(target);
    }
  }

  async close() {
    await this._connection.rootSession.send('Browser.close');
    this.disconnect();
  }

  browserTarget(): CRTarget {
    return [...this._targets.values()].find(t => t.type() === 'browser');
  }

  serviceWorker(target: CRTarget): Promise<Worker | null> {
    return target._worker();
  }

  async startTracing(page: Page | undefined, options: { path?: string; screenshots?: boolean; categories?: string[]; } = {}) {
    assert(!this._tracingRecording, 'Cannot start recording trace while already recording trace.');
    this._tracingClient = page ? (page._delegate as CRFrameManager)._client : this._client;

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
    let fulfill: (buffer: Buffer) => void;
    const contentPromise = new Promise<Buffer>(x => fulfill = x);
    this._tracingClient.once('Tracing.tracingComplete', event => {
      readProtocolStream(this._tracingClient, event.stream, this._tracingPath).then(fulfill);
    });
    await this._tracingClient.send('Tracing.end');
    this._tracingRecording = false;
    return contentPromise;
  }

  targets(context?: BrowserContext): CRTarget[] {
    const targets = this._allTargets();
    return context ? targets.filter(t => t.browserContext() === context) : targets;
  }

  pageTarget(page: Page): CRTarget {
    return CRTarget.fromPage(page);
  }

  disconnect() {
    this._connection.dispose();
  }

  isConnected(): boolean {
    return !this._connection._closed;
  }
}

async function emulateTimezone(session: CRSession, timezoneId: string) {
  try {
    await session.send('Emulation.setTimezoneOverride', { timezoneId: timezoneId });
  } catch (exception) {
    if (exception.message.includes('Invalid timezone'))
      throw new Error(`Invalid timezone ID: ${timezoneId}`);
    throw exception;
  }
}
