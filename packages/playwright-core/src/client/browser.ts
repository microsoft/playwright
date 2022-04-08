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

import type * as channels from '../protocol/channels';
import { BrowserContext, prepareBrowserContextParams } from './browserContext';
import type { Page } from './page';
import { ChannelOwner } from './channelOwner';
import { Events } from './events';
import type { BrowserContextOptions } from './types';
import { isSafeCloseError, kBrowserClosedError } from '../common/errors';
import type * as api from '../../types/types';
import { CDPSession } from './cdpSession';
import type { BrowserType } from './browserType';
import type { LocalUtils } from './localUtils';

export class Browser extends ChannelOwner<channels.BrowserChannel> implements api.Browser {
  readonly _contexts = new Set<BrowserContext>();
  private _isConnected = true;
  private _closedPromise: Promise<void>;
  _shouldCloseConnectionOnClose = false;
  private _browserType!: BrowserType;
  readonly _name: string;
  _localUtils!: LocalUtils;

  static from(browser: channels.BrowserChannel): Browser {
    return (browser as any)._object;
  }

  static fromNullable(browser: channels.BrowserChannel | null): Browser | null {
    return browser ? Browser.from(browser) : null;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.BrowserInitializer) {
    super(parent, type, guid, initializer);
    this._name = initializer.name;
    this._channel.on('close', () => this._didClose());
    this._closedPromise = new Promise(f => this.once(Events.Browser.Disconnected, f));
  }

  _setBrowserType(browserType: BrowserType) {
    this._browserType = browserType;
    for (const context of this._contexts)
      context._setBrowserType(browserType);
  }

  async newContext(options: BrowserContextOptions = {}): Promise<BrowserContext> {
    options = { ...this._browserType._defaultContextOptions, ...options };
    const contextOptions = await prepareBrowserContextParams(options);
    const context = BrowserContext.from((await this._channel.newContext(contextOptions)).context);
    context._options = contextOptions;
    this._contexts.add(context);
    context._logger = options.logger || this._logger;
    context._setBrowserType(this._browserType);
    context.tracing._localUtils = this._localUtils;
    await this._browserType._onDidCreateContext?.(context);
    return context;
  }

  contexts(): BrowserContext[] {
    return [...this._contexts];
  }

  version(): string {
    return this._initializer.version;
  }

  async newPage(options: BrowserContextOptions = {}): Promise<Page> {
    const context = await this.newContext(options);
    const page = await context.newPage();
    page._ownedContext = context;
    context._ownerPage = page;
    return page;
  }

  isConnected(): boolean {
    return this._isConnected;
  }

  async newBrowserCDPSession(): Promise<api.CDPSession> {
    return CDPSession.from((await this._channel.newBrowserCDPSession()).session);
  }

  async startTracing(page?: Page, options: { path?: string; screenshots?: boolean; categories?: string[]; } = {}) {
    await this._channel.startTracing({ ...options, page: page ? page._channel : undefined });
  }

  async stopTracing(): Promise<Buffer> {
    return Buffer.from((await this._channel.stopTracing()).binary, 'base64');
  }

  async close(): Promise<void> {
    try {
      if (this._shouldCloseConnectionOnClose)
        this._connection.close(kBrowserClosedError);
      else
        await this._channel.close();
      await this._closedPromise;
    } catch (e) {
      if (isSafeCloseError(e))
        return;
      throw e;
    }
  }

  _didClose() {
    this._isConnected = false;
    this.emit(Events.Browser.Disconnected, this);
  }
}
