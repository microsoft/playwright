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

import child_process from 'child_process';
import path from 'path';
import { EventEmitter } from 'events';
import type { RunPayload, TestBeginPayload, TestEndPayload, DonePayload, TestOutputPayload, WorkerInitParams, StepBeginPayload, StepEndPayload, SerializedLoaderData, TeardownErrorsPayload } from './ipc';
import type { TestResult, Reporter, TestStep, TestError } from '../types/testReporter';
import type { Suite, TestCase } from './test';
import type { Loader } from './loader';
import { ManualPromise } from 'playwright-core/lib/utils/async';

export type TestGroup = {
  workerHash: string;
  requireFile: string;
  repeatEachIndex: number;
  projectIndex: number;
  tests: TestCase[];
};

type TestResultData = {
  result: TestResult;
  steps: Map<string, TestStep>;
  stepStack: Set<TestStep>;
};
type TestData = {
  test: TestCase;
  resultByWorkerIndex: Map<number, TestResultData>;
};
export class Dispatcher {
  private _workerSlots: { busy: boolean, worker?: Worker }[] = [];
  private _queue: TestGroup[] = [];
  private _queueHashCount = new Map<string, number>();
  private _finished = new ManualPromise<void>();
  private _isStopped = false;

  private _testById = new Map<string, TestData>();
  private _loader: Loader;
  private _reporter: Reporter;
  private _hasWorkerErrors = false;
  private _failureCount = 0;

  constructor(loader: Loader, testGroups: TestGroup[], reporter: Reporter) {
    this._loader = loader;
    this._reporter = reporter;
    this._queue = testGroups;
    for (const group of testGroups) {
      this._queueHashCount.set(group.workerHash, 1 + (this._queueHashCount.get(group.workerHash) || 0));
      for (const test of group.tests)
        this._testById.set(test._id, { test, resultByWorkerIndex: new Map() });
    }
  }

  private async _scheduleJob() {
    // 1. Find a job to run.
    if (this._isStopped || !this._queue.length)
      return;
    const job = this._queue[0];

    // 2. Find a worker with the same hash, or just some free worker.
    let index = this._workerSlots.findIndex(w => !w.busy && w.worker && w.worker.hash() === job.workerHash && !w.worker.didSendStop());
    if (index === -1)
      index = this._workerSlots.findIndex(w => !w.busy);
    // No workers available, bail out.
    if (index === -1)
      return;

    // 3. Claim both the job and the worker, run the job and release the worker.
    this._queue.shift();
    this._queueHashCount.set(job.workerHash, this._queueHashCount.get(job.workerHash)! - 1);
    this._workerSlots[index].busy = true;
    await this._startJobInWorker(index, job);
    this._workerSlots[index].busy = false;

    // 4. Check the "finished" condition.
    this._checkFinished();

    // 5. We got a free worker - perhaps we can immediately start another job?
    this._scheduleJob();
  }

  private async _startJobInWorker(index: number, job: TestGroup) {
    let worker = this._workerSlots[index].worker;

    // 1. Restart the worker if it has the wrong hash or is being stopped already.
    if (worker && (worker.hash() !== job.workerHash || worker.didSendStop())) {
      await worker.stop();
      worker = undefined;
      if (this._isStopped) // Check stopped signal after async hop.
        return;
    }

    // 2. Start the worker if it is down.
    if (!worker) {
      worker = this._createWorker(job.workerHash, index);
      this._workerSlots[index].worker = worker;
      worker.on('exit', () => this._workerSlots[index].worker = undefined);
      await worker.init(job, this._loader.serialize());
      if (this._isStopped) // Check stopped signal after async hop.
        return;
    }

    // 3. Run the job.
    await this._runJob(worker, job);
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

    for (const { test } of this._testById.values()) {
      // Emulate skipped test run if we have stopped early.
      if (!test.results.length)
        test._appendTestResult().status = 'skipped';
    }
    this._finished.resolve();
  }

  private _isWorkerRedundant(worker: Worker) {
    let workersWithSameHash = 0;
    for (const slot of this._workerSlots) {
      if (slot.worker && !slot.worker.didSendStop() && slot.worker.hash() === worker.hash())
        workersWithSameHash++;
    }
    return workersWithSameHash > this._queueHashCount.get(worker.hash())!;
  }

  async run() {
    this._workerSlots = [];
    // 1. Allocate workers.
    for (let i = 0; i < this._loader.fullConfig().workers; i++)
      this._workerSlots.push({ busy: false });
    // 2. Schedule enough jobs.
    for (let i = 0; i < this._workerSlots.length; i++)
      this._scheduleJob();
    this._checkFinished();
    // 3. More jobs are scheduled when the worker becomes free, or a new job is added.
    // 4. Wait for all jobs to finish.
    await this._finished;
  }

  async _runJob(worker: Worker, testGroup: TestGroup) {
    worker.run(testGroup);

    let doneCallback = () => {};
    const result = new Promise<void>(f => doneCallback = f);
    const doneWithJob = () => {
      worker.removeListener('testBegin', onTestBegin);
      worker.removeListener('testEnd', onTestEnd);
      worker.removeListener('stepBegin', onStepBegin);
      worker.removeListener('stepEnd', onStepEnd);
      worker.removeListener('done', onDone);
      worker.removeListener('exit', onExit);
      doneCallback();
    };

    const remainingByTestId = new Map(testGroup.tests.map(e => [ e._id, e ]));
    const failedTestIds = new Set<string>();

    const onTestBegin = (params: TestBeginPayload) => {
      const data = this._testById.get(params.testId)!;
      if (this._hasReachedMaxFailures())
        return;
      const result = data.test._appendTestResult();
      data.resultByWorkerIndex.set(worker.workerIndex, { result, stepStack: new Set(), steps: new Map() });
      result.workerIndex = worker.workerIndex;
      result.startTime = new Date(params.startWallTime);
      this._reporter.onTestBegin?.(data.test, result);
    };
    worker.addListener('testBegin', onTestBegin);

    const onTestEnd = (params: TestEndPayload) => {
      remainingByTestId.delete(params.testId);
      if (this._hasReachedMaxFailures())
        return;
      const data = this._testById.get(params.testId)!;
      const test = data.test;
      const { result } = data.resultByWorkerIndex.get(worker.workerIndex)!;
      data.resultByWorkerIndex.delete(worker.workerIndex);
      result.duration = params.duration;
      result.errors = params.errors;
      result.error = result.errors[0];
      result.attachments = params.attachments.map(a => ({
        name: a.name,
        path: a.path,
        contentType: a.contentType,
        body: a.body !== undefined ? Buffer.from(a.body, 'base64') : undefined
      }));
      result.status = params.status;
      test.expectedStatus = params.expectedStatus;
      test.annotations = params.annotations;
      test.timeout = params.timeout;
      const isFailure = result.status !== 'skipped' && result.status !== test.expectedStatus;
      if (isFailure)
        failedTestIds.add(params.testId);
      this._reportTestEnd(test, result);
    };
    worker.addListener('testEnd', onTestEnd);

    const onStepBegin = (params: StepBeginPayload) => {
      const data = this._testById.get(params.testId)!;
      const runData = data.resultByWorkerIndex.get(worker.workerIndex);
      if (!runData) {
        // The test has finished, but steps are still coming. Just ignore them.
        return;
      }
      const { result, steps, stepStack } = runData;
      const parentStep = params.forceNoParent ? undefined : [...stepStack].pop();
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
        location: params.location,
      };
      steps.set(params.stepId, step);
      (parentStep || result).steps.push(step);
      if (params.canHaveChildren)
        stepStack.add(step);
      this._reporter.onStepBegin?.(data.test, result, step);
    };
    worker.on('stepBegin', onStepBegin);

    const onStepEnd = (params: StepEndPayload) => {
      const data = this._testById.get(params.testId)!;
      const runData = data.resultByWorkerIndex.get(worker.workerIndex);
      if (!runData) {
        // The test has finished, but steps are still coming. Just ignore them.
        return;
      }
      const { result, steps, stepStack } = runData;
      const step = steps.get(params.stepId);
      if (!step) {
        this._reporter.onStdErr?.('Internal error: step end without step begin: ' + params.stepId, data.test, result);
        return;
      }
      if (params.refinedTitle)
        step.title = params.refinedTitle;
      step.duration = params.wallTime - step.startTime.getTime();
      if (params.error)
        step.error = params.error;
      stepStack.delete(step);
      steps.delete(params.stepId);
      this._reporter.onStepEnd?.(data.test, result, step);
    };
    worker.on('stepEnd', onStepEnd);

    const onDone = (params: DonePayload) => {
      let remaining = [...remainingByTestId.values()];

      // We won't file remaining if:
      // - there are no remaining
      // - we are here not because something failed
      // - no unrecoverable worker error
      if (!remaining.length && !failedTestIds.size && !params.fatalErrors.length && !params.skipTestsDueToSetupFailure.length) {
        if (this._isWorkerRedundant(worker))
          worker.stop();
        doneWithJob();
        return;
      }

      // When worker encounters error, we will stop it and create a new one.
      worker.stop(true /* didFail */);

      const massSkipTestsFromRemaining = (testIds: Set<string>, errors: TestError[]) => {
        remaining = remaining.filter(test => {
          if (!testIds.has(test._id))
            return true;
          if (!this._hasReachedMaxFailures()) {
            const data = this._testById.get(test._id)!;
            const runData = data.resultByWorkerIndex.get(worker.workerIndex);
            // There might be a single test that has started but has not finished yet.
            let result: TestResult;
            if (runData) {
              result = runData.result;
            } else {
              result = data.test._appendTestResult();
              this._reporter.onTestBegin?.(test, result);
            }
            result.errors = [...errors];
            result.error = result.errors[0];
            result.status = errors.length ? 'failed' : 'skipped';
            this._reportTestEnd(test, result);
            failedTestIds.add(test._id);
            errors = []; // Only report errors for the first test.
          }
          return false;
        });
        if (errors.length) {
          // We had fatal errors after all tests have passed - most likely in some teardown.
          // Let's just fail the test run.
          this._hasWorkerErrors = true;
          for (const error of params.fatalErrors)
            this._reporter.onError?.(error);
        }
      };

      if (params.fatalErrors.length) {
        // In case of fatal errors, report first remaining test as failing with these errors,
        // and all others as skipped.
        massSkipTestsFromRemaining(new Set(remaining.map(test => test._id)), params.fatalErrors);
      }
      // Handle tests that should be skipped because of the setup failure.
      massSkipTestsFromRemaining(new Set(params.skipTestsDueToSetupFailure), []);

      const retryCandidates = new Set<string>();
      const serialSuitesWithFailures = new Set<Suite>();

      for (const failedTestId of failedTestIds) {
        retryCandidates.add(failedTestId);

        let outermostSerialSuite: Suite | undefined;
        for (let parent: Suite | undefined = this._testById.get(failedTestId)!.test.parent; parent; parent = parent.parent) {
          if (parent._parallelMode ===  'serial')
            outermostSerialSuite = parent;
        }
        if (outermostSerialSuite)
          serialSuitesWithFailures.add(outermostSerialSuite);
      }

      // We have failed tests that belong to a serial suite.
      // We should skip all future tests from the same serial suite.
      remaining = remaining.filter(test => {
        let parent: Suite | undefined = test.parent;
        while (parent && !serialSuitesWithFailures.has(parent))
          parent = parent.parent;

        // Does not belong to the failed serial suite, keep it.
        if (!parent)
          return true;

        // Emulate a "skipped" run, and drop this test from remaining.
        const result = test._appendTestResult();
        this._reporter.onTestBegin?.(test, result);
        result.status = 'skipped';
        this._reportTestEnd(test, result);
        return false;
      });

      for (const serialSuite of serialSuitesWithFailures) {
        // Add all tests from faiiled serial suites for possible retry.
        // These will only be retried together, because they have the same
        // "retries" setting and the same number of previous runs.
        serialSuite.allTests().forEach(test => retryCandidates.add(test._id));
      }

      for (const testId of retryCandidates) {
        const pair = this._testById.get(testId)!;
        if (!this._isStopped && pair.test.results.length < pair.test.retries + 1)
          remaining.push(pair.test);
      }

      if (remaining.length) {
        this._queue.unshift({ ...testGroup, tests: remaining });
        this._queueHashCount.set(testGroup.workerHash, this._queueHashCount.get(testGroup.workerHash)! + 1);
        // Perhaps we can immediately start the new job if there is a worker available?
        this._scheduleJob();
      }

      // This job is over, we just scheduled another one.
      doneWithJob();
    };
    worker.on('done', onDone);

    const onExit = (expectedly: boolean) => {
      onDone({ skipTestsDueToSetupFailure: [], fatalErrors: expectedly ? [] : [{ value: 'Worker process exited unexpectedly' }] });
    };
    worker.on('exit', onExit);

    return result;
  }

  _createWorker(hash: string, parallelIndex: number) {
    const worker = new Worker(hash, parallelIndex);
    const handleOutput = (params: TestOutputPayload) => {
      const chunk = chunkFromParams(params);
      if (worker.didFail()) {
        // Note: we keep reading stdio from workers that are currently stopping after failure,
        // to debug teardown issues. However, we avoid spoiling the test result from
        // the next retry.
        return { chunk };
      }
      if (!params.testId)
        return { chunk };
      const data = this._testById.get(params.testId)!;
      return { chunk, test: data.test, result: data.resultByWorkerIndex.get(worker.workerIndex)?.result };
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
      this._hasWorkerErrors = true;
      for (const error of params.fatalErrors)
        this._reporter.onError?.(error);
    });
    return worker;
  }

  async stop() {
    this._isStopped = true;
    await Promise.all(this._workerSlots.map(({ worker }) => worker?.stop()));
    this._checkFinished();
  }

  private _hasReachedMaxFailures() {
    const maxFailures = this._loader.fullConfig().maxFailures;
    return maxFailures > 0 && this._failureCount >= maxFailures;
  }

  private _reportTestEnd(test: TestCase, result: TestResult) {
    if (result.status !== 'skipped' && result.status !== test.expectedStatus)
      ++this._failureCount;
    this._reporter.onTestEnd?.(test, result);
    const maxFailures = this._loader.fullConfig().maxFailures;
    if (maxFailures && this._failureCount === maxFailures)
      this.stop().catch(e => {});
  }

  hasWorkerErrors(): boolean {
    return this._hasWorkerErrors;
  }
}

let lastWorkerIndex = 0;

class Worker extends EventEmitter {
  private process: child_process.ChildProcess;
  private _hash: string;
  private parallelIndex: number;
  readonly workerIndex: number;
  private _didSendStop = false;
  private _didFail = false;
  private didExit = false;
  private _ready: Promise<void>;

  constructor(hash: string, parallelIndex: number) {
    super();
    this.workerIndex = lastWorkerIndex++;
    this._hash = hash;
    this.parallelIndex = parallelIndex;

    this.process = child_process.fork(path.join(__dirname, 'worker.js'), {
      detached: false,
      env: {
        FORCE_COLOR: '1',
        DEBUG_COLORS: '1',
        TEST_WORKER_INDEX: String(this.workerIndex),
        TEST_PARALLEL_INDEX: String(this.parallelIndex),
        ...process.env
      },
      // Can't pipe since piping slows down termination for some reason.
      stdio: ['ignore', 'ignore', process.env.PW_RUNNER_DEBUG ? 'inherit' : 'ignore', 'ipc']
    });
    this.process.on('exit', () => {
      this.didExit = true;
      this.emit('exit', this._didSendStop /* expectedly */);
    });
    this.process.on('error', e => {});  // do not yell at a send to dead process.
    this.process.on('message', (message: any) => {
      const { method, params } = message;
      this.emit(method, params);
    });

    this._ready = new Promise((resolve, reject) => {
      this.process.once('exit', () => reject(new Error('worker exited before it became ready')));
      this.once('ready', () => resolve());
    });
  }

  async init(testGroup: TestGroup, loaderData: SerializedLoaderData) {
    await this._ready;
    const params: WorkerInitParams = {
      workerIndex: this.workerIndex,
      parallelIndex: this.parallelIndex,
      repeatEachIndex: testGroup.repeatEachIndex,
      projectIndex: testGroup.projectIndex,
      loader: loaderData,
    };
    this.send({ method: 'init', params });
  }

  run(testGroup: TestGroup) {
    const runPayload: RunPayload = {
      file: testGroup.requireFile,
      entries: testGroup.tests.map(test => {
        return { testId: test._id, retry: test.results.length };
      }),
    };
    this.send({ method: 'run', params: runPayload });
  }

  didFail() {
    return this._didFail;
  }

  didSendStop() {
    return this._didSendStop;
  }

  hash() {
    return this._hash;
  }

  async stop(didFail?: boolean) {
    if (didFail)
      this._didFail = true;
    if (this.didExit)
      return;
    if (!this._didSendStop) {
      this.send({ method: 'stop' });
      this._didSendStop = true;
    }
    await new Promise(f => this.once('exit', f));
  }

  private send(message: any) {
    // This is a great place for debug logging.
    this.process.send(message);
  }
}

function chunkFromParams(params: TestOutputPayload): string | Buffer {
  if (typeof params.text === 'string')
    return params.text;
  return Buffer.from(params.buffer!, 'base64');
}
