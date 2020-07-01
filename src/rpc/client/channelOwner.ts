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

import { Connection, ChannelGuid } from './connection';
import { Channel } from '../channels';
import { EventEmitter } from 'events';

export abstract class ChannelOwner<T extends Channel, Initializer> extends EventEmitter {
  readonly _channel: T;
  readonly _initializer: Initializer;
  readonly _connection: Connection;

  constructor(connection: Connection, guid: ChannelGuid, initializer: Initializer) {
    super();
    this._connection = connection;
    const base = new EventEmitter();
    (base as any)._object = this;
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
        return (params: any) => connection.sendMessageToServer({ ...guid, method: String(prop), params });
      },
    });
    this._initializer = initializer;
  }
}
