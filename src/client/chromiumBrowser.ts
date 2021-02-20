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
import { Page } from './page';
import { CDPSession } from './cdpSession';
import { Browser } from './browser';
import * as api from '../../types/types';
import { ChromiumBrowserContext } from './chromiumBrowserContext';
import { BrowserContextOptions } from './types';

export class ChromiumBrowser extends Browser implements api.ChromiumBrowser {
  contexts(): ChromiumBrowserContext[] {
    return super.contexts() as ChromiumBrowserContext[];
  }

  newContext(options?: BrowserContextOptions): Promise<ChromiumBrowserContext> {
    return super.newContext(options) as Promise<ChromiumBrowserContext>;
  }

  async newBrowserCDPSession(): Promise<CDPSession> {
    return this._wrapApiCall('chromiumBrowser.newBrowserCDPSession', async (channel: channels.BrowserChannel) => {
      return CDPSession.from((await channel.crNewBrowserCDPSession()).session);
    });
  }

  async startTracing(page?: Page, options: { path?: string; screenshots?: boolean; categories?: string[]; } = {}) {
    return this._wrapApiCall('chromiumBrowser.startTracing', async (channel: channels.BrowserChannel) => {
      await channel.crStartTracing({ ...options, page: page ? page._channel : undefined });
    });
  }

  async stopTracing(): Promise<Buffer> {
    return this._wrapApiCall('chromiumBrowser.stopTracing', async (channel: channels.BrowserChannel) => {
      return Buffer.from((await channel.crStopTracing()).binary, 'base64');
    });
  }
}
