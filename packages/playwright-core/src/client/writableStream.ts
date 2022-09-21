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

import { Writable } from 'stream';
import type * as channels from '@protocol/channels';
import { ChannelOwner } from './channelOwner';

export class WritableStream extends ChannelOwner<channels.WritableStreamChannel> {
  static from(Stream: channels.WritableStreamChannel): WritableStream {
    return (Stream as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.WritableStreamInitializer) {
    super(parent, type, guid, initializer);
  }

  stream(): Writable {
    return new WritableStreamImpl(this._channel);
  }
}

class WritableStreamImpl extends Writable {
  private _channel: channels.WritableStreamChannel;

  constructor(channel: channels.WritableStreamChannel) {
    super();
    this._channel = channel;
  }

  override async _write(chunk: Buffer | string, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    const error = await this._channel.write({ binary: typeof chunk === 'string' ? Buffer.from(chunk) : chunk }).catch(e => e);
    callback(error || null);
  }

  override async _final(callback: (error?: Error | null) => void) {
    // Stream might be destroyed after the connection was closed.
    const error = await this._channel.close().catch(e => e);
    callback(error || null);
  }
}
