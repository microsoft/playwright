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
import { findValidator, ValidationError, createMetadataValidator, type ValidatorContext } from '../../protocol/validator';
import { LongStandingScope, assert, isUnderTest, monotonicTime, rewriteErrorMessage } from '../../utils';
import { TargetClosedError, isTargetClosedError, serializeError } from '../errors';
import type { CallMetadata } from '../instrumentation';
import { SdkObject } from '../instrumentation';
import type { PlaywrightDispatcher } from './playwrightDispatcher';
import { eventsHelper } from '../..//utils/eventsHelper';
import type { RegisteredListener } from '../..//utils/eventsHelper';
import { isProtocolError } from '../protocolError';

export const dispatcherSymbol = Symbol('dispatcher');
const metadataValidator = createMetadataValidator();

export function existingDispatcher<DispatcherType>(object: any): DispatcherType | undefined {
  return object[dispatcherSymbol];
}

let maxDispatchersOverride: number | undefined;
export function setMaxDispatchersForTest(value: number | undefined) {
  maxDispatchersOverride = value;
}
function maxDispatchersForBucket(gcBucket: string) {
  return maxDispatchersOverride ?? {
    'JSHandle': 100000,
    'ElementHandle': 100000,
  }[gcBucket] ?? 10000;
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
  readonly _gcBucket: string;
  _object: Type;
  private _openScope = new LongStandingScope();

  constructor(parent: ParentScopeType | DispatcherConnection, object: Type, type: string, initializer: channels.InitializerTraits<Type>, gcBucket?: string) {
    super();

    this._connection = parent instanceof DispatcherConnection ? parent : parent._connection;
    this._parent = parent instanceof DispatcherConnection ? undefined : parent;

    const guid = object.guid;
    this._guid = guid;
    this._type = type;
    this._object = object;
    this._gcBucket = gcBucket ?? type;

    (object as any)[dispatcherSymbol] = this;

    this._connection.registerDispatcher(this);
    if (this._parent) {
      assert(!this._parent._dispatchers.has(guid));
      this._parent._dispatchers.set(guid, this);
    }

    if (this._parent)
      this._connection.sendCreate(this._parent, type, guid, initializer);
    this._connection.maybeDisposeStaleDispatchers(this._gcBucket);
  }

  parentScope(): ParentScopeType {
    return this._parent!;
  }

  addObjectListener(eventName: (string | symbol), handler: (...args: any[]) => void) {
    this._eventListeners.push(eventsHelper.addEventListener(this._object as unknown as EventEmitter, eventName, handler));
  }

  adopt(child: DispatcherScope) {
    if (child._parent === this)
      return;
    const oldParent = child._parent!;
    oldParent._dispatchers.delete(child._guid);
    this._dispatchers.set(child._guid, child);
    child._parent = this;
    this._connection.sendAdopt(this, child);
  }

  async _handleCommand(callMetadata: CallMetadata, method: string, validParams: any) {
    const commandPromise = (this as any)[method](validParams, callMetadata);
    try {
      return await this._openScope.race(commandPromise);
    } catch (e) {
      if (callMetadata.potentiallyClosesScope && isTargetClosedError(e))
        return await commandPromise;
      throw e;
    }
  }

  _dispatchEvent<T extends keyof channels.EventsTraits<ChannelType>>(method: T, params?: channels.EventsTraits<ChannelType>[T]) {
    if (this._disposed) {
      if (isUnderTest())
        throw new Error(`${this._guid} is sending "${String(method)}" event after being disposed`);
      // Just ignore this event outside of tests.
      return;
    }
    this._connection.sendEvent(this, method as string, params);
  }

  _dispose(reason?: 'gc') {
    this._disposeRecursively(new TargetClosedError());
    this._connection.sendDispose(this, reason);
  }

  protected _onDispose() {
  }

  private _disposeRecursively(error: Error) {
    assert(!this._disposed, `${this._guid} is disposed more than once`);
    this._onDispose();
    this._disposed = true;
    eventsHelper.removeEventListeners(this._eventListeners);

    // Clean up from parent and connection.
    this._parent?._dispatchers.delete(this._guid);
    const list = this._connection._dispatchersByBucket.get(this._gcBucket);
    list?.delete(this._guid);
    this._connection._dispatchers.delete(this._guid);

    // Dispose all children.
    for (const dispatcher of [...this._dispatchers.values()])
      dispatcher._disposeRecursively(error);
    this._dispatchers.clear();
    delete (this._object as any)[dispatcherSymbol];
    this._openScope.close(error);
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
  readonly _dispatchersByBucket = new Map<string, Set<string>>();
  onmessage = (message: object) => {};
  private _waitOperations = new Map<string, CallMetadata>();
  private _isLocal: boolean;

  constructor(isLocal?: boolean) {
    this._isLocal = !!isLocal;
  }

  sendEvent(dispatcher: DispatcherScope, event: string, params: any) {
    const validator = findValidator(dispatcher._type, event, 'Event');
    params = validator(params, '', { tChannelImpl: this._tChannelImplToWire.bind(this), binary: this._isLocal ? 'buffer' : 'toBase64' });
    this.onmessage({ guid: dispatcher._guid, method: event, params });
  }

  sendCreate(parent: DispatcherScope, type: string, guid: string, initializer: any) {
    const validator = findValidator(type, '', 'Initializer');
    initializer = validator(initializer, '', { tChannelImpl: this._tChannelImplToWire.bind(this), binary: this._isLocal ? 'buffer' : 'toBase64' });
    this.onmessage({ guid: parent._guid, method: '__create__', params: { type, initializer, guid } });
  }

  sendAdopt(parent: DispatcherScope, dispatcher: DispatcherScope) {
    this.onmessage({ guid: parent._guid, method: '__adopt__', params: { guid: dispatcher._guid } });
  }

  sendDispose(dispatcher: DispatcherScope, reason?: 'gc') {
    this.onmessage({ guid: dispatcher._guid, method: '__dispose__', params: { reason } });
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

  registerDispatcher(dispatcher: DispatcherScope) {
    assert(!this._dispatchers.has(dispatcher._guid));
    this._dispatchers.set(dispatcher._guid, dispatcher);
    let list = this._dispatchersByBucket.get(dispatcher._gcBucket);
    if (!list) {
      list = new Set();
      this._dispatchersByBucket.set(dispatcher._gcBucket, list);
    }
    list.add(dispatcher._guid);
  }

  maybeDisposeStaleDispatchers(gcBucket: string) {
    const maxDispatchers = maxDispatchersForBucket(gcBucket);
    const list = this._dispatchersByBucket.get(gcBucket);
    if (!list || list.size <= maxDispatchers)
      return;
    const dispatchersArray = [...list];
    const disposeCount = (maxDispatchers / 10) | 0;
    this._dispatchersByBucket.set(gcBucket, new Set(dispatchersArray.slice(disposeCount)));
    for (let i = 0; i < disposeCount; ++i) {
      const d = this._dispatchers.get(dispatchersArray[i]);
      if (!d)
        continue;
      d._dispose('gc');
    }
  }

  async dispatch(message: object) {
    const { id, guid, method, params, metadata } = message as any;
    const dispatcher = this._dispatchers.get(guid);
    if (!dispatcher) {
      this.onmessage({ id, error: serializeError(new TargetClosedError()) });
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
      location: validMetadata.location,
      apiName: validMetadata.apiName,
      internal: validMetadata.internal,
      stepId: validMetadata.stepId,
      objectId: sdkObject?.guid,
      pageId: sdkObject?.attribution?.page?.guid,
      frameId: sdkObject?.attribution?.frame?.guid,
      startTime: monotonicTime(),
      endTime: 0,
      type: dispatcher._type,
      method,
      params: params || {},
      log: [],
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

    await sdkObject?.instrumentation.onBeforeCall(sdkObject, callMetadata);
    const response: any = { id };
    try {
      const result = await dispatcher._handleCommand(callMetadata, method, validParams);
      const validator = findValidator(dispatcher._type, method, 'Result');
      response.result = validator(result, '', { tChannelImpl: this._tChannelImplToWire.bind(this), binary: this._isLocal ? 'buffer' : 'toBase64' });
      callMetadata.result = result;
    } catch (e) {
      if (isTargetClosedError(e) && sdkObject) {
        const reason = closeReason(sdkObject);
        if (reason)
          rewriteErrorMessage(e, reason);
      } else if (isProtocolError(e)) {
        if (e.type === 'closed') {
          const reason = sdkObject ? closeReason(sdkObject) : undefined;
          e = new TargetClosedError(reason, e.browserLogMessage());
        } else if (e.type === 'crashed') {
          rewriteErrorMessage(e, 'Target crashed ' + e.browserLogMessage());
        }
      }
      response.error = serializeError(e);
      // The command handler could have set error in the metadata, do not reset it if there was no exception.
      callMetadata.error = response.error;
    } finally {
      callMetadata.endTime = monotonicTime();
      await sdkObject?.instrumentation.onAfterCall(sdkObject, callMetadata);
    }

    if (response.error)
      response.log = callMetadata.log;
    this.onmessage(response);
  }
}

function closeReason(sdkObject: SdkObject): string | undefined {
  return sdkObject.attribution.page?._closeReason ||
    sdkObject.attribution.context?._closeReason ||
    sdkObject.attribution.browser?._closeReason;
}
