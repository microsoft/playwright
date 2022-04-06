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

import WebSocket from 'ws';
import { Connection } from '../client/connection';
import type { Playwright } from '../client/playwright';
import { makeWaitForNextTask } from '../utils/utils';

// TODO: this file should be removed because it uses the old protocol.

export type PlaywrightClientConnectOptions = {
  wsEndpoint: string;
  timeout?: number;
  followRedirects?: boolean;
};

export class PlaywrightClient {
  private _playwright: Playwright;
  private _ws: WebSocket;
  private _closePromise: Promise<void>;

  static async connect(options: PlaywrightClientConnectOptions): Promise<PlaywrightClient> {
    const { wsEndpoint, timeout = 30000, followRedirects = true } = options;
    const connection = new Connection();
    connection.markAsRemote();
    const ws = new WebSocket(wsEndpoint, { followRedirects });
    const waitForNextTask = makeWaitForNextTask();
    connection.onmessage = message => {
      if (ws.readyState === 2 /** CLOSING */ || ws.readyState === 3 /** CLOSED */)
        throw new Error('PlaywrightClient: writing to closed WebSocket connection');
      ws.send(JSON.stringify(message));
    };
    ws.on('message', message => waitForNextTask(() => connection.dispatch(JSON.parse(message.toString()))));
    const errorPromise = new Promise((_, reject) => ws.on('error', error => reject(error)));
    const closePromise = new Promise((_, reject) => ws.on('close', () => reject(new Error('Connection closed'))));
    const playwrightClientPromise = new Promise<PlaywrightClient>((resolve, reject) => {
      let playwright: Playwright;
      ws.on('open', async () => {
        playwright = await connection.initializePlaywright();
        resolve(new PlaywrightClient(playwright, ws));
      });
      ws.on('close', (code, reason) => connection.close(reason.toString()));
    });
    let timer: NodeJS.Timeout;
    try {
      await Promise.race([
        playwrightClientPromise,
        errorPromise,
        closePromise,
        new Promise((_, reject) => timer = setTimeout(() => reject(`Timeout of ${timeout}ms exceeded while connecting.`), timeout))
      ]);
      return await playwrightClientPromise;
    } finally {
      clearTimeout(timer!);
    }
  }

  constructor(playwright: Playwright, ws: WebSocket) {
    this._playwright = playwright;
    this._ws = ws;
    this._closePromise = new Promise(f => ws.on('close', f));
  }

  playwright(): Playwright {
    return this._playwright;
  }

  async close() {
    this._ws.close();
    await this._closePromise;
  }
}
