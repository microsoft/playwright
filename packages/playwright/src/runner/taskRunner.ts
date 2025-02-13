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

import { ManualPromise, monotonicTime } from 'playwright-core/lib/utils';
import { colors } from 'playwright-core/lib/utils';
import { debug } from 'playwright-core/lib/utilsBundle';


import { SigIntWatcher } from './sigIntWatcher';
import { serializeError } from '../util';

import type { FullResult, TestError } from '../../types/testReporter';
import type { InternalReporter } from '../reporters/internalReporter';

type TaskPhase<Context> = (context: Context, errors: TestError[], softErrors: TestError[]) => Promise<void> | void;
export type Task<Context> = { title: string, setup?: TaskPhase<Context>, teardown?: TaskPhase<Context> };

export class TaskRunner<Context> {
  private _tasks: Task<Context>[] = [];
  private _reporter: InternalReporter;
  private _hasErrors = false;
  private _interrupted = false;
  private _isTearDown = false;
  private _globalTimeoutForError: number;

  constructor(reporter: InternalReporter, globalTimeoutForError: number) {
    this._reporter = reporter;
    this._globalTimeoutForError = globalTimeoutForError;
  }

  addTask(task: Task<Context>) {
    this._tasks.push(task);
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
      for (const task of this._tasks) {
        currentTaskName = task.title;
        if (this._interrupted)
          break;
        debug('pw:test:task')(`"${task.title}" started`);
        const errors: TestError[] = [];
        const softErrors: TestError[] = [];
        try {
          teardownRunner._tasks.unshift({ title: `teardown for ${task.title}`, setup: task.teardown });
          await task.setup?.(context, errors, softErrors);
        } catch (e) {
          debug('pw:test:task')(`error in "${task.title}": `, e);
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
        debug('pw:test:task')(`"${task.title}" finished`);
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
      this._reporter.onError?.({ message: colors.red(`Timed out waiting ${this._globalTimeoutForError / 1000}s for the ${currentTaskName} to run`) });
      status = 'timedout';
    } else if (this._hasErrors) {
      status = 'failed';
    }
    cancelPromise?.resolve();
    // Note that upon hitting deadline, we "run cleanup", but it exits immediately
    // because of the same deadline. Essentially, we're not performing any cleanup.
    const cleanup = () => teardownRunner.runDeferCleanup(context, deadline).then(r => r.status);
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
