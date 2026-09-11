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
// because it does not use `builtins.setTimeout` and similar,
// and can break when clock emulation is engaged.

/* eslint-disable no-restricted-globals */

import { monotonicTime } from './time';
import { ManualPromise } from './manualPromise';

const kDispose: typeof Symbol.dispose = (Symbol.dispose || Symbol.for('Symbol.dispose')) as typeof Symbol.dispose;

// Timers do not implement Symbol.dispose on every supported Node.js version.
export function createTimeout(callback: () => void, timeout: number): Disposable {
  const timer = setTimeout(callback, timeout);
  return {
    [kDispose]() {
      clearTimeout(timer);
    },
  };
}

export async function raceAgainstDeadline<T>(cb: () => Promise<T>, deadline: number): Promise<{ result: T, timedOut: false } | { timedOut: true }> {
  const resultPromise: Promise<{ result: T, timedOut: false }> = cb().then(result => ({ result, timedOut: false }));
  const timeoutPromise = new ManualPromise<{ timedOut: true }>();
  using timer = deadline ? createTimeout(() => timeoutPromise.resolve({ timedOut: true }), Math.max(0, deadline - monotonicTime())) : undefined;
  // Note: not including "await" here truncates the async stack inside cb(), so always include it.
  return await Promise.race([resultPromise, timeoutPromise]);
}

export async function pollAgainstDeadline<T>(callback: () => Promise<{ continuePolling: boolean, result: T }>, deadline: number, [...pollIntervals]: number[] = [100, 250, 500, 1000]): Promise<{ result?: T, timedOut: boolean }> {
  const lastPollInterval = pollIntervals.pop() ?? 1000;
  let lastResult: T|undefined;
  const wrappedCallback = () => Promise.resolve().then(callback);
  while (true) {
    const time = monotonicTime();
    if (deadline && time >= deadline)
      break;
    const received = await raceAgainstDeadline(wrappedCallback, deadline);
    if (received.timedOut)
      break;
    lastResult = (received as any).result.result;
    if (!(received as any).result.continuePolling)
      return { result: lastResult, timedOut: false };
    const interval = pollIntervals!.shift() ?? lastPollInterval;
    if (deadline && deadline <= monotonicTime() + interval)
      break;
    await new Promise(x => setTimeout(x, interval));
  }
  return { timedOut: true, result: lastResult };
}
