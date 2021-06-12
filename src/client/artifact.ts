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
import * as fs from 'fs';
import { Stream } from './stream';
import { mkdirIfNeeded } from '../utils/utils';
import { ChannelOwner } from './channelOwner';
import { Readable } from 'stream';

export class Artifact extends ChannelOwner<channels.ArtifactChannel, channels.ArtifactInitializer> {
  _isRemote = false;
  _apiName: string = '';

  static from(channel: channels.ArtifactChannel): Artifact {
    return (channel as any)._object;
  }

  async pathAfterFinished(): Promise<string | null> {
    if (this._isRemote)
      throw new Error(`Path is not available when using browserType.connect(). Use saveAs() to save a local copy.`);
    return this._wrapApiCall(`${this._apiName}.path`, async (channel: channels.ArtifactChannel) => {
      return (await channel.pathAfterFinished()).value || null;
    });
  }

  async saveAs(path: string): Promise<void> {
    return this._wrapApiCall(`${this._apiName}.saveAs`, async (channel: channels.ArtifactChannel) => {
      if (!this._isRemote) {
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
    return this._wrapApiCall(`${this._apiName}.failure`, async (channel: channels.ArtifactChannel) => {
      return (await channel.failure()).error || null;
    });
  }

  async createReadStream(): Promise<Readable | null> {
    return this._wrapApiCall(`${this._apiName}.createReadStream`, async (channel: channels.ArtifactChannel) => {
      const result = await channel.stream();
      if (!result.stream)
        return null;
      const stream = Stream.from(result.stream);
      return stream.stream();
    });
  }

  async cancel(): Promise<void> {
    return this._wrapApiCall(`${this._apiName}.cancel`, async (channel: channels.ArtifactChannel) => {
      return channel.cancel();
    });
  }

  async delete(): Promise<void> {
    return this._wrapApiCall(`${this._apiName}.delete`, async (channel: channels.ArtifactChannel) => {
      return channel.delete();
    });
  }
}
