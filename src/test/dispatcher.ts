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
import { RunPayload, TestBeginPayload, TestEndPayload, DonePayload, TestOutputPayload, WorkerInitParams } from './ipc';
import type { TestResult, Reporter, TestStatus } from './reporter';
import { Suite, Test } from './test';
import { Loader } from './loader';

type DispatcherEntry = {
  runPayload: RunPayload;
  hash: string;
  repeatEachIndex: number;
  projectIndex: number;
};

export class Dispatcher {
  private _workers = new Set<Worker>();
  private _freeWorkers: Worker[] = [];
  private _workerClaimers: (() => void)[] = [];

  private _testById = new Map<string, { test: Test, result: TestResult }>();
  private _queue: DispatcherEntry[] = [];
  private _stopCallback = () => {};
  readonly _loader: Loader;
  private _suite: Suite;
  private _reporter: Reporter;
  private _hasWorkerErrors = false;
  private _isStopped = false;
  private _failureCount = 0;

  constructor(loader: Loader, suite: Suite, reporter: Reporter) {
    this._loader = loader;
    this._reporter = reporter;

    this._suite = suite;
    for (const suite of this._suite.suites) {
      for (const spec of suite._allSpecs()) {
        for (const test of spec.tests)
          this._testById.set(test._id, { test, result: test._appendTestResult() });
      }
    }

    this._queue = this._filesSortedByWorkerHash();

    // Shard tests.
    const shard = this._loader.fullConfig().shard;
    if (shard) {
      let total = this._suite.totalTestCount();
      const shardSize = Math.ceil(total / shard.total);
      const from = shardSize * shard.current;
      const to = shardSize * (shard.current + 1);
      let current = 0;
      total = 0;
      const filteredQueue: DispatcherEntry[] = [];
      for (const entry of this._queue) {
        if (current >= from && current < to) {
          filteredQueue.push(entry);
          total += entry.runPayload.entries.length;
        }
        current += entry.runPayload.entries.length;
      }
      this._queue = filteredQueue;
    }
  }

  _filesSortedByWorkerHash(): DispatcherEntry[] {
    const entriesByWorkerHashAndFile = new Map<string, Map<string, DispatcherEntry>>();
    for (const fileSuite of this._suite.suites) {
      const file = fileSuite.file;
      for (const spec of fileSuite._allSpecs()) {
        for (const test of spec.tests) {
          let entriesByFile = entriesByWorkerHashAndFile.get(test._workerHash);
          if (!entriesByFile) {
            entriesByFile = new Map();
            entriesByWorkerHashAndFile.set(test._workerHash, entriesByFile);
          }
          let entry = entriesByFile.get(file);
          if (!entry) {
            entry = {
              runPayload: {
                entries: [],
                file,
              },
              repeatEachIndex: test._repeatEachIndex,
              projectIndex: test._projectIndex,
              hash: test._workerHash,
            };
            entriesByFile.set(file, entry);
          }
          entry.runPayload.entries.push({
            retry: this._testById.get(test._id)!.result.retry,
            testId: test._id,
          });
        }
      }
    }

    const result: DispatcherEntry[] = [];
    for (const entriesByFile of entriesByWorkerHashAndFile.values()) {
      for (const entry of entriesByFile.values())
        result.push(entry);
    }
    result.sort((a, b) => a.hash < b.hash ? -1 : (a.hash === b.hash ? 0 : 1));
    return result;
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
      const entry = this._queue.shift()!;
      const requiredHash = entry.hash;
      let worker = await this._obtainWorker(entry);
      while (!this._isStopped && worker.hash && worker.hash !== requiredHash) {
        worker.stop();
        worker = await this._obtainWorker(entry);
      }
      if (this._isStopped)
        break;
      jobs.push(this._runJob(worker, entry));
    }
    await Promise.all(jobs);
  }

  async _runJob(worker: Worker, entry: DispatcherEntry) {
    worker.run(entry.runPayload);
    let doneCallback = () => {};
    const result = new Promise<void>(f => doneCallback = f);
    worker.once('done', (params: DonePayload) => {
      // We won't file remaining if:
      // - there are no remaining
      // - we are here not because something failed
      // - no unrecoverable worker error
      if (!params.remaining.length && !params.failedTestId && !params.fatalError) {
        this._freeWorkers.push(worker);
        this._notifyWorkerClaimer();
        doneCallback();
        return;
      }

      // When worker encounters error, we will stop it and create a new one.
      worker.stop();

      let remaining = params.remaining;
      const failedTestIds = new Set<string>();

      // In case of fatal error, report all remaining tests as failing with this error.
      if (params.fatalError) {
        for (const { testId } of remaining) {
          const { test, result } = this._testById.get(testId)!;
          this._reporter.onTestBegin?.(test);
          result.error = params.fatalError;
          this._reportTestEnd(test, result, 'failed');
          failedTestIds.add(testId);
        }
        // Since we pretent that all remaining tests failed, there is nothing else to run,
        // except for possible retries.
        remaining = [];
      }
      if (params.failedTestId)
        failedTestIds.add(params.failedTestId);

      // Only retry expected failures, not passes and only if the test failed.
      for (const testId of failedTestIds) {
        const pair = this._testById.get(testId)!;
        if (!this._isStopped && pair.test.expectedStatus === 'passed' && pair.test.results.length < pair.test.retries + 1) {
          pair.result = pair.test._appendTestResult();
          remaining.unshift({
            retry: pair.result.retry,
            testId: pair.test._id,
          });
        }
      }

      if (remaining.length)
        this._queue.unshift({ ...entry, runPayload: { ...entry.runPayload, entries: remaining } });

      // This job is over, we just scheduled another one.
      doneCallback();
    });
    return result;
  }

  async _obtainWorker(entry: DispatcherEntry) {
    const claimWorker = (): Promise<Worker> | null => {
      // Use available worker.
      if (this._freeWorkers.length)
        return Promise.resolve(this._freeWorkers.pop()!);
      // Create a new worker.
      if (this._workers.size < this._loader.fullConfig().workers)
        return this._createWorker(entry);
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
    return worker!;
  }

  async _notifyWorkerClaimer() {
    if (this._isStopped || !this._workerClaimers.length)
      return;
    const callback = this._workerClaimers.shift()!;
    callback();
  }

  _createWorker(entry: DispatcherEntry) {
    const worker = new Worker(this);
    worker.on('testBegin', (params: TestBeginPayload) => {
      const { test, result: testRun  } = this._testById.get(params.testId)!;
      testRun.workerIndex = params.workerIndex;
      this._reporter.onTestBegin(test);
    });
    worker.on('testEnd', (params: TestEndPayload) => {
      const { test, result } = this._testById.get(params.testId)!;
      result.duration = params.duration;
      result.error = params.error;
      test.expectedStatus = params.expectedStatus;
      test.annotations = params.annotations;
      test.timeout = params.timeout;
      if (params.expectedStatus === 'skipped' && params.status === 'skipped')
        test.skipped = true;
      this._reportTestEnd(test, result, params.status);
    });
    worker.on('stdOut', (params: TestOutputPayload) => {
      const chunk = chunkFromParams(params);
      const pair = params.testId ? this._testById.get(params.testId) : undefined;
      if (pair)
        pair.result.stdout.push(chunk);
      this._reporter.onStdOut(chunk, pair ? pair.test : undefined);
    });
    worker.on('stdErr', (params: TestOutputPayload) => {
      const chunk = chunkFromParams(params);
      const pair = params.testId ? this._testById.get(params.testId) : undefined;
      if (pair)
        pair.result.stderr.push(chunk);
      this._reporter.onStdErr(chunk, pair ? pair.test : undefined);
    });
    worker.on('teardownError', ({error}) => {
      this._hasWorkerErrors = true;
      this._reporter.onError(error);
    });
    worker.on('exit', () => {
      this._workers.delete(worker);
      this._notifyWorkerClaimer();
      if (this._stopCallback && !this._workers.size)
        this._stopCallback();
    });
    this._workers.add(worker);
    return worker.init(entry).then(() => worker);
  }

  async stop() {
    this._isStopped = true;
    if (this._workers.size) {
      const result = new Promise<void>(f => this._stopCallback = f);
      for (const worker of this._workers)
        worker.stop();
      await result;
    }
  }

  private _reportTestEnd(test: Test, result: TestResult, status: TestStatus) {
    if (this._isStopped)
      return;
    result.status = status;
    if (result.status !== 'skipped' && result.status !== test.expectedStatus)
      ++this._failureCount;
    const maxFailures = this._loader.fullConfig().maxFailures;
    if (!maxFailures || this._failureCount <= maxFailures)
      this._reporter.onTestEnd(test, result);
    if (maxFailures && this._failureCount === maxFailures)
      this._isStopped = true;
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

  async init(entry: DispatcherEntry) {
    this.hash = entry.hash;
    const params: WorkerInitParams = {
      workerIndex: this.index,
      repeatEachIndex: entry.repeatEachIndex,
      projectIndex: entry.projectIndex,
      loader: this.runner._loader.serialize(),
    };
    this.process.send({ method: 'init', params });
    await new Promise(f => this.process.once('message', f));  // Ready ack
  }

  run(runPayload: RunPayload) {
    this.process.send({ method: 'run', params: runPayload });
  }

  stop() {
    this.process.send({ method: 'stop' });
  }
}

function chunkFromParams(params: TestOutputPayload): string | Buffer {
  if (typeof params.text === 'string')
    return params.text;
  return Buffer.from(params.buffer!, 'base64');
}
