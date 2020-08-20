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
const crypto = require('crypto');
const path = require('path');
const { EventEmitter } = require('events');
const Mocha = require('mocha');
const builtinReporters = require('mocha/lib/reporters');
const DotRunner = require('./dotReporter');
const { lookupRegistrations } = require('./fixtures');

const constants = Mocha.Runner.constants;
// Mocha runner does not remove uncaughtException listeners.
process.setMaxListeners(0);

class Runner extends EventEmitter {
  constructor(suite, total, options) {
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

    this._testById = new Map();
    this._testsByConfiguredFile = new Map();

    suite.eachTest(test => {
      const configuredFile = `${test.file}::[${test.__configurationString}]`;
      if (!this._testsByConfiguredFile.has(configuredFile)) {
        this._testsByConfiguredFile.set(configuredFile, {
          file: test.file,
          configuredFile,
          ordinals: [],
          configurationObject: test.__configurationObject,
          configurationString: test.__configurationString
        });
      }
      const { ordinals } = this._testsByConfiguredFile.get(configuredFile);
      ordinals.push(test.__ordinal);
      this._testById.set(`${test.__ordinal}@${configuredFile}`, test);
    });

    if (process.stdout.isTTY) {
      console.log();
      const jobs = Math.min(options.jobs, this._testsByConfiguredFile.size);
      console.log(`Running ${total} test${ total > 1 ? 's' : '' } using ${jobs} worker${ jobs > 1 ? 's' : ''}`);
    }
  }

  _filesSortedByWorkerHash() {
    const result = [];
    for (const entry of this._testsByConfiguredFile.values())
      result.push({ ...entry, hash: entry.configurationString + '@' + computeWorkerHash(entry.file) });
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
    const test = this._testById.get(serialized.id);
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
  }

  async init() {
    this.process.send({ method: 'init', params: { workerId: lastWorkerId++, ...this.runner._options } });
    await new Promise(f => this.process.once('message', f));  // Ready ack
  }

  run(entry) {
    this.hash = entry.hash;
    this.process.send({ method: 'run', params: { entry, options: this.runner._options } });
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
    this.fixturePool = require('./testRunner').fixturePool;
  }

  async init() {
    const { initializeImageMatcher } = require('./testRunner');
    initializeImageMatcher(this.runner._options);
  }

  async run(entry) {
    delete require.cache[entry.file];
    const { TestRunner } = require('./testRunner');
    const testRunner = new TestRunner(entry, this.runner._options, 0);
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

function computeWorkerHash(file) {
  // At this point, registrationsByFile contains all the files with worker fixture registrations.
  // For every test, build the require closure and map each file to fixtures declared in it.
  // This collection of fixtures is the fingerprint of the worker setup, a "worker hash".
  // Tests with the matching "worker hash" will reuse the same worker.
  const hash = crypto.createHash('sha1');
  for (const registration of lookupRegistrations(file, 'worker').values())
    hash.update(registration.location);
  return hash.digest('hex');
}

module.exports = { Runner };
