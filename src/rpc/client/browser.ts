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

import * as types from '../../types';
import { BrowserChannel, BrowserInitializer, BrowserContextOptions } from '../channels';
import { BrowserContext } from './browserContext';
import { Page } from './page';
import { ChannelOwner } from './channelOwner';
import { Events } from '../../events';
import { LoggerSink } from '../../loggerSink';
import { BrowserType } from './browserType';
import { headersObjectToArray } from '../serializers';

export class Browser extends ChannelOwner<BrowserChannel, BrowserInitializer> {
  readonly _contexts = new Set<BrowserContext>();
  private _isConnected = true;
  private _isClosedOrClosing = false;
  private _closedPromise: Promise<void>;
  readonly _browserType: BrowserType;

  static from(browser: BrowserChannel): Browser {
    return (browser as any)._object;
  }

  static fromNullable(browser: BrowserChannel | null): Browser | null {
    return browser ? Browser.from(browser) : null;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: BrowserInitializer) {
    super(parent, type, guid, initializer, true);
    this._browserType = parent as BrowserType;
    this._channel.on('close', () => {
      this._isConnected = false;
      this.emit(Events.Browser.Disconnected);
      this._isClosedOrClosing = true;
      this._dispose();
    });
    this._closedPromise = new Promise(f => this.once(Events.Browser.Disconnected, f));
  }

  async newContext(options: types.BrowserContextOptions & { logger?: LoggerSink } = {}): Promise<BrowserContext> {
    const logger = options.logger;
    options = { ...options, logger: undefined };
    return this._wrapApiCall('browser.newContext', async () => {
      const contextOptions: BrowserContextOptions = {
        ...options,
        extraHTTPHeaders: options.extraHTTPHeaders ? headersObjectToArray(options.extraHTTPHeaders) : undefined,
      };
      const context = BrowserContext.from((await this._channel.newContext(contextOptions)).context);
      this._contexts.add(context);
      context._logger = logger || this._logger;
      return context;
    });
  }

  contexts(): BrowserContext[] {
    return [...this._contexts];
  }

  async newPage(options: types.BrowserContextOptions & { logger?: LoggerSink } = {}): Promise<Page> {
    const context = await this.newContext(options);
    const page = await context.newPage();
    page._ownedContext = context;
    context._ownerPage = page;
    return page;
  }

  isConnected(): boolean {
    return this._isConnected;
  }

  async close(): Promise<void> {
    return this._wrapApiCall('browser.close', async () => {
      if (!this._isClosedOrClosing) {
        this._isClosedOrClosing = true;
        await this._channel.close();
      }
      await this._closedPromise;
    });
  }
}
