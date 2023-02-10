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
import { type SocksProxy } from '../common/socksProxy';

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
  preLaunchedBrowser?: Browser;
  preLaunchedAndroidDevice?: AndroidDevice;
  preLaunchedSocksProxy?: SocksProxy;
};

export class PlaywrightServer {
  private _preLaunchedPlaywright: Playwright | undefined;
  private _wsServer: WebSocketServer | undefined;
  private _options: ServerOptions;

  constructor(options: ServerOptions) {
    this._options = options;
    if (options.preLaunchedBrowser)
      this._preLaunchedPlaywright = options.preLaunchedBrowser.options.rootSdkObject as Playwright;
    if (options.preLaunchedAndroidDevice)
      this._preLaunchedPlaywright = options.preLaunchedAndroidDevice._android._playwrightOptions.rootSdkObject as Playwright;
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

    debugLog('Listening at ' + wsEndpoint);
    this._wsServer = new wsServer({ server, path: this._options.path });
    const browserSemaphore = new Semaphore(this._options.maxConnections);
    const controllerSemaphore = new Semaphore(1);
    const reuseBrowserSemaphore = new Semaphore(1);
    this._wsServer.on('connection', (ws, request) => {
      const url = new URL('http://localhost' + (request.url || ''));
      const browserHeader = request.headers['x-playwright-browser'];
      const browserName = url.searchParams.get('browser') || (Array.isArray(browserHeader) ? browserHeader[0] : browserHeader) || null;
      const proxyHeader = request.headers['x-playwright-proxy'];
      const proxyValue = url.searchParams.get('proxy') || (Array.isArray(proxyHeader) ? proxyHeader[0] : proxyHeader);

      const launchOptionsHeader = request.headers['x-playwright-launch-options'] || '';
      let launchOptions: LaunchOptions = {};
      try {
        launchOptions = JSON.parse(Array.isArray(launchOptionsHeader) ? launchOptionsHeader[0] : launchOptionsHeader);
      } catch (e) {
      }

      const log = newLogger();
      log(`serving connection: ${request.url}`);
      const isDebugControllerClient = !!request.headers['x-playwright-debug-controller'];
      const shouldReuseBrowser = !!request.headers['x-playwright-reuse-context'];

      // If we started in the legacy reuse-browser mode, create this._preLaunchedPlaywright.
      // If we get a debug-controller request, create this._preLaunchedPlaywright.
      if (isDebugControllerClient || shouldReuseBrowser) {
        if (!this._preLaunchedPlaywright)
          this._preLaunchedPlaywright = createPlaywright('javascript');
      }

      let clientType: ClientType = 'playwright';
      let semaphore: Semaphore = browserSemaphore;
      if (isDebugControllerClient) {
        clientType = 'controller';
        semaphore = controllerSemaphore;
      } else if (shouldReuseBrowser) {
        clientType = 'reuse-browser';
        semaphore = reuseBrowserSemaphore;
      } else if (this._options.preLaunchedBrowser || this._options.preLaunchedAndroidDevice) {
        clientType = 'pre-launched-browser-or-android';
        semaphore = browserSemaphore;
      } else if (browserName) {
        clientType = 'launch-browser';
        semaphore = browserSemaphore;
      }

      const connection = new PlaywrightConnection(
          semaphore.aquire(),
          clientType, ws,
          { socksProxyPattern: proxyValue, browserName, launchOptions },
          {
            playwright: this._preLaunchedPlaywright,
            browser: this._options.preLaunchedBrowser,
            androidDevice: this._options.preLaunchedAndroidDevice,
            socksProxy: this._options.preLaunchedSocksProxy,
          },
          log, () => semaphore.release());
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

    debugLog('closing browsers');
    if (this._preLaunchedPlaywright)
      await Promise.all(this._preLaunchedPlaywright.allBrowsers().map(browser => browser.close()));
    debugLog('closed browsers');
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
