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

export type ClockAnchor = {
  wallTime: number;
  monotonicTime: number;
};

export function isValidWallTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 8.64e15;
}

export function createClockAnchor(wallTime: unknown, monotonicTime: unknown): ClockAnchor | undefined {
  if (!isValidWallTime(wallTime) || typeof monotonicTime !== 'number' || !Number.isFinite(monotonicTime))
    return undefined;
  return { wallTime, monotonicTime };
}

export function wallTimeForMonotonicTime(anchor: ClockAnchor | undefined, timestamp: number): number | undefined {
  if (!anchor || !Number.isFinite(timestamp))
    return undefined;
  const wallTime = anchor.wallTime + (timestamp - anchor.monotonicTime);
  return isValidWallTime(wallTime) ? wallTime : undefined;
}
