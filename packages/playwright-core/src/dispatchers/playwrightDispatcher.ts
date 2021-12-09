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

import net, { AddressInfo } from 'net';
import * as channels from '../protocol/channels';
import { GlobalAPIRequestContext } from '../server/fetch';
import { Playwright } from '../server/playwright';
import * as types from '../server/types';
import { debugLogger } from '../utils/debugLogger';
import { SocksConnection, SocksConnectionClient } from '../utils/socksProxy';
import { createGuid } from '../utils/utils';
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
    this._socksProxy = new SocksProxy(this);
    this._object.options.socksProxyPort = await this._socksProxy.listen(0);
    debugLogger.log('proxy', `Starting socks proxy server on port ${this._object.options.socksProxyPort}`);
  }

  async socksConnected(params: channels.PlaywrightSocksConnectedParams): Promise<void> {
    this._socksProxy?.socketConnected(params);
  }

  async socksFailed(params: channels.PlaywrightSocksFailedParams): Promise<void> {
    this._socksProxy?.socketFailed(params);
  }

  async socksData(params: channels.PlaywrightSocksDataParams): Promise<void> {
    this._socksProxy?.sendSocketData(params);
  }

  async socksError(params: channels.PlaywrightSocksErrorParams): Promise<void> {
    this._socksProxy?.sendSocketError(params);
  }

  async socksEnd(params: channels.PlaywrightSocksEndParams): Promise<void> {
    this._socksProxy?.sendSocketEnd(params);
  }

  async newRequest(params: channels.PlaywrightNewRequestParams, metadata?: channels.Metadata): Promise<channels.PlaywrightNewRequestResult> {
    const request = new GlobalAPIRequestContext(this._object, params);
    return { request: APIRequestContextDispatcher.from(this._scope, request) };
  }
}

class SocksProxy implements SocksConnectionClient {
  private _server: net.Server;
  private _connections = new Map<string, SocksConnection>();
  private _dispatcher: PlaywrightDispatcher;

  constructor(dispatcher: PlaywrightDispatcher) {
    this._dispatcher = dispatcher;
    this._server = new net.Server((socket: net.Socket) => {
      const uid = createGuid();
      const connection = new SocksConnection(uid, socket, this);
      this._connections.set(uid, connection);
    });
  }

  async listen(port: number): Promise<number> {
    return new Promise(f => {
      this._server.listen(port, () => {
        f((this._server.address() as AddressInfo).port);
      });
    });
  }

  onSocketRequested(uid: string, host: string, port: number): void {
    this._dispatcher._dispatchEvent('socksRequested', { uid, host, port });
  }

  onSocketData(uid: string, data: Buffer): void {
    this._dispatcher._dispatchEvent('socksData', { uid, data: data.toString('base64') });
  }

  onSocketClosed(uid: string): void {
    this._dispatcher._dispatchEvent('socksClosed', { uid });
  }

  socketConnected(params: channels.PlaywrightSocksConnectedParams) {
    this._connections.get(params.uid)?.socketConnected(params.host, params.port);
  }

  socketFailed(params: channels.PlaywrightSocksFailedParams) {
    this._connections.get(params.uid)?.socketFailed(params.errorCode);
  }

  sendSocketData(params: channels.PlaywrightSocksDataParams) {
    this._connections.get(params.uid)?.sendData(Buffer.from(params.data, 'base64'));
  }

  sendSocketEnd(params: channels.PlaywrightSocksEndParams) {
    this._connections.get(params.uid)?.end();
  }

  sendSocketError(params: channels.PlaywrightSocksErrorParams) {
    this._connections.get(params.uid)?.error(params.error);
  }
}
