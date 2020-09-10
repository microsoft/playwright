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

import { BrowserType } from '../server/browserType';
import { BrowserDispatcher } from './browserDispatcher';
import * as channels from '../protocol/channels';
import { Dispatcher, DispatcherScope } from './dispatcher';
import { BrowserContextDispatcher } from './browserContextDispatcher';

export class BrowserTypeDispatcher extends Dispatcher<BrowserType, channels.BrowserTypeInitializer> implements channels.BrowserTypeChannel {
  constructor(scope: DispatcherScope, browserType: BrowserType) {
    super(scope, browserType, 'BrowserType', {
      executablePath: browserType.executablePath(),
      name: browserType.name()
    }, true);
  }

  async launch(params: channels.BrowserTypeLaunchParams): Promise<channels.BrowserTypeLaunchResult> {
    const browser = await this._object.launch(params);
    return { browser: new BrowserDispatcher(this._scope, browser) };
  }

  async launchPersistentContext(params: channels.BrowserTypeLaunchPersistentContextParams): Promise<channels.BrowserTypeLaunchPersistentContextResult> {
    const browserContext = await this._object.launchPersistentContext(params.userDataDir, params);
    return { context: new BrowserContextDispatcher(this._scope, browserContext) };
  }
}
