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
import { serializeError } from './serializers';

export class Dispatcher<Type, Initializer> extends EventEmitter implements Channel {
  readonly _guid: string;
  readonly _type: string;
  protected _scope: DispatcherScope;
  _object: any;

  constructor(scope: DispatcherScope, object: Type, type: string, initializer: Initializer, guid = type + '@' + helper.guid()) {
    super();
    this._type = type;
    this._guid = guid;
    this._object = object;
    this._scope = scope;
    scope.dispatchers.set(this._guid, this);
    (object as any)[scope.dispatcherSymbol] = this;
    this._scope.sendMessageToClient(this._guid, '__create__', { type, initializer });
  }

  _dispatchEvent(method: string, params: Dispatcher<any, any> | any = {}) {
    this._scope.sendMessageToClient(this._guid, method, params);
  }
}

export class DispatcherScope {
  readonly dispatchers = new Map<string, Dispatcher<any, any>>();
  readonly dispatcherSymbol = Symbol('dispatcher');
  sendMessageToClientTransport = (message: string) => {};

  async sendMessageToClient(guid: string, method: string, params: any): Promise<any> {
    this.sendMessageToClientTransport(JSON.stringify({ guid, method, params: this._replaceDispatchersWithGuids(params) }));
  }

  async dispatchMessageFromClient(message: string) {
    const parsedMessage = JSON.parse(message);
    const { id, guid, method, params } = parsedMessage;
    const dispatcher = this.dispatchers.get(guid)!;
    try {
      const result = await (dispatcher as any)[method](this._replaceGuidsWithDispatchers(params));
      this.sendMessageToClientTransport(JSON.stringify({ id, result: this._replaceDispatchersWithGuids(result) }));
    } catch (e) {
      this.sendMessageToClientTransport(JSON.stringify({ id, error: serializeError(e) }));
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
    if (payload.guid && this.dispatchers.has(payload.guid))
      return this.dispatchers.get(payload.guid);
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
