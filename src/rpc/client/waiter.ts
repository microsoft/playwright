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

import { EventEmitter } from 'events';

export class Waiter {
  private _dispose: (() => void)[] = [];
  private _failures: Promise<any>[] = [];

  async waitForEvent<T = void>(emitter: EventEmitter, event: string, predicate?: (arg: T) => boolean): Promise<T> {
    const { promise, dispose } = waitForEvent(emitter, event, predicate);
    return this._wait(promise, dispose);
  }

  rejectOnEvent<T = void>(emitter: EventEmitter, event: string, error: Error, predicate?: (arg: T) => boolean) {
    const { promise, dispose } = waitForEvent(emitter, event, predicate);
    this._rejectOn(promise.then(() => { throw error; }), dispose);
  }

  rejectOnTimeout(timeout: number, error: Error) {
    if (!timeout)
      return;
    const { promise, dispose } = waitForTimeout(timeout);
    this._rejectOn(promise.then(() => { throw error; }), dispose);
  }

  dispose() {
    for (const dispose of this._dispose)
      dispose();
  }

  private async _wait<T>(promise: Promise<T>, dispose?: () => void): Promise<T> {
    try {
      const result = await Promise.race([promise, ...this._failures]);
      if (dispose)
        dispose();
      return result;
    } catch (e) {
      if (dispose)
        dispose();
      this.dispose();
      throw e;
    }
  }

  private _rejectOn(promise: Promise<any>, dispose?: () => void) {
    this._failures.push(promise);
    if (dispose)
      this._dispose.push(dispose);
  }
}

function waitForEvent<T = void>(emitter: EventEmitter, event: string, predicate?: (arg: T) => boolean): { promise: Promise<T>, dispose: () => void } {
  let listener: (eventArg: any) => void;
  const promise = new Promise<T>((resolve, reject) => {
    listener = (eventArg: any) => {
      try {
        if (predicate && !predicate(eventArg))
          return;
        emitter.removeListener(event, listener);
        resolve(eventArg);
      } catch (e) {
        emitter.removeListener(event, listener);
        reject(e);
      }
    };
    emitter.addListener(event, listener);
  });
  const dispose = () => emitter.removeListener(event, listener);
  return { promise, dispose };
}

function waitForTimeout(timeout: number): { promise: Promise<void>, dispose: () => void } {
  let timeoutId: number;
  const promise = new Promise<void>(resolve => timeoutId = setTimeout(resolve, timeout));
  const dispose = () => clearTimeout(timeoutId);
  return { promise, dispose };
}
