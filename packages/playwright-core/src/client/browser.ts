/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Artifact } from './artifact';
import { BrowserContext, prepareBrowserContextParams } from './browserContext';
import { CDPSession } from './cdpSession';
import { ChannelOwner } from './channelOwner';
import { isTargetClosedError } from './errors';
import { Events } from './events';
import { mkdirIfNeeded } from './fileUtils';

import type { BrowserType } from './browserType';
import type { Page } from './page';
import type { BrowserContextOptions, LaunchOptions, Logger } from './types';
import type * as api from '../../types/types';
import type * as channels from '@protocol/channels';

export class Browser extends ChannelOwner<channels.BrowserChannel> implements api.Browser {
  readonly _contexts = new Set<BrowserContext>();
  private _isConnected = true;
  private _closedPromise: Promise<void>;
  _shouldCloseConnectionOnClose = false;
  _browserType!: BrowserType;
  _options: LaunchOptions = {};
  readonly _name: string;
  private _path: string | undefined;
  _closeReason: string | undefined;

  static from(browser: channels.BrowserChannel): Browser {
    return (browser as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.BrowserInitializer) {
    super(parent, type, guid, initializer);
    this._name = initializer.name;
    this._channel.on('context', ({ context }) => this._didCreateContext(BrowserContext.from(context)));
    this._channel.on('close', () => this._didClose());
    this._closedPromise = new Promise(f => this.once(Events.Browser.Disconnected, f));
  }

  browserType(): BrowserType {
    return this._browserType;
  }

  async newContext(options: BrowserContextOptions = {}): Promise<BrowserContext> {
    return await this._innerNewContext(options, false);
  }

  async _newContextForReuse(options: BrowserContextOptions = {}): Promise<BrowserContext> {
    return await this._wrapApiCall(() => this._innerNewContext(options, true), { internal: true });
  }

  async _disconnectFromReusedContext(reason: string) {
    return await this._wrapApiCall(async () => {
      const context = [...this._contexts].find(context => context._forReuse);
      if (!context)
        return;
      await this._instrumentation.runBeforeCloseBrowserContext(context);
      for (const page of context.pages())
        page._onClose();
      context._onClose();
      await this._channel.disconnectFromReusedContext({ reason });
    }, { internal: true });
  }

  async _innerNewContext(options: BrowserContextOptions = {}, forReuse: boolean): Promise<BrowserContext> {
    options = this._browserType._playwright.selectors._withSelectorOptions({
      ...this._browserType._playwright._defaultContextOptions,
      ...options,
    });
    const contextOptions = await prepareBrowserContextParams(this._platform, options);
    const response = forReuse ? await this._channel.newContextForReuse(contextOptions) : await this._channel.newContext(contextOptions);
    const context = BrowserContext.from(response.context);
    if (forReuse)
      context._forReuse = true;
    if (options.logger)
      context._logger = options.logger;
    await context._initializeHarFromOptions(options.recordHar);
    await this._instrumentation.runAfterCreateBrowserContext(context);
    return context;
  }

  _connectToBrowserType(browserType: BrowserType, browserOptions: LaunchOptions, logger: Logger | undefined) {
    // Note: when using connect(), `browserType` is different from `this._parent`.
    // This is why browser type is not wired up in the constructor,
    // and instead this separate method is called later on.
    this._browserType = browserType;
    this._options = browserOptions;
    this._logger = logger;
    for (const context of this._contexts)
      this._setupBrowserContext(context);
  }

  private _didCreateContext(context: BrowserContext) {
    context._browser = this;
    this._contexts.add(context);
    // Note: when connecting to a browser, initial contexts arrive before `browserType` is set,
    // and will be configured later in `_connectToBrowserType`.
    if (this._browserType)
      this._setupBrowserContext(context);
  }

  private _setupBrowserContext(context: BrowserContext) {
    context._logger = this._logger;
    context.tracing._tracesDir = this._options.tracesDir;
    this._browserType._contexts.add(context);
    this._browserType._playwright.selectors._contextsForSelectors.add(context);
    context.setDefaultTimeout(this._browserType._playwright._defaultContextTimeout);
    context.setDefaultNavigationTimeout(this._browserType._playwright._defaultContextNavigationTimeout);
  }

  contexts(): BrowserContext[] {
    return [...this._contexts];
  }

  version(): string {
    return this._initializer.version;
  }

  async newPage(options: BrowserContextOptions = {}): Promise<Page> {
    return await this._wrapApiCall(async () => {
      const context = await this.newContext(options);
      const page = await context.newPage();
      page._ownedContext = context;
      context._ownerPage = page;
      return page;
    }, { title: 'Create page' });
  }

  isConnected(): boolean {
    return this._isConnected;
  }

  async newBrowserCDPSession(): Promise<api.CDPSession> {
    return CDPSession.from((await this._channel.newBrowserCDPSession()).session);
  }

  async startTracing(page?: Page, options: { path?: string; screenshots?: boolean; categories?: string[]; } = {}) {
    this._path = options.path;
    await this._channel.startTracing({ ...options, page: page ? page._channel : undefined });
  }

  async stopTracing(): Promise<Buffer> {
    const artifact = Artifact.from((await this._channel.stopTracing()).artifact);
    const buffer = await artifact.readIntoBuffer();
    await artifact.delete();
    if (this._path) {
      await mkdirIfNeeded(this._platform, this._path);
      await this._platform.fs().promises.writeFile(this._path, buffer);
      this._path = undefined;
    }
    return buffer;
  }

  async [Symbol.asyncDispose]() {
    await this.close();
  }

  async close(options: { reason?: string } = {}): Promise<void> {
    this._closeReason = options.reason;
    try {
      if (this._shouldCloseConnectionOnClose)
        this._connection.close();
      else
        await this._channel.close(options);
      await this._closedPromise;
    } catch (e) {
      if (isTargetClosedError(e))
        return;
      throw e;
    }
  }

  _didClose() {
    this._isConnected = false;
    this.emit(Events.Browser.Disconnected, this);
  }
}
