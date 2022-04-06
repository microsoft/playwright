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

import colors from 'colors/safe';
import { TimeoutRunner, TimeoutRunnerError } from 'playwright-core/lib/utils/async';
import type { TestError } from '../types/test';
import type { Location } from './types';

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
  fixture: string;
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

  defaultTimeout() {
    return this._defaultSlot.timeout;
  }

  slow() {
    const slot = this._currentSlot();
    slot.timeout = slot.timeout * 3;
    this._timeoutRunner.updateTimeout(slot.timeout);
  }

  async runWithTimeout(cb: () => Promise<any>): Promise<TestError | undefined> {
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

  private _createTimeoutError(): TestError {
    let suffix = '';
    switch (this._runnable.type) {
      case 'test':
        suffix = ''; break;
      case 'beforeAll':
      case 'beforeEach':
      case 'afterAll':
      case 'afterEach':
        suffix = ` in ${this._runnable.type} hook`; break;
      case 'teardown':
        suffix = ` in fixtures teardown`; break;
      case 'skip':
      case 'slow':
      case 'fixme':
      case 'fail':
        suffix = ` in ${this._runnable.type} modifier`; break;
    }
    const fixtureWithSlot = this._fixture?.slot ? this._fixture : undefined;
    if (fixtureWithSlot)
      suffix = ` in fixture "${fixtureWithSlot.fixture}"`;
    const message = colors.red(`Timeout of ${this._currentSlot().timeout}ms exceeded${suffix}.`);
    const location = (fixtureWithSlot || this._runnable).location;
    return {
      message,
      // Include location for hooks, modifiers and fixtures to distinguish between them.
      stack: location ? message + `\n    at ${location.file}:${location.line}:${location.column}` : undefined,
    };
  }
}
