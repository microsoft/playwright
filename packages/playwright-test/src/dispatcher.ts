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
import { RunPayload, TestBeginPayload, TestEndPayload, DonePayload, TestOutputPayload, WorkerInitParams, StepBeginPayload, StepEndPayload } from './ipc';
import type { TestResult, Reporter, TestStep } from '../types/testReporter';
import { Suite, TestCase } from './test';
import { Loader } from './loader';

export type TestGroup = {
  workerHash: string;
  requireFile: string;
  repeatEachIndex: number;
  projectIndex: number;
  tests: TestCase[];
};

export class Dispatcher {
  private _workers = new Set<Worker>();
  private _freeWorkers: Worker[] = [];
  private _workerClaimers: (() => void)[] = [];

  private _testById = new Map<string, { test: TestCase, result: TestResult, steps: Map<string, TestStep>, stepStack: Set<TestStep> }>();
  private _queue: TestGroup[] = [];
  private _stopCallback = () => {};
  readonly _loader: Loader;
  private _reporter: Reporter;
  private _hasWorkerErrors = false;
  private _isStopped = false;
  private _failureCount = 0;

  constructor(loader: Loader, testGroups: TestGroup[], reporter: Reporter) {
    this._loader = loader;
    this._reporter = reporter;
    this._queue = testGroups;
    for (const group of testGroups) {
      for (const test of group.tests) {
        const result = test._appendTestResult();
        // When changing this line, change the one in retry too.
        this._testById.set(test._id, { test, result, steps: new Map(), stepStack: new Set() });
      }
    }
  }

  async run() {
    // Loop in case job schedules more jobs
    while (this._queue.length && !this._isStopped)
      await this._dispatchQueue();
  }

  async _dispatchQueue() {
    const jobs = [];
    while (this._queue.length) {
      if (this._isStopped)
        break;
      const testGroup = this._queue.shift()!;
      const requiredHash = testGroup.workerHash;
      let worker = await this._obtainWorker(testGroup);
      while (worker && worker.hash && worker.hash !== requiredHash) {
        worker.stop();
        worker = await this._obtainWorker(testGroup);
      }
      if (this._isStopped || !worker)
        break;
      jobs.push(this._runJob(worker, testGroup));
    }
    await Promise.all(jobs);
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
    let lastStartedTestId: string | undefined;
    const failedTestIds = new Set<string>();

    const onTestBegin = (params: TestBeginPayload) => {
      lastStartedTestId = params.testId;
      if (this._hasReachedMaxFailures())
        return;
      const { test, result: testRun  } = this._testById.get(params.testId)!;
      testRun.workerIndex = params.workerIndex;
      testRun.startTime = new Date(params.startWallTime);
      this._reporter.onTestBegin?.(test, testRun);
    };
    worker.addListener('testBegin', onTestBegin);

    const onTestEnd = (params: TestEndPayload) => {
      remainingByTestId.delete(params.testId);
      if (this._hasReachedMaxFailures())
        return;
      const { test, result } = this._testById.get(params.testId)!;
      result.duration = params.duration;
      result.error = params.error;
      result.attachments = params.attachments.map(a => ({
        name: a.name,
        path: a.path,
        contentType: a.contentType,
        body: a.body ? Buffer.from(a.body, 'base64') : undefined
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
      const { test, result, steps, stepStack } = this._testById.get(params.testId)!;
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
        duration: 0,
        steps: [],
        location: params.location,
        data: {},
      };
      steps.set(params.stepId, step);
      (parentStep || result).steps.push(step);
      if (params.canHaveChildren)
        stepStack.add(step);
      this._reporter.onStepBegin?.(test, result, step);
    };
    worker.on('stepBegin', onStepBegin);

    const onStepEnd = (params: StepEndPayload) => {
      const { test, result, steps, stepStack } = this._testById.get(params.testId)!;
      const step = steps.get(params.stepId);
      if (!step) {
        this._reporter.onStdErr?.('Internal error: step end without step begin: ' + params.stepId, test, result);
        return;
      }
      step.duration = params.wallTime - step.startTime.getTime();
      if (params.error)
        step.error = params.error;
      stepStack.delete(step);
      steps.delete(params.stepId);
      this._reporter.onStepEnd?.(test, result, step);
    };
    worker.on('stepEnd', onStepEnd);

    const onDone = (params: DonePayload) => {
      let remaining = [...remainingByTestId.values()];

      // We won't file remaining if:
      // - there are no remaining
      // - we are here not because something failed
      // - no unrecoverable worker error
      if (!remaining.length && !failedTestIds.size && !params.fatalError) {
        this._freeWorkers.push(worker);
        this._notifyWorkerClaimer();
        doneWithJob();
        return;
      }

      // When worker encounters error, we will stop it and create a new one.
      worker.stop();
      worker.didFail = true;

      // In case of fatal error, report first remaining test as failing with this error,
      // and all others as skipped.
      if (params.fatalError) {
        let first = true;
        for (const test of remaining) {
          const { result } = this._testById.get(test._id)!;
          if (this._hasReachedMaxFailures())
            break;
          // There might be a single test that has started but has not finished yet.
          if (test._id !== lastStartedTestId)
            this._reporter.onTestBegin?.(test, result);
          result.error = params.fatalError;
          result.status = first ? 'failed' : 'skipped';
          this._reportTestEnd(test, result);
          failedTestIds.add(test._id);
          first = false;
        }
        if (first) {
          // We had a fatal error after all tests have passed - most likely in the afterAll hook.
          // Let's just fail the test run.
          this._hasWorkerErrors = true;
          this._reporter.onError?.(params.fatalError);
        }
        // Since we pretend that all remaining tests failed, there is nothing else to run,
        // except for possible retries.
        remaining = [];
      }

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
        const { result } = this._testById.get(test._id)!;
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
        if (!this._isStopped && pair.test.results.length < pair.test.retries + 1) {
          pair.result = pair.test._appendTestResult();
          pair.steps = new Map();
          pair.stepStack = new Set();
          remaining.push(pair.test);
        }
      }

      if (remaining.length)
        this._queue.unshift({ ...testGroup, tests: remaining });

      // This job is over, we just scheduled another one.
      doneWithJob();
    };
    worker.on('done', onDone);

    const onExit = () => {
      if (worker.didSendStop)
        onDone({});
      else
        onDone({ fatalError: { value: 'Worker process exited unexpectedly' } });
    };
    worker.on('exit', onExit);

    return result;
  }

  async _obtainWorker(testGroup: TestGroup) {
    const claimWorker = (): Promise<Worker> | null => {
      if (this._isStopped)
        return null;
      // Use available worker.
      if (this._freeWorkers.length)
        return Promise.resolve(this._freeWorkers.pop()!);
      // Create a new worker.
      if (this._workers.size < this._loader.fullConfig().workers)
        return this._createWorker(testGroup);
      return null;
    };

    // Note: it is important to claim the worker synchronously,
    // so that we won't miss a _notifyWorkerClaimer call while awaiting.
    let worker = claimWorker();
    if (!worker) {
      // Wait for available or stopped worker.
      await new Promise<void>(f => this._workerClaimers.push(f));
      worker = claimWorker();
    }
    return worker;
  }

  async _notifyWorkerClaimer() {
    if (this._isStopped || !this._workerClaimers.length)
      return;
    const callback = this._workerClaimers.shift()!;
    callback();
  }

  _createWorker(testGroup: TestGroup) {
    const worker = new Worker(this);
    worker.on('stdOut', (params: TestOutputPayload) => {
      const chunk = chunkFromParams(params);
      if (worker.didFail) {
        // Note: we keep reading stdout from workers that are currently stopping after failure,
        // to debug teardown issues. However, we avoid spoiling the test result from
        // the next retry.
        this._reporter.onStdOut?.(chunk);
        return;
      }
      const pair = params.testId ? this._testById.get(params.testId) : undefined;
      if (pair)
        pair.result.stdout.push(chunk);
      this._reporter.onStdOut?.(chunk, pair?.test, pair?.result);
    });
    worker.on('stdErr', (params: TestOutputPayload) => {
      const chunk = chunkFromParams(params);
      if (worker.didFail) {
        // Note: we keep reading stderr from workers that are currently stopping after failure,
        // to debug teardown issues. However, we avoid spoiling the test result from
        // the next retry.
        this._reporter.onStdErr?.(chunk);
        return;
      }
      const pair = params.testId ? this._testById.get(params.testId) : undefined;
      if (pair)
        pair.result.stderr.push(chunk);
      this._reporter.onStdErr?.(chunk, pair?.test, pair?.result);
    });
    worker.on('teardownError', ({ error }) => {
      this._hasWorkerErrors = true;
      this._reporter.onError?.(error);
    });
    worker.on('exit', () => {
      this._workers.delete(worker);
      this._notifyWorkerClaimer();
      if (this._stopCallback && !this._workers.size)
        this._stopCallback();
    });
    this._workers.add(worker);
    return worker.init(testGroup).then(() => worker);
  }

  async stop() {
    this._isStopped = true;
    if (this._workers.size) {
      const result = new Promise<void>(f => this._stopCallback = f);
      for (const worker of this._workers)
        worker.stop();
      await result;
    }
    while (this._workerClaimers.length)
      this._workerClaimers.shift()!();
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
  process: child_process.ChildProcess;
  runner: Dispatcher;
  hash = '';
  index: number;
  didSendStop = false;
  didFail = false;

  constructor(runner: Dispatcher) {
    super();
    this.runner = runner;
    this.index = lastWorkerIndex++;

    this.process = child_process.fork(path.join(__dirname, 'worker.js'), {
      detached: false,
      env: {
        FORCE_COLOR: process.stdout.isTTY ? '1' : '0',
        DEBUG_COLORS: process.stdout.isTTY ? '1' : '0',
        TEST_WORKER_INDEX: String(this.index),
        ...process.env
      },
      // Can't pipe since piping slows down termination for some reason.
      stdio: ['ignore', 'ignore', process.env.PW_RUNNER_DEBUG ? 'inherit' : 'ignore', 'ipc']
    });
    this.process.on('exit', () => this.emit('exit'));
    this.process.on('error', e => {});  // do not yell at a send to dead process.
    this.process.on('message', (message: any) => {
      const { method, params } = message;
      this.emit(method, params);
    });
  }

  async init(testGroup: TestGroup) {
    this.hash = testGroup.workerHash;
    const params: WorkerInitParams = {
      workerIndex: this.index,
      repeatEachIndex: testGroup.repeatEachIndex,
      projectIndex: testGroup.projectIndex,
      loader: this.runner._loader.serialize(),
    };
    this.process.send({ method: 'init', params });
    await new Promise(f => this.process.once('message', f));  // Ready ack
  }

  run(testGroup: TestGroup) {
    const runPayload: RunPayload = {
      file: testGroup.requireFile,
      entries: testGroup.tests.map(test => {
        return { testId: test._id, retry: test.results.length - 1 };
      }),
    };
    this.process.send({ method: 'run', params: runPayload });
  }

  stop() {
    if (!this.didSendStop)
      this.process.send({ method: 'stop' });
    this.didSendStop = true;
  }
}

function chunkFromParams(params: TestOutputPayload): string | Buffer {
  if (typeof params.text === 'string')
    return params.text;
  return Buffer.from(params.buffer!, 'base64');
}
