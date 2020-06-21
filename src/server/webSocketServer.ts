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

import { IncomingMessage } from 'http';
import * as ws from 'ws';
import { helper } from '../helper';
import { logError, Logger } from '../logger';
import { ConnectionTransport, ProtocolRequest, ProtocolResponse } from '../transport';

export interface WebSocketServerDelegate {
  onClientAttached(socket: ws): void;
  onClientRequest(socket: ws, message: ProtocolRequest): void;
  onClientDetached(socket: ws): void;
  onBrowserNotification(message: ProtocolResponse): void;
  onBrowserResponse(seqNum: number, source: ws, message: ProtocolResponse): void;
}

export class WebSocketServer {
  private _transport: ConnectionTransport;
  private _logger: Logger;
  private _server: ws.Server;
  private _guid: string;
  readonly wsEndpoint: string;
  private _bindings: (Map<any, any> | Set<any>)[] = [];
  private _lastSeqNum = 0;
  private _delegate: WebSocketServerDelegate;
  private _sockets = new Set<ws>();
  private _pendingRequests = new Map<number, { message: ProtocolRequest, source: ws | null }>();

  constructor(transport: ConnectionTransport, logger: Logger, port: number, delegate: WebSocketServerDelegate) {
    this._guid = helper.guid();
    this._transport = transport;
    this._logger = logger;
    this._server = new ws.Server({ port });
    this._delegate = delegate;
    transport.onmessage = message => this._browserMessage(message);
    transport.onclose = () => this._browserClosed();
    this._server.on('connection', (socket: ws, req) => this._clientAttached(socket, req));
    const address = this._server.address();
    this.wsEndpoint = typeof address === 'string' ? `${address}/${this._guid}` : `ws://127.0.0.1:${address.port}/${this._guid}`;
  }

  addBindings(bindings: (Map<any, any>|Set<any>)[]) {
    this._bindings.push(...bindings);
  }

  sendMessageToBrowser(message: ProtocolRequest, source: ws): number {
    const seqNum = ++this._lastSeqNum;
    this._pendingRequests.set(seqNum, { message, source });
    this._transport.send({ ...message, id: seqNum });
    return seqNum;
  }

  sendMessageToBrowserOneWay(method: string, params: any) {
    this._transport.send({ id: ++this._lastSeqNum, method, params });
  }

  close() {
    this._server.close();
  }

  private _browserMessage(message: ProtocolResponse) {
    const seqNum = message.id;
    if (typeof seqNum === 'number') {
      const request = this._pendingRequests.get(seqNum);
      if (!request)
        return;
      this._pendingRequests.delete(seqNum);
      message.id = request.message.id;
      if (request.source)
        this._delegate.onBrowserResponse(seqNum, request.source, message);
    } else {
      this._delegate.onBrowserNotification(message);
    }
  }

  private _browserClosed() {
    this._transport.onmessage = undefined;
    this._transport.onclose = undefined;
    for (const socket of this._sockets) {
      socket.removeAllListeners('close');
      socket.close(undefined, 'Browser disconnected');
    }
    this._server.close();
  }

  private _clientAttached(socket: ws, req: IncomingMessage) {
    if (req.url !== '/' + this._guid) {
      socket.close();
      return;
    }

    this._sockets.add(socket);
    this._delegate.onClientAttached(socket);
    socket.on('message', (message: string) => {
      const parsedMessage = JSON.parse(Buffer.from(message).toString()) as ProtocolRequest;
      this._delegate.onClientRequest(socket, parsedMessage);
    });
    socket.on('error', logError(this._logger));
    socket.on('close', () => {
      this._delegate.onClientDetached(socket);
      this._sockets.delete(socket);
    });
  }


  async checkLeaks() {
    let counter = 0;
    return new Promise((fulfill, reject) => {
      const check = () => {
        const filtered = this._bindings.filter(entry => entry.size);
        if (!filtered.length) {
          fulfill();
          return;
        }

        if (++counter >= 50) {
          reject(new Error('Web socket leak ' + filtered.map(entry => [...entry.keys()].join(':')).join('|')));
          return;
        }
        setTimeout(check, 100);
      };
      check();
    });
  }
}
