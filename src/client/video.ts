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
import { Browser } from './browser';
import { BrowserContext } from './browserContext';
import { ChannelOwner } from './channelOwner';

export class Video extends ChannelOwner<channels.VideoChannel, channels.VideoInitializer> {
  private _browser: Browser | undefined;

  static from(channel: channels.VideoChannel): Video {
    return (channel as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.VideoInitializer) {
    super(parent, type, guid, initializer);
    this._browser = (parent as BrowserContext)._browser;
  }

  async path(): Promise<string> {
    if (this._browser && this._browser._isRemote)
      throw new Error(`Path is not available when using browserType.connect().`);
    return (await this._channel.path()).value;
  }
}
