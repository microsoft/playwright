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

import type { Progress } from '@protocol/progress';
import type { CallMetadata, SdkObject } from './instrumentation';
import type { LogName } from './utils/debugLogger';

export type { Progress } from '@protocol/progress';

export class ProgressController {
  private _forceAbortPromise = new ManualPromise<any>();
  private _donePromise = new ManualPromise<void>();

  // Cleanups to be run only in the case of abort.
  private _cleanups: ((error: Error | undefined) => any)[] = [];

  private _logName: LogName;
  private _state: 'before' | 'running' | { error: Error } | 'finished' = 'before';
  private _sdkObject: SdkObject;

  readonly metadata: CallMetadata;

  constructor(metadata: CallMetadata, sdkObject: SdkObject) {
    this.metadata = metadata;
    this._sdkObject = sdkObject;
    this._logName = sdkObject.logName || 'api';
    this._forceAbortPromise.catch(e => null);  // Prevent unhandled promise rejection.
  }

  setLogName(logName: LogName) {
    this._logName = logName;
  }

  async abort(error: Error) {
    if (this._state === 'running') {
      (error as any)[kAbortErrorSymbol] = true;
      this._state = { error };
      this._forceAbortPromise.reject(error);
    }
    await this._donePromise;
  }

  async run<T>(task: (progress: Progress) => Promise<T>, timeout?: number): Promise<T> {
    assert(this._state === 'before');
    this._state = 'running';

    const progress: Progress = {
      log: message => {
        if (this._state === 'running')
          this.metadata.log.push(message);
        // Note: we might be sending logs after progress has finished, for example browser logs.
        this._sdkObject.instrumentation.onCallLog(this._sdkObject, this.metadata, this._logName, message);
      },
      cleanupWhenAborted: (cleanup: (error: Error | undefined) => any) => {
        if (this._state !== 'running')
          throw new Error('Internal error: cannot register cleanup after operation has finished.');
        this._cleanups.push(cleanup);
      },
      metadata: this.metadata,
      race: <T>(promise: Promise<T> | Promise<T>[]) => {
        const promises = Array.isArray(promise) ? promise : [promise];
        return Promise.race([...promises, this._forceAbortPromise]);
      },
      raceWithCleanup: <T>(promise: Promise<T>, cleanup: (result: T) => any) => {
        return progress.race(promise.then(result => {
          if (this._state !== 'running')
            cleanup(result);
          else
            this._cleanups.push(() => cleanup(result));
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
          (timeoutError as any)[kAbortErrorSymbol] = true;
          this._state = { error: timeoutError };
          this._forceAbortPromise.reject(timeoutError);
        }
      }, timeout);
    }

    try {
      const result = await task(progress);
      this._state = 'finished';
      return result;
    } catch (error) {
      this._state = { error };
      await Promise.all(this._cleanups.splice(0).map(cleanup => runCleanup(error, cleanup)));
      throw error;
    } finally {
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

const kAbortErrorSymbol = Symbol('kAbortError');

export function isAbortError(error: Error): boolean {
  return !!(error as any)[kAbortErrorSymbol];
}
