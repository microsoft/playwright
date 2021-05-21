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

import { Dispatcher, DispatcherScope } from './dispatcher';
import { SocksSocket } from '../server/socksSocket';
import * as channels from '../protocol/channels';

export class SocksSocketDispatcher extends Dispatcher<SocksSocket, channels.SocksSocketInitializer> implements channels.SocksSocketChannel {
  constructor(scope: DispatcherScope, socket: SocksSocket) {
    super(scope, socket, 'SocksSocket', {
      dstAddr: socket._dstAddr,
      dstPort: socket._dstPort
    }, true);
    socket.on('data', (data: Buffer) => this._dispatchEvent('data', { data: data.toString('base64') }));
    socket.on('close', () => {
      this._dispatchEvent('close');
      this._dispose();
    });
  }
  async connected(): Promise<void> {
    this._object._socketHandler.connected();
  }
  async error(params: channels.SocksSocketErrorParams): Promise<void> {
    this._object._socketHandler.error(params.error);
  }

  async write(params: channels.AndroidSocketWriteParams): Promise<void> {
    this._object._socketHandler.write(Buffer.from(params.data, 'base64'));
  }

  async end(): Promise<void> {
    this._object._socketHandler.end();
  }
}
