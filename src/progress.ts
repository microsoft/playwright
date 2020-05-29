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
  static async runCancelableTask<T>(task: (progress: Progress) => Promise<T>, timeoutOptions: types.TimeoutOptions, logger: InnerLogger, apiName?: string): Promise<T> {
    let resolveCancelation = () => {};
    const progress = new Progress(timeoutOptions, logger, new Promise(resolve => resolveCancelation = resolve), apiName);

    const { timeout = DEFAULT_TIMEOUT } = timeoutOptions;
    const timeoutError = new TimeoutError(`Timeout ${timeout}ms exceeded during ${progress.apiName}.`);
    let rejectWithTimeout: (error: Error) => void;
    const timeoutPromise = new Promise<T>((resolve, x) => rejectWithTimeout = x);
    const timeoutTimer = setTimeout(() => rejectWithTimeout(timeoutError), helper.timeUntilDeadline(progress.deadline));

    try {
      const promise = task(progress);
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutTimer);
      progress._running = false;
      progress._logRecording = [];
      return result;
    } catch (e) {
      resolveCancelation();
      rewriteErrorMessage(e, e.message + formatLogRecording(progress._logRecording, progress.apiName));
      clearTimeout(timeoutTimer);
      progress._running = false;
      progress._logRecording = [];
      await Promise.all(progress._cleanups.splice(0).map(cleanup => runCleanup(cleanup)));
      throw e;
    }
  }

  readonly apiName: string;
  readonly deadline: number;  // To be removed?
  readonly _canceled: Promise<any>;

  private _logger: InnerLogger;
  private _logRecording: string[] = [];
  private _cleanups: (() => any)[] = [];
  private _running = true;

  constructor(options: types.TimeoutOptions, logger: InnerLogger, canceled: Promise<any>, apiName?: string) {
    this.apiName = apiName || getCurrentApiCall();
    this.deadline = TimeoutSettings.computeDeadline(options.timeout);
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
  name = ` ${name} logs `;
  const headerLength = 60;
  const leftLength = (headerLength - name.length) / 2;
  const rightLength = headerLength - name.length - leftLength;
  return `\n${'='.repeat(leftLength)}${name}${'='.repeat(rightLength)}\n${log.join('\n')}\n${'='.repeat(headerLength)}`;
}
