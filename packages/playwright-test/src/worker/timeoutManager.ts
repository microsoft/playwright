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
import { TimeoutRunner, TimeoutRunnerError } from 'playwright-core/lib/utils';
import type { TestInfoError } from '../../types/test';
import type { Location } from '../../types/testReporter';

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
  private _defaultSlot: TimeSlot;
  private _runnables: RunnableDescription[] = [];
  private _timeoutRunner: TimeoutRunner;

  constructor(timeout: number) {
    this._defaultSlot = { timeout, elapsed: 0 };
    this._runnables = [{ type: 'test', slot: this._defaultSlot }];
    this._timeoutRunner = new TimeoutRunner(timeout);
  }

  interrupt() {
    this._timeoutRunner.interrupt();
  }

  async runRunnable<T>(runnable: RunnableDescription, cb: () => Promise<T>): Promise<T> {
    let slot = this._currentSlot();
    slot.elapsed = this._timeoutRunner.elapsed();
    this._runnables.unshift(runnable);
    slot = this._currentSlot();
    this._timeoutRunner.updateTimeout(slot.timeout, slot.elapsed);

    try {
      return await cb();
    } finally {
      let slot = this._currentSlot();
      slot.elapsed = this._timeoutRunner.elapsed();
      this._runnables.splice(this._runnables.indexOf(runnable), 1);
      slot = this._currentSlot();
      this._timeoutRunner.updateTimeout(slot.timeout, slot.elapsed);
    }
  }

  defaultSlotTimings() {
    const slot = this._currentSlot();
    slot.elapsed = this._timeoutRunner.elapsed();
    return this._defaultSlot;
  }

  slow() {
    const slot = this._currentSlot();
    slot.timeout = slot.timeout * 3;
    this._timeoutRunner.updateTimeout(slot.timeout);
  }

  async runWithTimeout(cb: () => Promise<any>): Promise<TestInfoError | undefined> {
    try {
      await this._timeoutRunner.run(cb);
    } catch (error) {
      if (!(error instanceof TimeoutRunnerError))
        throw error;
      return this._createTimeoutError();
    }
  }

  setTimeout(timeout: number) {
    const slot = this._currentSlot();
    if (!slot.timeout)
      return; // Zero timeout means some debug mode - do not set a timeout.
    slot.timeout = timeout;
    this._timeoutRunner.updateTimeout(timeout);
  }

  hasRunnableType(type: RunnableDescription['type']) {
    return this._runnables.some(r => r.type === type);
  }

  private _runnable(): RunnableDescription {
    return this._runnables[0]!;
  }

  currentSlotDeadline() {
    return this._timeoutRunner.deadline();
  }

  private _currentSlot() {
    for (const runnable of this._runnables) {
      if (runnable.slot)
        return runnable.slot;
    }
    return this._defaultSlot;
  }

  private _createTimeoutError(): TestInfoError {
    let message = '';
    const timeout = this._currentSlot().timeout;
    const runnable = this._runnable();
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
