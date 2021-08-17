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
import { Connection } from './connection';
import { Playwright } from './playwright';
import { kBrowserClosedError } from '../utils/errors';
import { TimeoutSettings } from '../utils/timeoutSettings';
import { getUserAgent, makeWaitForNextTask } from '../utils/utils';

type Options = {
  wsEndpoint: string;
  headers?: { [key: string]: string; };
  _forwardPorts?: number[];
  slowMo?: number;
  timeout?: number;
};

export class PlaywrightClient {
  private _doClose?: () => void;
  private _closedPromise = Promise.resolve();

  async connect(options: Options): Promise<Playwright> {
    if (this._doClose)
      throw new Error('Already connected');

    let resolveClosedPromise = () => {};
    this._closedPromise = new Promise(f => resolveClosedPromise = f);

    const ws = new WebSocket(options.wsEndpoint, [], {
      perMessageDeflate: false,
      maxPayload: 256 * 1024 * 1024, // 256Mb,
      handshakeTimeout: TimeoutSettings.timeout(options),
      headers: Object.assign({ 'User-Agent': getUserAgent() }, options.headers),
    });
    const connection = new Connection(() => ws.close());

    // The 'ws' module in node sometimes sends us multiple messages in a single task.
    const waitForNextTask = options.slowMo
      ? (cb: () => any) => setTimeout(cb, options.slowMo)
      : makeWaitForNextTask();
    connection.onmessage = message => {
      // Connection should handle all outgoing message in disconnected().
      if (ws.readyState !== WebSocket.OPEN)
        return;
      ws.send(JSON.stringify(message));
    };
    ws.addEventListener('message', event => {
      waitForNextTask(() => {
        try {
          // Since we may slow down the messages, but disconnect
          // synchronously, we might come here with a message
          // after disconnect.
          if (!connection.isDisconnected())
            connection.dispatch(JSON.parse(event.data));
        } catch (e) {
          console.error(`Playwright: Connection dispatch error`);
          console.error(e);
          ws.close();
        }
      });
    });

    let timeoutCallback = (e: Error) => {};
    const timeoutPromise = new Promise<Playwright>((f, r) => timeoutCallback = r);
    const timer = options.timeout ? setTimeout(() => timeoutCallback(new Error(`Timeout ${options.timeout}ms exceeded.`)), options.timeout) : undefined;

    const successPromise = new Promise<Playwright>(async (fulfill, reject) => {
      ws.addEventListener('open', async () => {
        const prematureCloseListener = (event: { code: number, reason: string }) => {
          reject(new Error(`WebSocket server disconnected (${event.code}) ${event.reason}`));
        };
        ws.addEventListener('close', prematureCloseListener);
        const playwright = await connection.waitForObjectWithKnownName('Playwright') as Playwright;

        if (options._forwardPorts) {
          try {
            await playwright._enablePortForwarding(options._forwardPorts);
          } catch (err) {
            reject(err);
            ws.close();
            return;
          }
        }

        ws.removeEventListener('close', prematureCloseListener);

        const closeListener = () => {
          this._doClose = undefined;
          ws.removeEventListener('close', closeListener);
          connection.didDisconnect(kBrowserClosedError);
          ws.close();
          resolveClosedPromise();
        };
        this._doClose = closeListener;
        ws.addEventListener('close', closeListener);

        fulfill(playwright);
      });
      ws.addEventListener('error', event => {
        ws.close();
        reject(new Error(event.message + '. Most likely ws endpoint is incorrect'));
      });
    });

    try {
      return await Promise.race([successPromise, timeoutPromise]);
    } finally {
      if (timer)
        clearTimeout(timer);
    }
  }

  async close() {
    this._doClose?.();
    await this._closedPromise;
  }
}
