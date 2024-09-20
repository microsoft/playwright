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
import type { ExpectZone } from '../utils/stackTrace';
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
                const { apiName, frames, csi, callCookie, stepId } = apiZone.reported ? { apiName: undefined, csi: undefined, callCookie: undefined, frames: [], stepId: undefined } : apiZone;
                apiZone.reported = true;
                let currentStepId = stepId;
                if (csi && apiName) {
                  const out: { stepId?: string } = {};
                  csi.onApiCallBegin(apiName, params, frames, callCookie, out);
                  currentStepId = out.stepId;
                }
                return await this._connection.sendMessageToServer(this, prop, validator(params, '', { tChannelImpl: tChannelImplToWire, binary: this._connection.rawBuffers() ? 'buffer' : 'toBase64' }), apiName, frames, currentStepId);
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

  async _wrapApiCall<R>(func: (apiZone: ApiZone) => Promise<R>, isInternal = false): Promise<R> {
    const logger = this._logger;
    const apiZone = zones.zoneData<ApiZone>('apiZone');
    if (apiZone)
      return await func(apiZone);

    const stackTrace = captureLibraryStackTrace();
    let apiName: string | undefined = stackTrace.apiName;
    const frames: channels.StackFrame[] = stackTrace.frames;

    isInternal = isInternal || this._isInternalType;
    if (isInternal)
      apiName = undefined;

    // Enclosing zone could have provided the apiName and wallTime.
    const expectZone = zones.zoneData<ExpectZone>('expectZone');
    const stepId = expectZone?.stepId;
    if (!isInternal && expectZone)
      apiName = expectZone.title;

    // If we are coming from the expectZone, there is no need to generate a new
    // step for the API call, since it will be generated by the expect itself.
    const csi = isInternal || expectZone ? undefined : this._instrumentation;
    const callCookie: any = {};

    try {
      logApiCall(logger, `=> ${apiName} started`, isInternal);
      const apiZone: ApiZone = { apiName, frames, isInternal, reported: false, csi, callCookie, stepId };
      const result = await zones.run('apiZone', apiZone, async () => await func(apiZone));
      csi?.onApiCallEnd(callCookie);
      logApiCall(logger, `<= ${apiName} succeeded`, isInternal);
      return result;
    } catch (e) {
      const innerError = ((process.env.PWDEBUGIMPL || isUnderTest()) && e.stack) ? '\n<inner error>\n' + e.stack : '';
      if (apiName && !apiName.includes('<anonymous>'))
        e.message = apiName + ': ' + e.message;
      const stackFrames = '\n' + stringifyStackFrames(stackTrace.frames).join('\n') + innerError;
      if (stackFrames.trim())
        e.stack = e.message + stackFrames;
      else
        e.stack = '';
      csi?.onApiCallEnd(callCookie, e);
      logApiCall(logger, `<= ${apiName} failed`, isInternal);
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

function logApiCall(logger: Logger | undefined, message: string, isNested: boolean) {
  if (isNested)
    return;
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
  apiName: string | undefined;
  frames: channels.StackFrame[];
  isInternal: boolean;
  reported: boolean;
  csi: ClientInstrumentation | undefined;
  callCookie: any;
  stepId?: string;
};
