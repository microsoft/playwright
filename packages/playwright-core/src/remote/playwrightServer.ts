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
import type  { LaunchOptions } from '../server/types';
import { ManualPromise } from '../utils/manualPromise';

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
  maxIncomingConnections: number;
  maxConcurrentConnections: number;
  enableSocksProxy: boolean;
  preLaunchedBrowser?: Browser
};

export class PlaywrightServer {
  private _preLaunchedPlaywright: Playwright | null = null;
  private _wsServer: WebSocketServer | undefined;
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

  preLaunchedPlaywright(): Playwright | null {
    return this._preLaunchedPlaywright;
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
    const semaphore = new Semaphore(this._options.maxConcurrentConnections);
    this._wsServer.on('connection', (ws, request) => {
      if (semaphore.requested() >= this._options.maxIncomingConnections) {
        ws.close(1013, 'Playwright Server is busy');
        return;
      }
      const url = new URL('http://localhost' + (request.url || ''));
      const browserHeader = request.headers['x-playwright-browser'];
      const browserName = url.searchParams.get('browser') || (Array.isArray(browserHeader) ? browserHeader[0] : browserHeader) || null;
      const proxyHeader = request.headers['x-playwright-proxy'];
      const proxyValue = url.searchParams.get('proxy') || (Array.isArray(proxyHeader) ? proxyHeader[0] : proxyHeader);
      const enableSocksProxy = this._options.enableSocksProxy && proxyValue === '*';

      const launchOptionsHeader = request.headers['x-playwright-launch-options'] || '';
      let launchOptions: LaunchOptions = {};
      try {
        launchOptions = JSON.parse(Array.isArray(launchOptionsHeader) ? launchOptionsHeader[0] : launchOptionsHeader);
      } catch (e) {
      }

      const log = newLogger();
      log(`serving connection: ${request.url}`);
      const connection = new PlaywrightConnection(
          semaphore.aquire(),
          this._mode, ws,
          { enableSocksProxy, browserName, launchOptions },
          { playwright: this._preLaunchedPlaywright, browser: this._options.preLaunchedBrowser || null },
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
  }
}

export class Semaphore {
  private _max: number;
  private _aquired = 0;
  private _queue: ManualPromise[] = [];
  constructor(max: number) {
    this._max = max;
  }

  aquire(): Promise<void> {
    const lock = new ManualPromise();
    this._queue.push(lock);
    this._flush();
    return lock;
  }

  requested() {
    return this._aquired + this._queue.length;
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
