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
import { Events } from './events';

import type * as api from '../../types/types';
import type * as channels from '@protocol/channels';

type PausedDetail = { location: { file: string, line?: number, column?: number }, title: string };

export class Debugger extends ChannelOwner<channels.DebuggerChannel> implements api.Debugger {
  private _pausedDetails: PausedDetail[] = [];

  static from(channel: channels.DebuggerChannel): Debugger {
    return (channel as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.DebuggerInitializer) {
    super(parent, type, guid, initializer);
    this._channel.on('pausedStateChanged', ({ pausedDetails }) => {
      this._pausedDetails = pausedDetails;
      this.emit(Events.Debugger.PausedStateChanged);
    });
  }

  async setPauseAt(options: { next?: boolean, location?: { file: string, line?: number, column?: number } } = {}) {
    await this._channel.setPauseAt(options);
  }

  async resume(): Promise<void> {
    await this._channel.resume();
  }

  pausedDetails(): PausedDetail[] {
    return this._pausedDetails;
  }
}
