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

import { PlaywrightConnection } from './playwrightConnection';
import { WebSocketServerTransport } from './serverTransport';
import { debugLogger } from '../server/utils/debugLogger';
import { Browser } from '../server/browser';
import { Semaphore } from '../utils';
import { WSServer } from '../server/utils/wsServer';

import type { PlaywrightInitializeResult } from './playwrightConnection';

export class PlaywrightWebSocketServer {
  private _wsServer: WSServer;
  private _browser: Browser;

  constructor(browser: Browser, path: string) {
    this._browser = browser;
    browser.on(Browser.Events.Disconnected, () => this.close());

    const semaphore = new Semaphore(Infinity);
    this._wsServer = new WSServer({
      onRequest: (request, response) => {
        response.end('Running');
      },
      onUpgrade: () => undefined,
      onHeaders: () => {},
      onConnection: (request, url, ws, id) => {
        debugLogger.log('server', `[${id}] ws client connected`);
        return new PlaywrightConnection(
            semaphore,
            new WebSocketServerTransport(ws),
            false,
            this._browser.attribution.playwright,
            () => this._initPreLaunchedBrowserMode(id),
            id,
        );
      },
    });
  }

  private async _initPreLaunchedBrowserMode(id: string): Promise<PlaywrightInitializeResult> {
    debugLogger.log('server', `[${id}] engaged pre-launched (browser) ws mode`);
    return {
      preLaunchedBrowser: this._browser,
      sharedBrowser: true,
      denyLaunch: true,
    };
  }

  async listen(port: number = 0, hostname?: string, path?: string): Promise<string> {
    return await this._wsServer.listen(port, hostname, path || '/');
  }

  async close() {
    await this._wsServer.close();
  }
}
