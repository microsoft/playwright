/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type * as api from '../../types/types';
import type * as channels from '@protocol/channels';
import type { BrowserContext } from './browserContext';

export class Clock implements api.Clock {
  private _browserContext: BrowserContext;

  constructor(browserContext: BrowserContext) {
    this._browserContext = browserContext;
  }

  async install(options?: Omit<channels.BrowserContextClockInstallOptions, 'now'> & { now?: number | Date }) {
    const now = options && options.now ? (options.now instanceof Date ? options.now.getTime() : options.now) : undefined;
    await this._browserContext._channel.clockInstall({ ...options, now });
  }

  async jump(time: number | string) {
    await this._browserContext._channel.clockJump({
      timeNumber: typeof time === 'number' ? time : undefined,
      timeString: typeof time === 'string' ? time : undefined
    });
  }

  async next(): Promise<number> {
    const result = await this._browserContext._channel.clockNext();
    return result.fakeTime;
  }

  async runAll(): Promise<number> {
    const result = await this._browserContext._channel.clockRunAll();
    return result.fakeTime;
  }

  async runToLast(): Promise<number> {
    const result = await this._browserContext._channel.clockRunToLast();
    return result.fakeTime;
  }

  async tick(time: number | string): Promise<number> {
    const result = await this._browserContext._channel.clockTick({
      timeNumber: typeof time === 'number' ? time : undefined,
      timeString: typeof time === 'string' ? time : undefined
    });
    return result.fakeTime;
  }
}
