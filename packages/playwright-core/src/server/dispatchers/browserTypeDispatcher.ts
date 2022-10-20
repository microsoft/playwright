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

import type { BrowserType } from '../browserType';
import { BrowserDispatcher } from './browserDispatcher';
import type * as channels from '@protocol/channels';
import type { RootDispatcher } from './dispatcher';
import { Dispatcher } from './dispatcher';
import { BrowserContextDispatcher } from './browserContextDispatcher';
import type { CallMetadata } from '../instrumentation';

export class BrowserTypeDispatcher extends Dispatcher<BrowserType, channels.BrowserTypeChannel, RootDispatcher> implements channels.BrowserTypeChannel {
  _type_BrowserType = true;
  constructor(scope: RootDispatcher, browserType: BrowserType) {
    super(scope, browserType, 'BrowserType', {
      executablePath: browserType.executablePath(),
      name: browserType.name()
    });
  }

  async launch(params: channels.BrowserTypeLaunchParams, metadata: CallMetadata): Promise<channels.BrowserTypeLaunchResult> {
    const browser = await this._object.launch(metadata, params);
    return { browser: new BrowserDispatcher(this, browser) };
  }

  async launchPersistentContext(params: channels.BrowserTypeLaunchPersistentContextParams, metadata: CallMetadata): Promise<channels.BrowserTypeLaunchPersistentContextResult> {
    const browserContext = await this._object.launchPersistentContext(metadata, params.userDataDir, params);
    return { context: new BrowserContextDispatcher(this, browserContext) };
  }

  async connectOverCDP(params: channels.BrowserTypeConnectOverCDPParams, metadata: CallMetadata): Promise<channels.BrowserTypeConnectOverCDPResult> {
    const browser = await this._object.connectOverCDP(metadata, params.endpointURL, params, params.timeout);
    const browserDispatcher = new BrowserDispatcher(this, browser);
    return {
      browser: browserDispatcher,
      defaultContext: browser._defaultContext ? new BrowserContextDispatcher(browserDispatcher, browser._defaultContext) : undefined,
    };
  }
}
