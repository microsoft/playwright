"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Dispatcher = void 0;
var _ipc = require("../common/ipc");
var _utils = require("playwright-core/lib/utils");
var _workerHost = require("./workerHost");
var _utilsBundle = require("playwright-core/lib/utilsBundle");
/**
 * Copyright Microsoft Corporation. All rights reserved.
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

class Dispatcher {
  constructor(config, reporter, failureTracker) {
    this._workerSlots = [];
    this._queue = [];
    this._queuedOrRunningHashCount = new Map();
    this._finished = new _utils.ManualPromise();
    this._isStopped = true;
    this._config = void 0;
    this._reporter = void 0;
    this._failureTracker = void 0;
    this._extraEnvByProjectId = new Map();
    this._producedEnvByProjectId = new Map();
    this._config = config;
    this._reporter = reporter;
    this._failureTracker = failureTracker;
  }
  async _scheduleJob() {
    // 1. Find a job to run.
    if (this._isStopped || !this._queue.length) return;
    const job = this._queue[0];

    // 2. Find a worker with the same hash, or just some free worker.
    let index = this._workerSlots.findIndex(w => !w.busy && w.worker && w.worker.hash() === job.workerHash && !w.worker.didSendStop());
    if (index === -1) index = this._workerSlots.findIndex(w => !w.busy);
    // No workers available, bail out.
    if (index === -1) return;

    // 3. Claim both the job and the worker, run the job and release the worker.
    this._queue.shift();
    this._workerSlots[index].busy = true;
    await this._startJobInWorker(index, job);
    this._workerSlots[index].busy = false;

    // 4. Check the "finished" condition.
    this._checkFinished();

    // 5. We got a free worker - perhaps we can immediately start another job?
    void this._scheduleJob();
  }
  async _startJobInWorker(index, job) {
    const stopCallback = () => this.stop().catch(() => {});
    const jobDispatcher = new JobDispatcher(job, this._reporter, this._failureTracker, stopCallback);
    if (jobDispatcher.skipWholeJob()) return;
    let worker = this._workerSlots[index].worker;

    // 1. Restart the worker if it has the wrong hash or is being stopped already.
    if (worker && (worker.hash() !== job.workerHash || worker.didSendStop())) {
      await worker.stop();
      worker = undefined;
      if (this._isStopped)
        // Check stopped signal after async hop.
        return;
    }
    this._workerSlots[index].jobDispatcher = jobDispatcher;

    // 2. Start the worker if it is down.
    let startError;
    if (!worker) {
      worker = this._createWorker(job, index, (0, _ipc.serializeConfig)(this._config, true));
      this._workerSlots[index].worker = worker;
      worker.on('exit', () => this._workerSlots[index].worker = undefined);
      startError = await worker.start();
      if (this._isStopped)
        // Check stopped signal after async hop.
        return;
    }

    // 3. Run the job.
    if (startError) jobDispatcher.onExit(startError);else jobDispatcher.runInWorker(worker);
    const result = await jobDispatcher.jobResult;
    this._workerSlots[index].jobDispatcher = undefined;
    this._updateCounterForWorkerHash(job.workerHash, -1);

    // 4. When worker encounters error, we stop it and create a new one.
    //    We also do not keep the worker alive if it cannot serve any more jobs.
    if (result.didFail) void worker.stop(true /* didFail */);else if (this._isWorkerRedundant(worker)) void worker.stop();

    // 5. Possibly schedule a new job with leftover tests and/or retries.
    if (!this._isStopped && result.newJob) {
      this._queue.unshift(result.newJob);
      this._updateCounterForWorkerHash(job.workerHash, +1);
    }
  }
  _checkFinished() {
    if (this._finished.isDone()) return;

    // Check that we have no more work to do.
    if (this._queue.length && !this._isStopped) return;

    // Make sure all workers have finished the current job.
    if (this._workerSlots.some(w => w.busy)) return;
    this._finished.resolve();
  }
  _isWorkerRedundant(worker) {
    let workersWithSameHash = 0;
    for (const slot of this._workerSlots) {
      if (slot.worker && !slot.worker.didSendStop() && slot.worker.hash() === worker.hash()) workersWithSameHash++;
    }
    return workersWithSameHash > this._queuedOrRunningHashCount.get(worker.hash());
  }
  _updateCounterForWorkerHash(hash, delta) {
    this._queuedOrRunningHashCount.set(hash, delta + (this._queuedOrRunningHashCount.get(hash) || 0));
  }
  async run(testGroups, extraEnvByProjectId) {
    this._extraEnvByProjectId = extraEnvByProjectId;
    this._queue = testGroups;
    for (const group of testGroups) this._updateCounterForWorkerHash(group.workerHash, +1);
    this._isStopped = false;
    this._workerSlots = [];
    // 0. Stop right away if we have reached max failures.
    if (this._failureTracker.hasReachedMaxFailures()) void this.stop();
    // 1. Allocate workers.
    for (let i = 0; i < this._config.config.workers; i++) this._workerSlots.push({
      busy: false
    });
    // 2. Schedule enough jobs.
    for (let i = 0; i < this._workerSlots.length; i++) void this._scheduleJob();
    this._checkFinished();
    // 3. More jobs are scheduled when the worker becomes free.
    // 4. Wait for all jobs to finish.
    await this._finished;
  }
  _createWorker(testGroup, parallelIndex, loaderData) {
    const projectConfig = this._config.projects.find(p => p.id === testGroup.projectId);
    const outputDir = projectConfig.project.outputDir;
    const worker = new _workerHost.WorkerHost(testGroup, parallelIndex, loaderData, this._extraEnvByProjectId.get(testGroup.projectId) || {}, outputDir);
    const handleOutput = params => {
      var _this$_workerSlots$pa;
      const chunk = chunkFromParams(params);
      if (worker.didFail()) {
        // Note: we keep reading stdio from workers that are currently stopping after failure,
        // to debug teardown issues. However, we avoid spoiling the test result from
        // the next retry.
        return {
          chunk
        };
      }
      const currentlyRunning = (_this$_workerSlots$pa = this._workerSlots[parallelIndex].jobDispatcher) === null || _this$_workerSlots$pa === void 0 ? void 0 : _this$_workerSlots$pa.currentlyRunning();
      if (!currentlyRunning) return {
        chunk
      };
      return {
        chunk,
        test: currentlyRunning.test,
        result: currentlyRunning.result
      };
    };
    worker.on('stdOut', params => {
      const {
        chunk,
        test,
        result
      } = handleOutput(params);
      result === null || result === void 0 || result.stdout.push(chunk);
      this._reporter.onStdOut(chunk, test, result);
    });
    worker.on('stdErr', params => {
      const {
        chunk,
        test,
        result
      } = handleOutput(params);
      result === null || result === void 0 || result.stderr.push(chunk);
      this._reporter.onStdErr(chunk, test, result);
    });
    worker.on('teardownErrors', params => {
      this._failureTracker.onWorkerError();
      for (const error of params.fatalErrors) this._reporter.onError(error);
    });
    worker.on('exit', () => {
      const producedEnv = this._producedEnvByProjectId.get(testGroup.projectId) || {};
      this._producedEnvByProjectId.set(testGroup.projectId, {
        ...producedEnv,
        ...worker.producedEnv()
      });
    });
    return worker;
  }
  producedEnvByProjectId() {
    return this._producedEnvByProjectId;
  }
  async stop() {
    if (this._isStopped) return;
    this._isStopped = true;
    await Promise.all(this._workerSlots.map(({
      worker
    }) => worker === null || worker === void 0 ? void 0 : worker.stop()));
    this._checkFinished();
  }
}
exports.Dispatcher = Dispatcher;
class JobDispatcher {
  constructor(_job, _reporter, _failureTracker, _stopCallback) {
    this.jobResult = new _utils.ManualPromise();
    this._listeners = [];
    this._failedTests = new Set();
    this._failedWithNonRetriableError = new Set();
    this._remainingByTestId = new Map();
    this._dataByTestId = new Map();
    this._parallelIndex = 0;
    this._workerIndex = 0;
    this._currentlyRunning = void 0;
    this._job = _job;
    this._reporter = _reporter;
    this._failureTracker = _failureTracker;
    this._stopCallback = _stopCallback;
    this._remainingByTestId = new Map(this._job.tests.map(e => [e.id, e]));
  }
  _onTestBegin(params) {
    const test = this._remainingByTestId.get(params.testId);
    if (!test) {
      // TODO: this should never be the case, report an internal error?
      return;
    }
    const result = test._appendTestResult();
    this._dataByTestId.set(test.id, {
      test,
      result,
      steps: new Map()
    });
    result.parallelIndex = this._parallelIndex;
    result.workerIndex = this._workerIndex;
    result.startTime = new Date(params.startWallTime);
    this._reporter.onTestBegin(test, result);
    this._currentlyRunning = {
      test,
      result
    };
  }
  _onTestEnd(params) {
    if (this._failureTracker.hasReachedMaxFailures()) {
      // Do not show more than one error to avoid confusion, but report
      // as interrupted to indicate that we did actually start the test.
      params.status = 'interrupted';
      params.errors = [];
    }
    const data = this._dataByTestId.get(params.testId);
    if (!data) {
      // TODO: this should never be the case, report an internal error?
      return;
    }
    this._dataByTestId.delete(params.testId);
    this._remainingByTestId.delete(params.testId);
    const {
      result,
      test
    } = data;
    result.duration = params.duration;
    result.errors = params.errors;
    result.error = result.errors[0];
    result.status = params.status;
    test.expectedStatus = params.expectedStatus;
    test.annotations = params.annotations;
    test.timeout = params.timeout;
    const isFailure = result.status !== 'skipped' && result.status !== test.expectedStatus;
    if (isFailure) this._failedTests.add(test);
    if (params.hasNonRetriableError) this._addNonretriableTestAndSerialModeParents(test);
    this._reportTestEnd(test, result);
    this._currentlyRunning = undefined;
  }
  _addNonretriableTestAndSerialModeParents(test) {
    this._failedWithNonRetriableError.add(test);
    for (let parent = test.parent; parent; parent = parent.parent) {
      if (parent._parallelMode === 'serial') this._failedWithNonRetriableError.add(parent);
    }
  }
  _onStepBegin(params) {
    const data = this._dataByTestId.get(params.testId);
    if (!data) {
      // The test has finished, but steps are still coming. Just ignore them.
      return;
    }
    const {
      result,
      steps,
      test
    } = data;
    const parentStep = params.parentStepId ? steps.get(params.parentStepId) : undefined;
    const step = {
      title: params.title,
      titlePath: () => {
        const parentPath = (parentStep === null || parentStep === void 0 ? void 0 : parentStep.titlePath()) || [];
        return [...parentPath, params.title];
      },
      parent: parentStep,
      category: params.category,
      startTime: new Date(params.wallTime),
      duration: -1,
      steps: [],
      location: params.location
    };
    steps.set(params.stepId, step);
    (parentStep || result).steps.push(step);
    this._reporter.onStepBegin(test, result, step);
  }
  _onStepEnd(params) {
    const data = this._dataByTestId.get(params.testId);
    if (!data) {
      // The test has finished, but steps are still coming. Just ignore them.
      return;
    }
    const {
      result,
      steps,
      test
    } = data;
    const step = steps.get(params.stepId);
    if (!step) {
      this._reporter.onStdErr('Internal error: step end without step begin: ' + params.stepId, test, result);
      return;
    }
    step.duration = params.wallTime - step.startTime.getTime();
    if (params.error) step.error = params.error;
    steps.delete(params.stepId);
    this._reporter.onStepEnd(test, result, step);
  }
  _onAttach(params) {
    const data = this._dataByTestId.get(params.testId);
    if (!data) {
      // The test has finished, but attachments are still coming. Just ignore them.
      return;
    }
    const attachment = {
      name: params.name,
      path: params.path,
      contentType: params.contentType,
      body: params.body !== undefined ? Buffer.from(params.body, 'base64') : undefined
    };
    data.result.attachments.push(attachment);
  }
  _failTestWithErrors(test, errors) {
    const runData = this._dataByTestId.get(test.id);
    // There might be a single test that has started but has not finished yet.
    let result;
    if (runData) {
      result = runData.result;
    } else {
      result = test._appendTestResult();
      this._reporter.onTestBegin(test, result);
    }
    result.errors = [...errors];
    result.error = result.errors[0];
    result.status = errors.length ? 'failed' : 'skipped';
    this._reportTestEnd(test, result);
    this._failedTests.add(test);
  }
  _massSkipTestsFromRemaining(testIds, errors) {
    for (const test of this._remainingByTestId.values()) {
      if (!testIds.has(test.id)) continue;
      if (!this._failureTracker.hasReachedMaxFailures()) {
        this._failTestWithErrors(test, errors);
        errors = []; // Only report errors for the first test.
      }
      this._remainingByTestId.delete(test.id);
    }
    if (errors.length) {
      // We had fatal errors after all tests have passed - most likely in some teardown.
      // Let's just fail the test run.
      this._failureTracker.onWorkerError();
      for (const error of errors) this._reporter.onError(error);
    }
  }
  _onDone(params) {
    // We won't file remaining if:
    // - there are no remaining
    // - we are here not because something failed
    // - no unrecoverable worker error
    if (!this._remainingByTestId.size && !this._failedTests.size && !params.fatalErrors.length && !params.skipTestsDueToSetupFailure.length && !params.fatalUnknownTestIds && !params.unexpectedExitError) {
      this._finished({
        didFail: false
      });
      return;
    }
    for (const testId of params.fatalUnknownTestIds || []) {
      const test = this._remainingByTestId.get(testId);
      if (test) {
        this._remainingByTestId.delete(testId);
        this._failTestWithErrors(test, [{
          message: `Test not found in the worker process. Make sure test title does not change.`
        }]);
      }
    }
    if (params.fatalErrors.length) {
      // In case of fatal errors, report first remaining test as failing with these errors,
      // and all others as skipped.
      this._massSkipTestsFromRemaining(new Set(this._remainingByTestId.keys()), params.fatalErrors);
    }
    // Handle tests that should be skipped because of the setup failure.
    this._massSkipTestsFromRemaining(new Set(params.skipTestsDueToSetupFailure), []);
    if (params.unexpectedExitError) {
      // When worker exits during a test, we blame the test itself.
      //
      // The most common situation when worker exits while not running a test is:
      //   worker failed to require the test file (at the start) because of an exception in one of imports.
      // In this case, "skip" all remaining tests, to avoid running into the same exception over and over.
      if (this._currentlyRunning) this._massSkipTestsFromRemaining(new Set([this._currentlyRunning.test.id]), [params.unexpectedExitError]);else this._massSkipTestsFromRemaining(new Set(this._remainingByTestId.keys()), [params.unexpectedExitError]);
    }
    const retryCandidates = new Set();
    const serialSuitesWithFailures = new Set();
    for (const failedTest of this._failedTests) {
      if (this._failedWithNonRetriableError.has(failedTest)) continue;
      retryCandidates.add(failedTest);
      let outermostSerialSuite;
      for (let parent = failedTest.parent; parent; parent = parent.parent) {
        if (parent._parallelMode === 'serial') outermostSerialSuite = parent;
      }
      if (outermostSerialSuite && !this._failedWithNonRetriableError.has(outermostSerialSuite)) serialSuitesWithFailures.add(outermostSerialSuite);
    }

    // If we have failed tests that belong to a serial suite,
    // we should skip all future tests from the same serial suite.
    const testsBelongingToSomeSerialSuiteWithFailures = [...this._remainingByTestId.values()].filter(test => {
      let parent = test.parent;
      while (parent && !serialSuitesWithFailures.has(parent)) parent = parent.parent;
      return !!parent;
    });
    this._massSkipTestsFromRemaining(new Set(testsBelongingToSomeSerialSuiteWithFailures.map(test => test.id)), []);
    for (const serialSuite of serialSuitesWithFailures) {
      // Add all tests from failed serial suites for possible retry.
      // These will only be retried together, because they have the same
      // "retries" setting and the same number of previous runs.
      serialSuite.allTests().forEach(test => retryCandidates.add(test));
    }
    const remaining = [...this._remainingByTestId.values()];
    for (const test of retryCandidates) {
      if (test.results.length < test.retries + 1) remaining.push(test);
    }

    // This job is over, we will schedule another one.
    const newJob = remaining.length ? {
      ...this._job,
      tests: remaining
    } : undefined;
    this._finished({
      didFail: true,
      newJob
    });
  }
  onExit(data) {
    const unexpectedExitError = data.unexpectedly ? {
      message: `Error: worker process exited unexpectedly (code=${data.code}, signal=${data.signal})`
    } : undefined;
    this._onDone({
      skipTestsDueToSetupFailure: [],
      fatalErrors: [],
      unexpectedExitError
    });
  }
  _finished(result) {
    _utils.eventsHelper.removeEventListeners(this._listeners);
    this.jobResult.resolve(result);
  }
  runInWorker(worker) {
    this._parallelIndex = worker.parallelIndex;
    this._workerIndex = worker.workerIndex;
    const runPayload = {
      file: this._job.requireFile,
      entries: this._job.tests.map(test => {
        return {
          testId: test.id,
          retry: test.results.length
        };
      })
    };
    worker.runTestGroup(runPayload);
    this._listeners = [_utils.eventsHelper.addEventListener(worker, 'testBegin', this._onTestBegin.bind(this)), _utils.eventsHelper.addEventListener(worker, 'testEnd', this._onTestEnd.bind(this)), _utils.eventsHelper.addEventListener(worker, 'stepBegin', this._onStepBegin.bind(this)), _utils.eventsHelper.addEventListener(worker, 'stepEnd', this._onStepEnd.bind(this)), _utils.eventsHelper.addEventListener(worker, 'attach', this._onAttach.bind(this)), _utils.eventsHelper.addEventListener(worker, 'done', this._onDone.bind(this)), _utils.eventsHelper.addEventListener(worker, 'exit', this.onExit.bind(this))];
  }
  skipWholeJob() {
    // If all the tests in a group are skipped, we report them immediately
    // without sending anything to a worker. This avoids creating unnecessary worker processes.
    //
    // However, if there is at least one non-skipped test in a group, we'll send
    // the whole group to the worker process and report tests in the natural order,
    // with skipped tests mixed in-between non-skipped. This makes
    // for a better reporter experience.
    const allTestsSkipped = this._job.tests.every(test => test.expectedStatus === 'skipped');
    if (allTestsSkipped && !this._failureTracker.hasReachedMaxFailures()) {
      for (const test of this._job.tests) {
        const result = test._appendTestResult();
        this._reporter.onTestBegin(test, result);
        result.status = 'skipped';
        this._reportTestEnd(test, result);
      }
      return true;
    }
    return false;
  }
  currentlyRunning() {
    return this._currentlyRunning;
  }
  _reportTestEnd(test, result) {
    this._reporter.onTestEnd(test, result);
    const hadMaxFailures = this._failureTracker.hasReachedMaxFailures();
    this._failureTracker.onTestEnd(test, result);
    if (this._failureTracker.hasReachedMaxFailures()) {
      this._stopCallback();
      if (!hadMaxFailures) this._reporter.onError({
        message: _utilsBundle.colors.red(`Testing stopped early after ${this._failureTracker.maxFailures()} maximum allowed failures.`)
      });
    }
  }
}
function chunkFromParams(params) {
  if (typeof params.text === 'string') return params.text;
  return Buffer.from(params.buffer, 'base64');
}