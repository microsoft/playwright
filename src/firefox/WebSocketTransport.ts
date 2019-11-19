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
import { ConnectionTransport } from '../ConnectionTransport';
import * as WebSocket from 'ws';

export class WebSocketTransport implements ConnectionTransport {
  _ws: WebSocket;
  _dispatchQueue: DispatchQueue;
  onclose?: () => void;
  onmessage?: (message: string) => void;
  static create(url: string): Promise<WebSocketTransport> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, [], { perMessageDeflate: false });
      ws.addEventListener('open', () => resolve(new WebSocketTransport(ws)));
      ws.addEventListener('error', reject);
    });
  }

  constructor(ws: WebSocket) {
    this._ws = ws;
    this._dispatchQueue = new DispatchQueue(this);
    this._ws.addEventListener('message', event => {
      this._dispatchQueue.enqueue(event.data);
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

// We want to dispatch all "message" events in separate tasks
// to make sure all message-related promises are resolved first
// before dispatching next message.
//
// We cannot just use setTimeout() in Node.js here like we would
// do in Browser - see https://github.com/nodejs/node/issues/23773
// Thus implement a dispatch queue that enforces new tasks manually.
class DispatchQueue {
  _transport: ConnectionTransport;
  _timeoutId: NodeJS.Timer = null;
  _queue: string[] = [];
  constructor(transport : ConnectionTransport) {
    this._transport = transport;
    this._dispatch = this._dispatch.bind(this);
  }

  enqueue(message: string) {
    this._queue.push(message);
    if (!this._timeoutId)
      this._timeoutId = setTimeout(this._dispatch, 0);
  }

  _dispatch() {
    const message = this._queue.shift();
    if (this._queue.length)
      this._timeoutId = setTimeout(this._dispatch, 0);
    else
      this._timeoutId = null;

    if (this._transport.onmessage)
      this._transport.onmessage.call(null, message);
  }
}

