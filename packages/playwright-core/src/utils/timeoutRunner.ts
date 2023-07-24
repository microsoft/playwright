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

type TimeoutRunnerData = {
  lastElapsedSync: number,
  timer: NodeJS.Timer | undefined,
  timeoutPromise: ManualPromise<any>,
};

export const MaxTime = 2147483647; // 2^31-1

export class TimeoutRunner {
  private _running: TimeoutRunnerData | undefined;
  private _timeout: number;
  private _elapsed: number;
  private _deadline = MaxTime;

  constructor(timeout: number) {
    this._timeout = timeout;
    this._elapsed = 0;
  }

  async run<T>(cb: () => Promise<T>): Promise<T> {
    const running = this._running = {
      lastElapsedSync: monotonicTime(),
      timer: undefined,
      timeoutPromise: new ManualPromise(),
    };
    try {
      const resultPromise = Promise.race([
        cb(),
        running.timeoutPromise
      ]);
      this._updateTimeout(running, this._timeout);
      return await resultPromise;
    } finally {
      this._updateTimeout(running, 0);
      if (this._running === running)
        this._running = undefined;
    }
  }

  interrupt() {
    if (this._running)
      this._updateTimeout(this._running, -1);
  }

  elapsed() {
    this._syncElapsedAndStart();
    return this._elapsed;
  }

  deadline(): number {
    return this._deadline;
  }

  updateTimeout(timeout: number, elapsed?: number) {
    this._timeout = timeout;
    if (elapsed !== undefined) {
      this._syncElapsedAndStart();
      this._elapsed = elapsed;
    }
    if (this._running)
      this._updateTimeout(this._running, timeout);
  }

  private _syncElapsedAndStart() {
    if (this._running) {
      const now = monotonicTime();
      this._elapsed += now - this._running.lastElapsedSync;
      this._running.lastElapsedSync = now;
    }
  }

  private _updateTimeout(running: TimeoutRunnerData, timeout: number) {
    if (running.timer) {
      clearTimeout(running.timer);
      running.timer = undefined;
    }
    this._syncElapsedAndStart();
    this._deadline = timeout ? monotonicTime() + timeout : MaxTime;
    if (timeout === 0)
      return;
    timeout = timeout - this._elapsed;
    if (timeout <= 0)
      running.timeoutPromise.reject(new TimeoutRunnerError());
    else
      running.timer = setTimeout(() => running.timeoutPromise.reject(new TimeoutRunnerError()), timeout);
  }
}

export async function raceAgainstDeadline<T>(cb: () => Promise<T>, deadline: number): Promise<{ result: T, timedOut: false } | { timedOut: true }> {
  const runner = new TimeoutRunner((deadline || MaxTime) - monotonicTime());
  try {
    return { result: await runner.run(cb), timedOut: false };
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
