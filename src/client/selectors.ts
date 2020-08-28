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
import { ChannelOwner } from './channelOwner';
import { ElementHandle } from './elementHandle';
import { evaluationScript } from './clientHelper';

export class Selectors extends ChannelOwner<channels.SelectorsChannel, channels.SelectorsInitializer> {
  static from(selectors: channels.SelectorsChannel): Selectors {
    return (selectors as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.SelectorsInitializer) {
    super(parent, type, guid, initializer);
  }

  async register(name: string, script: string | Function | { path?: string, content?: string }, options: { contentScript?: boolean } = {}): Promise<void> {
    const source = await evaluationScript(script, undefined, false);
    await this._channel.register({ ...options, name, source });
  }

  async _createSelector(name: string, handle: ElementHandle<Element>): Promise<string | undefined> {
    return (await this._channel.createSelector({ name, handle: handle._elementChannel })).value;
  }
}
