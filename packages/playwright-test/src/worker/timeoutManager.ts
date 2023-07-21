/**
 * Copyright Microsoft Corporation. All rights reserved.
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

import { colors } from 'playwright-core/lib/utilsBundle';
import { ScopedRace, TimeoutRunnerError, monotonicTime } from 'playwright-core/lib/utils';
import type { TestInfo, TestInfoError } from '../../types/test';
import type { Location } from '../../types/testReporter';
import { serializeError } from '../util';

export type TimeSlot = {
  timeout: number;
  elapsed: number;
};

export type RunnableDescription = {
  type: 'test' | 'beforeAll' | 'afterAll' | 'beforeEach' | 'afterEach' | 'slow' | 'skip' | 'fail' | 'fixme' | 'teardown' | 'fixture';
  phase?: 'setup' | 'teardown';
  title?: string;
  location?: Location;
  slot?: TimeSlot;  // Falls back to test slot.
};

export class TimeoutManager {
  private _runnables: RunnableDescription[] = [];
  private _mutableTimer: MutableTimer | undefined;
  private _lastTimeStamp = 0;
  private _testInfo: TestInfo | undefined;

  constructor(testInfo?: TestInfo) {
    this._testInfo = testInfo;
    this._runnables = [];
  }

  interrupt() {
    this._mutableTimer!.interrupt();
  }

  async runWithTimeout(type: RunnableDescription['type'], slot: { timeout: number, elapsed: number }, cb: () => Promise<any>): Promise<{ timeoutError?: TestInfoError, isReportedError?: boolean, remainingTime: number }> {
    this._runnables = [];
    this._mutableTimer = new MutableTimer();
    try {
      const remainingTime = await this.runRunnable({ type, slot }, cb);
      return { remainingTime, timeoutError: undefined };
    } catch (error) {
      if (!(error instanceof TimeoutRunnerError))
        throw error;
      return { timeoutError: this._createTimeoutError(), remainingTime: 2000000 };
    }
  }

  async runRunnable(runnable: RunnableDescription, cb: () => Promise<any>): Promise<number> {
    const runnables = this._runnables;
    const parentSlot = this._currentSlot();
    runnables.unshift(runnable);
    const childSlot = this._currentSlot()!;
    this._transitionSlot(parentSlot, childSlot);
    await this._mutableTimer!.race(cb().catch(e => {
      // Report errors unconditionally, even if timeout won the race.
      this._testInfo?.errors.push(serializeError(e));
      throw e;
    }));
    runnables.splice(runnables.indexOf(runnable), 1);
    this._transitionSlot(childSlot, parentSlot);
    return Math.max(0, childSlot.timeout - childSlot.elapsed);
  }

  remainingSlotTime(now: number): number {
    const slot = this._currentSlot();
    if (!slot || !slot.timeout)
      return 0;
    return slot.timeout - slot.elapsed - (now - this._lastTimeStamp);
  }

  private _transitionSlot(from: TimeSlot | null, to: TimeSlot | null) {
    if (from === to)
      return;
    const now = monotonicTime();
    if (from && from.timeout !== 0)
      from.elapsed += now - this._lastTimeStamp;
    this._lastTimeStamp = now;
    if (!to?.timeout)
      this._mutableTimer?.resetTimer(0);
    else if (to.timeout - to.elapsed > 0)
      this._mutableTimer?.resetTimer(to.timeout - to.elapsed);
    else
      this._mutableTimer?.interrupt();
  }

  slow() {
    const slot = this._currentSlot();
    if (!slot || !slot.timeout)
      return;
    slot.timeout = slot.timeout * 3;
    this._mutableTimer?.resetTimer(this.remainingSlotTime(monotonicTime()));
  }

  setTimeout(timeout: number) {
    const slot = this._currentSlot();
    if (!slot)
      return;
    slot.timeout = timeout;
    this._mutableTimer?.resetTimer(this.remainingSlotTime(monotonicTime()));
  }

  hasRunnableType(type: RunnableDescription['type']) {
    return this._runnables.some(r => r.type === type);
  }

  private _currentSlot(): TimeSlot | null {
    for (const runnable of this._runnables) {
      if (runnable.slot)
        return runnable.slot;
    }
    return null;
  }

  private _createTimeoutError(): TestInfoError {
    let message = '';
    const timeout = this._currentSlot()!.timeout;
    const runnable = this._runnables[0]!;
    switch (runnable.type) {
      case 'test': {
        message = `Test timeout of ${timeout}ms exceeded.`;
        break;
      }
      case 'fixture': {
        if (this._runnables.some(r => r.type === 'teardown')) {
          message = `Worker teardown timeout of ${timeout}ms exceeded while ${runnable.phase === 'setup' ? 'setting up' : 'tearing down'} "${runnable.title}".`;
        } else if (runnable.phase === 'setup') {
          message = `Test timeout of ${timeout}ms exceeded while setting up "${runnable.title}".`;
        } else {
          message = [
            `Test finished within timeout of ${timeout}ms, but tearing down "${runnable.title}" ran out of time.`,
            `Please allow more time for the test, since teardown is attributed towards the test timeout budget.`,
          ].join('\n');
        }
        break;
      }
      case 'afterEach':
      case 'beforeEach':
        message = `Test timeout of ${timeout}ms exceeded while running "${runnable.type}" hook.`;
        break;
      case 'beforeAll':
      case 'afterAll':
        message = `"${runnable.type}" hook timeout of ${timeout}ms exceeded.`;
        break;
      case 'teardown': {
        message = `Worker teardown timeout of ${timeout}ms exceeded.`;
        break;
      }
      case 'skip':
      case 'slow':
      case 'fixme':
      case 'fail':
        message = `"${runnable.type}" modifier timeout of ${timeout}ms exceeded.`;
        break;
    }
    const fixtureWithSlot = runnable.type === 'fixture' && runnable.slot ? runnable : undefined;
    if (fixtureWithSlot)
      message = `Fixture "${fixtureWithSlot.title}" timeout of ${timeout}ms exceeded during ${fixtureWithSlot.phase}.`;
    message = colors.red(message);
    const location = (fixtureWithSlot || runnable).location;
    return {
      message,
      // Include location for hooks, modifiers and fixtures to distinguish between them.
      stack: location ? message + `\n    at ${location.file}:${location.line}:${location.column}` : undefined
    };
  }
}

class MutableTimer {
  private _timerScope = new ScopedRace();
  private _timer: NodeJS.Timer | undefined;

  interrupt() {
    if (this._timer)
      clearTimeout(this._timer);
    this._timerScope.scopeClosed(new TimeoutRunnerError());
  }

  resetTimer(timeout: number) {
    if (this._timer)
      clearTimeout(this._timer);
    if (!timeout)
      return;
    this._timer = setTimeout(() => {
      this._timerScope.scopeClosed(new TimeoutRunnerError());
    }, timeout);
  }

  race<T>(promise: Promise<T>): Promise<T> {
    return this._timerScope.race(promise);
  }
}
