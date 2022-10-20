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

import { evaluationScript } from './clientHelper';
import type * as channels from '../protocol/channels';
import { ChannelOwner } from './channelOwner';
import type { SelectorEngine } from './types';
import type * as api from '../../types/types';

export class Selectors implements api.Selectors {
  private _channels = new Set<SelectorsOwner>();
  private _registrations: channels.SelectorsRegisterParams[] = [];

  async register(name: string, script: string | (() => SelectorEngine) | { path?: string, content?: string }, options: { contentScript?: boolean } = {}): Promise<void> {
    const source = await evaluationScript(script, undefined, false);
    const params = { ...options, name, source };
    for (const channel of this._channels)
      await channel._channel.register(params);
    this._registrations.push(params);
  }

  _addChannel(channel: SelectorsOwner) {
    this._channels.add(channel);
    for (const params of this._registrations) {
      // This should not fail except for connection closure, but just in case we catch.
      channel._channel.register(params).catch(e => {});
    }
  }

  _removeChannel(channel: SelectorsOwner) {
    this._channels.delete(channel);
  }
}

export class SelectorsOwner extends ChannelOwner<channels.SelectorsChannel> {
  static from(browser: channels.SelectorsChannel): SelectorsOwner {
    return (browser as any)._object;
  }
}
