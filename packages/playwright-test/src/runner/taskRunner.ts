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

import { debug } from 'playwright-core/lib/utilsBundle';
import { ManualPromise, monotonicTime } from 'playwright-core/lib/utils';
import type { FullResult, Reporter, TestError } from '../../reporter';
import { SigIntWatcher } from './sigIntWatcher';
import { serializeError } from '../util';

type TaskTeardown = () => Promise<any> | undefined;
export type Task<Context> = (context: Context, errors: TestError[]) => Promise<TaskTeardown | void> | undefined;

export class TaskRunner<Context> {
  private _tasks: { name: string, task: Task<Context> }[] = [];
  private _reporter: Reporter;
  private _hasErrors = false;
  private _interrupted = false;
  private _isTearDown = false;
  private _globalTimeoutForError: number;

  constructor(reporter: Reporter, globalTimeoutForError: number) {
    this._reporter = reporter;
    this._globalTimeoutForError = globalTimeoutForError;
  }

  addTask(name: string, task: Task<Context>) {
    this._tasks.push({ name, task });
  }

  stop() {
    this._interrupted = true;
  }

  async run(context: Context, deadline: number): Promise<FullResult['status']> {
    const { status, cleanup } = await this.runDeferCleanup(context, deadline);
    const teardownStatus = await cleanup();
    return status === 'passed' ? teardownStatus : status;
  }

  async runDeferCleanup(context: Context, deadline: number): Promise<{ status: FullResult['status'], cleanup: () => Promise<FullResult['status']> }> {
    const sigintWatcher = new SigIntWatcher();
    const timeoutWatcher = new TimeoutWatcher(deadline);
    const teardownRunner = new TaskRunner(this._reporter, this._globalTimeoutForError);
    teardownRunner._isTearDown = true;

    let currentTaskName: string | undefined;

    const taskLoop = async () => {
      for (const { name, task } of this._tasks) {
        currentTaskName = name;
        if (this._interrupted)
          break;
        debug('pw:test:task')(`"${name}" started`);
        const errors: TestError[] = [];
        try {
          const teardown = await task(context, errors);
          if (teardown)
            teardownRunner._tasks.unshift({ name: `teardown for ${name}`, task: teardown });
        } catch (e) {
          debug('pw:test:task')(`error in "${name}": `, e);
          errors.push(serializeError(e));
        } finally {
          for (const error of errors)
            this._reporter.onError?.(error);
          if (errors.length) {
            if (!this._isTearDown)
              this._interrupted = true;
            this._hasErrors = true;
          }
        }
        debug('pw:test:task')(`"${name}" finished`);
      }
    };

    await Promise.race([
      taskLoop(),
      sigintWatcher.promise(),
      timeoutWatcher.promise,
    ]);

    sigintWatcher.disarm();
    timeoutWatcher.disarm();

    // Prevent subsequent tasks from running.
    this._interrupted = true;

    let status: FullResult['status'] = 'passed';
    if (sigintWatcher.hadSignal()) {
      status = 'interrupted';
    } else if (timeoutWatcher.timedOut()) {
      this._reporter.onError?.({ message: `Timed out waiting ${this._globalTimeoutForError / 1000}s for the ${currentTaskName} to run` });
      status = 'timedout';
    } else if (this._hasErrors) {
      status = 'failed';
    }

    const cleanup = () => teardownRunner.runDeferCleanup(context, deadline).then(r => r.status);
    return { status, cleanup };
  }
}

export class TimeoutWatcher {
  private _timedOut = false;
  readonly promise = new ManualPromise();
  private _timer: NodeJS.Timeout | undefined;

  constructor(deadline: number) {
    if (!deadline)
      return;

    if (deadline - monotonicTime() <= 0) {
      this._timedOut = true;
      this.promise.resolve();
      return;
    }
    this._timer = setTimeout(() => {
      this._timedOut = true;
      this.promise.resolve();
    }, deadline - monotonicTime());
  }

  timedOut(): boolean {
    return this._timedOut;
  }

  disarm() {
    clearTimeout(this._timer);
  }
}
