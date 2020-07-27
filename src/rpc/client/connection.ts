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
import { CDPSession } from './cdpSession';
import { Playwright } from './playwright';
import { Electron, ElectronApplication } from './electron';
import { Channel } from '../channels';
import { ChromiumBrowser } from './chromiumBrowser';
import { ChromiumBrowserContext } from './chromiumBrowserContext';
import { Selectors } from './selectors';
import { Stream } from './stream';
import { createScheme, Validator, ValidationError } from '../validator';
import { WebKitBrowser } from './webkitBrowser';
import { FirefoxBrowser } from './firefoxBrowser';
import { assert } from '../../helper';

class Root extends ChannelOwner<Channel, {}> {
  constructor(connection: Connection) {
    super(connection, '', '', {});
  }
}

export class Connection {
  readonly _objects = new Map<string, ChannelOwner>();
  private _waitingForObject = new Map<string, any>();
  onmessage = (message: object): void => {};
  private _lastId = 0;
  private _callbacks = new Map<number, { resolve: (a: any) => void, reject: (a: Error) => void }>();
  private _rootObject: ChannelOwner;

  constructor() {
    this._rootObject = new Root(this);
    this._rootObject._isScope = true;
  }

  async waitForObjectWithKnownName(guid: string): Promise<any> {
    if (this._objects.has(guid))
      return this._objects.get(guid)!;
    return new Promise(f => this._waitingForObject.set(guid, f));
  }

  async sendMessageToServer(type: string, guid: string, method: string, params: any): Promise<any> {
    const id = ++this._lastId;
    const validated = method === 'debugScopeState' ? params : validateParams(type, method, params);
    const converted = { id, guid, method, params: validated };
    debug('pw:channel:command')(converted);
    this.onmessage(converted);
    return new Promise((resolve, reject) => this._callbacks.set(id, { resolve, reject }));
  }

  _debugScopeState(): any {
    return this._rootObject._debugScopeState();
  }

  dispatch(message: object) {
    const { id, guid, method, params, result, error } = message as any;
    if (id) {
      debug('pw:channel:response')(message);
      const callback = this._callbacks.get(id)!;
      this._callbacks.delete(id);
      if (error)
        callback.reject(parseError(error));
      else
        callback.resolve(this._replaceGuidsWithChannels(result));
      return;
    }

    debug('pw:channel:event')(message);
    if (method === '__create__') {
      this._createRemoteObject(guid, params.type, params.guid, params.initializer, params.scope);
      return;
    }
    if (method === '__dispose__') {
      this._objects.get(guid)!._dispose();
      return;
    }
    const object = this._objects.get(guid)!;
    object._channel.emit(method, this._replaceGuidsWithChannels(params));
  }

  private _replaceGuidsWithChannels(payload: any): any {
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

  private _createRemoteObject(parentGuid: string, type: string, guid: string, initializer: any, isScope: boolean): any {
    const parent = this._objects.get(parentGuid)!;
    assert(parent._isScope);
    let result: ChannelOwner<any, any>;
    initializer = this._replaceGuidsWithChannels(initializer);
    switch (type) {
      case 'BindingCall':
        result = new BindingCall(parent, type, guid, initializer);
        break;
      case 'Browser':
        if ((parent as BrowserType).name() === 'chromium')
          result = new ChromiumBrowser(parent, type, guid, initializer);
        else if ((parent as BrowserType).name() === 'webkit')
          result = new WebKitBrowser(parent, type, guid, initializer);
        else if ((parent as BrowserType).name() === 'firefox')
          result = new FirefoxBrowser(parent, type, guid, initializer);
        else
          result = new Browser(parent, type, guid, initializer);
        break;
      case 'BrowserContext':
        let browserName = '';
        if (parent instanceof ElectronApplication) {
          // Launching electron produces ElectronApplication parent for BrowserContext.
          browserName = 'electron';
        } else if (parent instanceof Browser) {
          // Launching a browser produces Browser parent for BrowserContext.
          browserName = parent._browserType.name();
        } else {
          // Launching persistent context produces BrowserType parent for BrowserContext.
          browserName = (parent as BrowserType).name();
        }
        if (browserName === 'chromium')
          result = new ChromiumBrowserContext(parent, type, guid, initializer);
        else
          result = new BrowserContext(parent, type, guid, initializer, browserName);
        break;
      case 'BrowserServer':
        result = new BrowserServer(parent, type, guid, initializer);
        break;
      case 'BrowserType':
        result = new BrowserType(parent, type, guid, initializer);
        break;
      case 'CDPSession':
        result = new CDPSession(parent, type, guid, initializer);
        break;
      case 'ConsoleMessage':
        result = new ConsoleMessage(parent, type, guid, initializer);
        break;
      case 'Dialog':
        result = new Dialog(parent, type, guid, initializer);
        break;
      case 'Download':
        result = new Download(parent, type, guid, initializer);
        break;
      case 'Electron':
        result = new Electron(parent, type, guid, initializer);
        break;
      case 'ElectronApplication':
        result = new ElectronApplication(parent, type, guid, initializer);
        break;
      case 'ElementHandle':
        result = new ElementHandle(parent, type, guid, initializer);
        break;
      case 'Frame':
        result = new Frame(parent, type, guid, initializer);
        break;
      case 'JSHandle':
        result = new JSHandle(parent, type, guid, initializer);
        break;
      case 'Page':
        result = new Page(parent, type, guid, initializer);
        break;
      case 'Playwright':
        result = new Playwright(parent, type, guid, initializer);
        break;
      case 'Request':
        result = new Request(parent, type, guid, initializer);
        break;
      case 'Stream':
        result = new Stream(parent, type, guid, initializer);
        break;
      case 'Response':
        result = new Response(parent, type, guid, initializer);
        break;
      case 'Route':
        result = new Route(parent, type, guid, initializer);
        break;
      case 'Selectors':
        result = new Selectors(parent, type, guid, initializer);
        break;
      case 'Worker':
        result = new Worker(parent, type, guid, initializer);
        break;
      default:
        throw new Error('Missing type ' + type);
    }
    if (isScope)
      result._isScope = true;
    const callback = this._waitingForObject.get(guid);
    if (callback) {
      callback(result);
      this._waitingForObject.delete(guid);
    }
    return result;
  }
}

const tChannel = (name: string): Validator => {
  return (arg: any, path: string) => {
    if (arg._object instanceof ChannelOwner && (name === '*' || arg._object._type === name))
      return { guid: arg._object._guid };
    throw new ValidationError(`${path}: expected ${name}`);
  };
};

const scheme = createScheme(tChannel);

function validateParams(type: string, method: string, params: any): any {
  const name = type + method[0].toUpperCase() + method.substring(1) + 'Params';
  if (!scheme[name])
    throw new ValidationError(`Uknown scheme for ${type}.${method}`);
  return scheme[name](params, '');
}
