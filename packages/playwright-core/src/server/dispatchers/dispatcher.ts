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
import type * as channels from '../../protocol/channels';
import { serializeError } from '../../protocol/serializers';
import type { Validator } from '../../protocol/validator';
import { createScheme, ValidationError } from '../../protocol/validator';
import { assert, debugAssert, isUnderTest, monotonicTime } from '../../utils';
import { tOptional } from '../../protocol/validatorPrimitives';
import { kBrowserOrContextClosedError } from '../../common/errors';
import type { CallMetadata } from '../instrumentation';
import { SdkObject } from '../instrumentation';
import { rewriteErrorMessage } from '../../utils/stackTrace';
import type { PlaywrightDispatcher } from './playwrightDispatcher';

export const dispatcherSymbol = Symbol('dispatcher');

export function lookupDispatcher<DispatcherType>(object: any): DispatcherType {
  const result = object[dispatcherSymbol];
  debugAssert(result);
  return result;
}

export function existingDispatcher<DispatcherType>(object: any): DispatcherType {
  return object[dispatcherSymbol];
}

export function lookupNullableDispatcher<DispatcherType>(object: any | null): DispatcherType | undefined {
  return object ? lookupDispatcher(object) : undefined;
}

export class Dispatcher<Type extends { guid: string }, ChannelType> extends EventEmitter implements channels.Channel {
  private _connection: DispatcherConnection;
  private _isScope: boolean;
  // Parent is always "isScope".
  private _parent: Dispatcher<any, any> | undefined;
  // Only "isScope" channel owners have registered dispatchers inside.
  private _dispatchers = new Map<string, Dispatcher<any, any>>();
  protected _disposed = false;

  readonly _guid: string;
  readonly _type: string;
  readonly _scope: Dispatcher<any, any>;
  _object: Type;

  constructor(parent: Dispatcher<any, any> | DispatcherConnection, object: Type, type: string, initializer: channels.InitializerTraits<Type>, isScope?: boolean) {
    super();

    this._connection = parent instanceof DispatcherConnection ? parent : parent._connection;
    this._isScope = !!isScope;
    this._parent = parent instanceof DispatcherConnection ? undefined : parent;
    this._scope = isScope ? this : this._parent!;

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
      this._connection.sendMessageToClient(this._parent._guid, type, '__create__', { type, initializer, guid }, this._parent._object);
  }

  _dispatchEvent<T extends keyof channels.EventsTraits<ChannelType>>(method: T, params?: channels.EventsTraits<ChannelType>[T]) {
    if (this._disposed) {
      if (isUnderTest())
        throw new Error(`${this._guid} is sending "${method}" event after being disposed`);
      // Just ignore this event outside of tests.
      return;
    }
    const sdkObject = this._object instanceof SdkObject ? this._object : undefined;
    this._connection.sendMessageToClient(this._guid, this._type, method as string, params, sdkObject);
  }

  protected _dispose() {
    assert(!this._disposed);
    this._disposed = true;

    // Clean up from parent and connection.
    if (this._parent)
      this._parent._dispatchers.delete(this._guid);
    this._connection._dispatchers.delete(this._guid);

    // Dispose all children.
    for (const dispatcher of [...this._dispatchers.values()])
      dispatcher._dispose();
    this._dispatchers.clear();

    if (this._isScope)
      this._connection.sendMessageToClient(this._guid, this._type, '__dispose__', {});
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

export type DispatcherScope = Dispatcher<any, any>;
export class Root extends Dispatcher<{ guid: '' }, any> {
  private _initialized = false;

  constructor(connection: DispatcherConnection, private readonly createPlaywright?: (scope: DispatcherScope, options: channels.RootInitializeParams) => Promise<PlaywrightDispatcher>) {
    super(connection, { guid: '' }, 'Root', {}, true);
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
  readonly _dispatchers = new Map<string, Dispatcher<any, any>>();
  onmessage = (message: object) => {};
  private _validateParams: (type: string, method: string, params: any) => any;
  private _validateMetadata: (metadata: any) => { stack?: channels.StackFrame[] };
  private _waitOperations = new Map<string, CallMetadata>();

  sendMessageToClient(guid: string, type: string, method: string, params: any, sdkObject?: SdkObject) {
    params = this._replaceDispatchersWithGuids(params);
    if (sdkObject) {
      const eventMetadata: CallMetadata = {
        id: `event@${++lastEventId}`,
        objectId: sdkObject?.guid,
        pageId: sdkObject?.attribution?.page?.guid,
        frameId: sdkObject?.attribution?.frame?.guid,
        wallTime: Date.now(),
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

  constructor() {
    const tChannel = (name: string): Validator => {
      return (arg: any, path: string) => {
        if (arg && typeof arg === 'object' && typeof arg.guid === 'string') {
          const guid = arg.guid;
          const dispatcher = this._dispatchers.get(guid);
          if (!dispatcher)
            throw new ValidationError(`${path}: no object with guid ${guid}`);
          if (name !== '*' && dispatcher._type !== name)
            throw new ValidationError(`${path}: object with guid ${guid} has type ${dispatcher._type}, expected ${name}`);
          return dispatcher;
        }
        throw new ValidationError(`${path}: expected ${name}`);
      };
    };
    const scheme = createScheme(tChannel);
    this._validateParams = (type: string, method: string, params: any): any => {
      const name = type + method[0].toUpperCase() + method.substring(1) + 'Params';
      if (!scheme[name])
        throw new ValidationError(`Unknown scheme for ${type}.${method}`);
      return scheme[name](params, '');
    };
    this._validateMetadata = (metadata: any): any => {
      return tOptional(scheme['Metadata'])(metadata, '');
    };
  }

  async dispatch(message: object) {
    const { id, guid, method, params, metadata } = message as any;
    const dispatcher = this._dispatchers.get(guid);
    if (!dispatcher) {
      this.onmessage({ id, error: serializeError(new Error(kBrowserOrContextClosedError)) });
      return;
    }
    if (method === 'debugScopeState') {
      const rootDispatcher = this._dispatchers.get('')!;
      this.onmessage({ id, result: rootDispatcher._debugScopeState() });
      return;
    }

    let validParams: any;
    let validMetadata: channels.Metadata;
    try {
      validParams = this._validateParams(dispatcher._type, method, params);
      validMetadata = this._validateMetadata(metadata);
      if (typeof (dispatcher as any)[method] !== 'function')
        throw new Error(`Mismatching dispatcher: "${dispatcher._type}" does not implement "${method}"`);
    } catch (e) {
      this.onmessage({ id, error: serializeError(e) });
      return;
    }

    const sdkObject = dispatcher._object instanceof SdkObject ? dispatcher._object : undefined;
    const callMetadata: CallMetadata = {
      id: `call@${id}`,
      stack: validMetadata.stack,
      apiName: validMetadata.apiName,
      internal: validMetadata.internal,
      objectId: sdkObject?.guid,
      pageId: sdkObject?.attribution?.page?.guid,
      frameId: sdkObject?.attribution?.frame?.guid,
      wallTime: Date.now(),
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
      callMetadata.result = this._replaceDispatchersWithGuids(result);
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

  private _replaceDispatchersWithGuids(payload: any): any {
    if (!payload)
      return payload;
    if (payload instanceof Dispatcher)
      return { guid: payload._guid };
    if (Array.isArray(payload))
      return payload.map(p => this._replaceDispatchersWithGuids(p));
    if (typeof payload === 'object') {
      const result: any = {};
      for (const key of Object.keys(payload))
        result[key] = this._replaceDispatchersWithGuids(payload[key]);
      return result;
    }
    return payload;
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
