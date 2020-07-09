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
import { helper, debugAssert, assert } from '../../helper';
import { Channel, LogMessage } from '../channels';
import { serializeError } from '../serializers';
import { kProgressLoggerSink } from '../../progress';
import { LoggerSink } from '../../loggerSink';

export const dispatcherSymbol = Symbol('dispatcher');

export function lookupDispatcher<DispatcherType>(object: any): DispatcherType {
  const result = object[dispatcherSymbol];
  debugAssert(result);
  return result;
}

export function existingDispatcher<DispatcherType>(object: any): DispatcherType {
  return object[dispatcherSymbol];
}

export function lookupNullableDispatcher<DispatcherType>(object: any | null): DispatcherType | null {
  return object ? lookupDispatcher(object) : null;
}

export class Dispatcher<Type, Initializer> extends EventEmitter implements Channel {
  readonly _guid: string;
  readonly _type: string;
  protected _scope: DispatcherScope;
  _object: Type;

  constructor(scope: DispatcherScope, object: Type, type: string, initializer: Initializer, isScope?: boolean, guid = type + '@' + helper.guid()) {
    super();
    this._type = type;
    this._guid = guid;
    this._object = object;
    this._scope = isScope ? scope.createChild(guid) : scope;
    scope.bind(this._guid, this);
    (object as any)[dispatcherSymbol] = this;
    this._scope.sendMessageToClient(scope.guid, '__create__', { type, initializer, guid });
  }

  _dispatchEvent(method: string, params: Dispatcher<any, any> | any = {}) {
    this._scope.sendMessageToClient(this._guid, method, params);
  }
}

export class DispatcherScope {
  private _connection: DispatcherConnection;
  private _dispatchers = new Map<string, Dispatcher<any, any>>();
  private _parent: DispatcherScope | undefined;
  readonly _children = new Set<DispatcherScope>();
  readonly guid: string;

  constructor(connection: DispatcherConnection, guid: string, parent?: DispatcherScope) {
    this._connection = connection;
    this._parent = parent;
    this.guid = guid;
    if (parent)
      parent._children.add(this);
  }

  createChild(guid: string): DispatcherScope {
    return new DispatcherScope(this._connection, guid, this);
  }

  bind(guid: string, arg: Dispatcher<any, any>) {
    assert(!this._dispatchers.has(guid));
    this._dispatchers.set(guid, arg);
    this._connection._dispatchers.set(guid, arg);
  }

  dispose() {
    // Take care of hierarchy.
    for (const child of [...this._children])
      child.dispose();
    this._children.clear();

    // Delete self from scopes and objects.
    this._connection._dispatchers.delete(this.guid);

    // Delete all of the objects from connection.
    for (const guid of this._dispatchers.keys())
      this._connection._dispatchers.delete(guid);

    if (this._parent) {
      this._parent._children.delete(this);
      this._parent._dispatchers.delete(this.guid);
    }
  }

  async sendMessageToClient(guid: string, method: string, params: any): Promise<any> {
    this._connection._sendMessageToClient(guid, method, params);
  }

  _dumpScopeState(scopes: any[]): any {
    const scopeState: any = { _guid: this.guid };
    scopeState.objects = [...this._dispatchers.keys()];
    scopes.push(scopeState);
    [...this._children].map(c => c._dumpScopeState(scopes));
    return scopeState;
  }
}

export class DispatcherConnection {
  readonly _dispatchers = new Map<string, Dispatcher<any, any>>();
  private _rootScope: DispatcherScope;
  onmessage = (message: string) => {};

  async _sendMessageToClient(guid: string, method: string, params: any): Promise<any> {
    this.onmessage(JSON.stringify({ guid, method, params: this._replaceDispatchersWithGuids(params) }));
  }

  constructor() {
    this._rootScope = new DispatcherScope(this, '');
  }

  rootScope(): DispatcherScope {
    return this._rootScope;
  }

  async dispatch(message: string) {
    const parsedMessage = JSON.parse(message);
    const { id, guid, method, params } = parsedMessage;
    const dispatcher = this._dispatchers.get(guid);
    if (!dispatcher) {
      this.onmessage(JSON.stringify({ id, error: serializeError(new Error('Target browser or context has been closed')) }));
      return;
    }
    if (method === 'debugScopeState') {
      const dispatcherState: any = {};
      dispatcherState.objects = [...this._dispatchers.keys()];
      dispatcherState.scopes = [];
      this._rootScope._dumpScopeState(dispatcherState.scopes);
      this.onmessage(JSON.stringify({ id, result: dispatcherState }));
      return;
    }
    let handled = false;
    try {
      const args = this._replaceGuidsWithDispatchers(params);
      if (args && (typeof args === 'object')) {
        const sink: LoggerSink = {
          isEnabled: (name, severity) => {
            return true;
          },
          log: (name, severity, message, args, hints) => {
            // TODO: fix all cases where we log after the command was handled.
            if (handled)
              return;
            const logMessage: LogMessage = {
              commandId: id,
              name,
              severity,
              message: typeof message === 'string' ? message : serializeError(message),
              args,
              hints,
            };
            this.onmessage(JSON.stringify({ log: logMessage }));
          },
        };
        args[kProgressLoggerSink] = sink;
      }
      const result = await (dispatcher as any)[method](args);
      handled = true;
      this.onmessage(JSON.stringify({ id, result: this._replaceDispatchersWithGuids(result) }));
    } catch (e) {
      handled = true;
      this.onmessage(JSON.stringify({ id, error: serializeError(e) }));
    }
  }

  _replaceDispatchersWithGuids(payload: any): any {
    if (!payload)
      return payload;
    if (payload instanceof Dispatcher)
      return { guid: payload._guid };
    if (Array.isArray(payload))
      return payload.map(p => this._replaceDispatchersWithGuids(p));
    if (typeof payload === 'object') {
      const result: any = {};
      for (const key of Object.keys(payload))
        result[key] = this._replaceDispatchersWithGuids(payload[key]);
      return result;
    }
    return payload;
  }

  private _replaceGuidsWithDispatchers(payload: any): any {
    if (!payload)
      return payload;
    if (Array.isArray(payload))
      return payload.map(p => this._replaceGuidsWithDispatchers(p));
    if (payload.guid && this._dispatchers.has(payload.guid))
      return this._dispatchers.get(payload.guid);
    if (typeof payload === 'object') {
      const result: any = {};
      for (const key of Object.keys(payload))
        result[key] = this._replaceGuidsWithDispatchers(payload[key]);
      return result;
    }
    return payload;
  }
}
