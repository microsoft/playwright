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
import type { FullResult, TestError } from '../../types/testReporter';
import { SigIntWatcher } from './sigIntWatcher';
import { serializeError } from '../util';
import type { ReporterV2 } from '../reporters/reporterV2';

type TaskPhase<Context> = (context: Context, errors: TestError[], softErrors: TestError[]) => Promise<void> | void;
export type Task<Context> = { setup?: TaskPhase<Context>, teardown?: TaskPhase<Context> };

export class TaskRunner<Context> {
  private _tasks: { name: string, task: Task<Context> }[] = [];
  private _reporter: ReporterV2;
  private _hasErrors = false;
  private _interrupted = false;
  private _isTearDown = false;
  private _globalTimeoutForError: number;

  constructor(reporter: ReporterV2, globalTimeoutForError: number) {
    this._reporter = reporter;
    this._globalTimeoutForError = globalTimeoutForError;
  }

  addTask(name: string, task: Task<Context>) {
    this._tasks.push({ name, task });
  }

  async run(context: Context, deadline: number, cancelPromise?: ManualPromise<void>): Promise<FullResult['status']> {
    const { status, cleanup } = await this.runDeferCleanup(context, deadline, cancelPromise);
    const teardownStatus = await cleanup();
    return status === 'passed' ? teardownStatus : status;
  }

  async runDeferCleanup(context: Context, deadline: number, cancelPromise = new ManualPromise<void>()): Promise<{ status: FullResult['status'], cleanup: () => Promise<FullResult['status']> }> {
    const sigintWatcher = new SigIntWatcher();
    const timeoutWatcher = new TimeoutWatcher(deadline);
    const teardownRunner = new TaskRunner<Context>(this._reporter, this._globalTimeoutForError);
    teardownRunner._isTearDown = true;

    let currentTaskName: string | undefined;

    const taskLoop = async () => {
      for (const { name, task } of this._tasks) {
        currentTaskName = name;
        if (this._interrupted)
          break;
        debug('pw:test:task')(`"${name}" started`);
        const errors: TestError[] = [];
        const softErrors: TestError[] = [];
        try {
          teardownRunner._tasks.unshift({ name: `teardown for ${name}`, task: { setup: task.teardown } });
          await task.setup?.(context, errors, softErrors);
        } catch (e) {
          debug('pw:test:task')(`error in "${name}": `, e);
          errors.push(serializeError(e));
        } finally {
          for (const error of [...softErrors, ...errors])
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
      cancelPromise,
      sigintWatcher.promise(),
      timeoutWatcher.promise,
    ]);

    sigintWatcher.disarm();
    timeoutWatcher.disarm();

    // Prevent subsequent tasks from running.
    this._interrupted = true;

    let status: FullResult['status'] = 'passed';
    if (sigintWatcher.hadSignal() || cancelPromise?.isDone()) {
      status = 'interrupted';
    } else if (timeoutWatcher.timedOut()) {
      this._reporter.onError?.({ message: `Timed out waiting ${this._globalTimeoutForError / 1000}s for the ${currentTaskName} to run` });
      status = 'timedout';
    } else if (this._hasErrors) {
      status = 'failed';
    }
    cancelPromise?.resolve();
    const cleanup = async () => {
      // Upon hitting deadline we add extra 30s to actually perform cleanup, otherwise
      // the task exits immediately because of the same deadline and we may continue
      // while the test workers are still running.
      const extraTime = timeoutWatcher.timedOut() ? 30_000 : 0;
      const { status } = await teardownRunner.runDeferCleanup(context, deadline + extraTime);
      return status;
    };
    return { status, cleanup };
  }
}

class TimeoutWatcher {
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
