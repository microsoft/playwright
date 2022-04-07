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

import type * as channels from '../../protocol/channels';
import type { Browser } from '../browser';
import { GlobalAPIRequestContext } from '../fetch';
import type { Playwright } from '../playwright';
import type { SocksSocketClosedPayload, SocksSocketDataPayload, SocksSocketRequestedPayload } from '../../common/socksProxy';
import { SocksProxy } from '../../common/socksProxy';
import type * as types from '../types';
import { AndroidDispatcher } from './androidDispatcher';
import { BrowserTypeDispatcher } from './browserTypeDispatcher';
import type { DispatcherScope } from './dispatcher';
import { Dispatcher } from './dispatcher';
import { ElectronDispatcher } from './electronDispatcher';
import { LocalUtilsDispatcher } from './localUtilsDispatcher';
import { APIRequestContextDispatcher } from './networkDispatchers';
import { SelectorsDispatcher } from './selectorsDispatcher';
import { ConnectedBrowserDispatcher } from './browserDispatcher';
import { createGuid } from '../../utils';

export class PlaywrightDispatcher extends Dispatcher<Playwright, channels.PlaywrightChannel> implements channels.PlaywrightChannel {
  _type_Playwright;
  private _browserDispatcher: ConnectedBrowserDispatcher | undefined;

  constructor(scope: DispatcherScope, playwright: Playwright, socksProxy?: SocksProxy, preLaunchedBrowser?: Browser) {
    const descriptors = require('../deviceDescriptors') as types.Devices;
    const deviceDescriptors = Object.entries(descriptors)
        .map(([name, descriptor]) => ({ name, descriptor }));
    const browserDispatcher = preLaunchedBrowser ? new ConnectedBrowserDispatcher(scope, preLaunchedBrowser) : undefined;
    super(scope, playwright, 'Playwright', {
      chromium: new BrowserTypeDispatcher(scope, playwright.chromium),
      firefox: new BrowserTypeDispatcher(scope, playwright.firefox),
      webkit: new BrowserTypeDispatcher(scope, playwright.webkit),
      android: new AndroidDispatcher(scope, playwright.android),
      electron: new ElectronDispatcher(scope, playwright.electron),
      utils: new LocalUtilsDispatcher(scope),
      deviceDescriptors,
      selectors: new SelectorsDispatcher(scope, browserDispatcher?.selectors || playwright.selectors),
      preLaunchedBrowser: browserDispatcher,
      socksSupport: socksProxy ? new SocksSupportDispatcher(scope, socksProxy) : undefined,
    }, false);
    this._type_Playwright = true;
    this._browserDispatcher = browserDispatcher;
  }

  async newRequest(params: channels.PlaywrightNewRequestParams, metadata?: channels.Metadata): Promise<channels.PlaywrightNewRequestResult> {
    const request = new GlobalAPIRequestContext(this._object, params);
    return { request: APIRequestContextDispatcher.from(this._scope, request) };
  }

  async hideHighlight(params: channels.PlaywrightHideHighlightParams, metadata?: channels.Metadata): Promise<channels.PlaywrightHideHighlightResult> {
    await this._object.hideHighlight();
  }

  async cleanup() {
    // Cleanup contexts upon disconnect.
    await this._browserDispatcher?.cleanupContexts();
  }
}

class SocksSupportDispatcher extends Dispatcher<{ guid: string }, channels.SocksSupportChannel> implements channels.SocksSupportChannel {
  _type_SocksSupport: boolean;
  private _socksProxy: SocksProxy;

  constructor(scope: DispatcherScope, socksProxy: SocksProxy) {
    super(scope, { guid: 'socksSupport@' + createGuid() }, 'SocksSupport', {});
    this._type_SocksSupport = true;
    this._socksProxy = socksProxy;
    socksProxy.on(SocksProxy.Events.SocksRequested, (payload: SocksSocketRequestedPayload) => this._dispatchEvent('socksRequested', payload));
    socksProxy.on(SocksProxy.Events.SocksData, (payload: SocksSocketDataPayload) => this._dispatchEvent('socksData', { uid: payload.uid, data: payload.data.toString('base64') }));
    socksProxy.on(SocksProxy.Events.SocksClosed, (payload: SocksSocketClosedPayload) => this._dispatchEvent('socksClosed', payload));
  }

  async socksConnected(params: channels.SocksSupportSocksConnectedParams): Promise<void> {
    this._socksProxy?.socketConnected(params);
  }

  async socksFailed(params: channels.SocksSupportSocksFailedParams): Promise<void> {
    this._socksProxy?.socketFailed(params);
  }

  async socksData(params: channels.SocksSupportSocksDataParams): Promise<void> {
    this._socksProxy?.sendSocketData({ uid: params.uid, data: Buffer.from(params.data, 'base64') });
  }

  async socksError(params: channels.SocksSupportSocksErrorParams): Promise<void> {
    this._socksProxy?.sendSocketError(params);
  }

  async socksEnd(params: channels.SocksSupportSocksEndParams): Promise<void> {
    this._socksProxy?.sendSocketEnd(params);
  }
}
