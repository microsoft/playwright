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

import { BrowserServer } from '../../server/browserServer';
import { BrowserServerChannel, BrowserServerInitializer } from '../channels';
import { Dispatcher, DispatcherScope } from './dispatcher';
import { Events } from '../../events';

export class BrowserServerDispatcher extends Dispatcher<BrowserServer, BrowserServerInitializer> implements BrowserServerChannel {
  constructor(scope: DispatcherScope, browserServer: BrowserServer) {
    super(scope, browserServer, 'BrowserServer', {
      wsEndpoint: browserServer.wsEndpoint(),
      pid: browserServer.process().pid
    }, true);
    browserServer.on(Events.BrowserServer.Close, (exitCode, signal) => {
      this._dispatchEvent('close', {
        exitCode: exitCode === null ? undefined : exitCode,
        signal: signal === null ? undefined : signal,
      });
      this._dispose();
    });
  }

  async close(): Promise<void> {
    await this._object.close();
  }

  async kill(): Promise<void> {
    await this._object.kill();
  }
}
