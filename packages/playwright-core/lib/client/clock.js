"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Clock = void 0;
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

class Clock {
  constructor(browserContext) {
    this._browserContext = void 0;
    this._browserContext = browserContext;
  }
  async install(options = {}) {
    await this._browserContext._channel.clockInstall(options.time !== undefined ? parseTime(options.time) : {});
  }
  async fastForward(ticks) {
    await this._browserContext._channel.clockFastForward(parseTicks(ticks));
  }
  async pauseAt(time) {
    await this._browserContext._channel.clockPauseAt(parseTime(time));
  }
  async resume() {
    await this._browserContext._channel.clockResume({});
  }
  async runFor(ticks) {
    await this._browserContext._channel.clockRunFor(parseTicks(ticks));
  }
  async setFixedTime(time) {
    await this._browserContext._channel.clockSetFixedTime(parseTime(time));
  }
  async setSystemTime(time) {
    await this._browserContext._channel.clockSetSystemTime(parseTime(time));
  }
}
exports.Clock = Clock;
function parseTime(time) {
  if (typeof time === 'number') return {
    timeNumber: time
  };
  if (typeof time === 'string') return {
    timeString: time
  };
  if (!isFinite(time.getTime())) throw new Error(`Invalid date: ${time}`);
  return {
    timeNumber: time.getTime()
  };
}
function parseTicks(ticks) {
  return {
    ticksNumber: typeof ticks === 'number' ? ticks : undefined,
    ticksString: typeof ticks === 'string' ? ticks : undefined
  };
}