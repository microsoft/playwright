/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
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

import dns from 'dns';
import net from 'net';
import util from 'util';
import * as channels from '../protocol/channels';
import { TimeoutError } from '../utils/errors';
import { createSocket } from '../utils/netUtils';
import { Android } from './android';
import { BrowserType } from './browserType';
import { ChannelOwner } from './channelOwner';
import { Electron } from './electron';
import { APIRequest } from './fetch';
import { Selectors, SelectorsOwner } from './selectors';
import { Size } from './types';
const dnsLookupAsync = util.promisify(dns.lookup);

type DeviceDescriptor = {
  userAgent: string,
  viewport: Size,
  deviceScaleFactor: number,
  isMobile: boolean,
  hasTouch: boolean,
  defaultBrowserType: 'chromium' | 'firefox' | 'webkit'
};
type Devices = { [name: string]: DeviceDescriptor };

export class Playwright extends ChannelOwner<channels.PlaywrightChannel> {
  readonly _android: Android;
  readonly _electron: Electron;
  readonly chromium: BrowserType;
  readonly firefox: BrowserType;
  readonly webkit: BrowserType;
  readonly devices: Devices;
  selectors: Selectors;
  readonly request: APIRequest;
  readonly errors: { TimeoutError: typeof TimeoutError };
  private _sockets = new Map<string, net.Socket>();
  private _redirectPortForTest: number | undefined;

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.PlaywrightInitializer) {
    super(parent, type, guid, initializer);
    this.request = new APIRequest(this);
    this.chromium = BrowserType.from(initializer.chromium);
    this.chromium._playwright = this;
    this.firefox = BrowserType.from(initializer.firefox);
    this.firefox._playwright = this;
    this.webkit = BrowserType.from(initializer.webkit);
    this.webkit._playwright = this;
    this._android = Android.from(initializer.android);
    this._electron = Electron.from(initializer.electron);
    this.devices = {};
    for (const { name, descriptor } of initializer.deviceDescriptors)
      this.devices[name] = descriptor;
    this.selectors = new Selectors();
    this.errors = { TimeoutError };

    const selectorsOwner = SelectorsOwner.from(initializer.selectors);
    this.selectors._addChannel(selectorsOwner);
    this._connection.on('close', () => {
      this.selectors._removeChannel(selectorsOwner);
      for (const uid of this._sockets.keys())
        this._onSocksClosed(uid);
    });
  }

  _setSelectors(selectors: Selectors) {
    const selectorsOwner = SelectorsOwner.from(this._initializer.selectors);
    this.selectors._removeChannel(selectorsOwner);
    this.selectors = selectors;
    this.selectors._addChannel(selectorsOwner);
  }

  _enablePortForwarding(redirectPortForTest?: number) {
    this._redirectPortForTest = redirectPortForTest;
    this._channel.on('socksRequested', ({ uid, host, port }) => this._onSocksRequested(uid, host, port));
    this._channel.on('socksData', ({ uid, data }) => this._onSocksData(uid, Buffer.from(data, 'base64')));
    this._channel.on('socksClosed', ({ uid }) => this._onSocksClosed(uid));
  }

  private async _onSocksRequested(uid: string, host: string, port: number): Promise<void> {
    if (host === 'local.playwright')
      host = 'localhost';
    try {
      if (this._redirectPortForTest)
        port = this._redirectPortForTest;
      const { address } = await dnsLookupAsync(host);
      const socket = await createSocket(address, port);
      socket.on('data', data => this._channel.socksData({ uid, data: data.toString('base64') }).catch(() => {}));
      socket.on('error', error => {
        this._channel.socksError({ uid, error: error.message }).catch(() => { });
        this._sockets.delete(uid);
      });
      socket.on('end', () => {
        this._channel.socksEnd({ uid }).catch(() => {});
        this._sockets.delete(uid);
      });
      const localAddress = socket.localAddress;
      const localPort = socket.localPort;
      this._sockets.set(uid, socket);
      this._channel.socksConnected({ uid, host: localAddress, port: localPort }).catch(() => {});
    } catch (error) {
      this._channel.socksFailed({ uid, errorCode: error.code }).catch(() => {});
    }
  }

  private _onSocksData(uid: string, data: Buffer): void {
    this._sockets.get(uid)?.write(data);
  }

  static from(channel: channels.PlaywrightChannel): Playwright {
    return (channel as any)._object;
  }

  private _onSocksClosed(uid: string): void {
    this._sockets.get(uid)?.destroy();
    this._sockets.delete(uid);
  }
}
