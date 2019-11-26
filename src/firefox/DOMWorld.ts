/**
 * Copyright 2019 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { JSHandle } from './JSHandle';
import { ExecutionContext } from './ExecutionContext';
import { WaitTaskParams, WaitTask } from '../waitTask';

export class DOMWorld {
  _frame: any;
  _timeoutSettings: any;
  _contextPromise: any;
  _contextResolveCallback: any;
  private _context: ExecutionContext | null;
  _waitTasks: Set<WaitTask<JSHandle>>;
  _detached: boolean;
  constructor(frame, timeoutSettings) {
    this._frame = frame;
    this._timeoutSettings = timeoutSettings;

    this._contextPromise;
    this._contextResolveCallback = null;
    this._setContext(null);

    this._waitTasks = new Set();
    this._detached = false;
  }

  frame() {
    return this._frame;
  }

  _setContext(context: ExecutionContext) {
    this._context = context;
    if (context) {
      this._contextResolveCallback.call(null, context);
      this._contextResolveCallback = null;
      for (const waitTask of this._waitTasks)
        waitTask.rerun(context);
    } else {
      this._contextPromise = new Promise(fulfill => {
        this._contextResolveCallback = fulfill;
      });
    }
  }

  _detach() {
    this._detached = true;
    for (const waitTask of this._waitTasks)
      waitTask.terminate(new Error('waitForFunction failed: frame got detached.'));
  }

  async executionContext(): Promise<ExecutionContext> {
    if (this._detached)
      throw new Error(`Execution Context is not available in detached frame "${this._frame.url()}" (are you trying to evaluate?)`);
    return this._contextPromise;
  }

  scheduleWaitTask(params: WaitTaskParams): Promise<JSHandle> {
    const task = new WaitTask(params, () => this._waitTasks.delete(task));
    this._waitTasks.add(task);
    if (this._context)
      task.rerun(this._context);
    return task.promise;
  }
}
