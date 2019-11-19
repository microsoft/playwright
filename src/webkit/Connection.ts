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

import {assert} from '../helper';
import * as debug from 'debug';
import {EventEmitter} from 'events';
import { ConnectionTransport } from '../ConnectionTransport';
import { Protocol } from './protocol';

const debugProtocol = debug('playwright:protocol');
const debugWrappedMessage = require('debug')('wrapped');

export const ConnectionEvents = {
  Disconnected: Symbol('ConnectionEvents.Disconnected')
};

export class Connection extends EventEmitter {
  private _url: string;
  _lastId = 0;
  private _callbacks = new Map<number, {resolve:(o: any) => void, reject:  (e: Error) => void, error: Error, method: string}>();
  private _delay: number;
  private _transport: ConnectionTransport;
  private _sessions = new Map<string, TargetSession>();
  _closed = false;

  constructor(url: string, transport: ConnectionTransport, delay: number | undefined = 0) {
    super();
    this._url = url;
    this._delay = delay;

    this._transport = transport;
    this._transport.onmessage = this._onMessage.bind(this);
    this._transport.onclose = this._onClose.bind(this);
  }

  static fromSession(session: TargetSession): Connection {
    return session._connection;
  }

  url(): string {
    return this._url;
  }

  send<T extends keyof Protocol.CommandParameters>(
    method: T,
    params?: Protocol.CommandParameters[T]
  ): Promise<Protocol.CommandReturnValues[T]> {
    const id = this._rawSend({method, params});
    return new Promise((resolve, reject) => {
      this._callbacks.set(id, {resolve, reject, error: new Error(), method});
    });
  }

  _rawSend(message: any): number {
    const id = ++this._lastId;
    message = JSON.stringify(Object.assign({}, message, {id}));
    debugProtocol('SEND ► ' + message);
    this._transport.send(message);
    return id;
  }

  async _onMessage(message: string) {
    if (this._delay)
      await new Promise(f => setTimeout(f, this._delay));
    debugProtocol('◀ RECV ' + message);
    const object = JSON.parse(message);
    this._dispatchTargetMessageToSession(object);
    if (object.id) {
      const callback = this._callbacks.get(object.id);
      // Callbacks could be all rejected if someone has called `.dispose()`.
      if (callback) {
        this._callbacks.delete(object.id);
        if (object.error)
          callback.reject(createProtocolError(callback.error, callback.method, object));
        else
          callback.resolve(object.result);
      } else {
        assert(this._closed, 'Received response for unknown callback: ' + object.id);
      }
    } else {
      this.emit(object.method, object.params);
    }
  }

  _dispatchTargetMessageToSession(object: {method: string, params: any}) {
    if (object.method === 'Target.targetCreated') {
      const {targetId, type} = object.params.targetInfo;
      // FIXME: this is a workaround for cross-origin navigation in WebKit.
      // console.log(`[${targetId}] ${object.method}`);
      const session = new TargetSession(this, type, targetId);
      this._sessions.set(targetId, session);
    } else if (object.method === 'Target.targetDestroyed') {
      // console.log(`[${object.params.targetId}] ${object.method}`);
      const session = this._sessions.get(object.params.targetId);
      if (session) {
        // FIXME: this is a workaround for cross-origin navigation in WebKit.
        session._onClosed();
        this._sessions.delete(object.params.targetId);
      }
    } else if (object.method === 'Target.dispatchMessageFromTarget') {
      const session = this._sessions.get(object.params.targetId);
      if (!session)
        throw new Error('Unknown target: ' + object.params.targetId);
      session._dispatchMessageFromTarget(object.params.message);
    } else if (object.method === 'Target.didCommitProvisionalTarget') {
      const {oldTargetId, newTargetId} = object.params;
      const newSession = this._sessions.get(newTargetId);
      if (!newSession)
        throw new Error('Unknown new target: ' + newTargetId);
      const oldSession = this._sessions.get(oldTargetId);
      if (!oldSession)
        throw new Error('Unknown old target: ' + oldTargetId);
    }
  }

  _onClose() {
    if (this._closed)
      return;
    this._closed = true;
    this._transport.onmessage = null;
    this._transport.onclose = null;
    for (const callback of this._callbacks.values())
      callback.reject(rewriteError(callback.error, `Protocol error (${callback.method}): Target closed.`));
    this._callbacks.clear();
    for (const session of this._sessions.values())
      session._onClosed();
    this._sessions.clear();
    this.emit(ConnectionEvents.Disconnected);
  }

  dispose() {
    this._onClose();
    this._transport.close();
  }

  session(targetId: string) : TargetSession {
    return this._sessions.get(targetId);
  }
}

export const TargetSessionEvents = {
  Disconnected: Symbol('TargetSessionEvents.Disconnected')
};

export class TargetSession extends EventEmitter {
  _connection: Connection;
  private _callbacks = new Map<number, {resolve:(o: any) => void, reject: (e: Error) => void, error: Error, method: string}>();
  private _targetType: string;
  private _sessionId: string;
  private _out = [];
  private _in = [];
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
    const innerId = ++this._connection._lastId;
    const messageObj = {
      id: innerId,
      method,
      params
    };
    debugWrappedMessage('SEND ► ' + JSON.stringify(messageObj, null, 2));
    this._out.push(messageObj);
    // Serialize message before adding callback in case JSON throws.
    const message = JSON.stringify(messageObj);
    const result = new Promise<Protocol.CommandReturnValues[T]>((resolve, reject) => {
      this._callbacks.set(innerId, {resolve, reject, error: new Error(), method});
    });
    this._connection.send('Target.sendMessageToTarget', {
      message: message, targetId: this._sessionId
    }).catch(e => {
      // There is a possible race of the connection closure. We may have received
      // targetDestroyed notification before response for the command, in that
      // case it's safe to swallow the exception.g
      const callback = this._callbacks.get(innerId);
      assert(!callback, 'Callback was not rejected when target was destroyed.');
    });
    return result;
  }

  _dispatchMessageFromTarget(message: string) {
    const object = JSON.parse(message);
    debugWrappedMessage('◀ RECV ' + JSON.stringify(object, null, 2));
    this._in.push(object);
    if (object.id && this._callbacks.has(object.id)) {
      const callback = this._callbacks.get(object.id);
      this._callbacks.delete(object.id);
      if (object.error)
        callback.reject(createProtocolError(callback.error, callback.method, object));
      else
        callback.resolve(object.result);
    } else {
      assert(!object.id);
      // console.log(`[${this._sessionId}] ${object.method}`);
      this.emit(object.method, object.params);
    }
  }

  _onClosed() {
    for (const callback of this._callbacks.values())
      callback.reject(rewriteError(callback.error, `Protocol error (${callback.method}): Target closed.`));
    this._callbacks.clear();
    this._connection = null;
    this.emit(TargetSessionEvents.Disconnected);
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
