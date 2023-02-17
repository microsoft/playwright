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
import type { Location, TestInfoError } from '../common/types';

export type TimeSlot = {
  timeout: number;
  elapsed: number;
};

type RunnableDescription = {
  type: 'test' | 'beforeAll' | 'afterAll' | 'beforeEach' | 'afterEach' | 'slow' | 'skip' | 'fail' | 'fixme' | 'teardown';
  location?: Location;
  slot?: TimeSlot;  // Falls back to test slot.
};

export type FixtureDescription = {
  title: string;
  location?: Location;
  slot?: TimeSlot;  // Falls back to current runnable slot.
};

export class TimeoutManager {
  private _defaultSlot: TimeSlot;
  private _runnable: RunnableDescription;
  private _fixture: FixtureDescription | undefined;
  private _timeoutRunner: TimeoutRunner;

  constructor(timeout: number) {
    this._defaultSlot = { timeout, elapsed: 0 };
    this._runnable = { type: 'test', slot: this._defaultSlot };
    this._timeoutRunner = new TimeoutRunner(timeout);
  }

  interrupt() {
    this._timeoutRunner.interrupt();
  }

  setCurrentRunnable(runnable: RunnableDescription) {
    this._updateRunnables(runnable, undefined);
  }

  setCurrentFixture(fixture: FixtureDescription | undefined) {
    this._updateRunnables(this._runnable, fixture);
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

  currentRunnableType() {
    return this._runnable.type;
  }

  private _currentSlot() {
    return this._fixture?.slot || this._runnable.slot || this._defaultSlot;
  }

  private _updateRunnables(runnable: RunnableDescription, fixture: FixtureDescription | undefined) {
    let slot = this._currentSlot();
    slot.elapsed = this._timeoutRunner.elapsed();

    this._runnable = runnable;
    this._fixture = fixture;

    slot = this._currentSlot();
    this._timeoutRunner.updateTimeout(slot.timeout, slot.elapsed);
  }

  private _createTimeoutError(): TestInfoError {
    let message = '';
    const timeout = this._currentSlot().timeout;
    switch (this._runnable.type) {
      case 'test': {
        const fixtureSuffix = this._fixture ? ` while ${this._fixture.title}` : '';
        message = `Test timeout of ${timeout}ms exceeded${fixtureSuffix}.`;
        break;
      }
      case 'afterEach':
      case 'beforeEach':
        message = `Test timeout of ${timeout}ms exceeded while running "${this._runnable.type}" hook.`;
        break;
      case 'beforeAll':
      case 'afterAll':
        message = `"${this._runnable.type}" hook timeout of ${timeout}ms exceeded.`;
        break;
      case 'teardown': {
        const fixtureSuffix = this._fixture ? ` while ${this._fixture.title}` : '';
        message = `Worker teardown timeout of ${timeout}ms exceeded${fixtureSuffix}.`;
        break;
      }
      case 'skip':
      case 'slow':
      case 'fixme':
      case 'fail':
        message = `"${this._runnable.type}" modifier timeout of ${timeout}ms exceeded.`;
        break;
    }
    const fixtureWithSlot = this._fixture?.slot ? this._fixture : undefined;
    if (fixtureWithSlot)
      message = `${fixtureWithSlot.title} timeout of ${timeout}ms exceeded.`;
    message = colors.red(message);
    const location = (fixtureWithSlot || this._runnable).location;
    return {
      message,
      // Include location for hooks, modifiers and fixtures to distinguish between them.
      stack: location ? message + `\n    at ${location.file}:${location.line}:${location.column}` : undefined
    };
  }
}
