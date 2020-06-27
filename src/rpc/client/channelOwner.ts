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
import { Channel } from '../channels';
import { Connection } from '../connection';

export abstract class ChannelOwner<T extends Channel, Initializer> extends EventEmitter {
  readonly _channel: T;
  readonly _initializer: Initializer;
  readonly _connection: Connection;
  static clientSymbol = Symbol('client');

  constructor(connection: Connection, channel: T, initializer: Initializer) {
    super();
    this._connection = connection;
    this._channel = channel;
    this._initializer = initializer;
    (channel as any)[ChannelOwner.clientSymbol] = this;
  }
}
