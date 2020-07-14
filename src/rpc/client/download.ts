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

import { DownloadChannel, DownloadInitializer } from '../channels';
import { ChannelOwner } from './channelOwner';
import { Readable } from 'stream';
import { Stream } from './stream';

export class Download extends ChannelOwner<DownloadChannel, DownloadInitializer> {
  static from(download: DownloadChannel): Download {
    return (download as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: DownloadInitializer) {
    super(parent, type, guid, initializer);
  }

  url(): string {
    return this._initializer.url;
  }

  suggestedFilename(): string {
    return this._initializer.suggestedFilename;
  }

  async path(): Promise<string | null> {
    return (await this._channel.path()).value;
  }

  async failure(): Promise<string | null> {
    return (await this._channel.failure()).error;
  }

  async createReadStream(): Promise<Readable | null> {
    const result = await this._channel.stream();
    if (!result.stream)
      return null;
    const stream = Stream.from(result.stream);
    return stream.stream();
  }

  async delete(): Promise<void> {
    return this._channel.delete();
  }
}
