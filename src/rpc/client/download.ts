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

import * as fs from 'fs';
import { DownloadChannel, DownloadInitializer } from '../channels';
import { Connection } from '../connection';
import { ChannelOwner } from './channelOwner';
import { Readable } from 'stream';

export class Download extends ChannelOwner<DownloadChannel, DownloadInitializer> {
  static from(request: DownloadChannel): Download {
    return request._object;
  }

  constructor(connection: Connection, channel: DownloadChannel, initializer: DownloadInitializer) {
    super(connection, channel, initializer);
  }

  url(): string {
    return this._initializer.url;
  }

  suggestedFilename(): string {
    return this._initializer.suggestedFilename;
  }

  async path(): Promise<string | null> {
    return this._channel.path();
  }

  async failure(): Promise<string | null> {
    return this._channel.failure();
  }

  async createReadStream(): Promise<Readable | null> {
    const fileName = await this.path();
    return fileName ? fs.createReadStream(fileName) : null;
  }

  async delete(): Promise<void> {
    return this._channel.delete();
  }
}
