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
import { assert, monotonicTime } from '../utils';
import { ManualPromise } from '../utils/isomorphic/manualPromise';

import type { CallMetadata, Instrumentation, SdkObject } from './instrumentation';
import type { LogName } from './utils/debugLogger';

export interface Progress {
  log(message: string): void;
  timeUntilDeadline(): number;
  cleanupWhenAborted(cleanup: () => any): void;
  throwIfAborted(): void;
  race<T>(promise: Promise<T> | Promise<T>[]): Promise<T>;
  raceWithCleanup<T>(promise: Promise<T>, cleanup: (result: T) => any): Promise<T>;
  wait(timeout: number): Promise<void>;
  metadata: CallMetadata;
}

export class ProgressController {
  private _forceAbortPromise = new ManualPromise<any>();
  private _donePromise = new ManualPromise<void>();

  // Cleanups to be run only in the case of abort.
  private _cleanups: (() => any)[] = [];

  // Lenient mode races against the timeout. This guarantees that timeout is respected,
  // but may have some work being done after the timeout due to parallel control flow.
  //
  // Strict mode aborts the progress and requires the code to react to it. This way,
  // progress only finishes after the inner callback exits, guaranteeing no work after the timeout.
  private _strictMode = false;

  private _logName: LogName;
  private _state: 'before' | 'running' | { error: Error } | 'finished' = 'before';
  private _deadline: number = 0;
  readonly metadata: CallMetadata;
  readonly instrumentation: Instrumentation;
  readonly sdkObject: SdkObject;

  constructor(metadata: CallMetadata, sdkObject: SdkObject, strictMode?: 'strict') {
    this._strictMode = strictMode === 'strict';
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
    this._deadline = timeout ? monotonicTime() + timeout : 0;

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
      timeUntilDeadline: () => this._deadline ? this._deadline - monotonicTime() : 2147483647, // 2^31-1 safe setTimeout in Node.
      cleanupWhenAborted: (cleanup: () => any) => {
        if (this._state === 'running')
          this._cleanups.push(cleanup);
        else
          runCleanup(cleanup);
      },
      throwIfAborted: () => {
        if (typeof this._state === 'object')
          throw this._state.error;
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

    const timeoutError = new TimeoutError(`Timeout ${timeout}ms exceeded.`);
    const timer = setTimeout(() => {
      if (this._state === 'running') {
        this._state = { error: timeoutError };
        this._forceAbortPromise.reject(timeoutError);
      }
    }, progress.timeUntilDeadline());
    try {
      const promise = task(progress);
      const result = this._strictMode ? await promise : await Promise.race([promise, this._forceAbortPromise]);
      this._state = 'finished';
      return result;
    } catch (error) {
      this._state = { error };
      await Promise.all(this._cleanups.splice(0).map(runCleanup));
      throw error;
    } finally {
      this.sdkObject.attribution.context?._activeProgressControllers.delete(this);
      clearTimeout(timer);
      this._donePromise.resolve();
    }
  }
}

async function runCleanup(cleanup: () => any) {
  try {
    await cleanup();
  } catch (e) {
  }
}

class AbortedError extends Error {}

export function isAbortError(error: Error): boolean {
  return error instanceof AbortedError || error instanceof TimeoutError;
}
