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

import { PlaywrightChannel, PlaywrightInitializer } from '../channels';
import * as types from '../../types';
import { BrowserType } from './browserType';
import { ChannelOwner } from './channelOwner';
import { Selectors } from './selectors';
import { Electron } from './electron';

export class Playwright extends ChannelOwner<PlaywrightChannel, PlaywrightInitializer> {
  chromium: BrowserType;
  firefox: BrowserType;
  webkit: BrowserType;
  devices: types.Devices;
  selectors: Selectors;

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: PlaywrightInitializer) {
    super(parent, type, guid, initializer);
    this.chromium = BrowserType.from(initializer.chromium);
    this.firefox = BrowserType.from(initializer.firefox);
    this.webkit = BrowserType.from(initializer.webkit);
    if (initializer.electron)
      (this as any).electron = Electron.from(initializer.electron);
    this.devices = {};
    for (const { name, descriptor } of initializer.deviceDescriptors)
      this.devices[name] = descriptor;
    this.selectors = Selectors.from(initializer.selectors);
  }
}
