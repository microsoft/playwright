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
import type * as channels from '@protocol/channels';
import { serializeError } from '../../protocol/serializers';
import { findValidator, ValidationError, createMetadataValidator, type ValidatorContext } from '../../protocol/validator';
import { assert, isUnderTest, monotonicTime } from '../../utils';
import { kBrowserOrContextClosedError } from '../../common/errors';
import type { CallMetadata } from '../instrumentation';
import { SdkObject } from '../instrumentation';
import { rewriteErrorMessage } from '../../utils/stackTrace';
import type { PlaywrightDispatcher } from './playwrightDispatcher';
import { eventsHelper } from '../..//utils/eventsHelper';
import type { RegisteredListener } from '../..//utils/eventsHelper';

export const dispatcherSymbol = Symbol('dispatcher');
const metadataValidator = createMetadataValidator();

export function existingDispatcher<DispatcherType>(object: any): DispatcherType | undefined {
  return object[dispatcherSymbol];
}

export class Dispatcher<Type extends { guid: string }, ChannelType, ParentScopeType extends DispatcherScope> extends EventEmitter implements channels.Channel {
  private _connection: DispatcherConnection;
  // Parent is always "isScope".
  private _parent: ParentScopeType | undefined;
  // Only "isScope" channel owners have registered dispatchers inside.
  private _dispatchers = new Map<string, DispatcherScope>();
  protected _disposed = false;
  protected _eventListeners: RegisteredListener[] = [];

  readonly _guid: string;
  readonly _type: string;
  _object: Type;

  constructor(parent: ParentScopeType | DispatcherConnection, object: Type, type: string, initializer: channels.InitializerTraits<Type>) {
    super();

    this._connection = parent instanceof DispatcherConnection ? parent : parent._connection;
    this._parent = parent instanceof DispatcherConnection ? undefined : parent;

    const guid = object.guid;
    assert(!this._connection._dispatchers.has(guid));
    this._connection._dispatchers.set(guid, this);
    if (this._parent) {
      assert(!this._parent._dispatchers.has(guid));
      this._parent._dispatchers.set(guid, this);
    }

    this._type = type;
    this._guid = guid;
    this._object = object;

    (object as any)[dispatcherSymbol] = this;
    if (this._parent)
      this._connection.sendCreate(this._parent, type, guid, initializer, this._parent._object);
  }

  parentScope(): ParentScopeType {
    return this._parent!;
  }

  addObjectListener(eventName: (string | symbol), handler: (...args: any[]) => void) {
    this._eventListeners.push(eventsHelper.addEventListener(this._object as unknown as EventEmitter, eventName, handler));
  }

  adopt(child: DispatcherScope) {
    const oldParent = child._parent!;
    oldParent._dispatchers.delete(child._guid);
    this._dispatchers.set(child._guid, child);
    child._parent = this;
    this._connection.sendAdopt(this, child);
  }

  _dispatchEvent<T extends keyof channels.EventsTraits<ChannelType>>(method: T, params?: channels.EventsTraits<ChannelType>[T]) {
    if (this._disposed) {
      if (isUnderTest())
        throw new Error(`${this._guid} is sending "${String(method)}" event after being disposed`);
      // Just ignore this event outside of tests.
      return;
    }
    const sdkObject = this._object instanceof SdkObject ? this._object : undefined;
    this._connection.sendEvent(this, method as string, params, sdkObject);
  }

  _dispose() {
    this._disposeRecursively();
    this._connection.sendDispose(this);
  }

  protected _onDispose() {
  }

  private _disposeRecursively() {
    assert(!this._disposed, `${this._guid} is disposed more than once`);
    this._onDispose();
    this._disposed = true;
    eventsHelper.removeEventListeners(this._eventListeners);

    // Clean up from parent and connection.
    if (this._parent)
      this._parent._dispatchers.delete(this._guid);
    this._connection._dispatchers.delete(this._guid);

    // Dispose all children.
    for (const dispatcher of [...this._dispatchers.values()])
      dispatcher._disposeRecursively();
    this._dispatchers.clear();
    delete (this._object as any)[dispatcherSymbol];
  }

  _debugScopeState(): any {
    return {
      _guid: this._guid,
      objects: Array.from(this._dispatchers.values()).map(o => o._debugScopeState()),
    };
  }

  async waitForEventInfo(): Promise<void> {
    // Instrumentation takes care of this.
  }
}

export type DispatcherScope = Dispatcher<any, any, any>;

export class RootDispatcher extends Dispatcher<{ guid: '' }, any, any> {
  private _initialized = false;

  constructor(connection: DispatcherConnection, private readonly createPlaywright?: (scope: RootDispatcher, options: channels.RootInitializeParams) => Promise<PlaywrightDispatcher>) {
    super(connection, { guid: '' }, 'Root', {});
  }

  async initialize(params: channels.RootInitializeParams): Promise<channels.RootInitializeResult> {
    assert(this.createPlaywright);
    assert(!this._initialized);
    this._initialized = true;
    return {
      playwright: await this.createPlaywright(this, params),
    };
  }
}

export class DispatcherConnection {
  readonly _dispatchers = new Map<string, DispatcherScope>();
  onmessage = (message: object) => {};
  private _waitOperations = new Map<string, CallMetadata>();
  private _isLocal: boolean;

  constructor(isLocal?: boolean) {
    this._isLocal = !!isLocal;
  }

  sendEvent(dispatcher: DispatcherScope, event: string, params: any, sdkObject?: SdkObject) {
    const validator = findValidator(dispatcher._type, event, 'Event');
    params = validator(params, '', { tChannelImpl: this._tChannelImplToWire.bind(this), binary: this._isLocal ? 'buffer' : 'toBase64' });
    this._sendMessageToClient(dispatcher._guid, dispatcher._type, event, params, sdkObject);
  }

  sendCreate(parent: DispatcherScope, type: string, guid: string, initializer: any, sdkObject?: SdkObject) {
    const validator = findValidator(type, '', 'Initializer');
    initializer = validator(initializer, '', { tChannelImpl: this._tChannelImplToWire.bind(this), binary: this._isLocal ? 'buffer' : 'toBase64' });
    this._sendMessageToClient(parent._guid, type, '__create__', { type, initializer, guid }, sdkObject);
  }

  sendAdopt(parent: DispatcherScope, dispatcher: DispatcherScope) {
    this._sendMessageToClient(parent._guid, dispatcher._type, '__adopt__', { guid: dispatcher._guid });
  }

  sendDispose(dispatcher: DispatcherScope) {
    this._sendMessageToClient(dispatcher._guid, dispatcher._type, '__dispose__', {});
  }

  private _sendMessageToClient(guid: string, type: string, method: string, params: any, sdkObject?: SdkObject) {
    if (sdkObject) {
      const eventMetadata: CallMetadata = {
        id: `event@${++lastEventId}`,
        objectId: sdkObject?.guid,
        pageId: sdkObject?.attribution?.page?.guid,
        frameId: sdkObject?.attribution?.frame?.guid,
        startTime: monotonicTime(),
        endTime: 0,
        type,
        method,
        params: params || {},
        log: [],
        snapshots: []
      };
      sdkObject.instrumentation?.onEvent(sdkObject, eventMetadata);
    }
    this.onmessage({ guid, method, params });
  }

  private _tChannelImplFromWire(names: '*' | string[], arg: any, path: string, context: ValidatorContext): any {
    if (arg && typeof arg === 'object' && typeof arg.guid === 'string') {
      const guid = arg.guid;
      const dispatcher = this._dispatchers.get(guid);
      if (!dispatcher)
        throw new ValidationError(`${path}: no object with guid ${guid}`);
      if (names !== '*' && !names.includes(dispatcher._type))
        throw new ValidationError(`${path}: object with guid ${guid} has type ${dispatcher._type}, expected ${names.toString()}`);
      return dispatcher;
    }
    throw new ValidationError(`${path}: expected guid for ${names.toString()}`);
  }

  private _tChannelImplToWire(names: '*' | string[], arg: any, path: string, context: ValidatorContext): any {
    if (arg instanceof Dispatcher)  {
      if (names !== '*' && !names.includes(arg._type))
        throw new ValidationError(`${path}: dispatcher with guid ${arg._guid} has type ${arg._type}, expected ${names.toString()}`);
      return { guid: arg._guid };
    }
    throw new ValidationError(`${path}: expected dispatcher ${names.toString()}`);
  }

  async dispatch(message: object) {
    const { id, guid, method, params, metadata } = message as any;
    const dispatcher = this._dispatchers.get(guid);
    if (!dispatcher) {
      this.onmessage({ id, error: serializeError(new Error(kBrowserOrContextClosedError)) });
      return;
    }

    let validParams: any;
    let validMetadata: channels.Metadata;
    try {
      const validator = findValidator(dispatcher._type, method, 'Params');
      validParams = validator(params, '', { tChannelImpl: this._tChannelImplFromWire.bind(this), binary: this._isLocal ? 'buffer' : 'fromBase64' });
      validMetadata = metadataValidator(metadata, '', { tChannelImpl: this._tChannelImplFromWire.bind(this), binary: this._isLocal ? 'buffer' : 'fromBase64' });
      if (typeof (dispatcher as any)[method] !== 'function')
        throw new Error(`Mismatching dispatcher: "${dispatcher._type}" does not implement "${method}"`);
    } catch (e) {
      this.onmessage({ id, error: serializeError(e) });
      return;
    }

    const sdkObject = dispatcher._object instanceof SdkObject ? dispatcher._object : undefined;
    const callMetadata: CallMetadata = {
      id: `call@${id}`,
      wallTime: validMetadata.wallTime,
      location: validMetadata.location,
      apiName: validMetadata.apiName,
      internal: validMetadata.internal,
      objectId: sdkObject?.guid,
      pageId: sdkObject?.attribution?.page?.guid,
      frameId: sdkObject?.attribution?.frame?.guid,
      startTime: monotonicTime(),
      endTime: 0,
      type: dispatcher._type,
      method,
      params: params || {},
      log: [],
      snapshots: []
    };

    if (sdkObject && params?.info?.waitId) {
      // Process logs for waitForNavigation/waitForLoadState/etc.
      const info = params.info;
      switch (info.phase) {
        case 'before': {
          this._waitOperations.set(info.waitId, callMetadata);
          await sdkObject.instrumentation.onBeforeCall(sdkObject, callMetadata);
          this.onmessage({ id });
          return;
        } case 'log': {
          const originalMetadata = this._waitOperations.get(info.waitId)!;
          originalMetadata.log.push(info.message);
          sdkObject.instrumentation.onCallLog(sdkObject, originalMetadata, 'api', info.message);
          this.onmessage({ id });
          return;
        } case 'after': {
          const originalMetadata = this._waitOperations.get(info.waitId)!;
          originalMetadata.endTime = monotonicTime();
          originalMetadata.error = info.error ? { error: { name: 'Error', message: info.error } } : undefined;
          this._waitOperations.delete(info.waitId);
          await sdkObject.instrumentation.onAfterCall(sdkObject, originalMetadata);
          this.onmessage({ id });
          return;
        }
      }
    }


    let error: any;
    await sdkObject?.instrumentation.onBeforeCall(sdkObject, callMetadata);
    try {
      const result = await (dispatcher as any)[method](validParams, callMetadata);
      const validator = findValidator(dispatcher._type, method, 'Result');
      callMetadata.result = validator(result, '', { tChannelImpl: this._tChannelImplToWire.bind(this), binary: this._isLocal ? 'buffer' : 'toBase64' });
    } catch (e) {
      // Dispatching error
      // We want original, unmodified error in metadata.
      callMetadata.error = serializeError(e);
      if (callMetadata.log.length)
        rewriteErrorMessage(e, e.message + formatLogRecording(callMetadata.log));
      error = serializeError(e);
    } finally {
      callMetadata.endTime = monotonicTime();
      await sdkObject?.instrumentation.onAfterCall(sdkObject, callMetadata);
    }

    const response: any = { id };
    if (callMetadata.result)
      response.result = callMetadata.result;
    if (error)
      response.error = error;
    this.onmessage(response);
  }
}

function formatLogRecording(log: string[]): string {
  if (!log.length)
    return '';
  const header = ` logs `;
  const headerLength = 60;
  const leftLength = (headerLength - header.length) / 2;
  const rightLength = headerLength - header.length - leftLength;
  return `\n${'='.repeat(leftLength)}${header}${'='.repeat(rightLength)}\n${log.join('\n')}\n${'='.repeat(headerLength)}`;
}

let lastEventId = 0;
