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
import { Request, Response } from './client/network';
import { Page } from './client/page';
import debug = require('debug');
import { Channel } from './channels';

export class Connection {
  private _channels = new Map<string, Channel>();
  sendMessageToServerTransport = (message: any): Promise<any> => Promise.resolve();

  constructor() {}

  createRemoteObject(type: string, guid: string): any {
    const channel = this._createChannel(guid) as any;
    this._channels.set(guid, channel);
    let result: ChannelOwner<any>;
    switch (type) {
      case 'browserType':
        result = new BrowserType(this, channel);
        break;
      case 'browser':
        result = new Browser(this, channel);
        break;
      case 'context':
        result = new BrowserContext(this, channel);
        break;
      case 'page':
        result = new Page(this, channel);
        break;
      case 'frame':
        result = new Frame(this, channel);
        break;
      case 'request':
        result = new Request(this, channel);
        break;
      case 'response':
        result = new Response(this, channel);
        break;
      case 'jsHandle':
        result = new JSHandle(this, channel);
        break;
      case 'elementHandle':
        result = new ElementHandle(this, channel);
        break;
      default:
        throw new Error('Missing type ' + type);
    }
    channel._object = result;
    return result;
  }

  async sendMessageToServer(message: { guid: string, method: string, params: any }) {
    const converted = {...message, params: this._replaceChannelsWithGuids(message.params)};
    debug('pw:channel:command')(converted);
    const response = await this.sendMessageToServerTransport(converted);
    debug('pw:channel:response')(response);
    return this._replaceGuidsWithChannels(response);
  }

  dispatchMessageFromServer(message: { guid: string, method: string, params: any }) {
    debug('pw:channel:event')(message);
    const { guid, method, params } = message;

    if (method === '__create__') {
      this.createRemoteObject(params.type,  guid);
      return;
    }

    const channel = this._channels.get(guid)!;
    if (message.method === '__init__') {
      channel._object._initialize(this._replaceGuidsWithChannels(params));
      return;
    }
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
    if (typeof payload === 'object')
      return Object.fromEntries([...Object.entries(payload)].map(([n,v]) => [n, this._replaceChannelsWithGuids(v)]));
    return payload;
  }

  private _replaceGuidsWithChannels(payload: any): any {
    if (!payload)
      return payload;
    if (Array.isArray(payload))
      return payload.map(p => this._replaceGuidsWithChannels(p));
    if (payload.guid && this._channels.has(payload.guid))
      return this._channels.get(payload.guid);
    if (typeof payload === 'object')
      return Object.fromEntries([...Object.entries(payload)].map(([n,v]) => [n, this._replaceGuidsWithChannels(v)]));
    return payload;
  }
}
