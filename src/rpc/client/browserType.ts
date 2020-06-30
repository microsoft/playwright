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

import * as types from '../../types';
import { BrowserTypeChannel, BrowserTypeInitializer } from '../channels';
import { Browser } from './browser';
import { BrowserContext } from './browserContext';
import { ChannelOwner } from './channelOwner';
import { Connection } from '../connection';
import { BrowserServer } from './browserServer';

export class BrowserType extends ChannelOwner<BrowserTypeChannel, BrowserTypeInitializer> {
  constructor(connection: Connection, channel: BrowserTypeChannel, initializer: BrowserTypeInitializer) {
    super(connection, channel, initializer);
  }

  executablePath(): string {
    return this._initializer.executablePath;
  }

  name(): string {
    return this._initializer.name;
  }

  async launch(options: types.LaunchOptions = {}): Promise<Browser> {
    delete (options as any).logger;
    return Browser.from(await this._channel.launch({ options }));
  }

  async launchServer(options?: types.LaunchServerOptions): Promise<BrowserServer> {
    delete (options as any).logger;
    return BrowserServer.from(await this._channel.launchServer({ options }));
  }

  async launchPersistentContext(userDataDir: string, options: types.LaunchOptions & types.BrowserContextOptions = {}): Promise<BrowserContext> {
    delete (options as any).logger;
    return BrowserContext.from(await this._channel.launchPersistentContext({ userDataDir, options }));
  }

  async connect(options: types.ConnectOptions): Promise<Browser> {
    delete (options as any).logger;
    return Browser.from(await this._channel.connect({ options }));
  }
}
