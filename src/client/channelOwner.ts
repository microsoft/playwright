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
import * as channels from '../protocol/channels';
import { createScheme, ValidationError, Validator } from '../protocol/validator';
import { debugLogger } from '../utils/debugLogger';
import { captureStackTrace, ParsedStackTrace } from '../utils/stackTrace';
import { isUnderTest } from '../utils/utils';
import type { Connection } from './connection';
import type { Logger } from './types';

export abstract class ChannelOwner<T extends channels.Channel = channels.Channel, Initializer = {}> extends EventEmitter {
  protected _connection: Connection;
  private _parent: ChannelOwner | undefined;
  private _objects = new Map<string, ChannelOwner>();

  readonly _type: string;
  readonly _guid: string;
  readonly _channel: T;
  readonly _initializer: Initializer;
  _logger: Logger | undefined;

  constructor(parent: ChannelOwner | Connection, type: string, guid: string, initializer: Initializer) {
    super();
    this.setMaxListeners(0);
    this._connection = parent instanceof ChannelOwner ? parent._connection : parent;
    this._type = type;
    this._guid = guid;
    this._parent = parent instanceof ChannelOwner ? parent : undefined;

    this._connection._objects.set(guid, this);
    if (this._parent) {
      this._parent._objects.set(guid, this);
      this._logger = this._parent._logger;
    }

    this._channel = this._createChannel(new EventEmitter(), null);
    this._initializer = initializer;
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

  private _createChannel(base: Object, stackTrace: ParsedStackTrace | null): T {
    const channel = new Proxy(base, {
      get: (obj: any, prop) => {
        if (prop === 'debugScopeState')
          return (params: any) => this._connection.sendMessageToServer(this, prop, params, stackTrace);
        if (typeof prop === 'string') {
          const validator = scheme[paramsName(this._type, prop)];
          if (validator)
            return (params: any) => this._connection.sendMessageToServer(this, prop, validator(params, ''), stackTrace);
        }
        return obj[prop];
      },
    });
    (channel as any)._object = this;
    return channel;
  }

  async _wrapApiCall<R, C extends channels.Channel>(func: (channel: C, stackTrace: ParsedStackTrace) => Promise<R>, logger?: Logger): Promise<R> {
    logger = logger || this._logger;
    const stackTrace = captureStackTrace();
    const { apiName, frameTexts } = stackTrace;
    const channel = this._createChannel({}, stackTrace);
    try {
      logApiCall(logger, `=> ${apiName} started`);
      const result = await func(channel as any, stackTrace);
      logApiCall(logger, `<= ${apiName} succeeded`);
      return result;
    } catch (e) {
      const innerError = ((process.env.PWDEBUGIMPL || isUnderTest()) && e.stack) ? '\n<inner error>\n' + e.stack : '';
      e.message = apiName + ': ' + e.message;
      e.stack = e.message + '\n' + frameTexts.join('\n') + innerError;
      logApiCall(logger, `<= ${apiName} failed`);
      throw e;
    }
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

function paramsName(type: string, method: string) {
  return type + method[0].toUpperCase() + method.substring(1) + 'Params';
}

const tChannel = (name: string): Validator => {
  return (arg: any, path: string) => {
    if (arg._object instanceof ChannelOwner && (name === '*' || arg._object._type === name))
      return { guid: arg._object._guid };
    throw new ValidationError(`${path}: expected ${name}`);
  };
};

const scheme = createScheme(tChannel);
