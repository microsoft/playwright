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
import { BrowserTypeBase, BrowserType } from '../../server/browserType';
import { BrowserDispatcher } from './browserDispatcher';
import { BrowserChannel, BrowserTypeChannel, BrowserContextChannel, BrowserTypeInitializer, BrowserTypeLaunchParams, BrowserTypeLaunchPersistentContextParams } from '../channels';
import { Dispatcher, DispatcherScope } from './dispatcher';
import { BrowserContextBase } from '../../browserContext';
import { BrowserContextDispatcher } from './browserContextDispatcher';
import { headersArrayToObject, envArrayToObject } from '../../converters';

export class BrowserTypeDispatcher extends Dispatcher<BrowserType, BrowserTypeInitializer> implements BrowserTypeChannel {
  constructor(scope: DispatcherScope, browserType: BrowserTypeBase) {
    super(scope, browserType, 'BrowserType', {
      executablePath: browserType.executablePath(),
      name: browserType.name()
    }, true);
  }

  async launch(params: BrowserTypeLaunchParams): Promise<{ browser: BrowserChannel }> {
    const options = {
      ...params,
      ignoreDefaultArgs: params.ignoreAllDefaultArgs ? true : params.ignoreDefaultArgs,
      env: params.env ? envArrayToObject(params.env) : undefined,
    };
    const browser = await this._object.launch(options);
    return { browser: new BrowserDispatcher(this._scope, browser as BrowserBase) };
  }

  async launchPersistentContext(params: BrowserTypeLaunchPersistentContextParams): Promise<{ context: BrowserContextChannel }> {
    const options = {
      ...params,
      viewport: params.viewport || (params.noDefaultViewport ? null : undefined),
      ignoreDefaultArgs: params.ignoreAllDefaultArgs ? true : params.ignoreDefaultArgs,
      env: params.env ? envArrayToObject(params.env) : undefined,
      extraHTTPHeaders: params.extraHTTPHeaders ? headersArrayToObject(params.extraHTTPHeaders) : undefined,
    };
    const browserContext = await this._object.launchPersistentContext(params.userDataDir, options);
    return { context: new BrowserContextDispatcher(this._scope, browserContext as BrowserContextBase) };
  }
}
