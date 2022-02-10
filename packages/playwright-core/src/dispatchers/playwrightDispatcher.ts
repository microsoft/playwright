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
import { GlobalAPIRequestContext } from '../server/fetch';
import { Playwright } from '../server/playwright';
import { SocksProxy } from '../server/socksProxy';
import * as types from '../server/types';
import { debugLogger } from '../utils/debugLogger';
import { AndroidDispatcher } from './androidDispatcher';
import { BrowserTypeDispatcher } from './browserTypeDispatcher';
import { Dispatcher, DispatcherScope } from './dispatcher';
import { ElectronDispatcher } from './electronDispatcher';
import { LocalUtilsDispatcher } from './localUtilsDispatcher';
import { APIRequestContextDispatcher } from './networkDispatchers';
import { SelectorsDispatcher } from './selectorsDispatcher';

export class PlaywrightDispatcher extends Dispatcher<Playwright, channels.PlaywrightChannel> implements channels.PlaywrightChannel {
  _type_Playwright;
  private _socksProxy: SocksProxy | undefined;

  constructor(scope: DispatcherScope, playwright: Playwright, customSelectors?: channels.SelectorsChannel, preLaunchedBrowser?: channels.BrowserChannel) {
    const descriptors = require('../server/deviceDescriptors') as types.Devices;
    const deviceDescriptors = Object.entries(descriptors)
        .map(([name, descriptor]) => ({ name, descriptor }));
    super(scope, playwright, 'Playwright', {
      chromium: new BrowserTypeDispatcher(scope, playwright.chromium),
      firefox: new BrowserTypeDispatcher(scope, playwright.firefox),
      webkit: new BrowserTypeDispatcher(scope, playwright.webkit),
      android: new AndroidDispatcher(scope, playwright.android),
      electron: new ElectronDispatcher(scope, playwright.electron),
      utils: new LocalUtilsDispatcher(scope),
      deviceDescriptors,
      selectors: customSelectors || new SelectorsDispatcher(scope, playwright.selectors),
      preLaunchedBrowser,
    }, false);
    this._type_Playwright = true;
  }

  async enableSocksProxy() {
    this._socksProxy = new SocksProxy();
    this._object.options.socksProxyPort = await this._socksProxy.listen(0);
    this._socksProxy.on(SocksProxy.Events.SocksRequested, data => this._dispatchEvent('socksRequested', data));
    this._socksProxy.on(SocksProxy.Events.SocksData, data => this._dispatchEvent('socksData', data));
    this._socksProxy.on(SocksProxy.Events.SocksClosed, data => this._dispatchEvent('socksClosed', data));
    debugLogger.log('proxy', `Starting socks proxy server on port ${this._object.options.socksProxyPort}`);
  }

  async socksConnected(params: channels.PlaywrightSocksConnectedParams): Promise<void> {
    this._socksProxy?.socketConnected(params.uid, params.host, params.port);
  }

  async socksFailed(params: channels.PlaywrightSocksFailedParams): Promise<void> {
    this._socksProxy?.socketFailed(params.uid, params.errorCode);
  }

  async socksData(params: channels.PlaywrightSocksDataParams): Promise<void> {
    this._socksProxy?.sendSocketData(params.uid, Buffer.from(params.data, 'base64'));
  }

  async socksError(params: channels.PlaywrightSocksErrorParams): Promise<void> {
    this._socksProxy?.sendSocketError(params.uid, params.error);
  }

  async socksEnd(params: channels.PlaywrightSocksEndParams): Promise<void> {
    this._socksProxy?.sendSocketEnd(params.uid);
  }

  async newRequest(params: channels.PlaywrightNewRequestParams, metadata?: channels.Metadata): Promise<channels.PlaywrightNewRequestResult> {
    const request = new GlobalAPIRequestContext(this._object, params);
    return { request: APIRequestContextDispatcher.from(this._scope, request) };
  }

  async hideHighlight(params: channels.PlaywrightHideHighlightParams, metadata?: channels.Metadata): Promise<channels.PlaywrightHideHighlightResult> {
    await this._object.hideHighlight();
  }
}
