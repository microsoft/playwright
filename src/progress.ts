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

import { InnerLogger, Log } from './logger';
import { TimeoutError } from './errors';
import { helper } from './helper';
import * as types from './types';
import { DEFAULT_TIMEOUT, TimeoutSettings } from './timeoutSettings';
import { getCurrentApiCall, rewriteErrorMessage } from './debug/stackTrace';

class AbortError extends Error {}

export class Progress {
  static async runCancelableTask<T>(task: (progress: Progress) => Promise<T>, timeoutOptions: types.TimeoutOptions, logger: InnerLogger, timeoutSettings?: TimeoutSettings, apiName?: string): Promise<T> {
    apiName = apiName || getCurrentApiCall();

    const defaultTimeout = timeoutSettings ? timeoutSettings.timeout() : DEFAULT_TIMEOUT;
    const { timeout = defaultTimeout } = timeoutOptions;
    const deadline = TimeoutSettings.computeDeadline(timeout);

    let rejectCancelPromise: (error: Error) => void = () => {};
    const cancelPromise = new Promise<T>((resolve, x) => rejectCancelPromise = x);
    const timeoutError = new TimeoutError(`Timeout ${timeout}ms exceeded during ${apiName}.`);
    const timer = setTimeout(() => rejectCancelPromise(timeoutError), helper.timeUntilDeadline(deadline));

    let resolveCancelation = () => {};
    const progress = new Progress(deadline, logger, new Promise(resolve => resolveCancelation = resolve), rejectCancelPromise, apiName);
    try {
      const promise = task(progress);
      const result = await Promise.race([promise, cancelPromise]);
      clearTimeout(timer);
      progress._running = false;
      progress._logRecording = [];
      return result;
    } catch (e) {
      resolveCancelation();
      rewriteErrorMessage(e, e.message + formatLogRecording(progress._logRecording, apiName));
      clearTimeout(timer);
      progress._running = false;
      progress._logRecording = [];
      await Promise.all(progress._cleanups.splice(0).map(cleanup => runCleanup(cleanup)));
      throw e;
    }
  }

  readonly apiName: string;
  readonly deadline: number;  // To be removed?
  readonly cancel: (error: Error) => void;
  readonly _canceled: Promise<any>;

  private _logger: InnerLogger;
  private _logRecording: string[] = [];
  private _cleanups: (() => any)[] = [];
  private _running = true;

  constructor(deadline: number, logger: InnerLogger, canceled: Promise<any>, cancel: (error: Error) => void, apiName: string) {
    this.deadline = deadline;
    this.apiName = apiName;
    this.cancel = cancel;
    this._canceled = canceled;
    this._logger = logger;
  }

  cleanupWhenCanceled(cleanup: () => any) {
    if (this._running)
      this._cleanups.push(cleanup);
    else
      runCleanup(cleanup);
  }

  throwIfCanceled() {
    if (!this._running)
      throw new AbortError();
  }

  race<T>(promise: Promise<T>, cleanup?: () => any): Promise<T> {
    const canceled = this._canceled.then(async error => {
      if (cleanup)
        await runCleanup(cleanup);
      throw error;
    });
    const success = promise.then(result => {
      cleanup = undefined;
      return result;
    });
    return Promise.race<T>([success, canceled]);
  }

  log(log: Log, message: string | Error): void {
    if (this._running)
      this._logRecording.push(message.toString());
    this._logger._log(log, message);
  }
}

async function runCleanup(cleanup: () => any) {
  try {
    await cleanup();
  } catch (e) {
  }
}

function formatLogRecording(log: string[], name: string): string {
  if (!log.length)
    return '';
  name = ` ${name} logs `;
  const headerLength = 60;
  const leftLength = (headerLength - name.length) / 2;
  const rightLength = headerLength - name.length - leftLength;
  return `\n${'='.repeat(leftLength)}${name}${'='.repeat(rightLength)}\n${log.join('\n')}\n${'='.repeat(headerLength)}`;
}
