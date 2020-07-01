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
import { ChannelOwner } from './channelOwner';

export type ChannelGuid = {
  guid: string,
  scope?: string
}

export class Connection {
  onmessage = (message: string): void => {};
  readonly _objects = new Map<string, ChannelOwner<any, any>>();
  private _waitingForObject = new Map<string, any>();
  private _callbacks = new Map<number, { resolve: (a: any) => void, reject: (a: Error) => void }>();
  _lastId = 0;

  constructor() {}

  dispatch(message: string) {
    const parsedMessage = JSON.parse(message);
    const { id, guid, scope, error, method, params, result } = parsedMessage;

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
      this._createRemoteObject(params.type, scope, guid, params.initializer);
      const callback = this._waitingForObject.get(guid);
      if (callback) {
        callback(this._objects.get(guid));
        this._waitingForObject.delete(guid);
      }
      return;
    }
    const object = this._objects.get(guid)!;
    object._channel.emit(method, this._replaceGuidsWithChannels(params));
  }

  async sendMessageToServer(message: { guid: string, method: string, params: any }): Promise<any> {
    const id = ++this._lastId;
    const converted: any = { id, ...message, params: this._replaceChannelsWithGuids(message.params) };
    converted.id = id;
    debug('pw:channel:command')(converted);
    this.onmessage(JSON.stringify(converted));
    return new Promise((resolve, reject) => this._callbacks.set(id, { resolve, reject }));
  }

  async waitForObjectWithKnownName(guid: string): Promise<any> {
    const result = this._objects.get(guid);
    return result || new Promise(f => this._waitingForObject.set(guid, f));
  }

  private _createRemoteObject(type: string, scope: string, guid: string, initializer: any): any {
    let result: ChannelOwner<any, any>;
    initializer = this._replaceGuidsWithChannels(initializer);
    const channelGuid = { scope, guid };
    switch (type) {
      case 'bindingCall':
        result = new BindingCall(this, channelGuid, initializer);
        break;
      case 'browser':
        result = new Browser(this, channelGuid, initializer);
        break;
      case 'browserServer':
        result = new BrowserServer(this, channelGuid, initializer);
        break;
      case 'browserType':
        result = new BrowserType(this, channelGuid, initializer);
        break;
      case 'context':
        result = new BrowserContext(this, channelGuid, initializer);
        break;
      case 'consoleMessage':
        result = new ConsoleMessage(this, channelGuid, initializer);
        break;
      case 'dialog':
        result = new Dialog(this, channelGuid, initializer);
        break;
      case 'download':
        result = new Download(this, channelGuid, initializer);
        break;
      case 'elementHandle':
        result = new ElementHandle(this, channelGuid, initializer);
        break;
      case 'frame':
        result = new Frame(this, channelGuid, initializer);
        break;
      case 'jsHandle':
        result = new JSHandle(this, channelGuid, initializer);
        break;
      case 'page':
        result = new Page(this, channelGuid, initializer);
        break;
      case 'request':
        result = new Request(this, channelGuid, initializer);
        break;
      case 'response':
        result = new Response(this, channelGuid, initializer);
        break;
      case 'route':
        result = new Route(this, channelGuid, initializer);
        break;
      case 'worker':
        result = new Worker(this, channelGuid, initializer);
        break;
      default:
        throw new Error('Missing type ' + type);
    }
    this._objects.set(guid, result);
    return result;
  }

  private _replaceChannelsWithGuids(payload: any): any {
    if (!payload)
      return payload;
    if (Array.isArray(payload))
      return payload.map(p => this._replaceChannelsWithGuids(p));
    if (payload._guid)
      return { guid: payload._guid };
    // TODO: send base64
    if (payload instanceof Buffer)
      return payload;
    if (typeof payload === 'object') {
      const result: any = {};
      for (const key of Object.keys(payload))
        result[key] = this._replaceChannelsWithGuids(payload[key]);
      return result;
    }
    return payload;
  }

  private _replaceGuidsWithChannels(payload: any): any {
    if (!payload)
      return payload;
    if (Array.isArray(payload))
      return payload.map(p => this._replaceGuidsWithChannels(p));
    if (payload.guid && this._objects.has(payload.guid))
      return this._objects.get(payload.guid)!._channel;
    // TODO: send base64
    if (payload instanceof Buffer)
      return payload;
    if (typeof payload === 'object') {
      const result: any = {};
      for (const key of Object.keys(payload))
        result[key] = this._replaceGuidsWithChannels(payload[key]);
      return result;
    }
    return payload;
  }
}
