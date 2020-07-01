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

import { ChildProcess } from 'child_process';
import { BrowserServerChannel, BrowserServerInitializer } from '../channels';
import { Connection, ChannelGuid } from './connection';
import { ChannelOwner } from './channelOwner';
import { Events } from '../../events';

export class BrowserServer extends ChannelOwner<BrowserServerChannel, BrowserServerInitializer> {
  static from(request: BrowserServerChannel): BrowserServer {
    return request._object;
  }

  constructor(connection: Connection, guid: ChannelGuid, initializer: BrowserServerInitializer) {
    super(connection, guid, initializer);
    this._channel.on('close', () => this.emit(Events.BrowserServer.Close));
  }

  process(): ChildProcess {
    return { pid: this._initializer.pid } as any;
  }

  wsEndpoint(): string {
    return this._initializer.wsEndpoint;
  }

  async kill(): Promise<void> {
    await this._channel.kill();
  }

  async close(): Promise<void> {
    await this._channel.close();
  }

  _checkLeaks() {}
}
