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

import { Browser } from '../server/browser';
import * as channels from '../protocol/channels';
import { BrowserContextDispatcher } from './browserContextDispatcher';
import { CDPSessionDispatcher } from './cdpSessionDispatcher';
import { Dispatcher, DispatcherScope } from './dispatcher';
import { CRBrowser } from '../server/chromium/crBrowser';
import { PageDispatcher } from './pageDispatcher';

export class BrowserDispatcher extends Dispatcher<Browser, channels.BrowserInitializer> implements channels.BrowserChannel {
  constructor(scope: DispatcherScope, browser: Browser) {
    super(scope, browser, 'Browser', { version: browser.version(), name: browser._options.name }, true);
    browser.on(Browser.Events.Disconnected, () => this._didClose());
  }

  _didClose() {
    this._dispatchEvent('close');
    this._dispose();
  }

  async newContext(params: channels.BrowserNewContextParams): Promise<channels.BrowserNewContextResult> {
    return { context: new BrowserContextDispatcher(this._scope, await this._object.newContext(params)) };
  }

  async close(): Promise<void> {
    await this._object.close();
  }

  async crNewBrowserCDPSession(): Promise<channels.BrowserCrNewBrowserCDPSessionResult> {
    if (this._object._options.name !== 'chromium')
      throw new Error(`CDP session is only available in Chromium`);
    const crBrowser = this._object as CRBrowser;
    return { session: new CDPSessionDispatcher(this._scope, await crBrowser.newBrowserCDPSession()) };
  }

  async crStartTracing(params: channels.BrowserCrStartTracingParams): Promise<void> {
    if (this._object._options.name !== 'chromium')
      throw new Error(`Tracing is only available in Chromium`);
    const crBrowser = this._object as CRBrowser;
    await crBrowser.startTracing(params.page ? (params.page as PageDispatcher)._object : undefined, params);
  }

  async crStopTracing(): Promise<channels.BrowserCrStopTracingResult> {
    if (this._object._options.name !== 'chromium')
      throw new Error(`Tracing is only available in Chromium`);
    const crBrowser = this._object as CRBrowser;
    const buffer = await crBrowser.stopTracing();
    return { binary: buffer.toString('base64') };
  }
}
