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
import { BrowserChannel, BrowserContextChannel, BrowserInitializer, CDPSessionChannel, Binary, BrowserNewContextParams } from '../channels';
import { BrowserContextDispatcher } from './browserContextDispatcher';
import { CDPSessionDispatcher } from './cdpSessionDispatcher';
import { Dispatcher, DispatcherScope } from './dispatcher';
import { CRBrowser } from '../../chromium/crBrowser';
import { PageDispatcher } from './pageDispatcher';
import { headersArrayToObject } from '../../converters';

export class BrowserDispatcher extends Dispatcher<Browser, BrowserInitializer> implements BrowserChannel {
  constructor(scope: DispatcherScope, browser: BrowserBase, guid?: string) {
    super(scope, browser, 'Browser', { version: browser.version() }, true, guid);
    browser.on(Events.Browser.Disconnected, () => this._didClose());
  }

  _didClose() {
    this._dispatchEvent('close');
    this._dispose();
  }

  async newContext(params: BrowserNewContextParams): Promise<{ context: BrowserContextChannel }> {
    const options = {
      ...params,
      extraHTTPHeaders: params.extraHTTPHeaders ? headersArrayToObject(params.extraHTTPHeaders) : undefined,
    };
    return { context: new BrowserContextDispatcher(this._scope, await this._object.newContext(options) as BrowserContextBase) };
  }

  async close(): Promise<void> {
    await this._object.close();
  }

  async crNewBrowserCDPSession(): Promise<{ session: CDPSessionChannel }> {
    const crBrowser = this._object as CRBrowser;
    return { session: new CDPSessionDispatcher(this._scope, await crBrowser.newBrowserCDPSession()) };
  }

  async crStartTracing(params: { page?: PageDispatcher, path?: string, screenshots?: boolean, categories?: string[] }): Promise<void> {
    const crBrowser = this._object as CRBrowser;
    await crBrowser.startTracing(params.page ? params.page._object : undefined, params);
  }

  async crStopTracing(): Promise<{ binary: Binary }> {
    const crBrowser = this._object as CRBrowser;
    const buffer = await crBrowser.stopTracing();
    return { binary: buffer.toString('base64') };
  }
}
