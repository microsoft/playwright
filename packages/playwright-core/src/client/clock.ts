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
import type { BrowserContext } from './browserContext';

export class Clock implements api.Clock {
  private _browserContext: BrowserContext;

  constructor(browserContext: BrowserContext) {
    this._browserContext = browserContext;
  }

  async installFakeTimers(time: number | Date, options: { loopLimit?: number } = {}) {
    const timeMs = time instanceof Date ? time.getTime() : time;
    await this._browserContext._channel.clockInstallFakeTimers({ time: timeMs, loopLimit: options.loopLimit });
  }

  async runAllTimers(): Promise<number> {
    const result = await this._browserContext._channel.clockRunAllTimers();
    return result.fakeTime;
  }

  async runFor(time: number | string): Promise<number> {
    const result = await this._browserContext._channel.clockRunFor({
      timeNumber: typeof time === 'number' ? time : undefined,
      timeString: typeof time === 'string' ? time : undefined
    });
    return result.fakeTime;
  }

  async runToLastTimer(): Promise<number> {
    const result = await this._browserContext._channel.clockRunToLastTimer();
    return result.fakeTime;
  }

  async runToNextTimer(): Promise<number> {
    const result = await this._browserContext._channel.clockRunToNextTimer();
    return result.fakeTime;
  }

  async setTime(time: number | Date) {
    const timeMs = time instanceof Date ? time.getTime() : time;
    await this._browserContext._channel.clockSetTime({ time: timeMs });
  }

  async skipTime(time: number | string) {
    const result = await this._browserContext._channel.clockSkipTime({
      timeNumber: typeof time === 'number' ? time : undefined,
      timeString: typeof time === 'string' ? time : undefined
    });
    return result.fakeTime;
  }
}
