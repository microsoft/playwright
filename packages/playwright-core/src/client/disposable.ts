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
import { isTargetClosedError } from './errors';

import type * as channels from '@protocol/channels';

export class Disposable<T extends channels.DisposableChannel = channels.DisposableChannel> extends ChannelOwner<T> {
  static from(channel: channels.DisposableChannel): Disposable {
    return (channel as any)._object;
  }

  async [Symbol.asyncDispose]() {
    await this.dispose();
  }

  async dispose() {
    try {
      await this._channel.dispose();
    } catch (e) {
      if (isTargetClosedError(e))
        return;
      throw e;
    }
  }
}
