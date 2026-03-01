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

import { EventEmitter } from 'events';

import type { WebSocket } from '../utilsBundle';
import type net from 'net';

export interface ServerTransport {
  send(message: string): void;
  close(reason?: { code: number, reason: string }): void;
  on(event: 'message', handler: (message: string) => void): void;
  on(event: 'close', handler: () => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  isClosed(): boolean;
}

export class WebSocketServerTransport implements ServerTransport {
  private _ws: WebSocket;

  constructor(ws: WebSocket) {
    this._ws = ws;
  }

  send(message: string): void {
    this._ws.send(message);
  }

  close(reason?: { code: number, reason: string }): void {
    this._ws.close(reason?.code, reason?.reason);
  }

  on(event: 'message', handler: (message: string) => void): void;
  on(event: 'close', handler: () => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  on(event: string, handler: (...args: any[]) => void): void {
    this._ws.on(event, handler);
  }

  isClosed(): boolean {
    return this._ws.readyState === this._ws.CLOSING || this._ws.readyState === this._ws.CLOSED;
  }
}

export class SocketServerTransport extends EventEmitter implements ServerTransport {
  private _socket: net.Socket;
  private _closed = false;
  private _pendingBuffers: Buffer[] = [];

  constructor(socket: net.Socket) {
    super();
    this._socket = socket;

    socket.on('data', (buffer: Buffer) => this._dispatch(buffer));
    socket.on('close', () => {
      this._closed = true;
      super.emit('close');
    });
    socket.on('error', (error: Error) => {
      super.emit('error', error);
    });
  }

  send(message: string): void {
    if (this._closed)
      return;
    this._socket.write(message);
    this._socket.write('\0');
  }

  close(reason?: { code: number, reason: string }): void {
    if (this._closed)
      return;
    this._closed = true;
    this._socket.end();
  }

  isClosed(): boolean {
    return this._closed;
  }

  private _dispatch(buffer: Buffer) {
    let end = buffer.indexOf('\0');
    if (end === -1) {
      this._pendingBuffers.push(buffer);
      return;
    }
    this._pendingBuffers.push(buffer.slice(0, end));
    const message = Buffer.concat(this._pendingBuffers).toString();
    super.emit('message', message);

    let start = end + 1;
    end = buffer.indexOf('\0', start);
    while (end !== -1) {
      super.emit('message', buffer.toString(undefined, start, end));
      start = end + 1;
      end = buffer.indexOf('\0', start);
    }
    this._pendingBuffers = [buffer.slice(start)];
  }
}
