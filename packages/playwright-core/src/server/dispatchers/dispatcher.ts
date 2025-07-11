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

import { eventsHelper } from '../utils/eventsHelper';
import { ValidationError, createMetadataValidator, findValidator  } from '../../protocol/validator';
import { assert, monotonicTime, rewriteErrorMessage } from '../../utils';
import { isUnderTest } from '../utils/debug';
import { TargetClosedError, isTargetClosedError, serializeError } from '../errors';
import { createRootSdkObject, SdkObject } from '../instrumentation';
import { isProtocolError } from '../protocolError';
import { compressCallLog } from '../callLog';
import { methodMetainfo } from '../../utils/isomorphic/protocolMetainfo';
import { Progress, ProgressController } from '../progress';

import type { CallMetadata } from '../instrumentation';
import type { PlaywrightDispatcher } from './playwrightDispatcher';
import type { RegisteredListener } from '../utils/eventsHelper';
import type { ValidatorContext } from '../../protocol/validator';
import type * as channels from '@protocol/channels';

const metadataValidator = createMetadataValidator();

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

export class Dispatcher<Type extends SdkObject, ChannelType, ParentScopeType extends DispatcherScope> extends EventEmitter implements channels.Channel {
  readonly connection: DispatcherConnection;
  private _parent: ParentScopeType | undefined;
  private _dispatchers = new Map<string, DispatcherScope>();
  protected _disposed = false;
  protected _eventListeners: RegisteredListener[] = [];
  private _activeProgressControllers = new Set<ProgressController>();

  readonly _guid: string;
  readonly _type: string;
  readonly _gcBucket: string;
  _object: Type;

  constructor(parent: ParentScopeType | DispatcherConnection, object: Type, type: string, initializer: channels.InitializerTraits<ChannelType>, gcBucket?: string) {
    super();

    this.connection = parent instanceof DispatcherConnection ? parent : parent.connection;
    this._parent = parent instanceof DispatcherConnection ? undefined : parent;

    const guid = object.guid;
    this._guid = guid;
    this._type = type;
    this._object = object;
    this._gcBucket = gcBucket ?? type;

    this.connection.registerDispatcher(this);
    if (this._parent) {
      assert(!this._parent._dispatchers.has(guid));
      this._parent._dispatchers.set(guid, this);
    }

    if (this._parent)
      this.connection.sendCreate(this._parent, type, guid, initializer);
    this.connection.maybeDisposeStaleDispatchers(this._gcBucket);
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
    this.connection.sendAdopt(this, child);
  }

  async _runCommand(callMetadata: CallMetadata, method: string, validParams: any) {
    const controller = new ProgressController(callMetadata, this._object);
    this._activeProgressControllers.add(controller);
    try {
      return await controller.run(progress => (this as any)[method](validParams, progress), validParams?.timeout);
    } finally {
      this._activeProgressControllers.delete(controller);
    }
  }

  _dispatchEvent<T extends keyof channels.EventsTraits<ChannelType>>(method: T, params?: channels.EventsTraits<ChannelType>[T]) {
    if (this._disposed) {
      if (isUnderTest())
        throw new Error(`${this._guid} is sending "${String(method)}" event after being disposed`);
      // Just ignore this event outside of tests.
      return;
    }
    this.connection.sendEvent(this, method as string, params);
  }

  _dispose(reason?: 'gc') {
    this._disposeRecursively(new TargetClosedError());
    this.connection.sendDispose(this, reason);
  }

  protected _onDispose() {
  }

  async stopPendingOperations(error: Error) {
    const controllers: ProgressController[] = [];
    const collect = (dispatcher: DispatcherScope) => {
      controllers.push(...dispatcher._activeProgressControllers);
      for (const child of [...dispatcher._dispatchers.values()])
        collect(child);
    };
    collect(this);
    await Promise.all(controllers.map(controller => controller.abort(error)));
  }

  private _disposeRecursively(error: Error) {
    assert(!this._disposed, `${this._guid} is disposed more than once`);
    for (const controller of this._activeProgressControllers) {
      if (!controller.metadata.potentiallyClosesScope)
        controller.abort(error).catch(() => {});
    }
    this._onDispose();
    this._disposed = true;
    eventsHelper.removeEventListeners(this._eventListeners);

    // Clean up from parent and connection.
    this._parent?._dispatchers.delete(this._guid);
    const list = this.connection._dispatchersByBucket.get(this._gcBucket);
    list?.delete(this._guid);
    this.connection._dispatcherByGuid.delete(this._guid);
    this.connection._dispatcherByObject.delete(this._object);

    // Dispose all children.
    for (const dispatcher of [...this._dispatchers.values()])
      dispatcher._disposeRecursively(error);
    this._dispatchers.clear();
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

export type DispatcherScope = Dispatcher<SdkObject, any, any>;

export class RootDispatcher extends Dispatcher<SdkObject, any, any> {
  private _initialized = false;

  constructor(connection: DispatcherConnection, private readonly createPlaywright?: (scope: RootDispatcher, options: channels.RootInitializeParams) => Promise<PlaywrightDispatcher>) {
    super(connection, createRootSdkObject(), 'Root', {});
  }

  async initialize(params: channels.RootInitializeParams, progress: Progress): Promise<channels.RootInitializeResult> {
    // Note: progress is deliberately ignored here.
    assert(this.createPlaywright);
    assert(!this._initialized);
    this._initialized = true;
    return {
      playwright: await this.createPlaywright(this, params),
    };
  }
}

export class DispatcherConnection {
  readonly _dispatcherByGuid = new Map<string, DispatcherScope>();
  readonly _dispatcherByObject = new Map<any, DispatcherScope>();
  readonly _dispatchersByBucket = new Map<string, Set<string>>();
  onmessage = (message: object) => {};
  private _waitOperations = new Map<string, CallMetadata>();
  private _isLocal: boolean;

  constructor(isLocal?: boolean) {
    this._isLocal = !!isLocal;
  }

  sendEvent(dispatcher: DispatcherScope, event: string, params: any) {
    const validator = findValidator(dispatcher._type, event, 'Event');
    params = validator(params, '', this._validatorToWireContext());
    this.onmessage({ guid: dispatcher._guid, method: event, params });
  }

  sendCreate(parent: DispatcherScope, type: string, guid: string, initializer: any) {
    const validator = findValidator(type, '', 'Initializer');
    initializer = validator(initializer, '', this._validatorToWireContext());
    this.onmessage({ guid: parent._guid, method: '__create__', params: { type, initializer, guid } });
  }

  sendAdopt(parent: DispatcherScope, dispatcher: DispatcherScope) {
    this.onmessage({ guid: parent._guid, method: '__adopt__', params: { guid: dispatcher._guid } });
  }

  sendDispose(dispatcher: DispatcherScope, reason?: 'gc') {
    this.onmessage({ guid: dispatcher._guid, method: '__dispose__', params: { reason } });
  }

  private _validatorToWireContext(): ValidatorContext {
    return {
      tChannelImpl: this._tChannelImplToWire.bind(this),
      binary: this._isLocal ? 'buffer' : 'toBase64',
      isUnderTest,
    };
  }

  private _validatorFromWireContext(): ValidatorContext {
    return {
      tChannelImpl: this._tChannelImplFromWire.bind(this),
      binary: this._isLocal ? 'buffer' : 'fromBase64',
      isUnderTest,
    };
  }

  private _tChannelImplFromWire(names: '*' | string[], arg: any, path: string, context: ValidatorContext): any {
    if (arg && typeof arg === 'object' && typeof arg.guid === 'string') {
      const guid = arg.guid;
      const dispatcher = this._dispatcherByGuid.get(guid);
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

  existingDispatcher<DispatcherType>(object: any): DispatcherType | undefined {
    return this._dispatcherByObject.get(object) as DispatcherType | undefined;
  }

  registerDispatcher(dispatcher: DispatcherScope) {
    assert(!this._dispatcherByGuid.has(dispatcher._guid));
    this._dispatcherByGuid.set(dispatcher._guid, dispatcher);
    this._dispatcherByObject.set(dispatcher._object, dispatcher);
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
      const d = this._dispatcherByGuid.get(dispatchersArray[i]);
      if (!d)
        continue;
      d._dispose('gc');
    }
  }

  async dispatch(message: object) {
    const { id, guid, method, params, metadata } = message as any;
    const dispatcher = this._dispatcherByGuid.get(guid);
    if (!dispatcher) {
      this.onmessage({ id, error: serializeError(new TargetClosedError()) });
      return;
    }

    let validParams: any;
    let validMetadata: channels.Metadata;
    try {
      const validator = findValidator(dispatcher._type, method, 'Params');
      const validatorContext = this._validatorFromWireContext();
      validParams = validator(params, '', validatorContext);
      validMetadata = metadataValidator(metadata, '', validatorContext);
      if (typeof (dispatcher as any)[method] !== 'function')
        throw new Error(`Mismatching dispatcher: "${dispatcher._type}" does not implement "${method}"`);
    } catch (e) {
      this.onmessage({ id, error: serializeError(e) });
      return;
    }

    if (methodMetainfo.get(dispatcher._type + '.' + method)?.internal) {
      // For non-js ports, it is easier to detect internal calls here rather
      // than generate protocol metainfo for each language.
      validMetadata.internal = true;
    }

    const sdkObject = dispatcher._object;
    const callMetadata: CallMetadata = {
      id: `call@${id}`,
      location: validMetadata.location,
      title: validMetadata.title,
      internal: validMetadata.internal,
      stepId: validMetadata.stepId,
      objectId: sdkObject.guid,
      pageId: sdkObject.attribution?.page?.guid,
      frameId: sdkObject.attribution?.frame?.guid,
      startTime: monotonicTime(),
      endTime: 0,
      type: dispatcher._type,
      method,
      params: params || {},
      log: [],
    };

    if (params?.info?.waitId) {
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

    await sdkObject.instrumentation.onBeforeCall(sdkObject, callMetadata);
    const response: any = { id };
    try {
      // If the dispatcher has been disposed while running the instrumentation call, error out.
      if (this._dispatcherByGuid.get(guid) !== dispatcher)
        throw new TargetClosedError(closeReason(sdkObject));
      const result = await dispatcher._runCommand(callMetadata, method, validParams);
      const validator = findValidator(dispatcher._type, method, 'Result');
      response.result = validator(result, '', this._validatorToWireContext());
      callMetadata.result = result;
    } catch (e) {
      if (isTargetClosedError(e)) {
        const reason = closeReason(sdkObject);
        if (reason)
          rewriteErrorMessage(e, reason);
      } else if (isProtocolError(e)) {
        if (e.type === 'closed')
          e = new TargetClosedError(closeReason(sdkObject), e.browserLogMessage());
        else if (e.type === 'crashed')
          rewriteErrorMessage(e, 'Target crashed ' + e.browserLogMessage());
      }
      response.error = serializeError(e);
      // The command handler could have set error in the metadata, do not reset it if there was no exception.
      callMetadata.error = response.error;
    } finally {
      callMetadata.endTime = monotonicTime();
      await sdkObject.instrumentation.onAfterCall(sdkObject, callMetadata);
    }

    if (response.error)
      response.log = compressCallLog(callMetadata.log);
    this.onmessage(response);
  }
}

function closeReason(sdkObject: SdkObject): string | undefined {
  return sdkObject.attribution.page?.closeReason ||
    sdkObject.attribution.context?._closeReason ||
    sdkObject.attribution.browser?._closeReason;
}
