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
import { BrowserChannel, BrowserInitializer } from '../channels';
import { BrowserContext } from './browserContext';
import { Page } from './page';
import { ChannelOwner } from './channelOwner';
import { Connection } from '../connection';

export class Browser extends ChannelOwner<BrowserChannel, BrowserInitializer> {
  readonly _contexts = new Set<BrowserContext>();
  private _isConnected = true;


  static from(browser: BrowserChannel): Browser {
    return browser._object;
  }

  static fromNullable(browser: BrowserChannel | null): Browser | null {
    return browser ? Browser.from(browser) : null;
  }

  constructor(connection: Connection, channel: BrowserChannel, initializer: BrowserInitializer) {
    super(connection, channel, initializer);
  }

  async newContext(options?: types.BrowserContextOptions): Promise<BrowserContext> {
    const context = BrowserContext.from(await this._channel.newContext({ options }));
    this._contexts.add(context);
    context._browser = this;
    return context;
  }

  contexts(): BrowserContext[] {
    return [...this._contexts];
  }

  async newPage(options?: types.BrowserContextOptions): Promise<Page> {
    const context = await this.newContext(options);
    const page = await context.newPage();
    page._ownedContext = context;
    return page;
  }

  isConnected(): boolean {
    return this._isConnected;
  }

  async close(): Promise<void> {
    await this._channel.close();
  }
}
