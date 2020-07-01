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
import { helper, debugAssert } from '../../helper';
import { Channel } from '../channels';
import { serializeError } from '../serializers';

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

  constructor(scope: DispatcherScope, object: Type, type: string, initializer: Initializer, guid = type + '@' + helper.guid()) {
    super();
    this._type = type;
    this._guid = guid;
    this._object = object;
    this._scope = scope;
    scope.bind(this._guid, this);
    (object as any)[dispatcherSymbol] = this;
    this._scope.sendMessageToClient(this._guid, '__create__', { type, initializer });
  }

  _dispatchEvent(method: string, params: Dispatcher<any, any> | any = {}) {
    this._scope.sendMessageToClient(this._guid, method, params);
  }
}

export class DispatcherScope {
  private _connection: DispatcherConnection;
  private _dispatchers = new Map<string, Dispatcher<any, any>>();
  private _parent: DispatcherScope | undefined;
  private _childScopes = new Set<DispatcherScope>();

  constructor(connection: DispatcherConnection, parent?: DispatcherScope) {
    this._connection = connection;
    this._parent = parent;
    if (parent)
      parent._childScopes.add(this);
  }

  createChild(): DispatcherScope {
    return new DispatcherScope(this._connection, this);
  }

  bind(guid: string, arg: Dispatcher<any, any>) {
    this._dispatchers.set(guid, arg);
    this._connection._dispatchers.set(guid, arg);
  }

  dispose() {
    for (const child of [...this._childScopes])
      child.dispose();
    this._childScopes.clear();
    for (const guid of this._dispatchers.keys())
      this._connection._dispatchers.delete(guid);
    if (this._parent)
      this._parent._childScopes.delete(this);
  }

  async sendMessageToClient(guid: string, method: string, params: any): Promise<any> {
    this._connection._sendMessageToClient(guid, method, params);
  }
}

export class DispatcherConnection {
  readonly _dispatchers = new Map<string, Dispatcher<any, any>>();
  onmessage = (message: string) => {};

  async _sendMessageToClient(guid: string, method: string, params: any): Promise<any> {
    this.onmessage(JSON.stringify({ guid, method, params: this._replaceDispatchersWithGuids(params) }));
  }

  createScope(): DispatcherScope {
    return new DispatcherScope(this);
  }

  async dispatch(message: string) {
    const parsedMessage = JSON.parse(message);
    const { id, guid, method, params } = parsedMessage;
    const dispatcher = this._dispatchers.get(guid);
    if (!dispatcher) {
      this.onmessage(JSON.stringify({ id, error: serializeError(new Error('Target browser or context has been closed')) }));
      return;
    }
    try {
      const result = await (dispatcher as any)[method](this._replaceGuidsWithDispatchers(params));
      this.onmessage(JSON.stringify({ id, result: this._replaceDispatchersWithGuids(result) }));
    } catch (e) {
      this.onmessage(JSON.stringify({ id, error: serializeError(e) }));
    }
  }

  private _replaceDispatchersWithGuids(payload: any): any {
    if (!payload)
      return payload;
    if (payload instanceof Dispatcher)
      return { guid: payload._guid };
    if (Array.isArray(payload))
      return payload.map(p => this._replaceDispatchersWithGuids(p));
    // TODO: send base64
    if (payload instanceof Buffer)
      return payload;
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
    // TODO: send base64
    if (payload instanceof Buffer)
      return payload;
    if (typeof payload === 'object') {
      const result: any = {};
      for (const key of Object.keys(payload))
        result[key] = this._replaceGuidsWithDispatchers(payload[key]);
      return result;
    }
    return payload;
  }
}
