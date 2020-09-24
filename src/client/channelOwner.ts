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
import type { Connection } from './connection';
import type { Logger } from './types';
import { debugLogger } from '../utils/debugLogger';
import { rewriteErrorMessage } from '../utils/stackTrace';

export abstract class ChannelOwner<T extends channels.Channel = channels.Channel, Initializer = {}> extends EventEmitter {
  private _connection: Connection;
  private _parent: ChannelOwner | undefined;
  private _objects = new Map<string, ChannelOwner>();

  readonly _type: string;
  readonly _guid: string;
  readonly _channel: T;
  readonly _initializer: Initializer;
  _logger: Logger | undefined;

  constructor(parent: ChannelOwner | Connection, type: string, guid: string, initializer: Initializer) {
    super();
    this._connection = parent instanceof ChannelOwner ? parent._connection : parent;
    this._type = type;
    this._guid = guid;
    this._parent = parent instanceof ChannelOwner ? parent : undefined;

    this._connection._objects.set(guid, this);
    if (this._parent) {
      this._parent._objects.set(guid, this);
      this._logger = this._parent._logger;
    }

    const base = new EventEmitter();
    this._channel = new Proxy(base, {
      get: (obj: any, prop) => {
        if (String(prop).startsWith('_'))
          return obj[prop];
        if (prop === 'then')
          return obj.then;
        if (prop === 'emit')
          return obj.emit;
        if (prop === 'on')
          return obj.on;
        if (prop === 'once')
          return obj.once;
        if (prop === 'addEventListener')
          return obj.addListener;
        if (prop === 'removeEventListener')
          return obj.removeListener;
        if (prop === 'domain') // https://github.com/microsoft/playwright/issues/3848
          return obj.domain;
        return (params: any) => this._connection.sendMessageToServer(this._type, guid, String(prop), params);
      },
    });
    (this._channel as any)._object = this;
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

  protected async _wrapApiCall<T>(apiName: string, func: () => Promise<T>, logger?: Logger): Promise<T> {
    logger = logger || this._logger;
    try {
      logApiCall(logger, `=> ${apiName} started`);
      const result = await func();
      logApiCall(logger, `<= ${apiName} succeeded`);
      return result;
    } catch (e) {
      logApiCall(logger, `<= ${apiName} failed`);
      rewriteErrorMessage(e, `${apiName}: ` + e.message);
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
