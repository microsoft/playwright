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

import { monotonicTime } from './utils';

export class DeadlineRunner<T> {
  private _timer: NodeJS.Timer | undefined;
  readonly result = new ManualPromise<{ timedOut: true } | { result: T, timedOut: false }>();

  constructor(promise: Promise<T>, deadline: number) {
    promise.then(result => {
      this._finish({ result, timedOut: false });
    }).catch(e => {
      this._finish(undefined, e);
    });
    this.updateDeadline(deadline);
  }

  private _finish(success?: { timedOut: true } | { result: T, timedOut: false }, error?: any) {
    if (this.result.isDone())
      return;
    this.updateDeadline(0);
    if (success)
      this.result.resolve(success);
    else
      this.result.reject(error);
  }

  interrupt() {
    this.updateDeadline(-1);
  }

  updateDeadline(deadline: number) {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = undefined;
    }
    if (deadline === 0)
      return;
    const timeout = deadline - monotonicTime();
    if (timeout <= 0)
      this._finish({ timedOut: true });
    else
      this._timer = setTimeout(() => this._finish({ timedOut: true }), timeout);
  }
}

export async function raceAgainstDeadline<T>(promise: Promise<T>, deadline: number) {
  return (new DeadlineRunner(promise, deadline)).result;
}

export class ManualPromise<T> extends Promise<T> {
  private _resolve!: (t: T) => void;
  private _reject!: (e: Error) => void;
  private _isDone: boolean;

  constructor() {
    let resolve: (t: T) => void;
    let reject: (e: Error) => void;
    super((f, r) => {
      resolve = f;
      reject = r;
    });
    this._isDone = false;
    this._resolve = resolve!;
    this._reject = reject!;
  }

  isDone() {
    return this._isDone;
  }

  resolve(t: T) {
    this._isDone = true;
    this._resolve(t);
  }

  reject(e: Error) {
    this._isDone = true;
    this._reject(e);
  }

  static override get [Symbol.species]() {
    return Promise;
  }

  override get [Symbol.toStringTag]() {
    return 'ManualPromise';
  }
}
