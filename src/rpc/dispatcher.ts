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
import { helper } from '../helper';
import { Channel } from './channels';

export class Dispatcher<Initializer> extends EventEmitter implements Channel {
  readonly _guid: string;
  readonly _type: string;
  protected _scope: DispatcherScope;
  _object: any;

  constructor(scope: DispatcherScope, object: any, type: string, initializer: Initializer, guid = type + '@' + helper.guid()) {
    super();
    this._type = type;
    this._guid = guid;
    this._object = object;
    this._scope = scope;
    scope.dispatchers.set(this._guid, this);
    object[scope.dispatcherSymbol] = this;
    this._scope.sendMessageToClient(this._guid, '__create__', { type, initializer });
  }

  _dispatchEvent(method: string, params: Dispatcher<any> | any = {}) {
    this._scope.sendMessageToClient(this._guid, method, params);
  }
}

export class DispatcherScope {
  readonly dispatchers = new Map<string, Dispatcher<any>>();
  readonly dispatcherSymbol = Symbol('dispatcher');
  sendMessageToClientTransport = (message: any) => {};

  async sendMessageToClient(guid: string, method: string, params: any): Promise<any> {
    this.sendMessageToClientTransport({ guid, method, params: this._replaceDispatchersWithGuids(params) });
  }

  async dispatchMessageFromClient(message: any): Promise<any> {
    const dispatcher = this.dispatchers.get(message.guid)!;
    const value = await (dispatcher as any)[message.method](this._replaceGuidsWithDispatchers(message.params));
    return this._replaceDispatchersWithGuids(value);
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
    if (typeof payload === 'object')
      return Object.fromEntries([...Object.entries(payload)].map(([n,v]) => [n, this._replaceDispatchersWithGuids(v)]));
    return payload;
  }

  private _replaceGuidsWithDispatchers(payload: any): any {
    if (!payload)
      return payload;
    if (Array.isArray(payload))
      return payload.map(p => this._replaceGuidsWithDispatchers(p));
    if (payload.guid && this.dispatchers.has(payload.guid))
      return this.dispatchers.get(payload.guid);
    // TODO: send base64
    if (payload instanceof Buffer)
      return payload;
    if (typeof payload === 'object')
      return Object.fromEntries([...Object.entries(payload)].map(([n,v]) => [n, this._replaceGuidsWithDispatchers(v)]));
    return payload;
  }
}
