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

import { ManualPromise,  eventsHelper } from 'playwright-core/lib/utils';
import { colors } from 'playwright-core/lib/utils';

import { addSuggestedRebaseline } from './rebase';
import { WorkerHost } from './workerHost';
import { serializeConfig } from '../common/ipc';

import type { FailureTracker } from './failureTracker';
import type { ProcessExitData } from './processHost';
import type { TestGroup } from './testGroups';
import type { TestError, TestResult, TestStep } from '../../types/testReporter';
import type { FullConfigInternal } from '../common/config';
import type { AttachmentPayload, DonePayload, RunPayload, SerializedConfig, StepBeginPayload, StepEndPayload, TeardownErrorsPayload, TestBeginPayload, TestEndPayload, TestOutputPayload } from '../common/ipc';
import type { Suite } from '../common/test';
import type { TestCase } from '../common/test';
import type { ReporterV2 } from '../reporters/reporterV2';
import type { RegisteredListener } from 'playwright-core/lib/utils';


export type EnvByProjectId = Map<string, Record<string, string | undefined>>;

export class Dispatcher {
  private _workerSlots: { busy: boolean, worker?: WorkerHost, jobDispatcher?: JobDispatcher }[] = [];
  private _queue: TestGroup[] = [];
  private _workerLimitPerProjectId = new Map<string, number>();
  private _queuedOrRunningHashCount = new Map<string, number>();
  private _finished = new ManualPromise<void>();
  private _isStopped = true;

  private _config: FullConfigInternal;
  private _reporter: ReporterV2;
  private _failureTracker: FailureTracker;

  private _extraEnvByProjectId: EnvByProjectId = new Map();
  private _producedEnvByProjectId: EnvByProjectId = new Map();

  constructor(config: FullConfigInternal, reporter: ReporterV2, failureTracker: FailureTracker) {
    this._config = config;
    this._reporter = reporter;
    this._failureTracker = failureTracker;
    for (const project of config.projects) {
      if (project.workers)
        this._workerLimitPerProjectId.set(project.id, project.workers);
    }
  }

  private _findFirstJobToRun() {
    // Always pick the first job that can be run while respecting the project worker limit.
    for (let index = 0; index < this._queue.length; index++) {
      const job = this._queue[index];
      const projectIdWorkerLimit = this._workerLimitPerProjectId.get(job.projectId);
      if (!projectIdWorkerLimit)
        return index;
      const runningWorkersWithSameProjectId = this._workerSlots.filter(w => w.busy && w.worker && w.worker.projectId() === job.projectId).length;
      if (runningWorkersWithSameProjectId < projectIdWorkerLimit)
        return index;
    }
    return -1;
  }

  private _scheduleJob() {
    // NOTE: keep this method synchronous for easier reasoning.

    // 0. No more running jobs after stop.
    if (this._isStopped)
      return;

    // 1. Find a job to run.
    const jobIndex = this._findFirstJobToRun();
    if (jobIndex === -1)
      return;
    const job = this._queue[jobIndex];

    // 2. Find a worker with the same hash, or just some free worker.
    let workerIndex = this._workerSlots.findIndex(w => !w.busy && w.worker && w.worker.hash() === job.workerHash && !w.worker.didSendStop());
    if (workerIndex === -1)
      workerIndex = this._workerSlots.findIndex(w => !w.busy);
    if (workerIndex === -1) {
      // No workers available, bail out.
      return;
    }

    // 3. Claim both the job and the worker slot.
    this._queue.splice(jobIndex, 1);
    const jobDispatcher = new JobDispatcher(job, this._reporter, this._failureTracker, () => this.stop().catch(() => {}));
    this._workerSlots[workerIndex].busy = true;
    this._workerSlots[workerIndex].jobDispatcher = jobDispatcher;

    // 4. Run the job. This is the only async operation.
    void this._runJobInWorker(workerIndex, jobDispatcher).then(() => {

      // 5. Release the worker slot.
      this._workerSlots[workerIndex].jobDispatcher = undefined;
      this._workerSlots[workerIndex].busy = false;

      // 6. Check whether we are done or should schedule another job.
      this._checkFinished();
      this._scheduleJob();
    });
  }

  private async _runJobInWorker(index: number, jobDispatcher: JobDispatcher) {
    const job = jobDispatcher.job;

    // 0. Perhaps skip the whole job?
    if (jobDispatcher.skipWholeJob())
      return;

    let worker = this._workerSlots[index].worker;

    // 1. Restart the worker if it has the wrong hash or is being stopped already.
    if (worker && (worker.hash() !== job.workerHash || worker.didSendStop())) {
      await worker.stop();
      worker = undefined;
      if (this._isStopped) // Check stopped signal after async hop.
        return;
    }

    // 2. Start the worker if it is down.
    let startError;
    if (!worker) {
      worker = this._createWorker(job, index, serializeConfig(this._config, true));
      this._workerSlots[index].worker = worker;
      worker.on('exit', () => this._workerSlots[index].worker = undefined);
      startError = await worker.start();
      if (this._isStopped) // Check stopped signal after async hop.
        return;
    }

    // 3. Finally, run some tests in the worker! Or fail all of them because of startup error...
    if (startError)
      jobDispatcher.onExit(startError);
    else
      jobDispatcher.runInWorker(worker);
    const result = await jobDispatcher.jobResult;
    this._updateCounterForWorkerHash(job.workerHash, -1);

    // 4. When worker encounters error, we stop it and create a new one.
    //    We also do not keep the worker alive if it cannot serve any more jobs.
    if (result.didFail)
      void worker.stop(true /* didFail */);
    else if (this._isWorkerRedundant(worker))
      void worker.stop();

    // 5. Possibly queue a new job with leftover tests and/or retries.
    if (!this._isStopped && result.newJob) {
      this._queue.unshift(result.newJob);
      this._updateCounterForWorkerHash(result.newJob.workerHash, +1);
    }
  }

  private _checkFinished() {
    if (this._finished.isDone())
      return;

    // Check that we have no more work to do.
    if (this._queue.length && !this._isStopped)
      return;

    // Make sure all workers have finished the current job.
    if (this._workerSlots.some(w => w.busy))
      return;

    this._finished.resolve();
  }

  private _isWorkerRedundant(worker: WorkerHost) {
    let workersWithSameHash = 0;
    for (const slot of this._workerSlots) {
      if (slot.worker && !slot.worker.didSendStop() && slot.worker.hash() === worker.hash())
        workersWithSameHash++;
    }
    return workersWithSameHash > this._queuedOrRunningHashCount.get(worker.hash())!;
  }

  private _updateCounterForWorkerHash(hash: string, delta: number) {
    this._queuedOrRunningHashCount.set(hash, delta + (this._queuedOrRunningHashCount.get(hash) || 0));
  }

  async run(testGroups: TestGroup[], extraEnvByProjectId: EnvByProjectId) {
    this._extraEnvByProjectId = extraEnvByProjectId;
    this._queue = testGroups;
    for (const group of testGroups)
      this._updateCounterForWorkerHash(group.workerHash, +1);
    this._isStopped = false;
    this._workerSlots = [];
    // 0. Stop right away if we have reached max failures.
    if (this._failureTracker.hasReachedMaxFailures())
      void this.stop();
    // 1. Allocate workers.
    for (let i = 0; i < this._config.config.workers; i++)
      this._workerSlots.push({ busy: false });
    // 2. Schedule enough jobs.
    for (let i = 0; i < this._workerSlots.length; i++)
      this._scheduleJob();
    this._checkFinished();
    // 3. More jobs are scheduled when the worker becomes free.
    // 4. Wait for all jobs to finish.
    await this._finished;
  }

  _createWorker(testGroup: TestGroup, parallelIndex: number, loaderData: SerializedConfig) {
    const projectConfig = this._config.projects.find(p => p.id === testGroup.projectId)!;
    const outputDir = projectConfig.project.outputDir;
    const worker = new WorkerHost(testGroup, parallelIndex, loaderData, this._extraEnvByProjectId.get(testGroup.projectId) || {}, outputDir);
    const handleOutput = (params: TestOutputPayload) => {
      const chunk = chunkFromParams(params);
      if (worker.didFail()) {
        // Note: we keep reading stdio from workers that are currently stopping after failure,
        // to debug teardown issues. However, we avoid spoiling the test result from
        // the next retry.
        return { chunk };
      }
      const currentlyRunning = this._workerSlots[parallelIndex].jobDispatcher?.currentlyRunning();
      if (!currentlyRunning)
        return { chunk };
      return { chunk, test: currentlyRunning.test, result: currentlyRunning.result };
    };
    worker.on('stdOut', (params: TestOutputPayload) => {
      const { chunk, test, result } = handleOutput(params);
      result?.stdout.push(chunk);
      this._reporter.onStdOut?.(chunk, test, result);
    });
    worker.on('stdErr', (params: TestOutputPayload) => {
      const { chunk, test, result } = handleOutput(params);
      result?.stderr.push(chunk);
      this._reporter.onStdErr?.(chunk, test, result);
    });
    worker.on('teardownErrors', (params: TeardownErrorsPayload) => {
      this._failureTracker.onWorkerError();
      for (const error of params.fatalErrors)
        this._reporter.onError?.(error);
    });
    worker.on('exit', () => {
      const producedEnv = this._producedEnvByProjectId.get(testGroup.projectId) || {};
      this._producedEnvByProjectId.set(testGroup.projectId, { ...producedEnv, ...worker.producedEnv() });
    });
    return worker;
  }

  producedEnvByProjectId() {
    return this._producedEnvByProjectId;
  }

  async stop() {
    if (this._isStopped)
      return;
    this._isStopped = true;
    await Promise.all(this._workerSlots.map(({ worker }) => worker?.stop()));
    this._checkFinished();
  }
}

class JobDispatcher {
  jobResult = new ManualPromise<{ newJob?: TestGroup, didFail: boolean }>();

  readonly job: TestGroup;
  private _reporter: ReporterV2;
  private _failureTracker: FailureTracker;
  private _stopCallback: () => void;
  private _listeners: RegisteredListener[] = [];
  private _failedTests = new Set<TestCase>();
  private _failedWithNonRetriableError = new Set<TestCase|Suite>();
  private _remainingByTestId = new Map<string, TestCase>();
  private _dataByTestId = new Map<string, { test: TestCase, result: TestResult, steps: Map<string, TestStep> }>();
  private _parallelIndex = 0;
  private _workerIndex = 0;
  private _currentlyRunning: { test: TestCase, result: TestResult } | undefined;

  constructor(job: TestGroup, reporter: ReporterV2, failureTracker: FailureTracker, stopCallback: () => void) {
    this.job = job;
    this._reporter = reporter;
    this._failureTracker = failureTracker;
    this._stopCallback = stopCallback;
    this._remainingByTestId = new Map(this.job.tests.map(e => [e.id, e]));
  }

  private _onTestBegin(params: TestBeginPayload) {
    const test = this._remainingByTestId.get(params.testId);
    if (!test) {
      // TODO: this should never be the case, report an internal error?
      return;
    }
    const result = test._appendTestResult();
    this._dataByTestId.set(test.id, { test, result, steps: new Map() });
    result.parallelIndex = this._parallelIndex;
    result.workerIndex = this._workerIndex;
    result.startTime = new Date(params.startWallTime);
    this._reporter.onTestBegin?.(test, result);
    this._currentlyRunning = { test, result };
  }

  private _onTestEnd(params: TestEndPayload) {
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
    const { result, test } = data;
    result.duration = params.duration;
    result.errors = params.errors;
    result.error = result.errors[0];
    result.status = params.status;
    result.annotations = params.annotations;
    test.annotations = [...params.annotations]; // last test result wins
    test.expectedStatus = params.expectedStatus;
    test.timeout = params.timeout;
    const isFailure = result.status !== 'skipped' && result.status !== test.expectedStatus;
    if (isFailure)
      this._failedTests.add(test);
    if (params.hasNonRetriableError)
      this._addNonretriableTestAndSerialModeParents(test);
    this._reportTestEnd(test, result);
    this._currentlyRunning = undefined;
  }

  private _addNonretriableTestAndSerialModeParents(test: TestCase) {
    this._failedWithNonRetriableError.add(test);
    for (let parent: Suite | undefined = test.parent; parent; parent = parent.parent) {
      if (parent._parallelMode === 'serial')
        this._failedWithNonRetriableError.add(parent);
    }
  }

  private _onStepBegin(params: StepBeginPayload) {
    const data = this._dataByTestId.get(params.testId);
    if (!data) {
      // The test has finished, but steps are still coming. Just ignore them.
      return;
    }
    const { result, steps, test } = data;
    const parentStep = params.parentStepId ? steps.get(params.parentStepId) : undefined;
    const step: TestStep = {
      title: params.title,
      titlePath: () => {
        const parentPath = parentStep?.titlePath() || [];
        return [...parentPath, params.title];
      },
      parent: parentStep,
      category: params.category,
      startTime: new Date(params.wallTime),
      duration: -1,
      steps: [],
      attachments: [],
      annotations: [],
      location: params.location,
    };
    steps.set(params.stepId, step);
    (parentStep || result).steps.push(step);
    this._reporter.onStepBegin?.(test, result, step);
  }

  private _onStepEnd(params: StepEndPayload) {
    const data = this._dataByTestId.get(params.testId);
    if (!data) {
      // The test has finished, but steps are still coming. Just ignore them.
      return;
    }
    const { result, steps, test } = data;
    const step = steps.get(params.stepId);
    if (!step) {
      this._reporter.onStdErr?.('Internal error: step end without step begin: ' + params.stepId, test, result);
      return;
    }
    step.duration = params.wallTime - step.startTime.getTime();
    if (params.error)
      step.error = params.error;
    if (params.suggestedRebaseline)
      addSuggestedRebaseline(step.location!, params.suggestedRebaseline);
    step.annotations = params.annotations;
    steps.delete(params.stepId);
    this._reporter.onStepEnd?.(test, result, step);
  }

  private _onAttach(params: AttachmentPayload) {
    const data = this._dataByTestId.get(params.testId)!;
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
    if (params.stepId) {
      const step = data.steps.get(params.stepId);
      if (step)
        step.attachments.push(attachment);
      else
        this._reporter.onStdErr?.('Internal error: step id not found: ' + params.stepId);
    }
  }

  private _failTestWithErrors(test: TestCase, errors: TestError[]) {
    const runData = this._dataByTestId.get(test.id);
    // There might be a single test that has started but has not finished yet.
    let result: TestResult;
    if (runData) {
      result = runData.result;
    } else {
      result = test._appendTestResult();
      this._reporter.onTestBegin?.(test, result);
    }
    result.errors = [...errors];
    result.error = result.errors[0];
    result.status = errors.length ? 'failed' : 'skipped';
    this._reportTestEnd(test, result);
    this._failedTests.add(test);
  }

  private _massSkipTestsFromRemaining(testIds: Set<string>, errors: TestError[]) {
    for (const test of this._remainingByTestId.values()) {
      if (!testIds.has(test.id))
        continue;
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
      for (const error of errors)
        this._reporter.onError?.(error);
    }
  }

  private _onDone(params: DonePayload & { unexpectedExitError?: TestError }) {
    // We won't file remaining if:
    // - there are no remaining
    // - we are here not because something failed
    // - no unrecoverable worker error
    if (!this._remainingByTestId.size && !this._failedTests.size && !params.fatalErrors.length && !params.skipTestsDueToSetupFailure.length && !params.fatalUnknownTestIds && !params.unexpectedExitError) {
      this._finished({ didFail: false });
      return;
    }

    for (const testId of params.fatalUnknownTestIds || []) {
      const test = this._remainingByTestId.get(testId);
      if (test) {
        this._remainingByTestId.delete(testId);
        this._failTestWithErrors(test, [{ message: `Test not found in the worker process. Make sure test title does not change.` }]);
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
      if (this._currentlyRunning)
        this._massSkipTestsFromRemaining(new Set([this._currentlyRunning.test.id]), [params.unexpectedExitError]);
      else
        this._massSkipTestsFromRemaining(new Set(this._remainingByTestId.keys()), [params.unexpectedExitError]);
    }

    const retryCandidates = new Set<TestCase>();
    const serialSuitesWithFailures = new Set<Suite>();

    for (const failedTest of this._failedTests) {
      if (this._failedWithNonRetriableError.has(failedTest))
        continue;
      retryCandidates.add(failedTest);

      let outermostSerialSuite: Suite | undefined;
      for (let parent: Suite | undefined = failedTest.parent; parent; parent = parent.parent) {
        if (parent._parallelMode ===  'serial')
          outermostSerialSuite = parent;
      }
      if (outermostSerialSuite && !this._failedWithNonRetriableError.has(outermostSerialSuite))
        serialSuitesWithFailures.add(outermostSerialSuite);
    }

    // If we have failed tests that belong to a serial suite,
    // we should skip all future tests from the same serial suite.
    const testsBelongingToSomeSerialSuiteWithFailures = [...this._remainingByTestId.values()].filter(test => {
      let parent: Suite | undefined = test.parent;
      while (parent && !serialSuitesWithFailures.has(parent))
        parent = parent.parent;
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
      if (test.results.length < test.retries + 1)
        remaining.push(test);
    }

    // This job is over, we will schedule another one.
    const newJob = remaining.length ? { ...this.job, tests: remaining } : undefined;
    this._finished({ didFail: true, newJob });
  }

  onExit(data: ProcessExitData) {
    const unexpectedExitError: TestError | undefined = data.unexpectedly ? {
      message: `Error: worker process exited unexpectedly (code=${data.code}, signal=${data.signal})`
    } : undefined;
    this._onDone({ skipTestsDueToSetupFailure: [], fatalErrors: [], unexpectedExitError });
  }

  private _finished(result: { newJob?: TestGroup, didFail: boolean }) {
    eventsHelper.removeEventListeners(this._listeners);
    this.jobResult.resolve(result);
  }

  runInWorker(worker: WorkerHost) {
    this._parallelIndex = worker.parallelIndex;
    this._workerIndex = worker.workerIndex;

    const runPayload: RunPayload = {
      file: this.job.requireFile,
      entries: this.job.tests.map(test => {
        return { testId: test.id, retry: test.results.length };
      }),
    };
    worker.runTestGroup(runPayload);

    this._listeners = [
      eventsHelper.addEventListener(worker, 'testBegin', this._onTestBegin.bind(this)),
      eventsHelper.addEventListener(worker, 'testEnd', this._onTestEnd.bind(this)),
      eventsHelper.addEventListener(worker, 'stepBegin', this._onStepBegin.bind(this)),
      eventsHelper.addEventListener(worker, 'stepEnd', this._onStepEnd.bind(this)),
      eventsHelper.addEventListener(worker, 'attach', this._onAttach.bind(this)),
      eventsHelper.addEventListener(worker, 'done', this._onDone.bind(this)),
      eventsHelper.addEventListener(worker, 'exit', this.onExit.bind(this)),
    ];
  }

  skipWholeJob(): boolean {
    // If all the tests in a group are skipped, we report them immediately
    // without sending anything to a worker. This avoids creating unnecessary worker processes.
    //
    // However, if there is at least one non-skipped test in a group, we'll send
    // the whole group to the worker process and report tests in the natural order,
    // with skipped tests mixed in-between non-skipped. This makes
    // for a better reporter experience.
    const allTestsSkipped = this.job.tests.every(test => test.expectedStatus === 'skipped');
    if (allTestsSkipped && !this._failureTracker.hasReachedMaxFailures()) {
      for (const test of this.job.tests) {
        const result = test._appendTestResult();
        this._reporter.onTestBegin?.(test, result);
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

  private _reportTestEnd(test: TestCase, result: TestResult) {
    this._reporter.onTestEnd?.(test, result);
    const hadMaxFailures = this._failureTracker.hasReachedMaxFailures();
    this._failureTracker.onTestEnd(test, result);
    if (this._failureTracker.hasReachedMaxFailures()) {
      this._stopCallback();
      if (!hadMaxFailures)
        this._reporter.onError?.({ message: colors.red(`Testing stopped early after ${this._failureTracker.maxFailures()} maximum allowed failures.`) });
    }
  }
}

function chunkFromParams(params: TestOutputPayload): string | Buffer {
  if (typeof params.text === 'string')
    return params.text;
  return Buffer.from(params.buffer!, 'base64');
}
