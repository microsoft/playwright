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

import { Logger } from './logger';
import { TimeoutError } from './errors';
import { assert } from './helper';
import { rewriteErrorMessage } from './utils/stackTrace';

export interface Progress {
  readonly aborted: Promise<void>;
  readonly logger: Logger;
  timeUntilDeadline(): number;
  isRunning(): boolean;
  cleanupWhenAborted(cleanup: () => any): void;
  throwIfAborted(): void;
}

export async function runAbortableTask<T>(task: (progress: Progress) => Promise<T>, logger: Logger, timeout: number): Promise<T> {
  const controller = new ProgressController(logger, timeout);
  return controller.run(task);
}

export class ProgressController {
  // Promise and callback that forcefully abort the progress.
  // This promise always rejects.
  private _forceAbort: (error: Error) => void = () => {};
  private _forceAbortPromise: Promise<any>;

  // Promise and callback that resolve once the progress is aborted.
  // This includes the force abort and also rejection of the task itself (failure).
  private _aborted = () => {};
  private _abortedPromise: Promise<void>;

  // Cleanups to be run only in the case of abort.
  private _cleanups: (() => any)[] = [];

  private _logger: Logger;
  private _state: 'before' | 'running' | 'aborted' | 'finished' = 'before';
  private _deadline: number;
  private _timeout: number;

  constructor(logger: Logger, timeout: number) {
    this._logger = logger;

    this._timeout = timeout;
    this._deadline = timeout ? monotonicTime() + timeout : 0;

    this._forceAbortPromise = new Promise((resolve, reject) => this._forceAbort = reject);
    this._forceAbortPromise.catch(e => null);  // Prevent unhandle promsie rejection.
    this._abortedPromise = new Promise(resolve => this._aborted = resolve);
  }

  async run<T>(task: (progress: Progress) => Promise<T>): Promise<T> {
    assert(this._state === 'before');
    this._state = 'running';

    const loggerScope = this._logger.createScope(undefined, true);

    const progress: Progress = {
      aborted: this._abortedPromise,
      logger: loggerScope,
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
    };

    const timeoutError = new TimeoutError(`Timeout ${this._timeout}ms exceeded.`);
    const timer = setTimeout(() => this._forceAbort(timeoutError), progress.timeUntilDeadline());
    try {
      const promise = task(progress);
      const result = await Promise.race([promise, this._forceAbortPromise]);
      clearTimeout(timer);
      this._state = 'finished';
      loggerScope.endScope('succeeded');
      return result;
    } catch (e) {
      this._aborted();
      rewriteErrorMessage(e,
          e.message +
          formatLogRecording(loggerScope.recording()) +
          kLoggingNote);
      clearTimeout(timer);
      this._state = 'aborted';
      loggerScope.endScope(`failed`);
      await Promise.all(this._cleanups.splice(0).map(cleanup => runCleanup(cleanup)));
      throw e;
    }
  }

  abort(error: Error) {
    this._forceAbort(error);
  }
}

async function runCleanup(cleanup: () => any) {
  try {
    await cleanup();
  } catch (e) {
  }
}

const kLoggingNote = `\nNote: use DEBUG=pw:api environment variable and rerun to capture Playwright logs.`;

function formatLogRecording(log: string[]): string {
  if (!log.length)
    return '';
  const header = ` logs `;
  const headerLength = 60;
  const leftLength = (headerLength - header.length) / 2;
  const rightLength = headerLength - header.length - leftLength;
  return `\n${'='.repeat(leftLength)}${header}${'='.repeat(rightLength)}\n${log.join('\n')}\n${'='.repeat(headerLength)}`;
}

function monotonicTime(): number {
  const [seconds, nanoseconds] = process.hrtime();
  return seconds * 1000 + (nanoseconds / 1000000 | 0);
}

class AbortedError extends Error {}
