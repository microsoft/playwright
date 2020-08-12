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

const child_process = require('child_process');
const path = require('path');
const { EventEmitter } = require('events');
const Mocha = require('mocha');
const builtinReporters = require('mocha/lib/reporters');
const DotRunner = require('./dotReporter');

const constants = Mocha.Runner.constants;
// Mocha runner does not remove uncaughtException listeners.
process.setMaxListeners(0);

class Runner extends EventEmitter {
  constructor(suite, options) {
    super();
    this._suite = suite;
    this._options = options;
    this._maxWorkers = options.maxWorkers;
    this._workers = new Set();
    this._freeWorkers = [];
    this._workerClaimers = [];
    this._workerId = 0;
    this._pendingJobs = 0;
    this.stats = {
      duration: 0,
      failures: 0,
      passes: 0,
      pending: 0,
      tests: 0,
    };
    const reporterFactory = builtinReporters[options.reporter] || DotRunner;
    this._reporter = new reporterFactory(this, {});

    this._tests = new Map();
    this._files = new Map();

    if (suite.hasOnly())
      suite.filterOnly();
    console.log(`Running ${suite.total()} tests`);
    this._traverse(suite);
  }

  _traverse(suite) {
    for (const child of suite.suites)
      this._traverse(child);
    for (const test of suite.tests) {
      if (!this._files.has(test.file))
        this._files.set(test.file, 0);
      const counter = this._files.get(test.file);
      this._files.set(test.file, counter + 1);
      this._tests.set(`${test.file}::${counter}`, test);
    }
  }

  async run() {
    this.emit(constants.EVENT_RUN_BEGIN, {});
    for (const file of this._files.keys()) {
      const worker = await this._obtainWorker();
      this._runJob(worker, file);
    }
    await new Promise(f => this._runCompleteCallback = f);
    this.emit(constants.EVENT_RUN_END, {});
  }

  _runJob(worker, file) {
    ++this._pendingJobs;
    worker.send({ method: 'run', params: { file, options: this._options } });
    const messageListener = (message) => {
      const { method, params } = message;
      if (method !== 'done') {
        this._messageFromWorker(method, params);
        return;
      }
      worker.off('message', messageListener);

      --this._pendingJobs;
      this.stats.duration += params.stats.duration;
      this.stats.failures += params.stats.failures;
      this.stats.passes += params.stats.passes;
      this.stats.pending += params.stats.pending;
      this.stats.tests += params.stats.tests;
      if (params.error)
        this._restartWorker(worker);
      else
        this._workerAvailable(worker);
      if (this._runCompleteCallback && !this._pendingJobs)
        this._runCompleteCallback();
    };
    worker.on('message', messageListener)
  }

  async _obtainWorker() {
    // If there is worker, use it.
    if (this._freeWorkers.length)
      return this._freeWorkers.pop();
    // If we can create worker, create it.
    if (this._workers.size < this._maxWorkers)
      this._createWorker();
    // Wait for the next available worker.
    await new Promise(f => this._workerClaimers.push(f));
    return this._freeWorkers.pop();
  }

  async _workerAvailable(worker) {
    this._freeWorkers.push(worker);
    if (this._workerClaimers.length) {
      const callback = this._workerClaimers.shift();
      callback();
    }
  }

  _createWorker() {
    const worker = child_process.fork(path.join(__dirname, 'worker.js'), {
      detached: false,
      env: process.env,
    });
    worker.on('exit', () => {
      this._workers.delete(worker);
      if (this._stopCallback && !this._workers.size)
        this._stopCallback();
    });
    this._workers.add(worker);
    worker.send({ method: 'init', params: { workerId: ++this._workerId } });
    worker.once('message', () => {
      // Ready ack.
      this._workerAvailable(worker);
    });
  }

  _stopWorker(worker) {
    worker.send({ method: 'stop' });
  }

  async _restartWorker(worker) {
    this._stopWorker(worker);
    this._createWorker();
  }

  _messageFromWorker(method, params) {
    switch (method) {
      case 'test':
        this.emit(constants.EVENT_TEST_BEGIN, this._updateTest(params.test));
        break;
      case 'pending':
        this.emit(constants.EVENT_TEST_PENDING, this._updateTest(params.test));
        break;
      case 'pass':
        this.emit(constants.EVENT_TEST_PASS, this._updateTest(params.test));
        break;
      case 'fail':
        this.emit(constants.EVENT_TEST_FAIL, this._updateTest(params.test), params.error);
        break;
    }
  }

  _updateTest(serialized) {
    const test = this._tests.get(serialized.id);
    test.duration = serialized.duration;
    return test;
  }

  async stop() {
    const result = new Promise(f => this._stopCallback = f);
    for (const worker of this._workers)
      this._stopWorker(worker);
    await result;
  }
}

module.exports = { Runner };
