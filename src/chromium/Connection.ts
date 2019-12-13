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

import * as debug from 'debug';
import { EventEmitter } from 'events';
import { ConnectionTransport, SerializingTransport } from '../transport';
import { assert } from '../helper';
import { Protocol } from './protocol';

const debugProtocol = debug('playwright:protocol');

export const ConnectionEvents = {
  Disconnected: Symbol('ConnectionEvents.Disconnected')
};

export class Connection extends EventEmitter {
  private _url: string;
  private _lastId = 0;
  private _transport: ConnectionTransport;
  private _sessions = new Map<string, CDPSession>();
  readonly rootSession: CDPSession;
  _closed = false;

  constructor(url: string, transport: ConnectionTransport, delay: number | undefined = 0) {
    super();
    this._url = url;

    this._transport = new SerializingTransport(transport, delay);
    this._transport.onmessage = this._onMessage.bind(this);
    this._transport.onclose = this._onClose.bind(this);
    this.rootSession = new CDPSession(this, 'browser', '');
    this._sessions.set('', this.rootSession);
  }

  static fromSession(session: CDPSession): Connection {
    return session._connection;
  }

  session(sessionId: string): CDPSession | null {
    return this._sessions.get(sessionId) || null;
  }

  url(): string {
    return this._url;
  }

  _rawSend(sessionId: string, message: any): number {
    const id = ++this._lastId;
    message.id = id;
    if (sessionId)
      message.sessionId = sessionId;
    const data = JSON.stringify(message);
    debugProtocol('SEND ► ' + data);
    this._transport.send(data);
    return id;
  }

  async _onMessage(message: string) {
    debugProtocol('◀ RECV ' + message);
    const object = JSON.parse(message);
    if (object.method === 'Target.attachedToTarget') {
      const sessionId = object.params.sessionId;
      const session = new CDPSession(this, object.params.targetInfo.type, sessionId);
      this._sessions.set(sessionId, session);
    } else if (object.method === 'Target.detachedFromTarget') {
      const session = this._sessions.get(object.params.sessionId);
      if (session) {
        session._onClosed();
        this._sessions.delete(object.params.sessionId);
      }
    }
    const session = this._sessions.get(object.sessionId || '');
    if (session)
      session._onMessage(object);
  }

  _onClose() {
    if (this._closed)
      return;
    this._closed = true;
    this._transport.onmessage = null;
    this._transport.onclose = null;
    for (const session of this._sessions.values())
      session._onClosed();
    this._sessions.clear();
    this.emit(ConnectionEvents.Disconnected);
  }

  dispose() {
    this._onClose();
    this._transport.close();
  }

  async createSession(targetInfo: Protocol.Target.TargetInfo): Promise<CDPSession> {
    const { sessionId } = await this.rootSession.send('Target.attachToTarget', { targetId: targetInfo.targetId, flatten: true });
    return this._sessions.get(sessionId);
  }

  async createBrowserSession(): Promise<CDPSession> {
    const { sessionId } = await this.rootSession.send('Target.attachToBrowserTarget');
    return this._sessions.get(sessionId);
  }
}

export const CDPSessionEvents = {
  Disconnected: Symbol('Events.CDPSession.Disconnected')
};

export class CDPSession extends EventEmitter {
  _connection: Connection;
  private _callbacks = new Map<number, {resolve:(o: any) => void, reject: (e: Error) => void, error: Error, method: string}>();
  private _targetType: string;
  private _sessionId: string;
  on: <T extends keyof Protocol.Events | symbol>(event: T, listener: (payload: T extends symbol ? any : Protocol.Events[T extends keyof Protocol.Events ? T : never]) => void) => this;
  addListener: <T extends keyof Protocol.Events | symbol>(event: T, listener: (payload: T extends symbol ? any : Protocol.Events[T extends keyof Protocol.Events ? T : never]) => void) => this;
  off: <T extends keyof Protocol.Events | symbol>(event: T, listener: (payload: T extends symbol ? any : Protocol.Events[T extends keyof Protocol.Events ? T : never]) => void) => this;
  removeListener: <T extends keyof Protocol.Events | symbol>(event: T, listener: (payload: T extends symbol ? any : Protocol.Events[T extends keyof Protocol.Events ? T : never]) => void) => this;
  once: <T extends keyof Protocol.Events | symbol>(event: T, listener: (payload: T extends symbol ? any : Protocol.Events[T extends keyof Protocol.Events ? T : never]) => void) => this;

  constructor(connection: Connection, targetType: string, sessionId: string) {
    super();
    this._connection = connection;
    this._targetType = targetType;
    this._sessionId = sessionId;
  }

  send<T extends keyof Protocol.CommandParameters>(
    method: T,
    params?: Protocol.CommandParameters[T]
  ): Promise<Protocol.CommandReturnValues[T]> {
    if (!this._connection)
      return Promise.reject(new Error(`Protocol error (${method}): Session closed. Most likely the ${this._targetType} has been closed.`));
    const id = this._connection._rawSend(this._sessionId, { method, params });
    return new Promise((resolve, reject) => {
      this._callbacks.set(id, {resolve, reject, error: new Error(), method});
    });
  }

  _onMessage(object: { id?: number; method: string; params: any; error: { message: string; data: any; }; result?: any; }) {
    if (object.id && this._callbacks.has(object.id)) {
      const callback = this._callbacks.get(object.id);
      this._callbacks.delete(object.id);
      if (object.error)
        callback.reject(createProtocolError(callback.error, callback.method, object));
      else
        callback.resolve(object.result);
    } else {
      assert(!object.id);
      this.emit(object.method, object.params);
    }
  }

  async detach() {
    if (!this._connection)
      throw new Error(`Session already detached. Most likely the ${this._targetType} has been closed.`);
    await this._connection.rootSession.send('Target.detachFromTarget', { sessionId: this._sessionId });
  }

  _onClosed() {
    for (const callback of this._callbacks.values())
      callback.reject(rewriteError(callback.error, `Protocol error (${callback.method}): Target closed.`));
    this._callbacks.clear();
    this._connection = null;
    this.emit(CDPSessionEvents.Disconnected);
  }
}

function createProtocolError(error: Error, method: string, object: { error: { message: string; data: any; }; }): Error {
  let message = `Protocol error (${method}): ${object.error.message}`;
  if ('data' in object.error)
    message += ` ${object.error.data}`;
  return rewriteError(error, message);
}

function rewriteError(error: Error, message: string): Error {
  error.message = message;
  return error;
}
