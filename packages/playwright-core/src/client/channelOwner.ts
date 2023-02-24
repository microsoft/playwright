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

import { EventEmitter } from 'events';
import type * as channels from '@protocol/channels';
import { maybeFindValidator, ValidationError, type ValidatorContext } from '../protocol/validator';
import { debugLogger } from '../common/debugLogger';
import type { ExpectZone, ParsedStackTrace } from '../utils/stackTrace';
import { captureRawStack, captureLibraryStackTrace } from '../utils/stackTrace';
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
  _instrumentation: ClientInstrumentation | undefined;
  private _eventToSubscriptionMapping: Map<string, string> = new Map();

  constructor(parent: ChannelOwner | Connection, type: string, guid: string, initializer: channels.InitializerTraits<T>, instrumentation?: ClientInstrumentation) {
    super();
    this.setMaxListeners(0);
    this._connection = parent instanceof ChannelOwner ? parent._connection : parent;
    this._type = type;
    this._guid = guid;
    this._parent = parent instanceof ChannelOwner ? parent : undefined;
    this._instrumentation = instrumentation || this._parent?._instrumentation;

    this._connection._objects.set(guid, this);
    if (this._parent) {
      this._parent._objects.set(guid, this);
      this._logger = this._parent._logger;
    }

    this._channel = this._createChannel(new EventEmitter());
    this._initializer = initializer;
  }

  _setEventToSubscriptionMapping(mapping: Map<string, string>) {
    this._eventToSubscriptionMapping = mapping;
  }

  private _updateSubscription(event: string | symbol, enabled: boolean) {
    const protocolEvent = this._eventToSubscriptionMapping.get(String(event));
    if (protocolEvent)
      (this._channel as any).updateSubscription({ event: protocolEvent, enabled }).catch(() => {});
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

  _dispose() {
    // Clean up from parent and connection.
    if (this._parent)
      this._parent._objects.delete(this._guid);
    this._connection._objects.delete(this._guid);

    // Dispose all children.
    for (const object of [...this._objects.values()])
      object._dispose();
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
      get: (obj: any, prop) => {
        if (typeof prop === 'string') {
          const validator = maybeFindValidator(this._type, prop, 'Params');
          if (validator) {
            return (params: any) => {
              return this._wrapApiCall(apiZone => {
                const { stackTrace, csi, callCookie, wallTime } = apiZone.reported ? { csi: undefined, callCookie: undefined, stackTrace: null, wallTime: undefined } : apiZone;
                apiZone.reported = true;
                if (csi && stackTrace && stackTrace.apiName)
                  csi.onApiCallBegin(renderCallWithParams(stackTrace.apiName, params), stackTrace, wallTime, callCookie);
                return this._connection.sendMessageToServer(this, this._type, prop, validator(params, '', { tChannelImpl: tChannelImplToWire, binary: this._connection.isRemote() ? 'toBase64' : 'buffer' }), stackTrace, wallTime);
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
    const stack = captureRawStack();
    const apiZone = zones.zoneData<ApiZone>('apiZone', stack);
    if (apiZone)
      return func(apiZone);

    const stackTrace = captureLibraryStackTrace(stack);
    if (isInternal)
      delete stackTrace.apiName;

    // Enclosing zone could have provided the apiName and wallTime.
    const expectZone = zones.zoneData<ExpectZone>('expectZone', stack);
    const wallTime = expectZone ? expectZone.wallTime : Date.now();
    if (!isInternal && expectZone)
      stackTrace.apiName = expectZone.title;

    const csi = isInternal ? undefined : this._instrumentation;
    const callCookie: any = {};

    const { apiName, frameTexts } = stackTrace;
    try {
      logApiCall(logger, `=> ${apiName} started`, isInternal);
      const apiZone = { stackTrace, isInternal, reported: false, csi, callCookie, wallTime };
      const result = await zones.run<ApiZone, R>('apiZone', apiZone, async () => {
        return await func(apiZone);
      });
      csi?.onApiCallEnd(callCookie);
      logApiCall(logger, `<= ${apiName} succeeded`, isInternal);
      return result;
    } catch (e) {
      const innerError = ((process.env.PWDEBUGIMPL || isUnderTest()) && e.stack) ? '\n<inner error>\n' + e.stack : '';
      if (apiName && !apiName.includes('<anonymous>'))
        e.message = apiName + ': ' + e.message;
      const stackFrames = '\n' + frameTexts.join('\n') + innerError;
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

const paramsToRender = ['url', 'selector', 'text', 'key'];
function renderCallWithParams(apiName: string, params: any) {
  const paramsArray = [];
  if (params) {
    for (const name of paramsToRender) {
      if (params[name])
        paramsArray.push(params[name]);
    }
  }
  const paramsText = paramsArray.length ? '(' + paramsArray.join(', ') + ')' : '';
  return apiName + paramsText;
}

function tChannelImplToWire(names: '*' | string[], arg: any, path: string, context: ValidatorContext) {
  if (arg._object instanceof ChannelOwner && (names === '*' || names.includes(arg._object._type)))
    return { guid: arg._object._guid };
  throw new ValidationError(`${path}: expected channel ${names.toString()}`);
}

type ApiZone = {
  stackTrace: ParsedStackTrace;
  isInternal: boolean;
  reported: boolean;
  csi: ClientInstrumentation | undefined;
  callCookie: any;
  wallTime: number;
};
