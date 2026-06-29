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

import colors from 'colors/safe';
import { rewriteErrorMessage } from '@isomorphic/stackTrace';
import { isUnderTest } from '@utils/debug';
import { debugLogger } from '@utils/debugLogger';
import { emptyZone } from '@utils/zones';
import { EventEmitter } from './eventEmitter';
import { Android, AndroidDevice, AndroidSocket } from './android';
import { Artifact } from './artifact';
import { Browser } from './browser';
import { BrowserContext } from './browserContext';
import { BrowserType } from './browserType';
import { CDPSession } from './cdpSession';
import { ChannelOwner } from './channelOwner';
import { createInstrumentation } from './clientInstrumentation';
import { Debugger } from './debugger';
import { Dialog } from './dialog';
import { DisposableObject } from './disposable';
import { Electron, ElectronApplication } from './electron';
import { ElementHandle } from './elementHandle';
import { AbortError, TargetClosedError, parseError } from './errors';
import { APIRequestContext } from './fetch';
import { Frame } from './frame';
import { JSHandle } from './jsHandle';
import { JsonPipe } from './jsonPipe';
import { LocalUtils } from './localUtils';
import { Request, Response, Route, WebSocket, WebSocketRoute } from './network';
import { BindingCall, Page } from './page';
import { Playwright } from './playwright';
import { Stream } from './stream';
import { Tracing } from './tracing';
import { Worker } from './worker';
import { WritableStream } from './writableStream';
import { ValidationError, findValidator, maybeFindValidator } from '../protocol/validator';
import type { ClientInstrumentation } from './clientInstrumentation';
import type { HeadersArray } from './types';
import type { ValidatorContext } from '../protocol/validator';
import type * as channels from './channels';

class Root extends ChannelOwner<channels.RootChannel> {
  constructor(connection: Connection) {
    super(connection, 'Root', '', {});
  }

  async initialize(): Promise<Playwright> {
    return Playwright.from((await this._channel.initialize({
      sdkLanguage: 'javascript',
    }, undefined)).playwright);
  }
}

class DummyChannelOwner extends ChannelOwner {
}

export type ChannelOwnerFactory = (parent: ChannelOwner, type: string, guid: string, initializer: any) => ChannelOwner;

export class Connection extends EventEmitter {
  readonly _objects = new Map<string, ChannelOwner>();
  onmessage = (message: object): void => {};
  private _lastId = 0;
  private _callbacks = new Map<number, { resolve: (a: any) => void, reject: (a: Error) => void, signal: AbortSignal | undefined, title: string | undefined, type: string, method: string }>();
  private _rootObject: Root;
  private _closedError: Error | undefined;
  private _isRemote = false;
  private _localUtils?: LocalUtils;
  private _rawBuffers = false;
  // Some connections allow resolving in-process dispatchers.
  toImpl: ((client: ChannelOwner | Connection) => any) | undefined;
  private _tracingCount = 0;
  readonly _instrumentation: ClientInstrumentation;
  // Used from @playwright/test fixtures -> TODO remove?
  readonly headers: HeadersArray;
  private _objectFactories = new Map<string, ChannelOwnerFactory>();

  constructor(localUtils?: LocalUtils, instrumentation?: ClientInstrumentation, headers: HeadersArray = []) {
    super();
    this._instrumentation = instrumentation || createInstrumentation();
    this._localUtils = localUtils;
    this._rootObject = new Root(this);
    this.headers = headers;
    this.registerObjectFactories({
      Android: (parent, type, guid, init) => new Android(parent, type, guid, init),
      AndroidDevice: (parent, type, guid, init) => new AndroidDevice(parent, type, guid, init),
      AndroidSocket: (parent, type, guid, init) => new AndroidSocket(parent, type, guid, init),
      APIRequestContext: (parent, type, guid, init) => new APIRequestContext(parent, type, guid, init),
      Artifact: (parent, type, guid, init) => new Artifact(parent, type, guid, init),
      BindingCall: (parent, type, guid, init) => new BindingCall(parent, type, guid, init),
      Browser: (parent, type, guid, init) => new Browser(parent, type, guid, init),
      BrowserContext: (parent, type, guid, init) => new BrowserContext(parent, type, guid, init),
      BrowserType: (parent, type, guid, init) => new BrowserType(parent, type, guid, init),
      CDPSession: (parent, type, guid, init) => new CDPSession(parent, type, guid, init),
      Debugger: (parent, type, guid, init) => new Debugger(parent, type, guid, init),
      Dialog: (parent, type, guid, init) => new Dialog(parent, type, guid, init),
      Disposable: (parent, type, guid, init) => new DisposableObject(parent, type, guid, init),
      Electron: (parent, type, guid, init) => new Electron(parent, type, guid, init),
      ElectronApplication: (parent, type, guid, init) => new ElectronApplication(parent, type, guid, init),
      ElementHandle: (parent, type, guid, init) => new ElementHandle(parent, type, guid, init),
      Frame: (parent, type, guid, init) => new Frame(parent, type, guid, init),
      JSHandle: (parent, type, guid, init) => new JSHandle(parent, type, guid, init),
      JsonPipe: (parent, type, guid, init) => new JsonPipe(parent, type, guid, init),
      LocalUtils: (parent, type, guid, init) => {
        const result = new LocalUtils(parent, type, guid, init);
        if (!this._localUtils)
          this._localUtils = result;
        return result;
      },
      Page: (parent, type, guid, init) => new Page(parent, type, guid, init),
      Playwright: (parent, type, guid, init) => new Playwright(parent, type, guid, init),
      Request: (parent, type, guid, init) => new Request(parent, type, guid, init),
      Response: (parent, type, guid, init) => new Response(parent, type, guid, init),
      Route: (parent, type, guid, init) => new Route(parent, type, guid, init),
      Stream: (parent, type, guid, init) => new Stream(parent, type, guid, init),
      SocksSupport: (parent, type, guid, init) => new DummyChannelOwner(parent, type, guid, init),
      Tracing: (parent, type, guid, init) => new Tracing(parent, type, guid, init),
      WebSocket: (parent, type, guid, init) => new WebSocket(parent, type, guid, init),
      WebSocketRoute: (parent, type, guid, init) => new WebSocketRoute(parent, type, guid, init),
      Worker: (parent, type, guid, init) => new Worker(parent, type, guid, init),
      WritableStream: (parent, type, guid, init) => new WritableStream(parent, type, guid, init),
    });
  }

  registerObjectFactories(factories: Record<string, ChannelOwnerFactory>) {
    for (const [type, factory] of Object.entries(factories))
      this._objectFactories.set(type, factory);
  }

  markAsRemote() {
    this._isRemote = true;
  }

  isRemote() {
    return this._isRemote;
  }

  useRawBuffers() {
    this._rawBuffers = true;
  }

  rawBuffers() {
    return this._rawBuffers;
  }

  localUtils(): LocalUtils | undefined {
    return this._localUtils;
  }

  async initializePlaywright(): Promise<Playwright> {
    return await this._rootObject.initialize();
  }

  getObjectWithKnownName(guid: string): any {
    return this._objects.get(guid)!;
  }

  setIsTracing(isTracing: boolean) {
    if (isTracing)
      this._tracingCount++;
    else
      this._tracingCount--;
  }

  async sendMessageToServer(object: ChannelOwner, method: string, params: any, options: { apiName?: string, title?: string, internal?: boolean, frames?: channels.StackFrame[], stepId?: string, signal?: AbortSignal }): Promise<any> {
    // Fire-and-forget: server intentionally never replies to __waitInfo__,
    // so silently drop it after the connection is closed or the object was collected.
    if (method === '__waitInfo__' && (this._closedError || object._wasCollected))
      return;
    if (this._closedError)
      throw this._closedError;
    if (object._wasCollected)
      throw new Error('The object has been collected to prevent unbounded heap growth.');

    const signal = options.signal;
    if (signal?.aborted)
      throw new AbortError(undefined, { cause: signal.reason });

    const guid = object._guid;
    const type = object._type;
    const id = ++this._lastId;
    const message = { id, guid, method, params };
    if (debugLogger.isEnabled('channel')) {
      // Do not include metadata in debug logs to avoid noise.
      debugLogger.log('channel', 'SEND> ' + JSON.stringify(message));
    }
    const location = options.frames?.[0] ? { file: options.frames[0].file, line: options.frames[0].line, column: options.frames[0].column } : undefined;
    const metadata: channels.Metadata = { title: options.title, location, internal: options.internal, stepId: options.stepId };
    if (this._tracingCount && options.frames && type !== 'LocalUtils')
      this._localUtils?.addStackToTracingNoReply({ callData: { stack: options.frames ?? [], id } }).catch(() => {});
    // We need to exit zones before calling into the server, otherwise
    // when we receive events from the server, we would be in an API zone.
    emptyZone.run(() => this.onmessage({ ...message, metadata }));
    // Fire-and-forget: server intentionally never replies to __waitInfo__.
    if (method === '__waitInfo__')
      return;
    let abortListener: (() => void) | undefined;
    if (signal) {
      abortListener = () => {
        const reason = signal.reason instanceof Error ? signal.reason.message : String(signal.reason);
        emptyZone.run(() => this.onmessage({ guid, method: '__abort__', params: { id, reason } }));
      };
      signal.addEventListener('abort', abortListener, { once: true });
    }
    try {
      return await new Promise((resolve, reject) => this._callbacks.set(id, { resolve, reject, signal, title: options.title, type, method }));
    } finally {
      if (abortListener)
        signal!.removeEventListener('abort', abortListener);
    }
  }

  private _validatorFromWireContext(): ValidatorContext {
    return {
      tChannelImpl: this._tChannelImplFromWire.bind(this),
      binary: this._rawBuffers ? 'buffer' : 'fromBase64',
      isUnderTest,
    };
  }

  dispatch(message: object) {
    if (this._closedError)
      return;

    const { id, guid, method, params, result, error, errorDetails, log } = message as any;
    if (id) {
      if (debugLogger.isEnabled('channel'))
        debugLogger.log('channel', '<RECV ' + JSON.stringify(message));
      const callback = this._callbacks.get(id);
      if (!callback)
        throw new Error(`Cannot find command to respond: ${id}`);
      this._callbacks.delete(id);
      if (error && !result) {
        const parsedError = parseError(error);
        if (callback.signal?.aborted && parsedError instanceof AbortError)
          parsedError.cause = callback.signal.reason;
        parsedError.log = log || [];
        rewriteErrorMessage(parsedError, parsedError.message + formatCallLog(log));
        const detailsValidator = maybeFindValidator(callback.type, callback.method, 'ErrorDetails');
        if (detailsValidator)
          parsedError.details = detailsValidator(errorDetails ?? {}, '', this._validatorFromWireContext());
        callback.reject(parsedError);
      } else {
        const validator = findValidator(callback.type, callback.method, 'Result');
        callback.resolve(validator(result, '', this._validatorFromWireContext()));
      }
      return;
    }

    if (debugLogger.isEnabled('channel'))
      debugLogger.log('channel', '<EVENT ' + JSON.stringify(message));
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
      object._dispose(params.reason);
      return;
    }

    const validator = findValidator(object._type, method, 'Event');
    (object._channel as any).emit(method, validator(params, '', this._validatorFromWireContext()));
  }

  close(cause?: string) {
    if (this._closedError)
      return;
    this._closedError = new TargetClosedError(cause);
    for (const callback of this._callbacks.values())
      callback.reject(this._closedError);
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
    const validator = findValidator(type, '', 'Initializer');
    initializer = validator(initializer, '', this._validatorFromWireContext());
    const factory = this._objectFactories.get(type);
    if (!factory)
      throw new Error('Missing type ' + type);
    return factory(parent, type, guid, initializer);
  }
}

function formatCallLog(log: string[] | undefined): string {
  if (!log || !log.some(l => !!l))
    return '';
  return `
Call log:
${colors.dim(log.join('\n'))}
`;
}
