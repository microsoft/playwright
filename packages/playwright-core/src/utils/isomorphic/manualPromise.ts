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

import { captureRawStack } from './stackTrace';

export class ManualPromise<T = void> extends Promise<T> {
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

export class LongStandingScope {
  private _terminateError: Error | undefined;
  private _closeError: Error | undefined;
  private _terminatePromises = new Map<ManualPromise<Error>, string[]>();
  private _isClosed = false;

  reject(error: Error) {
    this._isClosed = true;
    this._terminateError = error;
    for (const p of this._terminatePromises.keys())
      p.resolve(error);
  }

  close(error: Error) {
    this._isClosed = true;
    this._closeError = error;
    for (const [p, frames] of this._terminatePromises)
      p.resolve(cloneError(error, frames));
  }

  isClosed() {
    return this._isClosed;
  }

  static async raceMultiple<T>(scopes: LongStandingScope[], promise: Promise<T>): Promise<T> {
    return Promise.race(scopes.map(s => s.race(promise)));
  }

  async race<T>(promise: Promise<T> | Promise<T>[]): Promise<T> {
    return this._race(Array.isArray(promise) ? promise : [promise], false) as Promise<T>;
  }

  async safeRace<T>(promise: Promise<T>, defaultValue?: T): Promise<T> {
    return this._race([promise], true, defaultValue);
  }

  private async _race(promises: Promise<any>[], safe: boolean, defaultValue?: any): Promise<any> {
    const terminatePromise = new ManualPromise<Error>();
    const frames = captureRawStack();
    if (this._terminateError)
      terminatePromise.resolve(this._terminateError);
    if (this._closeError)
      terminatePromise.resolve(cloneError(this._closeError, frames));
    this._terminatePromises.set(terminatePromise, frames);
    try {
      return await Promise.race([
        terminatePromise.then(e => safe ? defaultValue : Promise.reject(e)),
        ...promises
      ]);
    } finally {
      this._terminatePromises.delete(terminatePromise);
    }
  }
}

function cloneError(error: Error, frames: string[]) {
  const clone = new Error();
  clone.name = error.name;
  clone.message = error.message;
  clone.stack = [error.name + ':' + error.message, ...frames].join('\n');
  return clone;
}
