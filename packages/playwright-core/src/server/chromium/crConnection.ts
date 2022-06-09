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

import { assert } from '../../utils';
import type { ConnectionTransport, ProtocolRequest, ProtocolResponse } from '../transport';
import type { Protocol } from './protocol';
import { EventEmitter } from 'events';
import { rewriteErrorMessage } from '../../utils/stackTrace';
import type { RecentLogsCollector } from '../../common/debugLogger';
import { debugLogger } from '../../common/debugLogger';
import type { ProtocolLogger } from '../types';
import { helper } from '../helper';
import { ProtocolError } from '../protocolError';

export const ConnectionEvents = {
  Disconnected: Symbol('ConnectionEvents.Disconnected')
};

// CRPlaywright uses this special id to issue Browser.close command which we
// should ignore.
export const kBrowserCloseMessageId = -9999;

export class CRConnection extends EventEmitter {
  private _lastId = 0;
  private readonly _transport: ConnectionTransport;
  private readonly _sessions = new Map<string, CRSession>();
  private readonly _protocolLogger: ProtocolLogger;
  private readonly _browserLogsCollector: RecentLogsCollector;
  readonly rootSession: CRSession;
  _closed = false;

  constructor(transport: ConnectionTransport, protocolLogger: ProtocolLogger, browserLogsCollector: RecentLogsCollector) {
    super();
    this.setMaxListeners(0);
    this._transport = transport;
    this._protocolLogger = protocolLogger;
    this._browserLogsCollector = browserLogsCollector;
    this._transport.onmessage = this._onMessage.bind(this);
    this._transport.onclose = this._onClose.bind(this);
    this.rootSession = new CRSession(this, '', 'browser', '');
    this._sessions.set('', this.rootSession);
  }

  static fromSession(session: CRSession): CRConnection {
    return session._connection!;
  }

  session(sessionId: string): CRSession | null {
    return this._sessions.get(sessionId) || null;
  }

  _rawSend(sessionId: string, method: string, params: any): number {
    const id = ++this._lastId;
    const message: ProtocolRequest = { id, method, params };
    if (sessionId)
      message.sessionId = sessionId;
    this._protocolLogger('send', message);
    this._transport.send(message);
    return id;
  }

  async _onMessage(message: ProtocolResponse) {
    this._protocolLogger('receive', message);
    if (message.id === kBrowserCloseMessageId)
      return;
    if (message.method === 'Target.attachedToTarget') {
      const sessionId = message.params.sessionId;
      const rootSessionId = message.sessionId || '';
      const session = new CRSession(this, rootSessionId, message.params.targetInfo.type, sessionId);
      this._sessions.set(sessionId, session);
    } else if (message.method === 'Target.detachedFromTarget') {
      const session = this._sessions.get(message.params.sessionId);
      if (session) {
        session._onClosed(undefined);
        this._sessions.delete(message.params.sessionId);
      }
    }
    const session = this._sessions.get(message.sessionId || '');
    if (session)
      session._onMessage(message);
  }

  _onClose() {
    this._closed = true;
    this._transport.onmessage = undefined;
    this._transport.onclose = undefined;
    const browserDisconnectedLogs = helper.formatBrowserLogs(this._browserLogsCollector.recentLogs());
    for (const session of this._sessions.values())
      session._onClosed(browserDisconnectedLogs);
    this._sessions.clear();
    Promise.resolve().then(() => this.emit(ConnectionEvents.Disconnected));
  }

  close() {
    if (!this._closed)
      this._transport.close();
  }

  async createSession(targetInfo: Protocol.Target.TargetInfo): Promise<CRSession> {
    const { sessionId } = await this.rootSession.send('Target.attachToTarget', { targetId: targetInfo.targetId, flatten: true });
    return this._sessions.get(sessionId)!;
  }

  async createBrowserSession(): Promise<CRSession> {
    const { sessionId } = await this.rootSession.send('Target.attachToBrowserTarget');
    return this._sessions.get(sessionId)!;
  }
}

export const CRSessionEvents = {
  Disconnected: Symbol('Events.CDPSession.Disconnected')
};

export class CRSession extends EventEmitter {
  _connection: CRConnection | null;
  _eventListener?: (method: string, params?: Object) => void;
  private readonly _callbacks = new Map<number, {resolve: (o: any) => void, reject: (e: ProtocolError) => void, error: ProtocolError, method: string}>();
  private readonly _targetType: string;
  private readonly _sessionId: string;
  private readonly _rootSessionId: string;
  private _crashed: boolean = false;
  private _browserDisconnectedLogs: string | undefined;
  override on: <T extends keyof Protocol.Events | symbol>(event: T, listener: (payload: T extends symbol ? any : Protocol.Events[T extends keyof Protocol.Events ? T : never]) => void) => this;
  override addListener: <T extends keyof Protocol.Events | symbol>(event: T, listener: (payload: T extends symbol ? any : Protocol.Events[T extends keyof Protocol.Events ? T : never]) => void) => this;
  override off: <T extends keyof Protocol.Events | symbol>(event: T, listener: (payload: T extends symbol ? any : Protocol.Events[T extends keyof Protocol.Events ? T : never]) => void) => this;
  override removeListener: <T extends keyof Protocol.Events | symbol>(event: T, listener: (payload: T extends symbol ? any : Protocol.Events[T extends keyof Protocol.Events ? T : never]) => void) => this;
  override once: <T extends keyof Protocol.Events | symbol>(event: T, listener: (payload: T extends symbol ? any : Protocol.Events[T extends keyof Protocol.Events ? T : never]) => void) => this;
  readonly guid: string;

  constructor(connection: CRConnection, rootSessionId: string, targetType: string, sessionId: string) {
    super();
    this.guid = `cdp-session@${sessionId}`;
    this.setMaxListeners(0);
    this._connection = connection;
    this._rootSessionId = rootSessionId;
    this._targetType = targetType;
    this._sessionId = sessionId;

    this.on = super.on;
    this.addListener = super.addListener;
    this.off = super.removeListener;
    this.removeListener = super.removeListener;
    this.once = super.once;
  }

  _markAsCrashed() {
    this._crashed = true;
  }

  async send<T extends keyof Protocol.CommandParameters>(
    method: T,
    params?: Protocol.CommandParameters[T]
  ): Promise<Protocol.CommandReturnValues[T]> {
    if (this._crashed)
      throw new ProtocolError(true, 'Target crashed');
    if (this._browserDisconnectedLogs !== undefined)
      throw new ProtocolError(true, `Browser closed.` + this._browserDisconnectedLogs);
    if (!this._connection)
      throw new ProtocolError(true, `Target closed`);
    const id = this._connection._rawSend(this._sessionId, method, params);
    return new Promise((resolve, reject) => {
      this._callbacks.set(id, { resolve, reject, error: new ProtocolError(false), method });
    });
  }

  _sendMayFail<T extends keyof Protocol.CommandParameters>(method: T, params?: Protocol.CommandParameters[T]): Promise<Protocol.CommandReturnValues[T] | void> {
    return this.send(method, params).catch((error: ProtocolError) => debugLogger.log('error', error));
  }

  _onMessage(object: ProtocolResponse) {
    if (object.id && this._callbacks.has(object.id)) {
      const callback = this._callbacks.get(object.id)!;
      this._callbacks.delete(object.id);
      if (object.error)
        callback.reject(createProtocolError(callback.error, callback.method, object.error));
      else
        callback.resolve(object.result);
    } else if (object.id && object.error?.code === -32001) {
      // Message to a closed session, just ignore it.
    } else {
      assert(!object.id);
      Promise.resolve().then(() => {
        if (this._eventListener)
          this._eventListener(object.method!, object.params);
        this.emit(object.method!, object.params);
      });
    }
  }

  async detach() {
    if (!this._connection)
      throw new Error(`Session already detached. Most likely the ${this._targetType} has been closed.`);
    const rootSession = this._connection.session(this._rootSessionId);
    if (!rootSession)
      throw new Error('Root session has been closed');
    await rootSession.send('Target.detachFromTarget', { sessionId: this._sessionId });
  }

  _onClosed(browserDisconnectedLogs: string | undefined) {
    this._browserDisconnectedLogs = browserDisconnectedLogs;
    const errorMessage = browserDisconnectedLogs !== undefined ? 'Browser closed.' + browserDisconnectedLogs : 'Target closed';
    for (const callback of this._callbacks.values()) {
      callback.error.sessionClosed = true;
      callback.reject(rewriteErrorMessage(callback.error, errorMessage));
    }
    this._callbacks.clear();
    this._connection = null;
    Promise.resolve().then(() => this.emit(CRSessionEvents.Disconnected));
  }
}

function createProtocolError(error: ProtocolError, method: string, protocolError: { message: string; data: any; }): ProtocolError {
  let message = `Protocol error (${method}): ${protocolError.message}`;
  if ('data' in protocolError)
    message += ` ${protocolError.data}`;
  return rewriteErrorMessage(error, message);
}
