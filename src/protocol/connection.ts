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

import { assert } from '../helper';
import * as platform from '../platform';
import { ConnectionTransport } from '../transport';
import { Protocol } from './protocol';

const debugClient = platform.debug('pw:client');
const debugServer = platform.debug('pw:server');

export interface ObjectTransport {
  send(message: any): void;
  close(): void;  // Note: calling close is expected to issue onclose at some point.
  onmessage?: (message: any) => void,
  onclose?: () => void,
}

export class JSONTransport implements ObjectTransport {
  private readonly _transport: ConnectionTransport;

  onmessage?: (message: string) => void;
  onclose?: () => void;

  constructor(transport: ConnectionTransport) {
    this._transport = transport;
    this._transport.onmessage = message => {
      if (this.onmessage)
        this.onmessage(JSON.parse(message));
    };
    this._transport.onclose = () => {
      if (this.onclose)
        this.onclose();
    };
    this.onmessage = undefined;
    this.onclose = undefined;
  }

  send(message: any) {
    this._transport.send(JSON.stringify(message));
  }

  close() {
    this._transport.close();
  }
}

export class ClientConnection extends platform.EventEmitter {
  private _lastId = 0;
  private readonly _transport: ObjectTransport;
  private _closed = false;
  private _onDisconnect: () => void;
  private readonly _callbacks = new Map<number, {resolve:(o: any) => void, reject: (e: Error) => void, error: Error, method: string}>();

  on: <T extends keyof Protocol.Events>(event: T, listener: (payload: Protocol.Events[T]) => void) => this;
  addListener: <T extends keyof Protocol.Events>(event: T, listener: (payload: Protocol.Events[T]) => void) => this;
  off: <T extends keyof Protocol.Events>(event: T, listener: (payload: Protocol.Events[T]) => void) => this;
  removeListener: <T extends keyof Protocol.Events>(event: T, listener: (payload: Protocol.Events[T]) => void) => this;
  once: <T extends keyof Protocol.Events>(event: T, listener: (payload: Protocol.Events[T]) => void) => this;

  constructor(transport: ObjectTransport, onDisconnect: () => void) {
    super();
    this._transport = transport;
    this._transport.onmessage = this._dispatchMessage.bind(this);
    this._transport.onclose = this._onClose.bind(this);
    this._onDisconnect = onDisconnect;
    this.on = super.on;
    this.off = super.removeListener;
    this.addListener = super.addListener;
    this.removeListener = super.removeListener;
    this.once = super.once;
  }

  send<T extends keyof Protocol.CommandParameters>(
    method: T,
    params?: Protocol.CommandParameters[T]
  ): Promise<Protocol.CommandReturnValues[T]> {
    if (this._closed)
      return Promise.reject(new Error(`Internal error (${method}): Connection has been closed.`));
    const id = ++this._lastId;
    const message = { id, method, params };
    const result = new Promise<Protocol.CommandReturnValues[T]>((resolve, reject) => {
      this._callbacks.set(id, {resolve, reject, error: new Error(), method});
    });
    debugClient('SEND ► %o', message);
    this._transport.send(message);
    return result;
  }

  private _dispatchMessage(message: any) {
    debugClient('◀ RECV %o', message);
    if (message.id && this._callbacks.has(message.id)) {
      const callback = this._callbacks.get(message.id)!;
      this._callbacks.delete(message.id);
      if (message.error)
        callback.reject(createInternalError(callback.error, callback.method, message));
      else
        callback.resolve(message.result);
    } else {
      assert(!message.id);
      Promise.resolve().then(() => this.emit(message.method, message.params));
    }
  }

  _onClose() {
    this._closed = true;
    this._transport.onmessage = undefined;
    this._transport.onclose = undefined;
    for (const callback of this._callbacks.values())
      callback.reject(rewriteError(callback.error, `Internal error (${callback.method}): Connection has been closed.`));
    this._callbacks.clear();
    this._onDisconnect();
  }

  isClosed() {
    return this._closed;
  }

  close() {
    if (!this._closed)
      this._transport.close();
  }
}

export class ServerConnection {
  private readonly _transport: ObjectTransport;
  private _closed = false;
  private _onDisconnect: () => void;
  private readonly _handlers = new Map<string, (arg: any) => Promise<any>>();

  constructor(transport: ObjectTransport, onDisconnect: () => void) {
    this._transport = transport;
    this._transport.onmessage = this._dispatchMessage.bind(this);
    this._transport.onclose = this._onClose.bind(this);
    this._onDisconnect = onDisconnect;
  }

  on<T extends keyof Protocol.CommandParameters>(command: T, handler: (payload: Protocol.CommandParameters[T]) => Promise<Protocol.CommandReturnValues[T]>) {
    this._handlers.set(command, handler);
  }

  send<T extends keyof Protocol.Events>(event: T, params?: Protocol.Events[T]) {
    if (this._closed)
      return Promise.reject(new Error(`Internal error (${event}): Connection has been closed.`));
    const message = { event, params };
    debugServer('SEND ► %o', message);
    this._transport.send(message);
  }

  private async _dispatchMessage(message: any) {
    debugServer('◀ RECV %o', message);
    assert(message.id);
    let result;
    try {
      const handler = this._handlers.get(message.method);
      if (!handler)
        throw new Error(`Unknown command "${message.method}"`);
      result = { id: message.id, result: await handler(message.params) };
    } catch (e) {
      result = { id: message.id, error: { message: e.message } };
    }
    this._transport.send(result);
  }

  _onClose() {
    this._closed = true;
    this._transport.onmessage = undefined;
    this._transport.onclose = undefined;
    this._onDisconnect();
  }

  isClosed() {
    return this._closed;
  }

  close() {
    if (!this._closed)
      this._transport.close();
  }
}

function createInternalError(error: Error, method: string, object: { error: { message: string; data: any; }; }): Error {
  let message = `Internal error (${method}): ${object.error.message}`;
  if ('data' in object.error)
    message += ` ${object.error.data}`;
  return rewriteError(error, message);
}

function rewriteError(error: Error, message: string): Error {
  error.message = message;
  return error;
}
