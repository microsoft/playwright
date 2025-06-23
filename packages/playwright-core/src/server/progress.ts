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

import { TimeoutError } from './errors';
import { assert } from '../utils';
import { ManualPromise } from '../utils/isomorphic/manualPromise';

import type { CallMetadata, Instrumentation, SdkObject } from './instrumentation';
import type { LogName } from './utils/debugLogger';

// Most server operations are run inside a Progress instance.
// Each method that takes a Progress must result in one of the three outcomes:
//   - It finishes successfully, returning a value, before the Progress is aborted.
//   - It throws some error, before the Progress is aborted.
//   - It throws the Progress's aborted error, because the Progress was aborted before
//     the method could finish.
// As a rule of thumb, the above is achieved by:
//   - Passing the Progress instance when awaiting other methods.
//   - Using `progress.race()` when awaiting other methods that do not take a Progress argument.
//     In this case, it is important that awaited method has no side effects, for example
//     it is a read-only browser protocol call.
//   - In rare cases, when the awaited method does not take a Progress argument,
//     but it does have side effects such as creating a page -  a proper cleanup
//     must be taken in case Progress is aborted before the awaited method finishes.
//     That's usually done by `progress.raceWithCleanup()` or `progress.cleanupWhenAborted()`.
export interface Progress {
  log(message: string): void;
  cleanupWhenAborted(cleanup: (error: Error | undefined) => any): void;
  race<T>(promise: Promise<T> | Promise<T>[]): Promise<T>;
  raceWithCleanup<T>(promise: Promise<T>, cleanup: (result: T) => any): Promise<T>;
  wait(timeout: number): Promise<void>;
  metadata: CallMetadata;
}

export class ProgressController {
  private _forceAbortPromise = new ManualPromise<any>();
  private _donePromise = new ManualPromise<void>();

  // Cleanups to be run only in the case of abort.
  private _cleanups: ((error: Error | undefined) => any)[] = [];

  // Lenient mode races against the timeout. This guarantees that timeout is respected,
  // but may have some work being done after the timeout due to parallel control flow.
  //
  // Strict mode aborts the progress and requires the code to react to it. This way,
  // progress only finishes after the inner callback exits, guaranteeing no work after the timeout.
  private _strictMode = false;

  private _logName: LogName;
  private _state: 'before' | 'running' | { error: Error } | 'finished' = 'before';
  readonly metadata: CallMetadata;
  readonly instrumentation: Instrumentation;
  readonly sdkObject: SdkObject;

  constructor(metadata: CallMetadata, sdkObject: SdkObject) {
    this._strictMode = !process.env.PLAYWRIGHT_LEGACY_TIMEOUTS;
    this.metadata = metadata;
    this.sdkObject = sdkObject;
    this.instrumentation = sdkObject.instrumentation;
    this._logName = sdkObject.logName || 'api';
    this._forceAbortPromise.catch(e => null);  // Prevent unhandled promise rejection.
  }

  setLogName(logName: LogName) {
    this._logName = logName;
  }

  async abort(message: string) {
    if (this._state === 'running') {
      const error = new AbortedError(message);
      this._state = { error };
      this._forceAbortPromise.reject(error);
    }
    if (this._strictMode)
      await this._donePromise;
  }

  async run<T>(task: (progress: Progress) => Promise<T>, timeout?: number): Promise<T> {
    assert(this._state === 'before');
    this._state = 'running';
    this.sdkObject.attribution.context?._activeProgressControllers.add(this);

    const progress: Progress = {
      log: message => {
        if (this._state === 'running')
          this.metadata.log.push(message);
        // Note: we might be sending logs after progress has finished, for example browser logs.
        this.instrumentation.onCallLog(this.sdkObject, this.metadata, this._logName, message);
      },
      cleanupWhenAborted: (cleanup: (error: Error | undefined) => any) => {
        if (this._strictMode) {
          if (this._state !== 'running')
            throw new Error('Internal error: cannot register cleanup after operation has finished.');
          this._cleanups.push(cleanup);
          return;
        }
        if (this._state === 'running')
          this._cleanups.push(cleanup);
        else
          runCleanup(typeof this._state === 'object' ? this._state.error : undefined, cleanup);
      },
      metadata: this.metadata,
      race: <T>(promise: Promise<T> | Promise<T>[]) => {
        const promises = Array.isArray(promise) ? promise : [promise];
        return Promise.race([...promises, this._forceAbortPromise]);
      },
      raceWithCleanup: <T>(promise: Promise<T>, cleanup: (result: T) => any) => {
        return progress.race(promise.then(result => {
          progress.cleanupWhenAborted(() => cleanup(result));
          return result;
        }));
      },
      wait: async (timeout: number) => {
        let timer: NodeJS.Timeout;
        const promise = new Promise<void>(f => timer = setTimeout(f, timeout));
        return progress.race(promise).finally(() => clearTimeout(timer));
      },
    };

    let timer: NodeJS.Timeout | undefined;
    if (timeout) {
      const timeoutError = new TimeoutError(`Timeout ${timeout}ms exceeded.`);
      timer = setTimeout(() => {
        if (this._state === 'running') {
          this._state = { error: timeoutError };
          this._forceAbortPromise.reject(timeoutError);
        }
      }, Math.min(timeout, 2147483647)); // 2^31-1 safe setTimeout in Node.
    }

    try {
      const promise = task(progress);
      const result = this._strictMode ? await promise : await Promise.race([promise, this._forceAbortPromise]);
      this._state = 'finished';
      return result;
    } catch (error) {
      this._state = { error };
      await Promise.all(this._cleanups.splice(0).map(cleanup => runCleanup(error, cleanup)));
      throw error;
    } finally {
      this.sdkObject.attribution.context?._activeProgressControllers.delete(this);
      clearTimeout(timer);
      this._donePromise.resolve();
    }
  }
}

async function runCleanup(error: Error | undefined, cleanup: (error: Error | undefined) => any) {
  try {
    await cleanup(error);
  } catch (e) {
  }
}

class AbortedError extends Error {}

export function isAbortError(error: Error): boolean {
  return error instanceof AbortedError || error instanceof TimeoutError;
}
