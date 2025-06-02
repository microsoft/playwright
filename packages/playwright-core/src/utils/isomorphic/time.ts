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

// Hopefully, this file is never used in injected sources,
// because it does not use `builtins.performance`,
// and can break when clock emulation is engaged.

/* eslint-disable no-restricted-globals */

let _timeOrigin = performance.timeOrigin;
let _timeShift = 0;

export function setTimeOrigin(origin: number) {
  _timeOrigin = origin;
  _timeShift = performance.timeOrigin - origin;
}

export function timeOrigin(): number {
  return _timeOrigin;
}

export function monotonicTime(): number {
  return Math.floor((performance.now() + _timeShift) * 1000) / 1000;
}

export const DEFAULT_PLAYWRIGHT_TIMEOUT = 30_000;
export const DEFAULT_PLAYWRIGHT_LAUNCH_TIMEOUT = 3 * 60 * 1000; // 3 minutes
