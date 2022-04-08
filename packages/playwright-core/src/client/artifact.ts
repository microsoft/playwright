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

import type * as channels from '../protocol/channels';
import * as fs from 'fs';
import { Stream } from './stream';
import { mkdirIfNeeded } from '../utils/fileUtils';
import { ChannelOwner } from './channelOwner';
import type { Readable } from 'stream';

export class Artifact extends ChannelOwner<channels.ArtifactChannel> {
  static from(channel: channels.ArtifactChannel): Artifact {
    return (channel as any)._object;
  }

  async pathAfterFinished(): Promise<string | null> {
    if (this._connection.isRemote())
      throw new Error(`Path is not available when connecting remotely. Use saveAs() to save a local copy.`);
    return (await this._channel.pathAfterFinished()).value || null;
  }

  async saveAs(path: string): Promise<void> {
    if (!this._connection.isRemote()) {
      await this._channel.saveAs({ path });
      return;
    }

    const result = await this._channel.saveAsStream();
    const stream = Stream.from(result.stream);
    await mkdirIfNeeded(path);
    await new Promise((resolve, reject) => {
      stream.stream().pipe(fs.createWriteStream(path))
          .on('finish' as any, resolve)
          .on('error' as any, reject);
    });
  }

  async failure(): Promise<string | null> {
    return (await this._channel.failure()).error || null;
  }

  async createReadStream(): Promise<Readable | null> {
    const result = await this._channel.stream();
    if (!result.stream)
      return null;
    const stream = Stream.from(result.stream);
    return stream.stream();
  }

  async cancel(): Promise<void> {
    return this._channel.cancel();
  }

  async delete(): Promise<void> {
    return this._channel.delete();
  }
}
