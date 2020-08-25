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

import { Page } from './page';
import * as channels from '../protocol/channels';
import { ChannelOwner } from './channelOwner';
import { CDPSession } from './cdpSession';
import { Events } from './events';
import { Worker } from './worker';
import { BrowserContext } from './browserContext';

export class ChromiumBrowserContext extends BrowserContext {
  _backgroundPages = new Set<Page>();
  _serviceWorkers = new Set<Worker>();

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.BrowserContextInitializer) {
    super(parent, type, guid, initializer, 'chromium');
    this._channel.on('crBackgroundPage', ({ page }) => {
      const backgroundPage = Page.from(page);
      this._backgroundPages.add(backgroundPage);
      this.emit(Events.ChromiumBrowserContext.BackgroundPage, backgroundPage);
    });
    this._channel.on('crServiceWorker', ({worker}) => {
      const serviceWorker = Worker.from(worker);
      serviceWorker._context = this;
      this._serviceWorkers.add(serviceWorker);
      this.emit(Events.ChromiumBrowserContext.ServiceWorker, serviceWorker);
    });
  }

  backgroundPages(): Page[] {
    return [...this._backgroundPages];
  }

  serviceWorkers(): Worker[] {
    return [...this._serviceWorkers];
  }

  async newCDPSession(page: Page): Promise<CDPSession> {
    return this._wrapApiCall('chromiumBrowserContext.newCDPSession', async () => {
      const result = await this._channel.crNewCDPSession({ page: page._channel });
      return CDPSession.from(result.session);
    });
  }
}
