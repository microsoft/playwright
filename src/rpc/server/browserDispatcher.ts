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

import { Browser, BrowserBase } from '../../browser';
import { BrowserContextBase } from '../../browserContext';
import { Events } from '../../events';
import * as types from '../../types';
import { BrowserChannel, BrowserContextChannel, BrowserInitializer } from '../channels';
import { BrowserContextDispatcher } from './browserContextDispatcher';
import { Dispatcher, DispatcherScope } from './dispatcher';

export class BrowserDispatcher extends Dispatcher<Browser, BrowserInitializer> implements BrowserChannel {
  constructor(scope: DispatcherScope, browser: BrowserBase) {
    super(scope, browser, 'browser', {});
    browser.on(Events.Browser.Disconnected, () => {
      this._dispatchEvent('close');
      scope.dispose();
    });
  }

  async newContext(params: { options?: types.BrowserContextOptions }): Promise<BrowserContextChannel> {
    return new BrowserContextDispatcher(this._scope.createChild(), await this._object.newContext(params.options) as BrowserContextBase);
  }

  async close(): Promise<void> {
    await this._object.close();
  }
}
