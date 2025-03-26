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

export class FloatingPromiseScope {
  readonly _floatingCalls: Set<Promise<any>> = new Set();

  /**
   * Enables a promise API call to be tracked by the test, alerting if unawaited.
   *
   * **NOTE:** Returning from an async function wraps the result in a promise, regardless of whether the return value is a promise. This will automatically mark the promise as awaited. Avoid this.
   */
  wrapPromiseAPIResult<T>(promise: Promise<T>): Promise<T> {
    const promiseProxy = new Proxy(promise, {
      get: (target, prop, receiver) => {
        if (prop === 'then') {
          return (...args: any[]) => {
            this._floatingCalls.delete(promise);

            const originalThen = Reflect.get(target, prop, receiver) as Promise<T>['then'];
            return originalThen.call(target, ...args);
          };
        } else {
          return Reflect.get(target, prop, receiver);
        }
      }
    });

    this._floatingCalls.add(promise);

    return promiseProxy;
  }

  clear() {
    this._floatingCalls.clear();
  }

  hasFloatingPromises(): boolean {
    return this._floatingCalls.size > 0;
  }
}
