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
import { ChannelOwner } from './channelOwner';
import { Events } from './events';

export class BrowserServer extends ChannelOwner<BrowserServerChannel, BrowserServerInitializer> {
  static from(server: BrowserServerChannel): BrowserServer {
    return (server as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: BrowserServerInitializer) {
    super(parent, type, guid, initializer);
    this._channel.on('close', ({ exitCode, signal }) => {
      this.emit(Events.BrowserServer.Close, exitCode === undefined ? null : exitCode, signal === undefined ? null : signal);
    });
  }

  process(): ChildProcess {
    return { pid: this._initializer.pid } as any;
  }

  wsEndpoint(): string {
    return this._initializer.wsEndpoint;
  }

  async kill(): Promise<void> {
    return this._wrapApiCall('browserServer.kill', async () => {
      await this._channel.kill();
    });
  }

  async close(): Promise<void> {
    return this._wrapApiCall('browserServer.close', async () => {
      await this._channel.close();
    });
  }
}
