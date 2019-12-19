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

import * as WebSocket from 'ws';
import { debugError, helper, RegisteredListener } from './helper';

export interface ConnectionTransport {
  send(s: string): void;
  close(): void;
  onmessage?: (message: string) => void,
  onclose?: () => void,
}

export class WebSocketTransport implements ConnectionTransport {
  private _ws: WebSocket;

  onmessage?: (message: string) => void;
  onclose?: () => void;

  static create(url: string): Promise<WebSocketTransport> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, [], {
        perMessageDeflate: false,
        maxPayload: 256 * 1024 * 1024, // 256Mb
      });
      ws.addEventListener('open', () => resolve(new WebSocketTransport(ws, url)));
      ws.addEventListener('error', reject);
    });
  }

  constructor(ws: WebSocket, url: string) {
    this._ws = ws;
    this._ws.addEventListener('message', event => {
      if (this.onmessage)
        this.onmessage.call(null, event.data);
    });
    this._ws.addEventListener('close', event => {
      if (this.onclose)
        this.onclose.call(null);
    });
    // Silently ignore all errors - we don't know what to do with them.
    this._ws.addEventListener('error', () => {});
  }

  send(message: string) {
    this._ws.send(message);
  }

  close() {
    this._ws.close();
  }
}

export class PipeTransport implements ConnectionTransport {
  private _pipeWrite: NodeJS.WritableStream;
  private _pendingMessage = '';
  private _eventListeners: RegisteredListener[];
  onmessage?: (message: string) => void;
  onclose?: () => void;

  constructor(pipeWrite: NodeJS.WritableStream, pipeRead: NodeJS.ReadableStream) {
    this._pipeWrite = pipeWrite;
    this._eventListeners = [
      helper.addEventListener(pipeRead, 'data', buffer => this._dispatch(buffer)),
      helper.addEventListener(pipeRead, 'close', () => {
        if (this.onclose)
          this.onclose.call(null);
      }),
      helper.addEventListener(pipeRead, 'error', debugError),
      helper.addEventListener(pipeWrite, 'error', debugError),
    ];
    this.onmessage = null;
    this.onclose = null;
  }

  send(message: string) {
    this._pipeWrite.write(message);
    this._pipeWrite.write('\0');
  }

  _dispatch(buffer: Buffer) {
    let end = buffer.indexOf('\0');
    if (end === -1) {
      this._pendingMessage += buffer.toString();
      return;
    }
    const message = this._pendingMessage + buffer.toString(undefined, 0, end);
    if (this.onmessage)
      this.onmessage.call(null, message);

    let start = end + 1;
    end = buffer.indexOf('\0', start);
    while (end !== -1) {
      if (this.onmessage)
        this.onmessage.call(null, buffer.toString(undefined, start, end));
      start = end + 1;
      end = buffer.indexOf('\0', start);
    }
    this._pendingMessage = buffer.toString(undefined, start);
  }

  close() {
    this._pipeWrite = null;
    helper.removeEventListeners(this._eventListeners);
  }
}

export class SlowMoTransport {
  private readonly _delay: number;
  private readonly _delegate: ConnectionTransport;
  private _incomingMessageQueue: string[] = [];
  private _dispatchTimerId?: NodeJS.Timer;
  private _closed = false;

  onmessage?: (message: string) => void;
  onclose?: () => void;

  static wrap(transport: ConnectionTransport, delay?: number): ConnectionTransport {
    return delay ? new SlowMoTransport(transport, delay) : transport;
  }

  constructor(transport: ConnectionTransport, delay: number) {
    this._delay = delay;
    this._delegate = transport;
    this._delegate.onmessage = this._enqueueMessage.bind(this);
    this._delegate.onclose = this._onClose.bind(this);
  }

  private _enqueueMessage(message: string) {
    this._incomingMessageQueue.push(message);
    this._scheduleQueueDispatch();
  }

  private _scheduleQueueDispatch() {
    if (this._dispatchTimerId)
      return;
    if (!this._incomingMessageQueue.length)
      return;
    this._dispatchTimerId = setTimeout(() => {
      this._dispatchTimerId = undefined;
      this._dispatchOneMessageFromQueue();
    }, this._delay);
  }

  private _dispatchOneMessageFromQueue() {
    if (this._closed)
      return;
    const message = this._incomingMessageQueue.shift();
    try {
      if (this.onmessage)
        this.onmessage(message);
    } finally {
      this._scheduleQueueDispatch();
    }
  }

  private _onClose() {
    if (this._closed)
      return;
    if (this.onclose)
      this.onclose();
    this._closed = true;
    this._delegate.onmessage = null;
    this._delegate.onclose = null;
  }

  send(s: string) {
    this._delegate.send(s);
  }

  close() {
    this._closed = true;
    this._delegate.close();
  }
}
