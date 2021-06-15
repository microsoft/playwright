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

import debug from 'debug';
import * as http from 'http';
import * as ws from 'ws';
import { DispatcherConnection, DispatcherScope } from '../dispatchers/dispatcher';
import { PlaywrightDispatcher } from '../dispatchers/playwrightDispatcher';
import { createPlaywright } from '../server/playwright';
import { gracefullyCloseAll } from '../server/processLauncher';

const debugLog = debug('pw:server');

export interface PlaywrightServerDelegate {
  path: string;
  allowMultipleClients: boolean;
  onConnect(rootScope: DispatcherScope, forceDisconnect: () => void): Promise<() => any>;
  onClose: () => any;
}

export type PlaywrightServerOptions = {
  acceptForwardedPorts?: boolean
};

export class PlaywrightServer {
  private _wsServer: ws.Server | undefined;
  private _clientsCount = 0;
  private _delegate: PlaywrightServerDelegate;

  static async startDefault({ acceptForwardedPorts }: PlaywrightServerOptions = {}): Promise<PlaywrightServer> {
    const cleanup = async () => {
      await gracefullyCloseAll().catch(e => {});
    };
    const delegate: PlaywrightServerDelegate = {
      path: '/ws',
      allowMultipleClients: false,
      onClose: cleanup,
      onConnect: async (rootScope: DispatcherScope) => {
        const playwright = createPlaywright();
        if (acceptForwardedPorts)
          await playwright._enablePortForwarding();
        new PlaywrightDispatcher(rootScope, playwright);
        return () => {
          cleanup();
          playwright._disablePortForwarding();
          playwright.selectors.unregisterAll();
        };
      },
    };
    return new PlaywrightServer(delegate);
  }

  constructor(delegate: PlaywrightServerDelegate) {
    this._delegate = delegate;
  }

  async listen(port: number = 0): Promise<string> {
    const server = http.createServer((request, response) => {
      response.end('Running');
    });
    server.on('error', error => debugLog(error));

    const path = this._delegate.path;
    const wsEndpoint = await new Promise<string>((resolve, reject) => {
      server.listen(port, () => {
        const address = server.address();
        const wsEndpoint = typeof address === 'string' ? `${address}${path}` : `ws://127.0.0.1:${address.port}${path}`;
        resolve(wsEndpoint);
      }).on('error', reject);
    });

    debugLog('Listening at ' + wsEndpoint);

    this._wsServer = new ws.Server({ server, path });
    this._wsServer.on('connection', async socket => {
      if (this._clientsCount && !this._delegate.allowMultipleClients) {
        socket.close();
        return;
      }
      this._clientsCount++;
      debugLog('Incoming connection');

      const connection = new DispatcherConnection();
      connection.onmessage = message => {
        if (socket.readyState !== ws.CLOSING)
          socket.send(JSON.stringify(message));
      };
      socket.on('message', (message: string) => {
        connection.dispatch(JSON.parse(Buffer.from(message).toString()));
      });

      const forceDisconnect = () => socket.close();
      const scope = connection.rootDispatcher();
      let onDisconnect = () => {};
      const disconnected = () => {
        this._clientsCount--;
        // Avoid sending any more messages over closed socket.
        connection.onmessage = () => {};
        onDisconnect();
      };
      socket.on('close', () => {
        debugLog('Client closed');
        disconnected();
      });
      socket.on('error', error => {
        debugLog('Client error ' + error);
        disconnected();
      });
      onDisconnect = await this._delegate.onConnect(scope, forceDisconnect);
    });

    return wsEndpoint;
  }

  async close() {
    if (!this._wsServer)
      return;
    debugLog('Closing server');
    // First disconnect all remaining clients.
    await new Promise(f => this._wsServer!.close(f));
    await new Promise(f => this._wsServer!.options.server!.close(f));
    this._wsServer = undefined;
    await this._delegate.onClose();
  }
}
