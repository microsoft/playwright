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

import { debug, wsServer } from '../utilsBundle';
import type { WebSocketServer } from '../utilsBundle';
import http from 'http';
import type { Browser } from '../server/browser';
import type { Playwright } from '../server/playwright';
import { createPlaywright } from '../server/playwright';
import { PlaywrightConnection } from './playwrightConnection';
import { assert } from '../utils';

const debugLog = debug('pw:server');

let lastConnectionId = 0;
const kConnectionSymbol = Symbol('kConnection');

function newLogger() {
  const id = ++lastConnectionId;
  return (message: string) => debugLog(`[id=${id}] ${message}`);
}

export type Mode = 'use-pre-launched-browser' | 'reuse-browser' | 'auto';

type ServerOptions = {
  path: string;
  maxClients: number;
  enableSocksProxy: boolean;
  preLaunchedBrowser?: Browser
};

export class PlaywrightServer {
  private _preLaunchedPlaywright: Playwright | null = null;
  private _wsServer: WebSocketServer | undefined;
  private _clientsCount = 0;
  private _mode: Mode;
  private _options: ServerOptions;

  constructor(mode: Mode, options: ServerOptions) {
    this._mode = mode;
    this._options = options;
    if (mode === 'use-pre-launched-browser') {
      assert(options.preLaunchedBrowser);
      this._preLaunchedPlaywright = options.preLaunchedBrowser.options.rootSdkObject as Playwright;
    }
    if (mode === 'reuse-browser')
      this._preLaunchedPlaywright = createPlaywright('javascript');
  }

  async listen(port: number = 0): Promise<string> {
    const server = http.createServer((request, response) => {
      response.end('Running');
    });
    server.on('error', error => debugLog(error));

    const wsEndpoint = await new Promise<string>((resolve, reject) => {
      server.listen(port, () => {
        const address = server.address();
        if (!address) {
          reject(new Error('Could not bind server socket'));
          return;
        }
        const wsEndpoint = typeof address === 'string' ? `${address}${this._options.path}` : `ws://127.0.0.1:${address.port}${this._options.path}`;
        resolve(wsEndpoint);
      }).on('error', reject);
    });

    debugLog('Listening at ' + wsEndpoint);

    this._wsServer = new wsServer({ server, path: this._options.path });
    const originalShouldHandle = this._wsServer.shouldHandle.bind(this._wsServer);
    this._wsServer.shouldHandle = request => originalShouldHandle(request) && this._clientsCount < this._options.maxClients;
    this._wsServer.on('connection', async (ws, request) => {
      if (this._clientsCount >= this._options.maxClients) {
        ws.close(1013, 'Playwright Server is busy');
        return;
      }
      const url = new URL('http://localhost' + (request.url || ''));
      const browserHeader = request.headers['x-playwright-browser'];
      const browserAlias = url.searchParams.get('browser') || (Array.isArray(browserHeader) ? browserHeader[0] : browserHeader) || null;
      const headlessHeader = request.headers['x-playwright-headless'];
      const headlessValue = url.searchParams.get('headless') || (Array.isArray(headlessHeader) ? headlessHeader[0] : headlessHeader);
      const proxyHeader = request.headers['x-playwright-proxy'];
      const proxyValue = url.searchParams.get('proxy') || (Array.isArray(proxyHeader) ? proxyHeader[0] : proxyHeader);
      const enableSocksProxy = this._options.enableSocksProxy && proxyValue === '*';
      this._clientsCount++;
      const log = newLogger();
      log(`serving connection: ${request.url}`);
      const connection = new PlaywrightConnection(
          this._mode, ws,
          { enableSocksProxy, browserAlias, headless: headlessValue !== '0' },
          { playwright: this._preLaunchedPlaywright, browser: this._options.preLaunchedBrowser || null },
          log, () => this._clientsCount--);
      (ws as any)[kConnectionSymbol] = connection;
    });

    return wsEndpoint;
  }

  async close() {
    const server = this._wsServer;
    if (!server)
      return;
    debugLog('closing websocket server');
    const waitForClose = new Promise(f => server.close(f));
    // First disconnect all remaining clients.
    await Promise.all(Array.from(server.clients).map(async ws => {
      const connection = (ws as any)[kConnectionSymbol] as PlaywrightConnection | undefined;
      if (connection)
        await connection.close();
      try {
        ws.terminate();
      } catch (e) {
      }
    }));
    await waitForClose;
    debugLog('closing http server');
    await new Promise(f => server.options.server!.close(f));
    this._wsServer = undefined;
    debugLog('closed server');
  }
}
