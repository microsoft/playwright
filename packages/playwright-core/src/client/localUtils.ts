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

import type * as channels from '@protocol/channels';
import { ChannelOwner } from './channelOwner';
import type { Size } from './types';

type DeviceDescriptor = {
  userAgent: string,
  viewport: Size,
  deviceScaleFactor: number,
  isMobile: boolean,
  hasTouch: boolean,
  defaultBrowserType: 'chromium' | 'firefox' | 'webkit'
};
type Devices = { [name: string]: DeviceDescriptor };

export class LocalUtils extends ChannelOwner<channels.LocalUtilsChannel> {
  readonly devices: Devices;

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.LocalUtilsInitializer) {
    super(parent, type, guid, initializer);
    this.markAsInternalType();
    this.devices = {};
    for (const { name, descriptor } of initializer.deviceDescriptors)
      this.devices[name] = descriptor;
  }
}
