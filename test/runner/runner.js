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
const { computeWorkerHash } = require('./fixtures');

const constants = Mocha.Runner.constants;
// Mocha runner does not remove uncaughtException listeners.
process.setMaxListeners(0);

class Runner extends EventEmitter {
  constructor(suite, options) {
    super();
    this._suite = suite;
    this._options = options;
    this._workers = new Set();
    this._freeWorkers = [];
    this._workerClaimers = [];
    this._lastWorkerId = 0;
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

  _filesSortedByWorkerHash() {
    const result = [];
    for (const file of this._files.keys())
      result.push({ file, hash: computeWorkerHash(file) });
    result.sort((a, b) => a.hash < b.hash ? -1 : (a.hash === b.hash ? 0 : 1));
    return result;
  }

  async run() {
    this.emit(constants.EVENT_RUN_BEGIN, {});
    const files = this._filesSortedByWorkerHash();
    while (files.length) {
      const worker = await this._obtainWorker();
      const requiredHash = files[0].hash;
      if (worker.hash && worker.hash !== requiredHash) {
        this._restartWorker(worker);
        continue;
      }
      const entry = files.shift();
      worker.hash = requiredHash;
      this._runJob(worker, entry.file);
    }
    await new Promise(f => this._runCompleteCallback = f);
    this.emit(constants.EVENT_RUN_END, {});
  }

  _runJob(worker, file) {
    ++this._pendingJobs;
    worker.run(file);
    worker.once('done', params => {
      --this._pendingJobs;
      this.stats.duration += params.stats.duration;
      this.stats.failures += params.stats.failures;
      this.stats.passes += params.stats.passes;
      this.stats.pending += params.stats.pending;
      this.stats.tests += params.stats.tests;
      if (this._runCompleteCallback && !this._pendingJobs)
        this._runCompleteCallback();
      else {
        if (params.error)
          this._restartWorker(worker);
        else
          this._workerAvailable(worker);
      }
    });
  }

  async _obtainWorker() {
    // If there is worker, use it.
    if (this._freeWorkers.length)
      return this._freeWorkers.pop();
    // If we can create worker, create it.
    if (this._workers.size < this._options.jobs)
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
    const worker = new Worker(this);
    worker.on('test', params => this.emit(constants.EVENT_TEST_BEGIN, this._updateTest(params.test)));
    worker.on('pending', params => this.emit(constants.EVENT_TEST_PENDING, this._updateTest(params.test)));
    worker.on('pass', params => this.emit(constants.EVENT_TEST_PASS, this._updateTest(params.test)));
    worker.on('fail', params => {
      const out = worker.takeOut();
      if (out.length)
        params.error.stack += '\n\x1b[33mstdout: ' + out.join('\n') + '\x1b[0m';
      const err = worker.takeErr();
      if (err.length)
        params.error.stack += '\n\x1b[33mstderr: ' + err.join('\n') + '\x1b[0m';
      this.emit(constants.EVENT_TEST_FAIL, this._updateTest(params.test), params.error);
    });
    worker.on('exit', () => {
      this._workers.delete(worker);
      if (this._stopCallback && !this._workers.size)
        this._stopCallback();
    });
    this._workers.add(worker);
    worker.init().then(() => this._workerAvailable(worker));
  }

  _restartWorker(worker) {
    worker.stop();
    this._createWorker();
  }

  _updateTest(serialized) {
    const test = this._tests.get(serialized.id);
    test.duration = serialized.duration;
    return test;
  }

  async stop() {
    const result = new Promise(f => this._stopCallback = f);
    for (const worker of this._workers)
      worker.stop();
    await result;
  }
}

let lastWorkerId = 0;

class Worker extends EventEmitter {
  constructor(runner) {
    super();
    this.runner = runner;

    this.process = child_process.fork(path.join(__dirname, 'worker.js'), {
      detached: false,
      env: {
        FORCE_COLOR: process.stdout.isTTY ? 1 : 0,
        DEBUG_COLORS: process.stdout.isTTY ? 1 : 0,
        ...process.env
      },
      // Can't pipe since piping slows down termination for some reason.
      stdio: ['ignore', 'ignore', 'ignore', 'ipc']
    });
    this.process.on('exit', () => this.emit('exit'));
    this.process.on('message', message => {
      const { method, params } = message;
      this.emit(method, params);
    });
    this.stdout = [];
    this.stderr = [];
    this.on('stdout', data => {
      if (runner._options.dumpio)
        process.stdout.write(data);
      else
        this.stdout.push(data);
    });
    this.on('stderr', data => {
      if (runner._options.dumpio)
        process.stderr.write(data);
      else
        this.stderr.push(data);
    });
    this.on('debug', data => {
      if (runner._options.dumpio)
        process.stderr.write(data + '\n');
      else
        this.stderr.push(data + '\n');
    });
  }

  async init() {
    this.process.send({ method: 'init', params: { workerId: lastWorkerId++ } });
    await new Promise(f => this.process.once('message', f));  // Ready ack
  }

  run(file) {
    this.process.send({ method: 'run', params: { file, options: this.runner._options } });
  }

  stop() {
    this.process.send({ method: 'stop' });
  }

  takeOut() {
    const result = this.stdout;
    this.stdout = [];
    return result;
  }

  takeErr() {
    const result = this.stderr;
    this.stderr = [];
    return result;
  }
}

module.exports = { Runner };
