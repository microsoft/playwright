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
import { TCPSocket } from '../server/tcpSocket';
import * as channels from '../protocol/channels';

export class TCPSocketDispatcher extends Dispatcher<TCPSocket, channels.TCPSocketInitializer> implements channels.TCPSocketChannel {
  constructor(scope: DispatcherScope, socket: TCPSocket) {
    super(scope, socket, 'TCPSocket', {
      dstAddr: socket._dstAddr,
      dstPort: socket._dstPort
    }, true);
    socket.on('data', (data: Buffer) => this._dispatchEvent('data', { data: data.toString('base64') }));
    socket.on('close', () => {
      if (this._disposed)
        return;
      this._dispatchEvent('close');
      this._dispose();
    });
  }

  async write(params: channels.AndroidSocketWriteParams): Promise<void> {
    this._object._socket.write(Buffer.from(params.data, 'base64'));
  }

  async end(): Promise<void> {
    this._object._socket.end();
  }
}