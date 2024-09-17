/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { EventEmitter } from 'events';
import { assert } from '../../utils';
import type { ConnectionTransport, ProtocolRequest, ProtocolResponse } from '../transport';
import type { RecentLogsCollector } from '../../utils/debugLogger';
import { debugLogger } from '../../utils/debugLogger';
import type { ProtocolLogger } from '../types';
import { helper } from '../helper';
import { ProtocolError } from '../protocolError';
import type * as bidi from './third_party/bidiProtocol';
import type * as bidiCommands from './third_party/bidiCommands';

// BidiPlaywright uses this special id to issue Browser.close command which we
// should ignore.
export const kBrowserCloseMessageId = 0;

export class BidiConnection {
  private readonly _transport: ConnectionTransport;
  private readonly _onDisconnect: () => void;
  private readonly _protocolLogger: ProtocolLogger;
  private readonly _browserLogsCollector: RecentLogsCollector;
  _browserDisconnectedLogs: string | undefined;
  private _lastId = 0;
  private _closed = false;
  readonly browserSession: BidiSession;
  readonly _browsingContextToSession = new Map<string, BidiSession>();

  constructor(transport: ConnectionTransport, onDisconnect: () => void, protocolLogger: ProtocolLogger, browserLogsCollector: RecentLogsCollector) {
    this._transport = transport;
    this._onDisconnect = onDisconnect;
    this._protocolLogger = protocolLogger;
    this._browserLogsCollector = browserLogsCollector;
    this.browserSession = new BidiSession(this, '', (message: any) => {
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
    const object = message as bidi.Message;
    // Bidi messages do not have a common session identifier, so we
    // route them based on BrowsingContext.
    if (object.type === 'event') {
      // Route page events to the right session.
      let context;
      if ('context' in object.params)
        context = object.params.context;
      else if (object.method === 'log.entryAdded' || object.method === 'script.message')
        context = object.params.source?.context;
      if (context) {
        const session = this._browsingContextToSession.get(context);
        if (session) {
          session.dispatchMessage(message);
          return;
        }
      }
    } else if (message.id) {
      // Find caller session.
      for (const session of this._browsingContextToSession.values()) {
        if (session.hasCallback(message.id)) {
          session.dispatchMessage(message);
          return;
        }
      }
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

  createMainFrameBrowsingContextSession(bowsingContextId: bidi.BrowsingContext.BrowsingContext): BidiSession {
    const result = new BidiSession(this, bowsingContextId, message => this.rawSend(message));
    this._browsingContextToSession.set(bowsingContextId, result);
    return result;
  }
}

type BidiEvents = {
  [K in bidi.Event['method']]: Extract<bidi.Event, {method: K}>;
};

export class BidiSession extends EventEmitter {
  readonly connection: BidiConnection;
  readonly sessionId: string;

  private _disposed = false;
  private readonly _rawSend: (message: any) => void;
  private readonly _callbacks = new Map<number, { resolve: (o: any) => void, reject: (e: ProtocolError) => void, error: ProtocolError }>();
  private _crashed: boolean = false;
  private readonly _browsingContexts = new Set<string>();

  override on: <T extends keyof BidiEvents | symbol>(event: T, listener: (payload: T extends symbol ? any : BidiEvents[T extends keyof BidiEvents ? T : never]['params']) => void) => this;
  override addListener: <T extends keyof BidiEvents | symbol>(event: T, listener: (payload: T extends symbol ? any : BidiEvents[T extends keyof BidiEvents ? T : never]['params']) => void) => this;
  override off: <T extends keyof BidiEvents | symbol>(event: T, listener: (payload: T extends symbol ? any : BidiEvents[T extends keyof BidiEvents ? T : never]['params']) => void) => this;
  override removeListener: <T extends keyof BidiEvents | symbol>(event: T, listener: (payload: T extends symbol ? any : BidiEvents[T extends keyof BidiEvents ? T : never]['params']) => void) => this;
  override once: <T extends keyof BidiEvents | symbol>(event: T, listener: (payload: T extends symbol ? any : BidiEvents[T extends keyof BidiEvents ? T : never]['params']) => void) => this;

  constructor(connection: BidiConnection, sessionId: string, rawSend: (message: any) => void) {
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

  addFrameBrowsingContext(context: string) {
    this._browsingContexts.add(context);
    this.connection._browsingContextToSession.set(context, this);
  }

  removeFrameBrowsingContext(context: string) {
    this._browsingContexts.delete(context);
    this.connection._browsingContextToSession.delete(context);
  }

  async send<T extends keyof bidiCommands.Commands>(
    method: T,
    params?: bidiCommands.Commands[T]['params']
  ): Promise<bidiCommands.Commands[T]['returnType']> {
    if (this._crashed || this._disposed || this.connection._browserDisconnectedLogs)
      throw new ProtocolError(this._crashed ? 'crashed' : 'closed', undefined, this.connection._browserDisconnectedLogs);
    const id = this.connection.nextMessageId();
    const messageObj = { id, method, params };
    this._rawSend(messageObj);
    return new Promise<bidiCommands.Commands[T]['returnType']>((resolve, reject) => {
      this._callbacks.set(id, { resolve, reject, error: new ProtocolError('error', method) });
    });
  }

  sendMayFail<T extends keyof bidiCommands.Commands>(method: T, params?: bidiCommands.Commands[T]['params']): Promise<bidiCommands.Commands[T]['returnType'] | void> {
    return this.send(method, params).catch(error => debugLogger.log('error', error));
  }

  markAsCrashed() {
    this._crashed = true;
  }

  isDisposed(): boolean {
    return this._disposed;
  }

  dispose() {
    this._disposed = true;
    this.connection._browsingContextToSession.delete(this.sessionId);
    for (const context of this._browsingContexts)
      this.connection._browsingContextToSession.delete(context);
    this._browsingContexts.clear();
    for (const callback of this._callbacks.values()) {
      callback.error.type = this._crashed ? 'crashed' : 'closed';
      callback.error.logs = this.connection._browserDisconnectedLogs;
      callback.reject(callback.error);
    }
    this._callbacks.clear();
  }

  hasCallback(id: number): boolean {
    return this._callbacks.has(id);
  }

  dispatchMessage(message: any) {
    const object = message as bidi.Message;
    if (object.id === kBrowserCloseMessageId)
      return;
    if (object.id && this._callbacks.has(object.id)) {
      const callback = this._callbacks.get(object.id)!;
      this._callbacks.delete(object.id);
      if (object.type === 'error') {
        callback.error.setMessage(object.error + '\nMessage: ' + object.message);
        callback.reject(callback.error);
      } else if (object.type === 'success') {
        callback.resolve(object.result);
      } else {
        callback.error.setMessage('Internal error, unexpected response type: ' + JSON.stringify(object));
        callback.reject(callback.error);
      }
    } else if (object.id) {
      // Response might come after session has been disposed and rejected all callbacks.
      assert(this.isDisposed());
    } else {
      Promise.resolve().then(() => this.emit(object.method, object.params));
    }
  }
}
