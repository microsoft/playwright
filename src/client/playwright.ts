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

import * as channels from '../protocol/channels';
import { BrowserType } from './browserType';
import { ChannelOwner } from './channelOwner';
import { Selectors, SelectorsOwner, sharedSelectors } from './selectors';
import { Electron } from './electron';
import { TimeoutError } from '../utils/errors';
import { Size } from './types';
import { Android } from './android';
import { SocksSocket } from './socksSocket';

type DeviceDescriptor = {
  userAgent: string,
  viewport: Size,
  deviceScaleFactor: number,
  isMobile: boolean,
  hasTouch: boolean,
  defaultBrowserType: 'chromium' | 'firefox' | 'webkit'
};
type Devices = { [name: string]: DeviceDescriptor };

export class Playwright extends ChannelOwner<channels.PlaywrightChannel, channels.PlaywrightInitializer> {
  readonly _android: Android;
  readonly _electron: Electron;
  readonly chromium: BrowserType;
  readonly firefox: BrowserType;
  readonly webkit: BrowserType;
  readonly devices: Devices;
  readonly selectors: Selectors;
  readonly errors: { TimeoutError: typeof TimeoutError };
  private _selectorsOwner: SelectorsOwner;
  _forwardPorts: number[] = [];

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.PlaywrightInitializer) {
    super(parent, type, guid, initializer);
    this.chromium = BrowserType.from(initializer.chromium);
    this.firefox = BrowserType.from(initializer.firefox);
    this.webkit = BrowserType.from(initializer.webkit);
    this._android = Android.from(initializer.android);
    this._electron = Electron.from(initializer.electron);
    this.devices = {};
    for (const { name, descriptor } of initializer.deviceDescriptors)
      this.devices[name] = descriptor;
    this.selectors = sharedSelectors;
    this.errors = { TimeoutError };

    this._selectorsOwner = SelectorsOwner.from(initializer.selectors);
    this.selectors._addChannel(this._selectorsOwner);

    this._channel.on('incomingSocksSocket', ({socket}) => SocksSocket.from(socket));
  }

  async _enablePortForwarding(ports: number[]) {
    this._forwardPorts = ports;
    await this._channel.setForwardedPorts({ports});
  }

  _cleanup() {
    this.selectors._removeChannel(this._selectorsOwner);
  }
}
