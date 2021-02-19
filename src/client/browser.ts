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

import * as channels from '../protocol/channels';
import { BrowserContext, prepareBrowserContextParams } from './browserContext';
import { Page } from './page';
import { ChannelOwner } from './channelOwner';
import { Events } from './events';
import { BrowserContextOptions } from './types';
import { isSafeCloseError } from '../utils/errors';
import * as api from '../../types/types';

export class Browser extends ChannelOwner<channels.BrowserChannel, channels.BrowserInitializer> implements api.Browser {
  readonly _contexts = new Set<BrowserContext>();
  private _isConnected = true;
  private _closedPromise: Promise<void>;
  _isRemote = false;

  static from(browser: channels.BrowserChannel): Browser {
    return (browser as any)._object;
  }

  static fromNullable(browser: channels.BrowserChannel | null): Browser | null {
    return browser ? Browser.from(browser) : null;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.BrowserInitializer) {
    super(parent, type, guid, initializer);
    this._channel.on('close', () => this._didClose());
    this._closedPromise = new Promise(f => this.once(Events.Browser.Disconnected, f));
  }

  async newContext(options: BrowserContextOptions = {}): Promise<BrowserContext> {
    return this._wrapApiCall('browser.newContext', async (channel: channels.BrowserChannel) => {
      if (this._isRemote && options._traceDir)
        throw new Error(`"_traceDir" is not supported in connected browser`);
      const contextOptions = await prepareBrowserContextParams(options);
      const context = BrowserContext.from((await channel.newContext(contextOptions)).context);
      context._options = contextOptions;
      this._contexts.add(context);
      context._logger = options.logger || this._logger;
      return context;
    });
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

  async close(): Promise<void> {
    try {
      await this._wrapApiCall('browser.close', async (channel: channels.BrowserChannel) => {
        await channel.close();
        await this._closedPromise;
      });
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
