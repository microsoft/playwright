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
import { Request, Response, Route, WebSocket } from './network';
import { Page, BindingCall } from './page';
import { Worker } from './worker';
import { ConsoleMessage } from './consoleMessage';
import { Dialog } from './dialog';
import { parseError } from '../protocol/serializers';
import { CDPSession } from './cdpSession';
import { Playwright } from './playwright';
import { Electron, ElectronApplication } from './electron';
import * as channels from '../protocol/channels';
import { Stream } from './stream';
import { debugLogger } from '../utils/debugLogger';
import { SelectorsOwner } from './selectors';
import { Android, AndroidSocket, AndroidDevice } from './android';
import { SocksSocket } from './socksSocket';
import { ParsedStackTrace } from '../utils/stackTrace';
import { Artifact } from './artifact';
import { EventEmitter } from 'events';

class Root extends ChannelOwner<channels.Channel, {}> {
  constructor(connection: Connection) {
    super(connection, '', '', {});
  }
}

export class Connection extends EventEmitter {
  readonly _objects = new Map<string, ChannelOwner>();
  private _waitingForObject = new Map<string, any>();
  onmessage = (message: object): void => {};
  private _lastId = 0;
  private _callbacks = new Map<number, { resolve: (a: any) => void, reject: (a: Error) => void, metadata: channels.Metadata }>();
  private _rootObject: ChannelOwner;
  private _disconnectedErrorMessage: string | undefined;
  private _onClose?: () => void;

  constructor(onClose?: () => void) {
    super();
    this._rootObject = new Root(this);
    this._onClose = onClose;
  }

  async waitForObjectWithKnownName(guid: string): Promise<any> {
    if (this._objects.has(guid))
      return this._objects.get(guid)!;
    return new Promise(f => this._waitingForObject.set(guid, f));
  }

  pendingProtocolCalls(): channels.Metadata[] {
    return Array.from(this._callbacks.values()).map(callback => callback.metadata);
  }

  getObjectWithKnownName(guid: string): any {
    return this._objects.get(guid)!;
  }

  async sendMessageToServer(object: ChannelOwner, method: string, params: any, stackTrace: ParsedStackTrace | null): Promise<any> {
    const guid = object._guid;
    const { frames, apiName }: ParsedStackTrace = stackTrace || { frameTexts: [], frames: [], apiName: '' };

    const id = ++this._lastId;
    const converted = { id, guid, method, params };
    // Do not include metadata in debug logs to avoid noise.
    debugLogger.log('channel:command', converted);
    const metadata: channels.Metadata = { stack: frames, apiName };
    this.onmessage({ ...converted, metadata });

    if (this._disconnectedErrorMessage)
      throw new Error(this._disconnectedErrorMessage);
    return await new Promise((resolve, reject) => this._callbacks.set(id, { resolve, reject, metadata }));
  }

  _debugScopeState(): any {
    return this._rootObject._debugScopeState();
  }

  dispatch(message: object) {
    const { id, guid, method, params, result, error } = message as any;
    if (id) {
      debugLogger.log('channel:response', message);
      const callback = this._callbacks.get(id);
      if (!callback)
        throw new Error(`Cannot find command to respond: ${id}`);
      this._callbacks.delete(id);
      if (error)
        callback.reject(parseError(error));
      else
        callback.resolve(this._replaceGuidsWithChannels(result));
      return;
    }

    debugLogger.log('channel:event', message);
    if (method === '__create__') {
      this._createRemoteObject(guid, params.type, params.guid, params.initializer);
      return;
    }
    if (method === '__dispose__') {
      const object = this._objects.get(guid);
      if (!object)
        throw new Error(`Cannot find object to dispose: ${guid}`);
      object._dispose();
      return;
    }
    const object = this._objects.get(guid);
    if (!object)
      throw new Error(`Cannot find object to emit "${method}": ${guid}`);
    object._channel.emit(method, this._replaceGuidsWithChannels(params));
  }

  close() {
    if (this._onClose)
      this._onClose();
  }

  didDisconnect(errorMessage: string) {
    this._disconnectedErrorMessage = errorMessage;
    for (const callback of this._callbacks.values())
      callback.reject(new Error(errorMessage));
    this._callbacks.clear();
    this.emit('disconnect');
  }

  isDisconnected() {
    return !!this._disconnectedErrorMessage;
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

  private _createRemoteObject(parentGuid: string, type: string, guid: string, initializer: any): any {
    const parent = this._objects.get(parentGuid);
    if (!parent)
      throw new Error(`Cannot find parent object ${parentGuid} to create ${guid}`);
    let result: ChannelOwner<any, any>;
    initializer = this._replaceGuidsWithChannels(initializer);
    switch (type) {
      case 'Android':
        result = new Android(parent, type, guid, initializer);
        break;
      case 'AndroidSocket':
        result = new AndroidSocket(parent, type, guid, initializer);
        break;
      case 'AndroidDevice':
        result = new AndroidDevice(parent, type, guid, initializer);
        break;
      case 'Artifact':
        result = new Artifact(parent, type, guid, initializer);
        break;
      case 'BindingCall':
        result = new BindingCall(parent, type, guid, initializer);
        break;
      case 'Browser':
        result = new Browser(parent, type, guid, initializer);
        break;
      case 'BrowserContext':
        result = new BrowserContext(parent, type, guid, initializer);
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
      case 'Response':
        result = new Response(parent, type, guid, initializer);
        break;
      case 'Route':
        result = new Route(parent, type, guid, initializer);
        break;
      case 'Stream':
        result = new Stream(parent, type, guid, initializer);
        break;
      case 'Selectors':
        result = new SelectorsOwner(parent, type, guid, initializer);
        break;
      case 'WebSocket':
        result = new WebSocket(parent, type, guid, initializer);
        break;
      case 'Worker':
        result = new Worker(parent, type, guid, initializer);
        break;
      case 'SocksSocket':
        result = new SocksSocket(parent, type, guid, initializer);
        break;
      default:
        throw new Error('Missing type ' + type);
    }
    const callback = this._waitingForObject.get(guid);
    if (callback) {
      callback(result);
      this._waitingForObject.delete(guid);
    }
    return result;
  }
}
