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
import type * as channels from '@protocol/channels';
import { Stream } from './stream';
import { WritableStream } from './writableStream';
import { debugLogger } from '../common/debugLogger';
import { SelectorsOwner } from './selectors';
import { Android, AndroidSocket, AndroidDevice } from './android';
import { captureLibraryStackTrace, type ParsedStackTrace } from '../utils/stackTrace';
import { Artifact } from './artifact';
import { EventEmitter } from 'events';
import { JsonPipe } from './jsonPipe';
import { APIRequestContext } from './fetch';
import { LocalUtils } from './localUtils';
import { Tracing } from './tracing';
import { findValidator, ValidationError, type ValidatorContext } from '../protocol/validator';

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

class DummyChannelOwner extends ChannelOwner {
}

export class Connection extends EventEmitter {
  readonly _objects = new Map<string, ChannelOwner>();
  onmessage = (message: object): void => {};
  private _lastId = 0;
  private _callbacks = new Map<number, { resolve: (a: any) => void, reject: (a: Error) => void, stackTrace: ParsedStackTrace | null, type: string, method: string }>();
  private _rootObject: Root;
  private _closedErrorMessage: string | undefined;
  private _isRemote = false;
  private _localUtils?: LocalUtils;
  // Some connections allow resolving in-process dispatchers.
  toImpl: ((client: ChannelOwner) => any) | undefined;
  private _stackCollectors = new Set<channels.ClientSideCallMetadata[]>();

  constructor(localUtils?: LocalUtils) {
    super();
    this._rootObject = new Root(this);
    this._localUtils = localUtils;
  }

  markAsRemote() {
    this._isRemote = true;
  }

  isRemote() {
    return this._isRemote;
  }

  localUtils(): LocalUtils {
    return this._localUtils!;
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

  startCollectingCallMetadata(collector: channels.ClientSideCallMetadata[]) {
    this._stackCollectors.add(collector);
  }

  stopCollectingCallMetadata(collector: channels.ClientSideCallMetadata[]) {
    this._stackCollectors.delete(collector);
  }

  async sendMessageToServer(object: ChannelOwner, type: string, method: string, params: any, stackTrace: ParsedStackTrace | null, wallTime: number | undefined): Promise<any> {
    if (this._closedErrorMessage)
      throw new Error(this._closedErrorMessage);

    const { apiName, frames } = stackTrace || { apiName: '', frames: [] };
    const guid = object._guid;
    const id = ++this._lastId;
    const converted = { id, guid, method, params };
    // Do not include metadata in debug logs to avoid noise.
    debugLogger.log('channel:command', converted);
    for (const collector of this._stackCollectors)
      collector.push({ stack: frames, id: id });
    const location = frames[0] ? { file: frames[0].file, line: frames[0].line, column: frames[0].column } : undefined;
    const metadata: channels.Metadata = { wallTime, apiName, location, internal: !apiName };
    this.onmessage({ ...converted, metadata });

    return await new Promise((resolve, reject) => this._callbacks.set(id, { resolve, reject, stackTrace, type, method }));
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
      if (error && !result) {
        callback.reject(parseError(error));
      } else {
        const validator = findValidator(callback.type, callback.method, 'Result');
        callback.resolve(validator(result, '', { tChannelImpl: this._tChannelImplFromWire.bind(this), binary: this.isRemote() ? 'fromBase64' : 'buffer' }));
      }
      return;
    }

    debugLogger.log('channel:event', message);
    if (method === '__create__') {
      this._createRemoteObject(guid, params.type, params.guid, params.initializer);
      return;
    }

    const object = this._objects.get(guid);
    if (!object)
      throw new Error(`Cannot find object to "${method}": ${guid}`);

    if (method === '__adopt__') {
      const child = this._objects.get(params.guid);
      if (!child)
        throw new Error(`Unknown new child: ${params.guid}`);
      object._adopt(child);
      return;
    }

    if (method === '__dispose__') {
      object._dispose();
      return;
    }

    const validator = findValidator(object._type, method, 'Event');
    (object._channel as any).emit(method, validator(params, '', { tChannelImpl: this._tChannelImplFromWire.bind(this), binary: this.isRemote() ? 'fromBase64' : 'buffer' }));
  }

  close(errorMessage: string = 'Connection closed') {
    const stack = captureLibraryStackTrace().frameTexts.join('\n');
    if (stack)
      errorMessage += '\n    ==== Closed by ====\n' + stack + '\n';
    this._closedErrorMessage = errorMessage;
    for (const callback of this._callbacks.values())
      callback.reject(new Error(errorMessage));
    this._callbacks.clear();
    this.emit('close');
  }

  private _tChannelImplFromWire(names: '*' | string[], arg: any, path: string, context: ValidatorContext) {
    if (arg && typeof arg === 'object' && typeof arg.guid === 'string') {
      const object = this._objects.get(arg.guid)!;
      if (!object)
        throw new Error(`Object with guid ${arg.guid} was not bound in the connection`);
      if (names !== '*' && !names.includes(object._type))
        throw new ValidationError(`${path}: expected channel ${names.toString()}`);
      return object._channel;
    }
    throw new ValidationError(`${path}: expected channel ${names.toString()}`);
  }

  private _createRemoteObject(parentGuid: string, type: string, guid: string, initializer: any): any {
    const parent = this._objects.get(parentGuid);
    if (!parent)
      throw new Error(`Cannot find parent object ${parentGuid} to create ${guid}`);
    let result: ChannelOwner<any>;
    const validator = findValidator(type, '', 'Initializer');
    initializer = validator(initializer, '', { tChannelImpl: this._tChannelImplFromWire.bind(this), binary: this.isRemote() ? 'fromBase64' : 'buffer' });
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
        if (!this._localUtils)
          this._localUtils = result as LocalUtils;
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
