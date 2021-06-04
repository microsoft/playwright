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

import net from 'net';

import * as channels from '../protocol/channels';
import { Playwright } from './playwright';
import { assert, isLocalIpAddress, isUnderTest } from '../utils/utils';
import { ChannelOwner } from './channelOwner';

export class SocksSocket extends ChannelOwner<channels.SocksSocketChannel, channels.SocksSocketInitializer>  {
  private _socket: net.Socket;
  static from(socket: channels.SocksSocketChannel): SocksSocket {
    return (socket as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.SocksSocketInitializer) {
    super(parent, type, guid, initializer);
    assert(parent instanceof Playwright);

    assert(parent._forwardPorts.includes(this._initializer.dstPort));
    assert(isLocalIpAddress(this._initializer.dstAddr));

    if (isUnderTest() && process.env.PW_TEST_PROXY_TARGET)
      this._initializer.dstPort = Number(process.env.PW_TEST_PROXY_TARGET);

    this._socket = net.createConnection(this._initializer.dstPort, this._initializer.dstAddr);
    this._socket.on('error', (err: Error) => this._channel.error({error: String(err)}));
    this._socket.on('connect', () => {
      this.connected().catch(() => {});
      this._socket.on('data', data => this.write(data).catch(() => {}));
    });
    this._socket.on('close', () => {
      this.end().catch(() => {});
    });

    this._channel.on('data', ({ data }) => {
      if (!this._socket.writable)
        return;
      this._socket.write(Buffer.from(data, 'base64'));
    });
    this._channel.on('close', () => this._socket.end());

    this._connection.on('disconnect', () => this._socket.end());
  }

  async write(data: Buffer): Promise<void> {
    await this._channel.write({ data: data.toString('base64') });
  }

  async end(): Promise<void> {
    await this._channel.end();
  }

  async connected(): Promise<void> {
    await this._channel.connected();
  }
}
