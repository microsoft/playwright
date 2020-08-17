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

    let grep;
    if (options.grep) {
      const match = options.grep.match(/^\/(.*)\/(g|i|)$|.*/);
      grep = new RegExp(match[1] || match[0], match[2]);
    }

    suite.eachTest(test => {
      if (grep && !grep.test(test.fullTitle()))
        return;
      if (!this._files.has(test.file))
        this._files.set(test.file, 0);
      const counter = this._files.get(test.file);
      this._files.set(test.file, counter + 1);
      this._tests.set(`${test.file}::${counter}`, test);
    });
  }

  _filesSortedByWorkerHash() {
    const result = [];
    for (const [file, count] of this._files.entries())
      result.push({ file, hash: computeWorkerHash(file), ordinals: new Array(count).fill(0).map((_, i) => i) });
    result.sort((a, b) => a.hash < b.hash ? -1 : (a.hash === b.hash ? 0 : 1));
    return result;
  }

  async run() {
    this.emit(constants.EVENT_RUN_BEGIN, {});
    this._queue = this._filesSortedByWorkerHash();
    // Loop in case job schedules more jobs
    while (this._queue.length)
      await this._dispatchQueue();
    this.emit(constants.EVENT_RUN_END, {});
  }

  async _dispatchQueue() {
    const jobs = [];
    while (this._queue.length) {
      const entry = this._queue.shift();
      const requiredHash = entry.hash;
      let worker = await this._obtainWorker();
      while (worker.hash && worker.hash !== requiredHash) {
        this._restartWorker(worker);
        worker = await this._obtainWorker();
      }
      jobs.push(this._runJob(worker, entry));
    }
    await Promise.all(jobs);
  }

  async _runJob(worker, entry) {
    worker.run(entry);
    let doneCallback;
    const result = new Promise(f => doneCallback = f);
    worker.once('done', params => {
      this.stats.duration += params.stats.duration;
      this.stats.failures += params.stats.failures;
      this.stats.passes += params.stats.passes;
      this.stats.pending += params.stats.pending;
      this.stats.tests += params.stats.passes + params.stats.pending + params.stats.failures;
      // When worker encounters error, we will restart it.
      if (params.error) {
        this._restartWorker(worker);
        // If there are remaining tests, we will queue them.
        if (params.remaining.length)
          this._queue.unshift({ ...entry, ordinals: params.remaining });
      } else {
        this._workerAvailable(worker);
      }
      doneCallback();
    });
    return result;
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
    const worker = this._options.debug ? new InProcessWorker(this) : new OopWorker(this);
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

  async _restartWorker(worker) {
    await worker.stop();
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

class OopWorker extends EventEmitter {
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
    this.on('stdout', params => {
      const chunk = chunkFromParams(params);
      if (!runner._options.quiet)
        process.stdout.write(chunk);
      this.stdout.push(chunk);
    });
    this.on('stderr', params => {
      const chunk = chunkFromParams(params);
      if (!runner._options.quiet)
        process.stderr.write(chunk);
      this.stderr.push(chunk);
    });
    this.on('debug', data => {
      process.stderr.write(data + '\n');
    });
  }

  async init() {
    this.process.send({ method: 'init', params: { workerId: lastWorkerId++, ...this.runner._options } });
    await new Promise(f => this.process.once('message', f));  // Ready ack
  }

  run(entry) {
    this.hash = entry.hash;
    this.process.send({ method: 'run', params: { file: entry.file, ordinals: entry.ordinals, options: this.runner._options } });
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

class InProcessWorker extends EventEmitter {
  constructor(runner) {
    super();
    this.runner = runner;
    this.fixturePool = require('./fixturesUI').fixturePool;
  }

  async init() {
    const { initializeImageMatcher } = require('./testRunner');
    const { initializeWorker } = require('./builtin.fixtures');
    initializeImageMatcher(this.runner._options);
    initializeWorker({ ...this.runner._options.outputDir, workerId: 0 });
  }

  async run(entry) {
    delete require.cache[entry.file];
    const { TestRunner } = require('./testRunner');
    const testRunner = new TestRunner(entry.file, entry.ordinals, this.runner._options);
    for (const event of ['test', 'pending', 'pass', 'fail', 'done'])
      testRunner.on(event, this.emit.bind(this, event));
    testRunner.run();
  }

  async stop() {
    await this.fixturePool.teardownScope('worker');
    this.emit('exit');
  }

  takeOut() {
    return [];
  }

  takeErr() {
    return [];
  }
}

function chunkFromParams(params) {
  if (typeof params === 'string')
    return params;
  return Buffer.from(params.buffer, 'base64');
}

module.exports = { Runner };
