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

import * as channels from '../protocol/channels';
import { Browser } from '../server/browser';
import { BrowserType } from '../server/browserType';
import { CRBrowser } from '../server/chromium/crBrowser';
import { DeviceDescriptors } from '../server/deviceDescriptors';
import { Electron } from '../server/electron/electron';
import { Playwright } from '../server/playwright';
import { BrowserContextDispatcher } from './browserContextDispatcher';
import { CDPSessionDispatcher } from './cdpSessionDispatcher';
import { Dispatcher, DispatcherScope } from './dispatcher';
import { ElectronDispatcher } from './electronDispatcher';
import { PageDispatcher } from './pageDispatcher';
import { SelectorsDispatcher } from './selectorsDispatcher';

export class PlaywrightDispatcher extends Dispatcher<Playwright, channels.PlaywrightInitializer> implements channels.PlaywrightChannel {
  constructor(scope: DispatcherScope, playwright: Playwright) {
    const electron = (playwright as any).electron as (Electron | undefined);
    const deviceDescriptors = Object.entries(DeviceDescriptors)
        .map(([name, descriptor]) => ({ name, descriptor }));
    super(scope, playwright, 'Playwright', {
      chromium: new BrowserTypeDispatcher(scope, playwright.chromium),
      clank: new BrowserTypeDispatcher(scope, playwright.clank),
      firefox: new BrowserTypeDispatcher(scope, playwright.firefox),
      webkit: new BrowserTypeDispatcher(scope, playwright.webkit),
      electron: electron ? new ElectronDispatcher(scope, electron) : undefined,
      deviceDescriptors,
      selectors: new SelectorsDispatcher(scope, playwright.selectors),
    }, false, 'Playwright');
  }
}

class BrowserTypeDispatcher extends Dispatcher<BrowserType, channels.BrowserTypeInitializer> implements channels.BrowserTypeChannel {
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
    const context = await this._object.newContext(params);
    if (params.storageState)
      await context.setStorageState(params.storageState);
    return { context: new BrowserContextDispatcher(this._scope, context) };
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
