"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TaskRunner = void 0;
var _utilsBundle = require("playwright-core/lib/utilsBundle");
var _utils = require("playwright-core/lib/utils");
var _sigIntWatcher = require("./sigIntWatcher");
var _util = require("../util");
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

class TaskRunner {
  constructor(reporter, globalTimeoutForError) {
    this._tasks = [];
    this._reporter = void 0;
    this._hasErrors = false;
    this._interrupted = false;
    this._isTearDown = false;
    this._globalTimeoutForError = void 0;
    this._reporter = reporter;
    this._globalTimeoutForError = globalTimeoutForError;
  }
  addTask(name, task) {
    this._tasks.push({
      name,
      task
    });
  }
  async run(context, deadline, cancelPromise) {
    const {
      status,
      cleanup
    } = await this.runDeferCleanup(context, deadline, cancelPromise);
    const teardownStatus = await cleanup();
    return status === 'passed' ? teardownStatus : status;
  }
  async runDeferCleanup(context, deadline, cancelPromise = new _utils.ManualPromise()) {
    const sigintWatcher = new _sigIntWatcher.SigIntWatcher();
    const timeoutWatcher = new TimeoutWatcher(deadline);
    const teardownRunner = new TaskRunner(this._reporter, this._globalTimeoutForError);
    teardownRunner._isTearDown = true;
    let currentTaskName;
    const taskLoop = async () => {
      for (const {
        name,
        task
      } of this._tasks) {
        currentTaskName = name;
        if (this._interrupted) break;
        (0, _utilsBundle.debug)('pw:test:task')(`"${name}" started`);
        const errors = [];
        const softErrors = [];
        try {
          var _task$setup;
          teardownRunner._tasks.unshift({
            name: `teardown for ${name}`,
            task: {
              setup: task.teardown
            }
          });
          await ((_task$setup = task.setup) === null || _task$setup === void 0 ? void 0 : _task$setup.call(task, context, errors, softErrors));
        } catch (e) {
          (0, _utilsBundle.debug)('pw:test:task')(`error in "${name}": `, e);
          errors.push((0, _util.serializeError)(e));
        } finally {
          for (const error of [...softErrors, ...errors]) {
            var _this$_reporter$onErr, _this$_reporter;
            (_this$_reporter$onErr = (_this$_reporter = this._reporter).onError) === null || _this$_reporter$onErr === void 0 || _this$_reporter$onErr.call(_this$_reporter, error);
          }
          if (errors.length) {
            if (!this._isTearDown) this._interrupted = true;
            this._hasErrors = true;
          }
        }
        (0, _utilsBundle.debug)('pw:test:task')(`"${name}" finished`);
      }
    };
    await Promise.race([taskLoop(), cancelPromise, sigintWatcher.promise(), timeoutWatcher.promise]);
    sigintWatcher.disarm();
    timeoutWatcher.disarm();

    // Prevent subsequent tasks from running.
    this._interrupted = true;
    let status = 'passed';
    if (sigintWatcher.hadSignal() || cancelPromise !== null && cancelPromise !== void 0 && cancelPromise.isDone()) {
      status = 'interrupted';
    } else if (timeoutWatcher.timedOut()) {
      var _this$_reporter$onErr2, _this$_reporter2;
      (_this$_reporter$onErr2 = (_this$_reporter2 = this._reporter).onError) === null || _this$_reporter$onErr2 === void 0 || _this$_reporter$onErr2.call(_this$_reporter2, {
        message: _utilsBundle.colors.red(`Timed out waiting ${this._globalTimeoutForError / 1000}s for the ${currentTaskName} to run`)
      });
      status = 'timedout';
    } else if (this._hasErrors) {
      status = 'failed';
    }
    cancelPromise === null || cancelPromise === void 0 || cancelPromise.resolve();
    // Note that upon hitting deadline, we "run cleanup", but it exits immediately
    // because of the same deadline. Essentially, we're not performing any cleanup.
    const cleanup = () => teardownRunner.runDeferCleanup(context, deadline).then(r => r.status);
    return {
      status,
      cleanup
    };
  }
}
exports.TaskRunner = TaskRunner;
class TimeoutWatcher {
  constructor(deadline) {
    this._timedOut = false;
    this.promise = new _utils.ManualPromise();
    this._timer = void 0;
    if (!deadline) return;
    if (deadline - (0, _utils.monotonicTime)() <= 0) {
      this._timedOut = true;
      this.promise.resolve();
      return;
    }
    this._timer = setTimeout(() => {
      this._timedOut = true;
      this.promise.resolve();
    }, deadline - (0, _utils.monotonicTime)());
  }
  timedOut() {
    return this._timedOut;
  }
  disarm() {
    clearTimeout(this._timer);
  }
}