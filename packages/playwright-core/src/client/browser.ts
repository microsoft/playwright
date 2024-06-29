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

import fs from 'fs';
import type * as channels from '@protocol/channels';
import { BrowserContext, prepareBrowserContextParams } from './browserContext';
import type { Page } from './page';
import { ChannelOwner } from './channelOwner';
import { Events } from './events';
import type { LaunchOptions, BrowserContextOptions, HeadersArray } from './types';
import { isTargetClosedError } from './errors';
import type * as api from '../../types/types';
import { CDPSession } from './cdpSession';
import type { BrowserType } from './browserType';
import { Artifact } from './artifact';
import { mkdirIfNeeded } from '../utils';

export class Browser extends ChannelOwner<channels.BrowserChannel> implements api.Browser {
  readonly _contexts = new Set<BrowserContext>();
  private _isConnected = true;
  private _closedPromise: Promise<void>;
  _shouldCloseConnectionOnClose = false;
  _browserType!: BrowserType;
  _options: LaunchOptions = {};
  readonly _name: string;
  private _path: string | undefined;

  // Used from @playwright/test fixtures.
  _connectHeaders?: HeadersArray;
  _closeReason: string | undefined;

  static from(browser: channels.BrowserChannel): Browser {
    return (browser as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.BrowserInitializer) {
    super(parent, type, guid, initializer);
    this._name = initializer.name;
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
    return await this._wrapApiCall(async () => {
      for (const context of this._contexts) {
        await this._browserType._willCloseContext(context);
        for (const page of context.pages())
          page._onClose();
        context._onClose();
      }
      return await this._innerNewContext(options, true);
    }, true);
  }

  async _stopPendingOperations(reason: string) {
    return await this._wrapApiCall(async () => {
      await this._channel.stopPendingOperations({ reason });
    }, true);
  }

  async _innerNewContext(options: BrowserContextOptions = {}, forReuse: boolean): Promise<BrowserContext> {
    options = { ...this._browserType._defaultContextOptions, ...options };
    const contextOptions = await prepareBrowserContextParams(options);
    const response = forReuse ? await this._channel.newContextForReuse(contextOptions) : await this._channel.newContext(contextOptions);
    const context = BrowserContext.from(response.context);
    await this._browserType._didCreateContext(context, contextOptions, this._options, options.logger || this._logger);
    return context;
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
    });
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
      await mkdirIfNeeded(this._path);
      await fs.promises.writeFile(this._path, buffer);
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
