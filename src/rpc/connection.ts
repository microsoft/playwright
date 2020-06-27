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

import { EventEmitter } from 'ws';
import { Browser } from './client/browser';
import { BrowserContext } from './client/browserContext';
import { BrowserType } from './client/browserType';
import { ChannelOwner } from './client/channelOwner';
import { ElementHandle } from './client/elementHandle';
import { Frame } from './client/frame';
import { JSHandle } from './client/jsHandle';
import { Request, Response, Route } from './client/network';
import { Page, BindingCall } from './client/page';
import debug = require('debug');
import { Channel } from './channels';
import { ConsoleMessage } from './client/consoleMessage';
import { Dialog } from './client/dialog';
import { Download } from './client/download';
import { parseError } from './serializers';

export class Connection {
  private _channels = new Map<string, Channel>();
  private _waitingForObject = new Map<string, any>();
  onmessage = (message: string): void => {};
  private _lastId = 0;
  private _callbacks = new Map<number, { resolve: (a: any) => void, reject: (a: Error) => void }>();

  constructor() {}

  private _createRemoteObject(type: string, guid: string, initializer: any): any {
    const channel = this._createChannel(guid) as any;
    this._channels.set(guid, channel);
    let result: ChannelOwner<any, any>;
    initializer = this._replaceGuidsWithChannels(initializer);
    switch (type) {
      case 'bindingCall':
        result = new BindingCall(this, channel, initializer);
        break;
      case 'browser':
        result = new Browser(this, channel, initializer);
        break;
      case 'browserType':
        result = new BrowserType(this, channel, initializer);
        break;
      case 'context':
        result = new BrowserContext(this, channel, initializer);
        break;
      case 'consoleMessage':
        result = new ConsoleMessage(this, channel, initializer);
        break;
      case 'dialog':
        result = new Dialog(this, channel, initializer);
        break;
      case 'download':
        result = new Download(this, channel, initializer);
        break;
      case 'elementHandle':
        result = new ElementHandle(this, channel, initializer);
        break;
      case 'frame':
        result = new Frame(this, channel, initializer);
        break;
      case 'jsHandle':
        result = new JSHandle(this, channel, initializer);
        break;
      case 'page':
        result = new Page(this, channel, initializer);
        break;
      case 'request':
        result = new Request(this, channel, initializer);
        break;
      case 'response':
        result = new Response(this, channel, initializer);
        break;
      case 'route':
        result = new Route(this, channel, initializer);
        break;
      default:
        throw new Error('Missing type ' + type);
    }
    channel._object = result;
    const callback = this._waitingForObject.get(guid);
    if (callback) {
      callback(result);
      this._waitingForObject.delete(guid);
    }
    return result;
  }

  waitForObjectWithKnownName(guid: string): Promise<any> {
    if (this._channels.has(guid))
      return this._channels.get(guid)!._object;
    return new Promise(f => this._waitingForObject.set(guid, f));
  }

  async sendMessageToServer(message: { guid: string, method: string, params: any }): Promise<any> {
    const id = ++this._lastId;
    const converted = { id, ...message, params: this._replaceChannelsWithGuids(message.params) };
    debug('pw:channel:command')(converted);
    this.onmessage(JSON.stringify(converted));
    return new Promise((resolve, reject) => this._callbacks.set(id, { resolve, reject }));
  }

  send(message: string) {
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
      this._createRemoteObject(params.type,  guid, params.initializer);
      return;
    }
    const channel = this._channels.get(guid)!;
    channel.emit(method, this._replaceGuidsWithChannels(params));
  }

  private _createChannel(guid: string): Channel {
    const base = new EventEmitter();
    (base as any)._guid = guid;
    return new Proxy(base, {
      get: (obj: any, prop) => {
        if (String(prop).startsWith('_'))
          return obj[prop];
        if (prop === 'then')
          return obj.then;
        if (prop === 'emit')
          return obj.emit;
        if (prop === 'on')
          return obj.on;
        if (prop === 'once')
          return obj.once;
        if (prop === 'addEventListener')
          return obj.addListener;
        if (prop === 'removeEventListener')
          return obj.removeListener;
        return (params: any) => this.sendMessageToServer({ guid, method: String(prop), params });
      },
    });
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
    if (payload.guid && this._channels.has(payload.guid))
      return this._channels.get(payload.guid);
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
