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

import { Page } from './page';
import * as api from '../../types/types';
import * as channels from '../protocol/channels';
import * as fs from 'fs';
import { Stream } from './stream';
import { mkdirIfNeeded } from '../utils/utils';
import { ChannelOwner } from './channelOwner';

export class Video implements api.Video {
  private _page: Page;
  private _impl: VideoImpl | undefined;
  private _implCallback = () => {};
  private _implPromise: Promise<void>;

  constructor(page: Page) {
    this._page = page;
    this._implPromise = new Promise(f => this._implCallback = f);
  }

  _setImpl(impl: VideoImpl) {
    this._impl = impl;
    this._implCallback();
  }

  async path(): Promise<string> {
    const browser = this._page.context()._browser;
    if (browser && browser._isRemote)
      throw new Error(`Path is not available when using browserType.connect(). Use video.saveAs() to save a local copy.`);
    await this._implPromise;
    return this._impl!._initializer.absolutePath;
  }

  async saveAs(path: string): Promise<void> {
    await this._implPromise;
    const impl = this._impl!;
    return impl._wrapApiCall('video.saveAs', async (channel: channels.VideoChannel) => {
      const browser = this._page.context()._browser;
      if (!browser || !browser._isRemote) {
        await channel.saveAs({ path });
        return;
      }

      const result = await channel.saveAsStream();
      const stream = Stream.from(result.stream);
      await mkdirIfNeeded(path);
      await new Promise((resolve, reject) => {
        stream.stream().pipe(fs.createWriteStream(path))
            .on('finish' as any, resolve)
            .on('error' as any, reject);
      });
    });
  }
}

export class VideoImpl extends ChannelOwner<channels.VideoChannel, channels.VideoInitializer> {
  static from(channel: channels.VideoChannel): VideoImpl {
    return (channel as any)._object;
  }
}
