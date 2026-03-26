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

type PausedDetails = { location: { file: string, line?: number, column?: number }, title: string, stack?: string };

export class Debugger extends ChannelOwner<channels.DebuggerChannel> implements api.Debugger {
  private _pausedDetails: PausedDetails | null = null;

  static from(channel: channels.DebuggerChannel): Debugger {
    return (channel as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.DebuggerInitializer) {
    super(parent, type, guid, initializer);
    this._channel.on('pausedStateChanged', ({ pausedDetails }) => {
      this._pausedDetails = pausedDetails ?? null;
      this.emit(Events.Debugger.PausedStateChanged);
    });
  }

  async requestPause(): Promise<void> {
    await this._channel.requestPause();
  }

  async resume(): Promise<void> {
    await this._channel.resume();
  }

  async next(): Promise<void> {
    await this._channel.next();
  }

  async runTo(location: { file: string, line?: number, column?: number }): Promise<void> {
    await this._channel.runTo({ location });
  }

  pausedDetails(): PausedDetails | null {
    return this._pausedDetails;
  }
}
