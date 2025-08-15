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

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { Transport, TransportSendOptions } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage, MessageExtraInfo } from '@modelcontextprotocol/sdk/types.js';

export class InProcessTransport implements Transport {
  private _server: Server;
  private _serverTransport: InProcessServerTransport;
  private _connected: boolean = false;

  constructor(server: Server) {
    this._server = server;
    this._serverTransport = new InProcessServerTransport(this);
  }

  async start(): Promise<void> {
    if (this._connected)
      throw new Error('InprocessTransport already started!');

    await this._server.connect(this._serverTransport);
    this._connected = true;
  }

  async send(message: JSONRPCMessage, options?: TransportSendOptions): Promise<void> {
    if (!this._connected)
      throw new Error('Transport not connected');


    this._serverTransport._receiveFromClient(message);
  }

  async close(): Promise<void> {
    if (this._connected) {
      this._connected = false;
      this.onclose?.();
      this._serverTransport.onclose?.();
    }
  }

  onclose?: (() => void) | undefined;
  onerror?: ((error: Error) => void) | undefined;
  onmessage?: ((message: JSONRPCMessage, extra?: MessageExtraInfo) => void) | undefined;
  sessionId?: string | undefined;
  setProtocolVersion?: ((version: string) => void) | undefined;

  _receiveFromServer(message: JSONRPCMessage, extra?: MessageExtraInfo): void {
    this.onmessage?.(message, extra);
  }
}

class InProcessServerTransport implements Transport {
  private _clientTransport: InProcessTransport;

  constructor(clientTransport: InProcessTransport) {
    this._clientTransport = clientTransport;
  }

  async start(): Promise<void> {
  }

  async send(message: JSONRPCMessage, options?: TransportSendOptions): Promise<void> {
    this._clientTransport._receiveFromServer(message);
  }

  async close(): Promise<void> {
    this.onclose?.();
  }

  onclose?: (() => void) | undefined;
  onerror?: ((error: Error) => void) | undefined;
  onmessage?: ((message: JSONRPCMessage, extra?: MessageExtraInfo) => void) | undefined;
  sessionId?: string | undefined;
  setProtocolVersion?: ((version: string) => void) | undefined;
  _receiveFromClient(message: JSONRPCMessage): void {
    this.onmessage?.(message);
  }
}
