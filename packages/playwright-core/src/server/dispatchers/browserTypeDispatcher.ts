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

import { BrowserContextDispatcher } from './browserContextDispatcher';
import { BrowserDispatcher } from './browserDispatcher';
import { Dispatcher } from './dispatcher';

import type { BrowserType } from '../browserType';
import type { RootDispatcher } from './dispatcher';
import type * as channels from '@protocol/channels';
import type { Progress } from '@protocol/progress';

export class BrowserTypeDispatcher extends Dispatcher<BrowserType, channels.BrowserTypeChannel, RootDispatcher> implements channels.BrowserTypeChannel {
  _type_BrowserType = true;
  private readonly _denyLaunch: boolean;
  constructor(scope: RootDispatcher, browserType: BrowserType, denyLaunch: boolean) {
    super(scope, browserType, 'BrowserType', {
      executablePath: browserType.executablePath(),
      name: browserType.name()
    });
    this._denyLaunch = denyLaunch;
  }

  async launch(params: channels.BrowserTypeLaunchParams, progress: Progress): Promise<channels.BrowserTypeLaunchResult> {
    if (this._denyLaunch)
      throw new Error(`Launching more browsers is not allowed.`);

    const browser = await this._object.launch(progress, params);
    return { browser: new BrowserDispatcher(this, browser) };
  }

  async launchPersistentContext(params: channels.BrowserTypeLaunchPersistentContextParams, progress: Progress): Promise<channels.BrowserTypeLaunchPersistentContextResult> {
    if (this._denyLaunch)
      throw new Error(`Launching more browsers is not allowed.`);

    const browserContext = await this._object.launchPersistentContext(progress, params.userDataDir, params);
    const browserDispatcher = new BrowserDispatcher(this, browserContext._browser);
    const contextDispatcher = BrowserContextDispatcher.from(browserDispatcher, browserContext);
    return { browser: browserDispatcher, context: contextDispatcher };
  }

  async connectOverCDP(params: channels.BrowserTypeConnectOverCDPParams, progress: Progress): Promise<channels.BrowserTypeConnectOverCDPResult> {
    if (this._denyLaunch)
      throw new Error(`Launching more browsers is not allowed.`);

    const browser = await this._object.connectOverCDP(progress, params.endpointURL, params);
    const browserDispatcher = new BrowserDispatcher(this, browser);
    return {
      browser: browserDispatcher,
      defaultContext: browser._defaultContext ? BrowserContextDispatcher.from(browserDispatcher, browser._defaultContext) : undefined,
    };
  }
}
