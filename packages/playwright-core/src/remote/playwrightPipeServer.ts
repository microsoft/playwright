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

import net from 'net';
import fs from 'fs';

import { PlaywrightConnection } from './playwrightConnection';
import { SocketServerTransport } from './serverTransport';
import { debugLogger } from '../server/utils/debugLogger';
import { Browser } from '../server/browser';
import { Semaphore } from '../utils';

import type { PlaywrightInitializeResult } from './playwrightConnection';

export class PlaywrightPipeServer {
  private _server: net.Server | undefined;
  private _connections = new Set<PlaywrightConnection>();
  private _connectionId = 0;
  private _browser: Browser;

  constructor(browser: Browser) {
    this._browser = browser;
    browser.on(Browser.Events.Disconnected, () => this.close());
  }

  async listen(pipeName: string) {
    // Clean up stale socket file on Unix (not needed for Windows named pipes).
    if (!pipeName.startsWith('\\\\.\\pipe\\')) {
      try {
        fs.unlinkSync(pipeName);
      } catch {
      }
    }

    this._server = net.createServer(socket => {
      const id = String(++this._connectionId);
      debugLogger.log('server', `[${id}] pipe client connected`);
      const transport = new SocketServerTransport(socket);
      const connection = new PlaywrightConnection(
          new Semaphore(1),
          transport,
          false,
          this._browser.attribution.playwright,
          () => this._initPreLaunchedBrowserMode(id),
          id,
      );
      this._connections.add(connection);
      transport.on('close', () => this._connections.delete(connection));
    });

    await new Promise<void>((resolve, reject) => {
      this._server!.listen(pipeName, () => resolve());
      this._server!.on('error', reject);
    });

    debugLogger.log('server', `Pipe server listening at ${pipeName}`);
  }

  private async _initPreLaunchedBrowserMode(id: string): Promise<PlaywrightInitializeResult> {
    debugLogger.log('server', `[${id}] engaged pre-launched (browser) pipe mode`);
    return {
      preLaunchedBrowser: this._browser,
      sharedBrowser: true,
      denyLaunch: true,
    };
  }

  async close() {
    if (!this._server)
      return;
    debugLogger.log('server', 'closing pipe server');
    for (const connection of this._connections)
      await connection.close({ code: 1001, reason: 'Server closing' });
    this._connections.clear();
    await new Promise<void>(f => this._server!.close(() => f()));
    this._server = undefined;
    debugLogger.log('server', 'closed pipe server');
  }
}
