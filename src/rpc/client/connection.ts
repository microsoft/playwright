/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

import { Browser } from './browser';
import { BrowserContext } from './browserContext';
import { BrowserType } from './browserType';
import { ChannelOwner } from './channelOwner';
import { ElementHandle } from './elementHandle';
import { Frame } from './frame';
import { JSHandle } from './jsHandle';
import { Request, Response, Route } from './network';
import { Page, BindingCall } from './page';
import { Worker } from './worker';
import debug = require('debug');
import { ConsoleMessage } from './consoleMessage';
import { Dialog } from './dialog';
import { Download } from './download';
import { parseError } from '../serializers';
import { BrowserServer } from './browserServer';

export class Connection {
  readonly _objects = new Map<string, ChannelOwner<any, any>>();
  readonly _waitingForObject = new Map<string, any>();
  onmessage = (message: string): void => {};
  private _lastId = 0;
  private _callbacks = new Map<number, { resolve: (a: any) => void, reject: (a: Error) => void }>();
  readonly _scopes = new Map<string, ConnectionScope>();
  private _rootScript: ConnectionScope;

  constructor() {
    this._rootScript = this.createScope('');
  }

  async waitForObjectWithKnownName(guid: string): Promise<any> {
    if (this._objects.has(guid))
      return this._objects.get(guid)!;
    return new Promise(f => this._waitingForObject.set(guid, f));
  }

  async sendMessageToServer(message: { guid: string, method: string, params: any }): Promise<any> {
    const id = ++this._lastId;
    const converted = { id, ...message, params: this._replaceChannelsWithGuids(message.params) };
    debug('pw:channel:command')(converted);
    this.onmessage(JSON.stringify(converted));
    return new Promise((resolve, reject) => this._callbacks.set(id, { resolve, reject }));
  }

  _debugScopeState(): any {
    const scopeState: any = {};
    scopeState.objects = [...this._objects.keys()];
    scopeState.scopes = [...this._scopes.values()].map(scope => ({
      _guid: scope._guid,
      objects: [...scope._objects.keys()]
    }));
    return scopeState;
  }

  dispatch(message: string) {
    const parsedMessage = JSON.parse(message);
    const { id, guid, method, params, result, error } = parsedMessage;
    if (id) {
      debug('pw:channel:response')(parsedMessage);
      const callback = this._callbacks.get(id)!;
      this._callbacks.delete(id);
      if (error)
        callback.reject(parseError(error));
      else
        callback.resolve(this._replaceGuidsWithChannels(result));
      return;
    }

    debug('pw:channel:event')(parsedMessage);
    if (method === '__create__') {
      const scope = this._scopes.get(guid)!;
      scope.createRemoteObject(params.type, params.guid, params.initializer);
      return;
    }
    const object = this._objects.get(guid)!;
    object._channel.emit(method, this._replaceGuidsWithChannels(params));
  }


  private _replaceChannelsWithGuids(payload: any): any {
    if (!payload)
      return payload;
    if (Array.isArray(payload))
      return payload.map(p => this._replaceChannelsWithGuids(p));
    if (payload._object instanceof ChannelOwner)
      return { guid: payload._object.guid };
    if (typeof payload === 'object') {
      const result: any = {};
      for (const key of Object.keys(payload))
        result[key] = this._replaceChannelsWithGuids(payload[key]);
      return result;
    }
    return payload;
  }

  _replaceGuidsWithChannels(payload: any): any {
    if (!payload)
      return payload;
    if (Array.isArray(payload))
      return payload.map(p => this._replaceGuidsWithChannels(p));
    if (payload.guid && this._objects.has(payload.guid))
      return this._objects.get(payload.guid)!._channel;
    if (typeof payload === 'object') {
      const result: any = {};
      for (const key of Object.keys(payload))
        result[key] = this._replaceGuidsWithChannels(payload[key]);
      return result;
    }
    return payload;
  }

  createScope(guid: string): ConnectionScope {
    const scope = new ConnectionScope(this, guid);
    this._scopes.set(guid, scope);
    return scope;
  }
}

export class ConnectionScope {
  private _connection: Connection;
  readonly _objects = new Map<string, ChannelOwner<any, any>>();
  private _children = new Set<ConnectionScope>();
  private _parent: ConnectionScope | undefined;
  readonly _guid: string;

  constructor(connection: Connection, guid: string) {
    this._connection = connection;
    this._guid = guid;
  }

  createChild(guid: string): ConnectionScope {
    const scope = this._connection.createScope(guid);
    this._children.add(scope);
    scope._parent = this;
    return scope;
  }

  dispose() {
    // Take care of hierarchy.
    for (const child of [...this._children])
      child.dispose();
    this._children.clear();

    // Delete self from scopes and objects.
    this._connection._scopes.delete(this._guid);
    this._connection._objects.delete(this._guid);

    // Delete all of the objects from connection.
    for (const guid of this._objects.keys())
      this._connection._objects.delete(guid);

    // Clean up from parent.
    if (this._parent) {
      this._parent._objects.delete(this._guid);
      this._parent._children.delete(this);
    }
  }

  async sendMessageToServer(message: { guid: string, method: string, params: any }): Promise<any> {
    return this._connection.sendMessageToServer(message);
  }

  createRemoteObject(type: string, guid: string, initializer: any): any {
    let result: ChannelOwner<any, any>;
    initializer = this._connection._replaceGuidsWithChannels(initializer);
    switch (type) {
      case 'bindingCall':
        result = new BindingCall(this, guid, initializer);
        break;
      case 'browser':
        result = new Browser(this, guid, initializer);
        break;
      case 'browserServer':
        result = new BrowserServer(this, guid, initializer);
        break;
      case 'browserType':
        result = new BrowserType(this, guid, initializer);
        break;
      case 'context':
        result = new BrowserContext(this, guid, initializer);
        break;
      case 'consoleMessage':
        result = new ConsoleMessage(this, guid, initializer);
        break;
      case 'dialog':
        result = new Dialog(this, guid, initializer);
        break;
      case 'download':
        result = new Download(this, guid, initializer);
        break;
      case 'elementHandle':
        result = new ElementHandle(this, guid, initializer);
        break;
      case 'frame':
        result = new Frame(this, guid, initializer);
        break;
      case 'jsHandle':
        result = new JSHandle(this, guid, initializer);
        break;
      case 'page':
        result = new Page(this, guid, initializer);
        break;
      case 'request':
        result = new Request(this, guid, initializer);
        break;
      case 'response':
        result = new Response(this, guid, initializer);
        break;
      case 'route':
        result = new Route(this, guid, initializer);
        break;
      case 'worker':
        result = new Worker(this, guid, initializer);
        break;
      default:
        throw new Error('Missing type ' + type);
    }
    this._connection._objects.set(guid, result);
    this._objects.set(guid, result);
    const callback = this._connection._waitingForObject.get(guid);
    if (callback) {
      callback(result);
      this._connection._waitingForObject.delete(guid);
    }
    return result;
  }
}
