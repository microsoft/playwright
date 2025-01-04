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

import { EventEmitter } from './eventEmitter';
import type * as channels from '@protocol/channels';
import { maybeFindValidator, ValidationError, type ValidatorContext } from '../protocol/validator';
import { debugLogger } from '../utils/debugLogger';
import { captureLibraryStackTrace, stringifyStackFrames } from '../utils/stackTrace';
import { isUnderTest } from '../utils';
import { zones } from '../utils/zones';
import type { ClientInstrumentation } from './clientInstrumentation';
import type { Connection } from './connection';
import type { Logger } from './types';

type Listener = (...args: any[]) => void;

export abstract class ChannelOwner<T extends channels.Channel = channels.Channel> extends EventEmitter {
  readonly _connection: Connection;
  private _parent: ChannelOwner | undefined;
  private _objects = new Map<string, ChannelOwner>();

  readonly _type: string;
  readonly _guid: string;
  readonly _channel: T;
  readonly _initializer: channels.InitializerTraits<T>;
  _logger: Logger | undefined;
  readonly _instrumentation: ClientInstrumentation;
  private _eventToSubscriptionMapping: Map<string, string> = new Map();
  private _isInternalType = false;
  _wasCollected: boolean = false;

  constructor(parent: ChannelOwner | Connection, type: string, guid: string, initializer: channels.InitializerTraits<T>) {
    super();
    this.setMaxListeners(0);
    this._connection = parent instanceof ChannelOwner ? parent._connection : parent;
    this._type = type;
    this._guid = guid;
    this._parent = parent instanceof ChannelOwner ? parent : undefined;
    this._instrumentation = this._connection._instrumentation;

    this._connection._objects.set(guid, this);
    if (this._parent) {
      this._parent._objects.set(guid, this);
      this._logger = this._parent._logger;
    }

    this._channel = this._createChannel(new EventEmitter());
    this._initializer = initializer;
  }

  protected markAsInternalType() {
    this._isInternalType = true;
  }

  _setEventToSubscriptionMapping(mapping: Map<string, string>) {
    this._eventToSubscriptionMapping = mapping;
  }

  private _updateSubscription(event: string | symbol, enabled: boolean) {
    const protocolEvent = this._eventToSubscriptionMapping.get(String(event));
    if (protocolEvent) {
      this._wrapApiCall(async () => {
        await (this._channel as any).updateSubscription({ event: protocolEvent, enabled });
      }, true).catch(() => {});
    }
  }

  override on(event: string | symbol, listener: Listener): this {
    if (!this.listenerCount(event))
      this._updateSubscription(event, true);
    super.on(event, listener);
    return this;
  }

  override addListener(event: string | symbol, listener: Listener): this {
    if (!this.listenerCount(event))
      this._updateSubscription(event, true);
    super.addListener(event, listener);
    return this;
  }

  override prependListener(event: string | symbol, listener: Listener): this {
    if (!this.listenerCount(event))
      this._updateSubscription(event, true);
    super.prependListener(event, listener);
    return this;
  }

  override off(event: string | symbol, listener: Listener): this {
    super.off(event, listener);
    if (!this.listenerCount(event))
      this._updateSubscription(event, false);
    return this;
  }

  override removeListener(event: string | symbol, listener: Listener): this {
    super.removeListener(event, listener);
    if (!this.listenerCount(event))
      this._updateSubscription(event, false);
    return this;
  }

  _adopt(child: ChannelOwner<any>) {
    child._parent!._objects.delete(child._guid);
    this._objects.set(child._guid, child);
    child._parent = this;
  }

  _dispose(reason: 'gc' | undefined) {
    // Clean up from parent and connection.
    if (this._parent)
      this._parent._objects.delete(this._guid);
    this._connection._objects.delete(this._guid);
    this._wasCollected = reason === 'gc';

    // Dispose all children.
    for (const object of [...this._objects.values()])
      object._dispose(reason);
    this._objects.clear();
  }

  _debugScopeState(): any {
    return {
      _guid: this._guid,
      objects: Array.from(this._objects.values()).map(o => o._debugScopeState()),
    };
  }

  private _createChannel(base: Object): T {
    const channel = new Proxy(base, {
      get: (obj: any, prop: string | symbol) => {
        if (typeof prop === 'string') {
          const validator = maybeFindValidator(this._type, prop, 'Params');
          if (validator) {
            return async (params: any) => {
              return await this._wrapApiCall(async apiZone => {
                const validatedParams = validator(params, '', { tChannelImpl: tChannelImplToWire, binary: this._connection.rawBuffers() ? 'buffer' : 'toBase64' });
                if (!apiZone.isInternal && !apiZone.reported) {
                  // Reporting/tracing/logging this api call for the first time.
                  apiZone.params = params;
                  apiZone.reported = true;
                  this._instrumentation.onApiCallBegin(apiZone);
                  logApiCall(this._logger, `=> ${apiZone.apiName} started`);
                  return await this._connection.sendMessageToServer(this, prop, validatedParams, apiZone.apiName, apiZone.frames, apiZone.stepId);
                }
                // Since this api call is either internal, or has already been reported/traced once,
                // passing undefined apiName will avoid an extra unneeded tracing entry.
                return await this._connection.sendMessageToServer(this, prop, validatedParams, undefined, [], undefined);
              });
            };
          }
        }
        return obj[prop];
      },
    });
    (channel as any)._object = this;
    return channel;
  }

  async _wrapApiCall<R>(func: (apiZone: ApiZone) => Promise<R>, isInternal?: boolean): Promise<R> {
    const logger = this._logger;
    const existingApiZone = zones.zoneData<ApiZone>('apiZone');
    if (existingApiZone)
      return await func(existingApiZone);

    if (isInternal === undefined)
      isInternal = this._isInternalType;
    const stackTrace = captureLibraryStackTrace();
    const apiZone: ApiZone = { apiName: stackTrace.apiName, frames: stackTrace.frames, isInternal, reported: false, userData: undefined, stepId: undefined };

    try {
      const result = await zones.run('apiZone', apiZone, async () => await func(apiZone));
      if (!isInternal) {
        logApiCall(logger, `<= ${apiZone.apiName} succeeded`);
        this._instrumentation.onApiCallEnd(apiZone);
      }
      return result;
    } catch (e) {
      const innerError = ((process.env.PWDEBUGIMPL || isUnderTest()) && e.stack) ? '\n<inner error>\n' + e.stack : '';
      if (apiZone.apiName && !apiZone.apiName.includes('<anonymous>'))
        e.message = apiZone.apiName + ': ' + e.message;
      const stackFrames = '\n' + stringifyStackFrames(stackTrace.frames).join('\n') + innerError;
      if (stackFrames.trim())
        e.stack = e.message + stackFrames;
      else
        e.stack = '';
      if (!isInternal) {
        apiZone.error = e;
        logApiCall(logger, `<= ${apiZone.apiName} failed`);
        this._instrumentation.onApiCallEnd(apiZone);
      }
      throw e;
    }
  }

  _toImpl(): any {
    return this._connection.toImpl?.(this);
  }

  private toJSON() {
    // Jest's expect library tries to print objects sometimes.
    // RPC objects can contain links to lots of other objects,
    // which can cause jest to crash. Let's help it out
    // by just returning the important values.
    return {
      _type: this._type,
      _guid: this._guid,
    };
  }
}

function logApiCall(logger: Logger | undefined, message: string) {
  if (logger && logger.isEnabled('api', 'info'))
    logger.log('api', 'info', message, [], { color: 'cyan' });
  debugLogger.log('api', message);
}

function tChannelImplToWire(names: '*' | string[], arg: any, path: string, context: ValidatorContext) {
  if (arg._object instanceof ChannelOwner && (names === '*' || names.includes(arg._object._type)))
    return { guid: arg._object._guid };
  throw new ValidationError(`${path}: expected channel ${names.toString()}`);
}

type ApiZone = {
  apiName: string;
  params?: Record<string, any>;
  frames: channels.StackFrame[];
  isInternal: boolean;
  reported: boolean;
  userData: any;
  stepId?: string;
  error?: Error;
};
