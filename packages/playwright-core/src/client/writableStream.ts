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

import { ChannelOwner } from './channelOwner';

import type * as channels from '@protocol/channels';
import type { Writable } from 'stream';

export class WritableStream extends ChannelOwner<channels.WritableStreamChannel> {
  static from(Stream: channels.WritableStreamChannel): WritableStream {
    return (Stream as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.WritableStreamInitializer) {
    super(parent, type, guid, initializer);
  }

  stream(): Writable {
    return this._platform.streamWritable(this._channel);
  }
}
