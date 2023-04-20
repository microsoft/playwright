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

import { Readable } from 'stream';
import type * as channels from '@protocol/channels';
import { ChannelOwner } from './channelOwner';

export class Stream extends ChannelOwner<channels.StreamChannel> {
  static from(Stream: channels.StreamChannel): Stream {
    return (Stream as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.StreamInitializer) {
    super(parent, type, guid, initializer);
  }

  stream(): Readable {
    return new StreamImpl(this._channel);
  }
}

class StreamImpl extends Readable {
  private _channel: channels.StreamChannel;

  constructor(channel: channels.StreamChannel) {
    super();
    this._channel = channel;
  }

  override async _read() {
    const result = await this._channel.read({ size: 1024 * 1024 });
    if (result.binary.byteLength)
      this.push(result.binary);
    else
      this.push(null);
  }

  override _destroy(error: Error | null, callback: (error: Error | null | undefined) => void): void {
    // Stream might be destroyed after the connection was closed.
    this._channel.close().catch(e => null);
    super._destroy(error, callback);
  }
}
