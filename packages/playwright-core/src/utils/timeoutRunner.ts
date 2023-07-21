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

import { ManualPromise } from './manualPromise';
import { monotonicTime } from './';

export class TimeoutRunnerError extends Error {}

export const MaxTime = 2147483647; // 2^31-1

async function runWithTimeout<T>(cb: () => Promise<T>, timeout: number): Promise<T> {
  if (timeout <= 0)
    throw new TimeoutRunnerError();
  const timeoutPromise = new ManualPromise();
  setTimeout(() => timeoutPromise.reject(new TimeoutRunnerError()), timeout);
  return await Promise.race([
    cb(),
    timeoutPromise
  ]) as T;
}

export async function raceAgainstDeadline<T>(cb: () => Promise<T>, deadline: number): Promise<{ result: T, timedOut: false } | { timedOut: true }> {
  const timeout = ((deadline || MaxTime) - monotonicTime());
  try {
    return { result: await runWithTimeout(cb, timeout), timedOut: false };
  } catch (e) {
    if (e instanceof TimeoutRunnerError)
      return { timedOut: true };
    throw e;
  }
}

export async function pollAgainstDeadline<T>(callback: () => Promise<{ continuePolling: boolean, result: T }>, deadline: number, pollIntervals: number[] = [100, 250, 500, 1000]): Promise<{ result?: T, timedOut: boolean }> {
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
