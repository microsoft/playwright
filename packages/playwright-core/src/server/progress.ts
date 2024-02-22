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
import type { LogName } from '../utils/debugLogger';
import type { CallMetadata, Instrumentation, SdkObject } from './instrumentation';
import type { ElementHandle } from './dom';
import { ManualPromise } from '../utils/manualPromise';

export interface Progress {
  log(message: string): void;
  timeUntilDeadline(): number;
  isRunning(): boolean;
  cleanupWhenAborted(cleanup: () => any): void;
  throwIfAborted(): void;
  beforeInputAction(element: ElementHandle): Promise<void>;
  metadata: CallMetadata;
}

export class ProgressController {
  private _forceAbortPromise = new ManualPromise<any>();

  // Cleanups to be run only in the case of abort.
  private _cleanups: (() => any)[] = [];

  private _logName = 'api';
  private _state: 'before' | 'running' | 'aborted' | 'finished' = 'before';
  private _deadline: number = 0;
  private _timeout: number = 0;
  readonly metadata: CallMetadata;
  readonly instrumentation: Instrumentation;
  readonly sdkObject: SdkObject;

  constructor(metadata: CallMetadata, sdkObject: SdkObject) {
    this.metadata = metadata;
    this.sdkObject = sdkObject;
    this.instrumentation = sdkObject.instrumentation;
    this._forceAbortPromise.catch(e => null);  // Prevent unhandled promise rejection.
  }

  setLogName(logName: LogName) {
    this._logName = logName;
  }

  abort(error: Error) {
    this._forceAbortPromise.reject(error);
  }

  async run<T>(task: (progress: Progress) => Promise<T>, timeout?: number): Promise<T> {
    if (timeout) {
      this._timeout = timeout;
      this._deadline = timeout ? monotonicTime() + timeout : 0;
    }

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
      isRunning: () => this._state === 'running',
      cleanupWhenAborted: (cleanup: () => any) => {
        if (this._state === 'running')
          this._cleanups.push(cleanup);
        else
          runCleanup(cleanup);
      },
      throwIfAborted: () => {
        if (this._state === 'aborted')
          throw new AbortedError();
      },
      beforeInputAction: async (element: ElementHandle) => {
        await this.instrumentation.onBeforeInputAction(this.sdkObject, this.metadata, element);
      },
      metadata: this.metadata
    };

    const timeoutError = new TimeoutError(`Timeout ${this._timeout}ms exceeded.`);
    const timer = setTimeout(() => this._forceAbortPromise.reject(timeoutError), progress.timeUntilDeadline());
    try {
      const promise = task(progress);
      const result = await Promise.race([promise, this._forceAbortPromise]);
      this._state = 'finished';
      return result;
    } catch (e) {
      this._state = 'aborted';
      await Promise.all(this._cleanups.splice(0).map(runCleanup));
      throw e;
    } finally {
      this.sdkObject.attribution.context?._activeProgressControllers.delete(this);
      clearTimeout(timer);
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
