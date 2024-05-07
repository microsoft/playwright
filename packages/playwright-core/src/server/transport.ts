/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ws } from '../utilsBundle';
import type { WebSocket } from '../utilsBundle';
import type { ClientRequest, IncomingMessage } from 'http';
import type { Progress } from './progress';
import { makeWaitForNextTask } from '../utils';
import { httpHappyEyeballsAgent, httpsHappyEyeballsAgent } from '../utils/happy-eyeballs';
import type { HeadersArray } from './types';

export const perMessageDeflate = {
  zlibDeflateOptions: {
    level: 3,
  },
  zlibInflateOptions: {
    chunkSize: 10 * 1024
  },
  threshold: 10 * 1024,
};

export type ProtocolRequest = {
  id: number;
  method: string;
  params: any;
  sessionId?: string;
};

export type ProtocolResponse = {
  id?: number;
  method?: string;
  sessionId?: string;
  error?: { message: string; data: any; code?: number };
  params?: any;
  result?: any;
  pageProxyId?: string;
  browserContextId?: string;
};

export interface ConnectionTransport {
  send(s: ProtocolRequest): void;
  close(): void;  // Note: calling close is expected to issue onclose at some point.
  onmessage?: (message: ProtocolResponse) => void,
  onclose?: (reason?: string) => void,
}

export class WebSocketTransport implements ConnectionTransport {
  private _ws: WebSocket;
  private _progress?: Progress;
  private _logUrl: string;

  onmessage?: (message: ProtocolResponse) => void;
  onclose?: (reason?: string) => void;
  readonly wsEndpoint: string;
  readonly headers: HeadersArray = [];

  static async connect(progress: (Progress|undefined), url: string, headers?: { [key: string]: string; }, followRedirects?: boolean, debugLogHeader?: string): Promise<WebSocketTransport> {
    return await WebSocketTransport._connect(progress, url, headers || {}, { follow: !!followRedirects, hadRedirects: false }, debugLogHeader);
  }

  static async _connect(progress: (Progress|undefined), url: string, headers: { [key: string]: string; }, redirect: { follow: boolean, hadRedirects: boolean }, debugLogHeader?: string): Promise<WebSocketTransport> {
    const logUrl = stripQueryParams(url);
    progress?.log(`<ws connecting> ${logUrl}`);
    const transport = new WebSocketTransport(progress, url, logUrl, headers, redirect.follow && redirect.hadRedirects, debugLogHeader);
    let success = false;
    progress?.cleanupWhenAborted(async () => {
      if (!success)
        await transport.closeAndWait().catch(e => null);
    });
    const result = await new Promise<{ transport?: WebSocketTransport, redirect?: IncomingMessage }>((fulfill, reject) => {
      transport._ws.on('open', async () => {
        progress?.log(`<ws connected> ${logUrl}`);
        fulfill({ transport });
      });
      transport._ws.on('error', event => {
        progress?.log(`<ws connect error> ${logUrl} ${event.message}`);
        reject(new Error('WebSocket error: ' + event.message));
        transport._ws.close();
      });
      transport._ws.on('unexpected-response', (request: ClientRequest, response: IncomingMessage) => {
        if (redirect.follow && !redirect.hadRedirects && (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308)) {
          fulfill({ redirect: response });
          transport._ws.close();
          return;
        }
        for (let i = 0; i < response.rawHeaders.length; i += 2) {
          if (debugLogHeader && response.rawHeaders[i] === debugLogHeader)
            progress?.log(response.rawHeaders[i + 1]);
        }
        const chunks: Buffer[] = [];
        const errorPrefix = `${logUrl} ${response.statusCode} ${response.statusMessage}`;
        response.on('data', chunk => chunks.push(chunk));
        response.on('close', () => {
          const error = chunks.length ? `${errorPrefix}\n${Buffer.concat(chunks)}` : errorPrefix;
          progress?.log(`<ws unexpected response> ${error}`);
          reject(new Error('WebSocket error: ' + error));
          transport._ws.close();
        });
      });
    });

    if (result.redirect) {
      // Strip authorization headers from the redirected request.
      const newHeaders = Object.fromEntries(Object.entries(headers || {}).filter(([name]) => {
        return !name.includes('access-key') && name.toLowerCase() !== 'authorization';
      }));
      return WebSocketTransport._connect(progress, result.redirect.headers.location!, newHeaders, { follow: true, hadRedirects: true }, debugLogHeader);
    }

    success = true;
    return transport;
  }

  constructor(progress: Progress|undefined, url: string, logUrl: string, headers?: { [key: string]: string; }, followRedirects?: boolean, debugLogHeader?: string) {
    this.wsEndpoint = url;
    this._logUrl = logUrl;
    this._ws = new ws(url, [], {
      maxPayload: 256 * 1024 * 1024, // 256Mb,
      // Prevent internal http client error when passing negative timeout.
      handshakeTimeout: Math.max(progress?.timeUntilDeadline() ?? 30_000, 1),
      headers,
      followRedirects,
      agent: (/^(https|wss):\/\//.test(url)) ? httpsHappyEyeballsAgent : httpHappyEyeballsAgent,
      perMessageDeflate,
    });
    this._ws.on('upgrade', response => {
      for (let i = 0; i < response.rawHeaders.length; i += 2) {
        this.headers.push({ name: response.rawHeaders[i], value: response.rawHeaders[i + 1] });
        if (debugLogHeader && response.rawHeaders[i] === debugLogHeader)
          progress?.log(response.rawHeaders[i + 1]);
      }
    });
    this._progress = progress;
    // The 'ws' module in node sometimes sends us multiple messages in a single task.
    // In Web, all IO callbacks (e.g. WebSocket callbacks)
    // are dispatched into separate tasks, so there's no need
    // to do anything extra.
    const messageWrap: (cb: () => void) => void = makeWaitForNextTask();

    this._ws.addEventListener('message', event => {
      messageWrap(() => {
        const eventData = event.data as string;
        let parsedJson;
        try {
          parsedJson = JSON.parse(eventData);
        } catch (e) {
          this._progress?.log(`<closing ws> Closing websocket due to malformed JSON. eventData=${eventData} e=${e?.message}`);
          this._ws.close();
          return;
        }
        try {
          if (this.onmessage)
            this.onmessage.call(null, parsedJson);
        } catch (e) {
          this._progress?.log(`<closing ws> Closing websocket due to failed onmessage callback. eventData=${eventData} e=${e?.message}`);
          this._ws.close();
        }
      });
    });

    this._ws.addEventListener('close', event => {
      this._progress?.log(`<ws disconnected> ${logUrl} code=${event.code} reason=${event.reason}`);
      if (this.onclose)
        this.onclose.call(null, event.reason);
    });
    // Prevent Error: read ECONNRESET.
    this._ws.addEventListener('error', error => this._progress?.log(`<ws error> ${logUrl} ${error.type} ${error.message}`));
  }

  send(message: ProtocolRequest) {
    this._ws.send(JSON.stringify(message));
  }

  close() {
    this._progress?.log(`<ws disconnecting> ${this._logUrl}`);
    this._ws.close();
  }

  async closeAndWait() {
    if (this._ws.readyState === ws.CLOSED)
      return;
    const promise = new Promise(f => this._ws.once('close', f));
    this.close();
    await promise; // Make sure to await the actual disconnect.
  }
}

function stripQueryParams(url: string): string {
  try {
    const u = new URL(url);
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}
