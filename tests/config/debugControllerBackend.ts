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
import { EventEmitter } from 'events';
import type * as channels from '@protocol/channels';

export type ProtocolRequest = {
  id: number;
  method: string;
  params: any;
};

export type ProtocolResponse = {
  id?: number;
  method?: string;
  error?: { message: string; data: any; };
  params?: any;
  result?: any;
};

export interface ConnectionTransport {
  send(s: ProtocolRequest): void;
  close(): void;  // Note: calling close is expected to issue onclose at some point.
  isClosed(): boolean,
  onmessage?: (message: ProtocolResponse) => void,
  onclose?: () => void,
}

class WebSocketTransport implements ConnectionTransport {
  private _ws: WebSocket;

  onmessage?: (message: ProtocolResponse) => void;
  onclose?: () => void;
  readonly wsEndpoint: string;

  static async connect(url: string, headers: Record<string, string> = {}): Promise<WebSocketTransport> {
    const transport = new WebSocketTransport(url, headers);
    await new Promise<WebSocketTransport>((fulfill, reject) => {
      transport._ws.addEventListener('open', async () => {
        fulfill(transport);
      });
      transport._ws.addEventListener('error', event => {
        reject(new Error('WebSocket error: ' + event.message));
        transport._ws.close();
      });
    });
    return transport;
  }

  constructor(url: string, headers: Record<string, string> = {}) {
    this.wsEndpoint = url;
    this._ws = new WebSocket(url, [], {
      perMessageDeflate: false,
      maxPayload: 256 * 1024 * 1024, // 256Mb,
      handshakeTimeout: 30000,
      headers
    });

    this._ws.addEventListener('message', event => {
      try {
        if (this.onmessage)
          this.onmessage.call(null, JSON.parse(event.data.toString()));
      } catch (e) {
        this._ws.close();
      }
    });

    this._ws.addEventListener('close', event => {
      if (this.onclose)
        this.onclose.call(null);
    });
    // Prevent Error: read ECONNRESET.
    this._ws.addEventListener('error', () => {});
  }

  isClosed() {
    return this._ws.readyState === WebSocket.CLOSING || this._ws.readyState === WebSocket.CLOSED;
  }

  send(message: ProtocolRequest) {
    this._ws.send(JSON.stringify(message));
  }

  close() {
    this._ws.close();
  }

  async closeAndWait() {
    const promise = new Promise(f => this._ws.once('close', f));
    this.close();
    await promise; // Make sure to await the actual disconnect.
  }
}

export class Backend extends EventEmitter {
  private static _lastId = 0;
  private _callbacks = new Map<number, { fulfill: (a: any) => void, reject: (e: Error) => void }>();
  private _transport!: WebSocketTransport;
  channel: channels.DebugControllerChannel;

  constructor() {
    super();
  }

  async connect(wsEndpoint: string) {
    this._transport = await WebSocketTransport.connect(wsEndpoint + '?debug-controller');
    this._transport.onmessage = (message: any) => {
      if (!message.id) {
        this.emit(message.method, message.params);
        return;
      }
      const pair = this._callbacks.get(message.id);
      if (!pair)
        return;
      this._callbacks.delete(message.id);
      if (message.error) {
        const error = new Error(message.error.error?.message || message.error.value);
        error.stack = message.error.error?.stack;
        pair.reject(error);
      } else {
        pair.fulfill(message.result);
      }
    };
    this.channel = new Proxy(this, {
      get: (target, propKey) => {
        if (['on', 'once'].includes(String(propKey)))
          return target[propKey].bind(target);
        return (...args: any) => this._send(String(propKey), ...args);
      }
    }) as any;
  }

  async initialize() {
    await this.channel.initialize({ codegenId: 'playwright-test', sdkLanguage: 'javascript' });
  }

  async close() {
    await this._transport.closeAndWait();
  }

  private _send(method: string, params: any = {}): Promise<any> {
    return new Promise((fulfill, reject) => {
      const id = ++Backend._lastId;
      const command = { id, guid: 'DebugController', method, params, metadata: {} };
      this._transport.send(command as any);
      this._callbacks.set(id, { fulfill, reject });
    });
  }
}
