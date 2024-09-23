/**
 * Copyright 2017 Google Inc. All rights reserved.
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

import { EventEmitter } from 'events';
import { assert } from '../../utils';
import type { ConnectionTransport, ProtocolRequest, ProtocolResponse } from '../transport';
import type { Protocol } from './protocol';
import type { RecentLogsCollector } from '../../utils/debugLogger';
import { debugLogger } from '../../utils/debugLogger';
import type { ProtocolLogger } from '../types';
import { helper } from '../helper';
import { ProtocolError } from '../protocolError';

// WKPlaywright uses this special id to issue Browser.close command which we
// should ignore.
export const kBrowserCloseMessageId = -9999;

// We emulate kPageProxyMessageReceived message to unify it with Browser.pageProxyCreated
// and Browser.pageProxyDestroyed for easier management.
export const kPageProxyMessageReceived = Symbol('kPageProxyMessageReceived');
export type PageProxyMessageReceivedPayload = { pageProxyId: string, message: any };

export class WKConnection {
  private readonly _transport: ConnectionTransport;
  private readonly _onDisconnect: () => void;
  private readonly _protocolLogger: ProtocolLogger;
  private readonly _browserLogsCollector: RecentLogsCollector;
  _browserDisconnectedLogs: string | undefined;
  private _lastId = 0;
  private _closed = false;
  readonly browserSession: WKSession;

  constructor(transport: ConnectionTransport, onDisconnect: () => void, protocolLogger: ProtocolLogger, browserLogsCollector: RecentLogsCollector) {
    this._transport = transport;
    this._onDisconnect = onDisconnect;
    this._protocolLogger = protocolLogger;
    this._browserLogsCollector = browserLogsCollector;
    this.browserSession = new WKSession(this, '', (message: any) => {
      this.rawSend(message);
    });
    this._transport.onmessage = this._dispatchMessage.bind(this);
    // onclose should be set last, since it can be immediately called.
    this._transport.onclose = this._onClose.bind(this);
  }

  nextMessageId(): number {
    return ++this._lastId;
  }

  rawSend(message: ProtocolRequest) {
    this._protocolLogger('send', message);
    this._transport.send(message);
  }

  private _dispatchMessage(message: ProtocolResponse) {
    this._protocolLogger('receive', message);
    if (message.id === kBrowserCloseMessageId)
      return;
    if (message.pageProxyId) {
      const payload: PageProxyMessageReceivedPayload = { message: message, pageProxyId: message.pageProxyId };
      this.browserSession.dispatchMessage({ method: kPageProxyMessageReceived, params: payload });
      return;
    }
    this.browserSession.dispatchMessage(message);
  }

  _onClose(reason?: string) {
    this._closed = true;
    this._transport.onmessage = undefined;
    this._transport.onclose = undefined;
    this._browserDisconnectedLogs = helper.formatBrowserLogs(this._browserLogsCollector.recentLogs(), reason);
    this.browserSession.dispose();
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

export class WKSession extends EventEmitter {
  connection: WKConnection;
  readonly sessionId: string;

  private _disposed = false;
  private readonly _rawSend: (message: any) => void;
  private readonly _callbacks = new Map<number, { resolve: (o: any) => void, reject: (e: ProtocolError) => void, error: ProtocolError }>();
  private _crashed: boolean = false;

  override on: <T extends keyof Protocol.Events | symbol>(event: T, listener: (payload: T extends symbol ? any : Protocol.Events[T extends keyof Protocol.Events ? T : never]) => void) => this;
  override addListener: <T extends keyof Protocol.Events | symbol>(event: T, listener: (payload: T extends symbol ? any : Protocol.Events[T extends keyof Protocol.Events ? T : never]) => void) => this;
  override off: <T extends keyof Protocol.Events | symbol>(event: T, listener: (payload: T extends symbol ? any : Protocol.Events[T extends keyof Protocol.Events ? T : never]) => void) => this;
  override removeListener: <T extends keyof Protocol.Events | symbol>(event: T, listener: (payload: T extends symbol ? any : Protocol.Events[T extends keyof Protocol.Events ? T : never]) => void) => this;
  override once: <T extends keyof Protocol.Events | symbol>(event: T, listener: (payload: T extends symbol ? any : Protocol.Events[T extends keyof Protocol.Events ? T : never]) => void) => this;

  constructor(connection: WKConnection, sessionId: string, rawSend: (message: any) => void) {
    super();
    this.setMaxListeners(0);
    this.connection = connection;
    this.sessionId = sessionId;
    this._rawSend = rawSend;

    this.on = super.on;
    this.off = super.removeListener;
    this.addListener = super.addListener;
    this.removeListener = super.removeListener;
    this.once = super.once;
  }

  async send<T extends keyof Protocol.CommandParameters>(
    method: T,
    params?: Protocol.CommandParameters[T]
  ): Promise<Protocol.CommandReturnValues[T]> {
    if (this._crashed || this._disposed || this.connection._browserDisconnectedLogs)
      throw new ProtocolError(this._crashed ? 'crashed' : 'closed', undefined, this.connection._browserDisconnectedLogs);
    const id = this.connection.nextMessageId();
    const messageObj = { id, method, params };
    this._rawSend(messageObj);
    return new Promise<Protocol.CommandReturnValues[T]>((resolve, reject) => {
      this._callbacks.set(id, { resolve, reject, error: new ProtocolError('error', method) });
    });
  }

  sendMayFail<T extends keyof Protocol.CommandParameters>(method: T, params?: Protocol.CommandParameters[T]): Promise<Protocol.CommandReturnValues[T] | void> {
    return this.send(method, params).catch(error => debugLogger.log('error', error));
  }

  markAsCrashed() {
    this._crashed = true;
  }

  isDisposed(): boolean {
    return this._disposed;
  }

  dispose() {
    for (const callback of this._callbacks.values()) {
      callback.error.type = this._crashed ? 'crashed' : 'closed';
      callback.error.logs = this.connection._browserDisconnectedLogs;
      callback.reject(callback.error);
    }
    this._callbacks.clear();
    this._disposed = true;
  }

  dispatchMessage(object: any) {
    if (object.id && this._callbacks.has(object.id)) {
      const callback = this._callbacks.get(object.id)!;
      this._callbacks.delete(object.id);
      if (object.error) {
        callback.error.setMessage(object.error.message);
        callback.reject(callback.error);
      } else {
        callback.resolve(object.result);
      }
    } else if (object.id && !object.error) {
      // Response might come after session has been disposed and rejected all callbacks.
      assert(this.isDisposed());
    } else {
      Promise.resolve().then(() => this.emit(object.method, object.params));
    }
  }
}
