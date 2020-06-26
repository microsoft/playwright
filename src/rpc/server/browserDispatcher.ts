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
import { BrowserContextBase } from '../../browserContext';
import * as types from '../../types';
import { BrowserContextDispatcher } from './browserContextDispatcher';
import { BrowserChannel, BrowserContextChannel, PageChannel, BrowserInitializer } from '../channels';
import { Dispatcher, DispatcherScope } from '../dispatcher';
import { PageDispatcher } from './pageDispatcher';

export class BrowserDispatcher extends Dispatcher<BrowserInitializer> implements BrowserChannel {
  private _browser: BrowserBase;

  static from(scope: DispatcherScope, browser: BrowserBase): BrowserDispatcher {
    if ((browser as any)[scope.dispatcherSymbol])
      return (browser as any)[scope.dispatcherSymbol];
    return new BrowserDispatcher(scope, browser);
  }

  static fromNullable(scope: DispatcherScope, browser: BrowserBase | null): BrowserDispatcher | null {
    if (!browser)
      return null;
    return BrowserDispatcher.from(scope, browser);
  }

  constructor(scope: DispatcherScope, browser: BrowserBase) {
    super(scope, browser, 'browser', {});
    this._browser = browser;
  }

  async newContext(params: { options?: types.BrowserContextOptions }): Promise<BrowserContextChannel> {
    return BrowserContextDispatcher.from(this._scope, await this._browser.newContext(params.options) as BrowserContextBase);
  }

  async newPage(params: { options?: types.BrowserContextOptions }): Promise<PageChannel> {
    return PageDispatcher.from(this._scope, await this._browser.newPage(params.options));
  }

  async close(): Promise<void> {
    await this._browser.close();
  }
}
