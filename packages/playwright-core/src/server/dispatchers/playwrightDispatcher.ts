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

import { SocksProxy } from '../utils/socksProxy';
import { GlobalAPIRequestContext } from '../fetch';
import { AndroidDispatcher } from './androidDispatcher';
import { AndroidDeviceDispatcher } from './androidDispatcher';
import { BrowserDispatcher } from './browserDispatcher';
import { BrowserTypeDispatcher } from './browserTypeDispatcher';
import { Dispatcher } from './dispatcher';
import { ElectronDispatcher } from './electronDispatcher';
import { LocalUtilsDispatcher } from './localUtilsDispatcher';
import { APIRequestContextDispatcher } from './networkDispatchers';
import { SdkObject } from '../instrumentation';
import { eventsHelper  } from '../utils/eventsHelper';

import type { RootDispatcher } from './dispatcher';
import type { SocksSocketClosedPayload, SocksSocketDataPayload, SocksSocketRequestedPayload } from '../utils/socksProxy';
import type { RegisteredListener } from '../utils/eventsHelper';
import type { AndroidDevice } from '../android/android';
import type { Browser } from '../browser';
import type { Playwright } from '../playwright';
import type * as channels from '@protocol/channels';

type PlaywrightDispatcherOptions = {
  socksProxy?: SocksProxy;
  preLaunchedBrowser?: Browser;
  preLaunchedAndroidDevice?: AndroidDevice;
  sharedBrowser?: boolean;
};

export class PlaywrightDispatcher extends Dispatcher<Playwright, channels.PlaywrightChannel, RootDispatcher> implements channels.PlaywrightChannel {
  _type_Playwright;
  private _browserDispatcher: BrowserDispatcher | undefined;

  constructor(scope: RootDispatcher, playwright: Playwright, options: PlaywrightDispatcherOptions = {}) {
    const chromium = new BrowserTypeDispatcher(scope, playwright.chromium);
    const firefox = new BrowserTypeDispatcher(scope, playwright.firefox);
    const webkit = new BrowserTypeDispatcher(scope, playwright.webkit);
    const bidiChromium = new BrowserTypeDispatcher(scope, playwright.bidiChromium);
    const bidiFirefox = new BrowserTypeDispatcher(scope, playwright.bidiFirefox);
    const android = new AndroidDispatcher(scope, playwright.android);
    const initializer: channels.PlaywrightInitializer = {
      chromium,
      firefox,
      webkit,
      bidiChromium,
      bidiFirefox,
      android,
      electron: new ElectronDispatcher(scope, playwright.electron),
      utils: playwright.options.isServer ? undefined : new LocalUtilsDispatcher(scope, playwright),
      socksSupport: options.socksProxy ? new SocksSupportDispatcher(scope, playwright, options.socksProxy) : undefined,
    };

    let browserDispatcher: BrowserDispatcher | undefined;
    if (options.preLaunchedBrowser) {
      let browserTypeDispatcher: BrowserTypeDispatcher;
      switch (options.preLaunchedBrowser.options.name) {
        case 'chromium': browserTypeDispatcher = chromium; break;
        case 'firefox': browserTypeDispatcher = firefox; break;
        case 'webkit': browserTypeDispatcher = webkit; break;
        case 'bidi': browserTypeDispatcher = options.preLaunchedBrowser.options.channel?.includes('firefox') ? bidiFirefox : bidiChromium; break;
        default: throw new Error(`Unknown browser name: ${options.preLaunchedBrowser.options.name}`);
      }
      browserDispatcher = new BrowserDispatcher(browserTypeDispatcher, options.preLaunchedBrowser, {
        ignoreStopAndKill: true,
        isolateContexts: !options.sharedBrowser,
      });
      initializer.preLaunchedBrowser = browserDispatcher;
    }

    if (options.preLaunchedAndroidDevice)
      initializer.preConnectedAndroidDevice = new AndroidDeviceDispatcher(android, options.preLaunchedAndroidDevice);

    super(scope, playwright, 'Playwright', initializer);
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

class SocksSupportDispatcher extends Dispatcher<SdkObject, channels.SocksSupportChannel, RootDispatcher> implements channels.SocksSupportChannel {
  _type_SocksSupport: boolean;
  private _socksProxy: SocksProxy;
  private _socksListeners: RegisteredListener[];

  constructor(scope: RootDispatcher, parent: SdkObject, socksProxy: SocksProxy) {
    super(scope, new SdkObject(parent, 'socksSupport'), 'SocksSupport', {});
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
