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
import { ChannelOwner } from './channelOwner';

export class JsonPipe extends ChannelOwner<channels.JsonPipeChannel> {
  static from(jsonPipe: channels.JsonPipeChannel): JsonPipe {
    return (jsonPipe as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.JsonPipeInitializer) {
    super(parent, type, guid, initializer);
  }

  channel() {
    return this._channel;
  }
}
