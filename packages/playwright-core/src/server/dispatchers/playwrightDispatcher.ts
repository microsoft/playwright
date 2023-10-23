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

import type * as channels from '@protocol/channels';
import type { Browser } from '../browser';
import { GlobalAPIRequestContext } from '../fetch';
import type { Playwright } from '../playwright';
import type { SocksSocketClosedPayload, SocksSocketDataPayload, SocksSocketRequestedPayload } from '../../common/socksProxy';
import { SocksProxy } from '../../common/socksProxy';
import { AndroidDispatcher } from './androidDispatcher';
import { BrowserTypeDispatcher } from './browserTypeDispatcher';
import type { RootDispatcher } from './dispatcher';
import { Dispatcher } from './dispatcher';
import { ElectronDispatcher } from './electronDispatcher';
import { LocalUtilsDispatcher } from './localUtilsDispatcher';
import { APIRequestContextDispatcher } from './networkDispatchers';
import { SelectorsDispatcher } from './selectorsDispatcher';
import { ConnectedBrowserDispatcher } from './browserDispatcher';
import { createGuid } from '../../utils';
import type { AndroidDevice } from '../android/android';
import { AndroidDeviceDispatcher } from './androidDispatcher';
import { eventsHelper, type RegisteredListener } from '../../utils/eventsHelper';

export class PlaywrightDispatcher extends Dispatcher<Playwright, channels.PlaywrightChannel, RootDispatcher> implements channels.PlaywrightChannel {
  _type_Playwright;
  private _browserDispatcher: ConnectedBrowserDispatcher | undefined;

  constructor(scope: RootDispatcher, playwright: Playwright, socksProxy?: SocksProxy, preLaunchedBrowser?: Browser, prelaunchedAndroidDevice?: AndroidDevice) {
    const browserDispatcher = preLaunchedBrowser ? new ConnectedBrowserDispatcher(scope, preLaunchedBrowser) : undefined;
    const android = new AndroidDispatcher(scope, playwright.android);
    const prelaunchedAndroidDeviceDispatcher = prelaunchedAndroidDevice ? new AndroidDeviceDispatcher(android, prelaunchedAndroidDevice) : undefined;
    super(scope, playwright, 'Playwright', {
      chromium: new BrowserTypeDispatcher(scope, playwright.chromium),
      firefox: new BrowserTypeDispatcher(scope, playwright.firefox),
      webkit: new BrowserTypeDispatcher(scope, playwright.webkit),
      android,
      electron: new ElectronDispatcher(scope, playwright.electron),
      utils: playwright.options.isServer ? undefined : new LocalUtilsDispatcher(scope, playwright),
      selectors: new SelectorsDispatcher(scope, browserDispatcher?.selectors || playwright.selectors),
      preLaunchedBrowser: browserDispatcher,
      preConnectedAndroidDevice: prelaunchedAndroidDeviceDispatcher,
      socksSupport: socksProxy ? new SocksSupportDispatcher(scope, socksProxy) : undefined,
    });
    this._type_Playwright = true;
    this._browserDispatcher = browserDispatcher;
  }

  async newRequest(params: channels.PlaywrightNewRequestParams): Promise<channels.PlaywrightNewRequestResult> {
    const request = new GlobalAPIRequestContext(this._object, params);
    return { request: APIRequestContextDispatcher.from(this.parentScope(), request) };
  }

  async cleanup() {
    // Cleanup contexts upon disconnect.
    await this._browserDispatcher?.cleanupContexts();
  }
}

class SocksSupportDispatcher extends Dispatcher<{ guid: string }, channels.SocksSupportChannel, RootDispatcher> implements channels.SocksSupportChannel {
  _type_SocksSupport: boolean;
  private _socksProxy: SocksProxy;
  private _socksListeners: RegisteredListener[];

  constructor(scope: RootDispatcher, socksProxy: SocksProxy) {
    super(scope, { guid: 'socksSupport@' + createGuid() }, 'SocksSupport', {});
    this._type_SocksSupport = true;
    this._socksProxy = socksProxy;
    this._socksListeners = [
      eventsHelper.addEventListener(socksProxy, SocksProxy.Events.SocksRequested, (payload: SocksSocketRequestedPayload) => this._dispatchEvent('socksRequested', payload)),
      eventsHelper.addEventListener(socksProxy, SocksProxy.Events.SocksData, (payload: SocksSocketDataPayload) => this._dispatchEvent('socksData', payload)),
      eventsHelper.addEventListener(socksProxy, SocksProxy.Events.SocksClosed, (payload: SocksSocketClosedPayload) => this._dispatchEvent('socksClosed', payload)),
    ];
  }

  async socksConnected(params: channels.SocksSupportSocksConnectedParams): Promise<void> {
    this._socksProxy?.socketConnected(params);
  }

  async socksFailed(params: channels.SocksSupportSocksFailedParams): Promise<void> {
    this._socksProxy?.socketFailed(params);
  }

  async socksData(params: channels.SocksSupportSocksDataParams): Promise<void> {
    this._socksProxy?.sendSocketData(params);
  }

  async socksError(params: channels.SocksSupportSocksErrorParams): Promise<void> {
    this._socksProxy?.sendSocketError(params);
  }

  async socksEnd(params: channels.SocksSupportSocksEndParams): Promise<void> {
    this._socksProxy?.sendSocketEnd(params);
  }

  override _onDispose() {
    eventsHelper.removeEventListeners(this._socksListeners);
  }
}
