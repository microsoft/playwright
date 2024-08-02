"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.pollAgainstDeadline = pollAgainstDeadline;
exports.raceAgainstDeadline = raceAgainstDeadline;
var _ = require("./");
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

async function raceAgainstDeadline(cb, deadline) {
  let timer;
  return Promise.race([cb().then(result => {
    return {
      result,
      timedOut: false
    };
  }), new Promise(resolve => {
    const kMaxDeadline = 2147483647; // 2^31-1
    const timeout = (deadline || kMaxDeadline) - (0, _.monotonicTime)();
    timer = setTimeout(() => resolve({
      timedOut: true
    }), timeout);
  })]).finally(() => {
    clearTimeout(timer);
  });
}
async function pollAgainstDeadline(callback, deadline, pollIntervals = [100, 250, 500, 1000]) {
  var _pollIntervals$pop;
  const lastPollInterval = (_pollIntervals$pop = pollIntervals.pop()) !== null && _pollIntervals$pop !== void 0 ? _pollIntervals$pop : 1000;
  let lastResult;
  const wrappedCallback = () => Promise.resolve().then(callback);
  while (true) {
    var _shift;
    const time = (0, _.monotonicTime)();
    if (deadline && time >= deadline) break;
    const received = await raceAgainstDeadline(wrappedCallback, deadline);
    if (received.timedOut) break;
    lastResult = received.result.result;
    if (!received.result.continuePolling) return {
      result: lastResult,
      timedOut: false
    };
    const interval = (_shift = pollIntervals.shift()) !== null && _shift !== void 0 ? _shift : lastPollInterval;
    if (deadline && deadline <= (0, _.monotonicTime)() + interval) break;
    await new Promise(x => setTimeout(x, interval));
  }
  return {
    timedOut: true,
    result: lastResult
  };
}