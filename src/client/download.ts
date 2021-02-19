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
import { ChannelOwner } from './channelOwner';
import { Readable } from 'stream';
import { Stream } from './stream';
import { Browser } from './browser';
import { BrowserContext } from './browserContext';
import fs from 'fs';
import { mkdirIfNeeded } from '../utils/utils';
import * as api from '../../types/types';

export class Download extends ChannelOwner<channels.DownloadChannel, channels.DownloadInitializer> implements api.Download {
  private _browser: Browser | null;

  static from(download: channels.DownloadChannel): Download {
    return (download as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.DownloadInitializer) {
    super(parent, type, guid, initializer);
    this._browser = (parent as BrowserContext)._browser;
  }

  url(): string {
    return this._initializer.url;
  }

  suggestedFilename(): string {
    return this._initializer.suggestedFilename;
  }

  async path(): Promise<string | null> {
    if (this._browser && this._browser._isRemote)
      throw new Error(`Path is not available when using browserType.connect(). Use download.saveAs() to save a local copy.`);
    return this._wrapApiCall('download.path', async (channel: channels.DownloadChannel) => {
      return (await channel.path()).value || null;
    });
  }

  async saveAs(path: string): Promise<void> {
    return this._wrapApiCall('download.saveAs', async (channel: channels.DownloadChannel) => {
      if (!this._browser || !this._browser._isRemote) {
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

  async failure(): Promise<string | null> {
    return this._wrapApiCall('download.failure', async (channel: channels.DownloadChannel) => {
      return (await channel.failure()).error || null;
    });
  }

  async createReadStream(): Promise<Readable | null> {
    return this._wrapApiCall('download.createReadStream', async (channel: channels.DownloadChannel) => {
      const result = await channel.stream();
      if (!result.stream)
        return null;
      const stream = Stream.from(result.stream);
      return stream.stream();
    });
  }

  async delete(): Promise<void> {
    return this._wrapApiCall('download.delete', async (channel: channels.DownloadChannel) => {
      return channel.delete();
    });
  }
}
