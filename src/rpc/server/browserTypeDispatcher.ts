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

import { BrowserBase } from '../../browser';
import { BrowserTypeBase } from '../../server/browserType';
import * as types from '../../types';
import { BrowserDispatcher } from './browserDispatcher';
import { BrowserChannel, BrowserTypeChannel, BrowserContextChannel, BrowserTypeInitializer } from '../channels';
import { Dispatcher, DispatcherScope } from '../dispatcher';
import { BrowserContextBase } from '../../browserContext';
import { BrowserContextDispatcher } from './browserContextDispatcher';

export class BrowserTypeDispatcher extends Dispatcher<BrowserTypeInitializer> implements BrowserTypeChannel {
  private _browserType: BrowserTypeBase;

  static from(scope: DispatcherScope, browserType: BrowserTypeBase): BrowserTypeDispatcher {
    if ((browserType as any)[scope.dispatcherSymbol])
      return (browserType as any)[scope.dispatcherSymbol];
    return new BrowserTypeDispatcher(scope, browserType);
  }

  constructor(scope: DispatcherScope, browserType: BrowserTypeBase) {
    super(scope, browserType, 'browserType', {
      executablePath: browserType.executablePath(),
      name: browserType.name()
    }, browserType.name());
    this._browserType = browserType;
  }

  async launch(params: { options?: types.LaunchOptions }): Promise<BrowserChannel> {
    const browser = await this._browserType.launch(params.options || undefined);
    return BrowserDispatcher.from(this._scope, browser as BrowserBase);
  }

  async launchPersistentContext(params: { userDataDir: string, options?: types.LaunchOptions & types.BrowserContextOptions }): Promise<BrowserContextChannel> {
    const browserContext = await this._browserType.launchPersistentContext(params.userDataDir, params.options);
    return BrowserContextDispatcher.from(this._scope, browserContext as BrowserContextBase);
  }

  async connect(params: { options: types.ConnectOptions }): Promise<BrowserChannel> {
    const browser = await this._browserType.connect(params.options);
    return BrowserDispatcher.from(this._scope, browser as BrowserBase);
  }
}
