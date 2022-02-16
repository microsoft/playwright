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
import WebSocket from 'ws';
import { DispatcherConnection, DispatcherScope, Root } from '../dispatchers/dispatcher';
import { internalCallMetadata } from '../server/instrumentation';
import { createPlaywright, Playwright } from '../server/playwright';
import { Browser } from '../server/browser';
import { gracefullyCloseAll } from '../utils/processLauncher';
import { registry } from '../utils/registry';
import { PlaywrightDispatcher } from '../dispatchers/playwrightDispatcher';
import { SocksProxy } from '../utils/socksProxy';

const debugLog = debug('pw:server');

export class PlaywrightServer {
  private _path: string;
  private _maxClients: number;
  private _enableSocksProxy: boolean;
  private _browser: Browser | undefined;
  private _wsServer: WebSocket.Server | undefined;
  private _clientsCount = 0;

  static async startDefault(options: { path?: string, maxClients?: number, enableSocksProxy?: boolean } = {}): Promise<PlaywrightServer> {
    const { path = '/ws', maxClients = 1, enableSocksProxy = true } = options;
    return new PlaywrightServer(path, maxClients, enableSocksProxy);
  }

  constructor(path: string, maxClients: number, enableSocksProxy: boolean, browser?: Browser) {
    this._path = path;
    this._maxClients = maxClients;
    this._enableSocksProxy = enableSocksProxy;
    this._browser = browser;
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
        const wsEndpoint = typeof address === 'string' ? `${address}${this._path}` : `ws://127.0.0.1:${address.port}${this._path}`;
        resolve(wsEndpoint);
      }).on('error', reject);
    });

    debugLog('Listening at ' + wsEndpoint);

    this._wsServer = new WebSocket.Server({ server, path: this._path });
    const originalShouldHandle = this._wsServer.shouldHandle.bind(this._wsServer);
    this._wsServer.shouldHandle = request => originalShouldHandle(request) && this._clientsCount < this._maxClients;
    this._wsServer.on('connection', async (ws, request) => {
      if (this._clientsCount >= this._maxClients) {
        ws.close(1013, 'Playwright Server is busy');
        return;
      }
      this._clientsCount++;
      const connection = new Connection(ws, request, this._enableSocksProxy, this._browser, () => this._clientsCount--);
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
      const connection = (ws as any)[kConnectionSymbol] as Connection | undefined;
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

let lastConnectionId = 0;
const kConnectionSymbol = Symbol('kConnection');

class Connection {
  private _ws: WebSocket;
  private _onClose: () => void;
  private _dispatcherConnection: DispatcherConnection;
  private _cleanups: (() => Promise<void>)[] = [];
  private _id: number;
  private _disconnected = false;

  constructor(ws: WebSocket, request: http.IncomingMessage, enableSocksProxy: boolean, browser: Browser | undefined, onClose: () => void) {
    this._ws = ws;
    this._onClose = onClose;
    this._id = ++lastConnectionId;
    debugLog(`[id=${this._id}] serving connection: ${request.url}`);

    this._dispatcherConnection = new DispatcherConnection();
    this._dispatcherConnection.onmessage = message => {
      if (ws.readyState !== ws.CLOSING)
        ws.send(JSON.stringify(message));
    };
    ws.on('message', (message: string) => {
      this._dispatcherConnection.dispatch(JSON.parse(Buffer.from(message).toString()));
    });

    ws.on('close', () => this._onDisconnect());
    ws.on('error', error => this._onDisconnect(error));

    new Root(this._dispatcherConnection, async scope => {
      if (browser)
        return await this._initPreLaunchedBrowserMode(scope, browser);
      const url = new URL('http://localhost' + (request.url || ''));
      const browserHeader = request.headers['X-Playwright-Browser'];
      const browserAlias = url.searchParams.get('browser') || (Array.isArray(browserHeader) ? browserHeader[0] : browserHeader);
      const proxyHeader = request.headers['X-Playwright-Proxy'];
      const proxyValue = url.searchParams.get('proxy') || (Array.isArray(proxyHeader) ? proxyHeader[0] : proxyHeader);
      if (!browserAlias)
        return await this._initPlaywrightConnectMode(scope, enableSocksProxy && proxyValue === '*');
      return await this._initLaunchBrowserMode(scope, enableSocksProxy && proxyValue === '*', browserAlias);
    });
  }

  private async _initPlaywrightConnectMode(scope: DispatcherScope, enableSocksProxy: boolean) {
    debugLog(`[id=${this._id}] engaged playwright.connect mode`);
    const playwright = createPlaywright('javascript');
    // Close all launched browsers on disconnect.
    this._cleanups.push(() => gracefullyCloseAll());

    const socksProxy = enableSocksProxy ? await this._enableSocksProxy(playwright) : undefined;
    return new PlaywrightDispatcher(scope, playwright, socksProxy);
  }

  private async _initLaunchBrowserMode(scope: DispatcherScope, enableSocksProxy: boolean, browserAlias: string) {
    debugLog(`[id=${this._id}] engaged launch mode for "${browserAlias}"`);
    const executable = registry.findExecutable(browserAlias);
    if (!executable || !executable.browserName)
      throw new Error(`Unsupported browser "${browserAlias}`);

    const playwright = createPlaywright('javascript');
    const socksProxy = enableSocksProxy ? await this._enableSocksProxy(playwright) : undefined;
    const browser = await playwright[executable.browserName].launch(internalCallMetadata(), {
      channel: executable.type === 'browser' ? undefined : executable.name,
    });

    // Close the browser on disconnect.
    // TODO: it is technically possible to launch more browsers over protocol.
    this._cleanups.push(() => browser.close());
    browser.on(Browser.Events.Disconnected, () => {
      // Underlying browser did close for some reason - force disconnect the client.
      this.close({ code: 1001, reason: 'Browser closed' });
    });

    return new PlaywrightDispatcher(scope, playwright, socksProxy, browser);
  }

  private async _initPreLaunchedBrowserMode(scope: DispatcherScope, browser: Browser) {
    debugLog(`[id=${this._id}] engaged pre-launched mode`);
    browser.on(Browser.Events.Disconnected, () => {
      // Underlying browser did close for some reason - force disconnect the client.
      this.close({ code: 1001, reason: 'Browser closed' });
    });
    const playwright = browser.options.rootSdkObject as Playwright;
    const playwrightDispatcher = new PlaywrightDispatcher(scope, playwright, undefined, browser);
    // In pre-launched mode, keep the browser and just cleanup new contexts.
    // TODO: it is technically possible to launch more browsers over protocol.
    this._cleanups.push(() => playwrightDispatcher.cleanupPreLaunchedBrowser({}));
    return playwrightDispatcher;
  }

  private async _enableSocksProxy(playwright: Playwright) {
    const socksProxy = new SocksProxy();
    playwright.options.socksProxyPort = await socksProxy.listen(0);
    debugLog(`[id=${this._id}] started socks proxy on port ${playwright.options.socksProxyPort}`);
    this._cleanups.push(() => socksProxy.close());
    return socksProxy;
  }

  private async _onDisconnect(error?: Error) {
    this._disconnected = true;
    debugLog(`[id=${this._id}] disconnected. error: ${error}`);
    // Avoid sending any more messages over closed socket.
    this._dispatcherConnection.onmessage = () => {};
    debugLog(`[id=${this._id}] starting cleanup`);
    for (const cleanup of this._cleanups)
      await cleanup().catch(() => {});
    this._onClose();
    debugLog(`[id=${this._id}] finished cleanup`);
  }

  async close(reason?: { code: number, reason: string }) {
    if (this._disconnected)
      return;
    debugLog(`[id=${this._id}] force closing connection: ${reason?.reason || ''} (${reason?.code || 0})`);
    try {
      this._ws.close(reason?.code, reason?.reason);
    } catch (e) {
    }
  }
}
