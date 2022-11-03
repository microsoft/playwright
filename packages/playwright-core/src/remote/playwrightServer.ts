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
import type { ClientType } from './playwrightConnection';
import type  { LaunchOptions } from '../server/types';
import { ManualPromise } from '../utils/manualPromise';
import type { AndroidDevice } from '../server/android/android';
import { SocksProxy } from '../common/socksProxy';

const debugLog = debug('pw:server');

let lastConnectionId = 0;
const kConnectionSymbol = Symbol('kConnection');

function newLogger() {
  const id = ++lastConnectionId;
  return (message: string) => debugLog(`[id=${id}] ${message}`);
}

type ServerOptions = {
  path: string;
  maxConnections: number;
  preLaunchedBrowser?: Browser
  preLaunchedAndroidDevice?: AndroidDevice
  browserProxyMode: 'client' | 'tether' | 'disabled',
  ownedByTetherClient?: boolean;
};

export class PlaywrightServer {
  private _preLaunchedPlaywright: Playwright | undefined;
  private _wsServer: WebSocketServer | undefined;
  private _networkTetheringSocksProxy: SocksProxy | undefined;
  private _options: ServerOptions;
  private _networkTetheringClientTimeout: NodeJS.Timeout | undefined;

  constructor(options: ServerOptions) {
    this._options = options;
    if (options.preLaunchedBrowser)
      this._preLaunchedPlaywright = options.preLaunchedBrowser.options.rootSdkObject as Playwright;
    if (options.preLaunchedAndroidDevice)
      this._preLaunchedPlaywright = options.preLaunchedAndroidDevice._android._playwrightOptions.rootSdkObject as Playwright;
  }

  preLaunchedPlaywright(): Playwright {
    if (!this._preLaunchedPlaywright)
      this._preLaunchedPlaywright = createPlaywright('javascript');
    return this._preLaunchedPlaywright;
  }

  async listen(port: number = 0): Promise<string> {
    const server = http.createServer((request: http.IncomingMessage, response: http.ServerResponse) => {
      if (request.method === 'GET' && request.url === '/json') {
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({
          wsEndpointPath: this._options.path,
        }));
        return;
      }
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
    if (this._options.browserProxyMode === 'tether') {
      this._networkTetheringSocksProxy = new SocksProxy();
      await this._networkTetheringSocksProxy.listen(0);
      debugLog('Launched tethering proxy at ' + this._networkTetheringSocksProxy.port());
    }

    debugLog('Listening at ' + wsEndpoint);
    if (this._options.ownedByTetherClient) {
      this._networkTetheringClientTimeout = setTimeout(() => {
        this.close();
      }, 30_000);
    }

    this._wsServer = new wsServer({ server, path: this._options.path });
    const browserSemaphore = new Semaphore(this._options.maxConnections);
    const controllerSemaphore = new Semaphore(1);
    const reuseBrowserSemaphore = new Semaphore(1);
    const networkTetheringSemaphore = new Semaphore(1);
    this._wsServer.on('connection', (ws, request) => {
      const url = new URL('http://localhost' + (request.url || ''));
      const browserHeader = request.headers['x-playwright-browser'];
      const browserName = url.searchParams.get('browser') || (Array.isArray(browserHeader) ? browserHeader[0] : browserHeader) || null;
      const proxyHeader = request.headers['x-playwright-proxy'];
      const proxyValue = url.searchParams.get('proxy') || (Array.isArray(proxyHeader) ? proxyHeader[0] : proxyHeader);
      const enableSocksProxy = this._options.browserProxyMode !== 'disabled' && proxyValue === '*';

      const launchOptionsHeader = request.headers['x-playwright-launch-options'] || '';
      let launchOptions: LaunchOptions = {};
      try {
        launchOptions = JSON.parse(Array.isArray(launchOptionsHeader) ? launchOptionsHeader[0] : launchOptionsHeader);
      } catch (e) {
      }

      const log = newLogger();
      log(`serving connection: ${request.url}`);
      const isDebugControllerClient = !!request.headers['x-playwright-debug-controller'];
      const isNetworkTetheringClient = !!request.headers['x-playwright-network-tethering'];
      const shouldReuseBrowser = !!request.headers['x-playwright-reuse-context'];

      // If we started in the legacy reuse-browser mode, create this._preLaunchedPlaywright.
      // If we get a reuse-controller request,  create this._preLaunchedPlaywright.
      if (isDebugControllerClient || shouldReuseBrowser)
        this.preLaunchedPlaywright();

      let clientType: ClientType = 'playwright';
      let semaphore: Semaphore = browserSemaphore;
      if (isNetworkTetheringClient) {
        clientType = 'network-tethering';
        semaphore = networkTetheringSemaphore;
      } else if (isDebugControllerClient) {
        clientType = 'controller';
        semaphore = controllerSemaphore;
      } else if (shouldReuseBrowser) {
        clientType = 'reuse-browser';
        semaphore = reuseBrowserSemaphore;
      } else if (this._options.preLaunchedBrowser || this._options.preLaunchedAndroidDevice) {
        clientType = 'pre-launched-browser';
        semaphore = browserSemaphore;
      } else if (browserName) {
        clientType = 'launch-browser';
        semaphore = browserSemaphore;
      }

      if (clientType === 'network-tethering' && this._options.ownedByTetherClient)
        clearTimeout(this._networkTetheringClientTimeout);

      const connection = new PlaywrightConnection(
          semaphore.aquire(),
          clientType, ws,
          { enableSocksProxy, browserName, launchOptions },
          {
            playwright: this._preLaunchedPlaywright,
            browser: this._options.preLaunchedBrowser,
            androidDevice: this._options.preLaunchedAndroidDevice,
            networkTetheringSocksProxy: this._networkTetheringSocksProxy,
          },
          log, () => {
            semaphore.release();
            if (this._options.ownedByTetherClient && clientType === 'network-tethering')
              this.close();
          });
      (ws as any)[kConnectionSymbol] = connection;
    });

    return wsEndpoint;
  }

  async close() {
    const server = this._wsServer;
    if (!server)
      return;
    await this._networkTetheringSocksProxy?.close();
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

export class Semaphore {
  private _max: number;
  private _aquired = 0;
  private _queue: ManualPromise[] = [];

  constructor(max: number) {
    this._max = max;
  }

  setMax(max: number) {
    this._max = max;
  }

  aquire(): Promise<void> {
    const lock = new ManualPromise();
    this._queue.push(lock);
    this._flush();
    return lock;
  }

  release() {
    --this._aquired;
    this._flush();
  }

  private _flush() {
    while (this._aquired < this._max && this._queue.length) {
      ++this._aquired;
      this._queue.shift()!.resolve();
    }
  }
}
