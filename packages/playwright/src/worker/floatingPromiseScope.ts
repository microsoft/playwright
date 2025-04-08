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

import { wrapPromiseAPIResult } from 'playwright-core/lib/utils';

import type { Location } from '../../types/test';

export class FloatingPromiseScope {
  readonly _floatingCalls: Map<Promise<any>, Location | undefined> = new Map();

  /**
   * Enables a promise API call to be tracked by the test, alerting if unawaited.
   *
   * **NOTE:** Returning from an async function wraps the result in a promise, regardless of whether the return value is a promise. This will automatically mark the promise as awaited. Avoid this.
   */
  wrapPromiseAPIResult<T>(promise: Promise<T>, location: Location | undefined): Promise<T> {
    return wrapPromiseAPIResult(promise, location, this.registerFloatingPromise.bind(this), this.unregisterFloatingPromise.bind(this));
  }

  registerFloatingPromise<T>(promise: Promise<T>, location: Location | undefined) {
    this._floatingCalls.set(promise, location);
  }

  unregisterFloatingPromise<T>(promise: Promise<T>) {
    this._floatingCalls.delete(promise);
  }

  clear() {
    this._floatingCalls.clear();
  }

  hasFloatingPromises(): boolean {
    return this._floatingCalls.size > 0;
  }

  floatingPromises(): Array<{ location: Location | undefined, promise: Promise<any> }> {
    return Array.from(this._floatingCalls.entries()).map(([promise, location]) => ({ location, promise }));
  }
}
