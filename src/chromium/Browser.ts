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
import { BrowserContext } from './BrowserContext';
import { Connection, ConnectionEvents, CDPSession } from './Connection';
import { Page, Viewport } from './Page';
import { Target } from './Target';
import { TaskQueue } from './TaskQueue';
import { Protocol } from './protocol';
import { Chromium } from './features/chromium';

export class Browser extends EventEmitter {
  private _ignoreHTTPSErrors: boolean;
  private _defaultViewport: Viewport;
  private _process: childProcess.ChildProcess;
  private _screenshotTaskQueue = new TaskQueue();
  private _connection: Connection;
  private _client: CDPSession;
  private _closeCallback: () => Promise<void>;
  private _defaultContext: BrowserContext;
  private _contexts = new Map<string, BrowserContext>();
  _targets = new Map<string, Target>();
  readonly chromium: Chromium;

  static async create(
    connection: Connection,
    contextIds: string[],
    ignoreHTTPSErrors: boolean,
    defaultViewport: Viewport | null,
    process: childProcess.ChildProcess | null,
    closeCallback?: (() => Promise<void>)) {
    const browser = new Browser(connection, contextIds, ignoreHTTPSErrors, defaultViewport, process, closeCallback);
    await connection.rootSession.send('Target.setDiscoverTargets', { discover: true });
    return browser;
  }

  constructor(
    connection: Connection,
    contextIds: string[],
    ignoreHTTPSErrors: boolean,
    defaultViewport: Viewport | null,
    process: childProcess.ChildProcess | null,
    closeCallback?: (() => Promise<void>)) {
    super();
    this._connection = connection;
    this._client = connection.rootSession;
    this._ignoreHTTPSErrors = ignoreHTTPSErrors;
    this._defaultViewport = defaultViewport;
    this._process = process;
    this._closeCallback = closeCallback || (() => Promise.resolve());
    this.chromium = new Chromium(this._client);

    this._defaultContext = new BrowserContext(this._client, this, null);
    for (const contextId of contextIds)
      this._contexts.set(contextId, new BrowserContext(this._client, this, contextId));

    this._connection.on(ConnectionEvents.Disconnected, () => this.emit(Events.Browser.Disconnected));
    this._client.on('Target.targetCreated', this._targetCreated.bind(this));
    this._client.on('Target.targetDestroyed', this._targetDestroyed.bind(this));
    this._client.on('Target.targetInfoChanged', this._targetInfoChanged.bind(this));
  }

  process(): childProcess.ChildProcess | null {
    return this._process;
  }

  async createIncognitoBrowserContext(): Promise<BrowserContext> {
    const {browserContextId} = await this._client.send('Target.createBrowserContext');
    const context = new BrowserContext(this._client, this, browserContextId);
    this._contexts.set(browserContextId, context);
    return context;
  }

  browserContexts(): BrowserContext[] {
    return [this._defaultContext, ...Array.from(this._contexts.values())];
  }

  defaultBrowserContext(): BrowserContext {
    return this._defaultContext;
  }

  async _disposeContext(contextId: string | null) {
    await this._client.send('Target.disposeBrowserContext', {browserContextId: contextId || undefined});
    this._contexts.delete(contextId);
  }

  async _targetCreated(event: Protocol.Target.targetCreatedPayload) {
    const targetInfo = event.targetInfo;
    const {browserContextId} = targetInfo;
    const context = (browserContextId && this._contexts.has(browserContextId)) ? this._contexts.get(browserContextId) : this._defaultContext;

    const target = new Target(targetInfo, context, () => this._connection.createSession(targetInfo), this._ignoreHTTPSErrors, this._defaultViewport, this._screenshotTaskQueue);
    assert(!this._targets.has(event.targetInfo.targetId), 'Target should not exist before targetCreated');
    this._targets.set(event.targetInfo.targetId, target);

    if (await target._initializedPromise) {
      this.emit(Events.Browser.TargetCreated, target);
      context.emit(Events.BrowserContext.TargetCreated, target);
    }
  }

  async _targetDestroyed(event: { targetId: string; }) {
    const target = this._targets.get(event.targetId);
    target._initializedCallback(false);
    this._targets.delete(event.targetId);
    target._closedCallback();
    if (await target._initializedPromise) {
      this.emit(Events.Browser.TargetDestroyed, target);
      target.browserContext().emit(Events.BrowserContext.TargetDestroyed, target);
    }
  }

  _targetInfoChanged(event: Protocol.Target.targetInfoChangedPayload) {
    const target = this._targets.get(event.targetInfo.targetId);
    assert(target, 'target should exist before targetInfoChanged');
    const previousURL = target.url();
    const wasInitialized = target._isInitialized;
    target._targetInfoChanged(event.targetInfo);
    if (wasInitialized && previousURL !== target.url()) {
      this.emit(Events.Browser.TargetChanged, target);
      target.browserContext().emit(Events.BrowserContext.TargetChanged, target);
    }
  }

  wsEndpoint(): string {
    return this._connection.url();
  }

  async newPage(): Promise<Page> {
    return this._defaultContext.newPage();
  }

  async _createPageInContext(contextId: string | null): Promise<Page> {
    const { targetId } = await this._client.send('Target.createTarget', { url: 'about:blank', browserContextId: contextId || undefined });
    const target = await this._targets.get(targetId);
    assert(await target._initializedPromise, 'Failed to create target for page');
    const page = await target.page();
    return page;
  }

  async _closeTarget(target: Target) {
    await this._client.send('Target.closeTarget', { targetId: target._targetId });
  }

  targets(): Target[] {
    return Array.from(this._targets.values()).filter(target => target._isInitialized);
  }

  target(): Target {
    return this.targets().find(target => target.type() === 'browser');
  }

  async waitForTarget(predicate: (arg0: Target) => boolean, options: { timeout?: number; } | undefined = {}): Promise<Target> {
    const {
      timeout = 30000
    } = options;
    const existingTarget = this.targets().find(predicate);
    if (existingTarget)
      return existingTarget;
    let resolve;
    const targetPromise = new Promise<Target>(x => resolve = x);
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

    function check(target: Target) {
      if (predicate(target))
        resolve(target);
    }
  }

  async pages(): Promise<Page[]> {
    const contextPages = await Promise.all(this.browserContexts().map(context => context.pages()));
    // Flatten array.
    return contextPages.reduce((acc, x) => acc.concat(x), []);
  }

  async version(): Promise<string> {
    const version = await this._getVersion();
    return version.product;
  }

  async userAgent(): Promise<string> {
    const version = await this._getVersion();
    return version.userAgent;
  }

  async close() {
    await this._closeCallback.call(null);
    this.disconnect();
  }

  disconnect() {
    this._connection.dispose();
  }

  isConnected(): boolean {
    return !this._connection._closed;
  }

  _getVersion(): Promise<any> {
    return this._client.send('Browser.getVersion');
  }
}
