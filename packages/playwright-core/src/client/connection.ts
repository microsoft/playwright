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
import type * as channels from '../protocol/channels';
import { Stream } from './stream';
import { WritableStream } from './writableStream';
import { debugLogger } from '../common/debugLogger';
import { SelectorsOwner } from './selectors';
import { Android, AndroidSocket, AndroidDevice } from './android';
import type { ParsedStackTrace } from '../utils/stackTrace';
import { Artifact } from './artifact';
import { EventEmitter } from 'events';
import { JsonPipe } from './jsonPipe';
import { APIRequestContext } from './fetch';
import { LocalUtils } from './localUtils';
import { Tracing } from './tracing';

class Root extends ChannelOwner<channels.RootChannel> {
  constructor(connection: Connection) {
    super(connection, 'Root', '', {});
  }

  async initialize(): Promise<Playwright> {
    return Playwright.from((await this._channel.initialize({
      sdkLanguage: 'javascript',
    })).playwright);
  }
}

class DummyChannelOwner<T> extends ChannelOwner<T> {
}

export class Connection extends EventEmitter {
  readonly _objects = new Map<string, ChannelOwner>();
  onmessage = (message: object): void => {};
  private _lastId = 0;
  private _callbacks = new Map<number, { resolve: (a: any) => void, reject: (a: Error) => void, stackTrace: ParsedStackTrace | null }>();
  private _rootObject: Root;
  private _closedErrorMessage: string | undefined;
  private _isRemote = false;
  // Some connections allow resolving in-process dispatchers.
  toImpl: ((client: ChannelOwner) => any) | undefined;

  constructor() {
    super();
    this._rootObject = new Root(this);
  }

  markAsRemote() {
    this._isRemote = true;
  }

  isRemote() {
    return this._isRemote;
  }

  async initializePlaywright(): Promise<Playwright> {
    return await this._rootObject.initialize();
  }

  pendingProtocolCalls(): ParsedStackTrace[] {
    return Array.from(this._callbacks.values()).map(callback => callback.stackTrace).filter(Boolean) as ParsedStackTrace[];
  }

  getObjectWithKnownName(guid: string): any {
    return this._objects.get(guid)!;
  }

  async sendMessageToServer(object: ChannelOwner, method: string, params: any, stackTrace: ParsedStackTrace | null): Promise<any> {
    if (this._closedErrorMessage)
      throw new Error(this._closedErrorMessage);

    const { apiName, frames } = stackTrace || { apiName: '', frames: [] };
    const guid = object._guid;
    const id = ++this._lastId;
    const converted = { id, guid, method, params };
    // Do not include metadata in debug logs to avoid noise.
    debugLogger.log('channel:command', converted);
    const metadata: channels.Metadata = { stack: frames, apiName, internal: !apiName };
    this.onmessage({ ...converted, metadata });

    return await new Promise((resolve, reject) => this._callbacks.set(id, { resolve, reject, stackTrace }));
  }

  _debugScopeState(): any {
    return this._rootObject._debugScopeState();
  }

  dispatch(message: object) {
    if (this._closedErrorMessage)
      return;

    const { id, guid, method, params, result, error } = message as any;
    if (id) {
      debugLogger.log('channel:response', message);
      const callback = this._callbacks.get(id);
      if (!callback)
        throw new Error(`Cannot find command to respond: ${id}`);
      this._callbacks.delete(id);
      if (error && !result)
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
    (object._channel as any).emit(method, object._type === 'JsonPipe' ? params : this._replaceGuidsWithChannels(params));
  }

  close(errorMessage: string = 'Connection closed') {
    this._closedErrorMessage = errorMessage;
    for (const callback of this._callbacks.values())
      callback.reject(new Error(errorMessage));
    this._callbacks.clear();
    this.emit('close');
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
    let result: ChannelOwner<any>;
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
      case 'APIRequestContext':
        result = new APIRequestContext(parent, type, guid, initializer);
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
      case 'JsonPipe':
        result = new JsonPipe(parent, type, guid, initializer);
        break;
      case 'LocalUtils':
        result = new LocalUtils(parent, type, guid, initializer);
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
      case 'SocksSupport':
        result = new DummyChannelOwner(parent, type, guid, initializer);
        break;
      case 'Tracing':
        result = new Tracing(parent, type, guid, initializer);
        break;
      case 'WebSocket':
        result = new WebSocket(parent, type, guid, initializer);
        break;
      case 'Worker':
        result = new Worker(parent, type, guid, initializer);
        break;
      case 'WritableStream':
        result = new WritableStream(parent, type, guid, initializer);
        break;
      default:
        throw new Error('Missing type ' + type);
    }
    return result;
  }
}
