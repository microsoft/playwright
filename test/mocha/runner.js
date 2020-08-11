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
const { Serializer } = require('v8');

const constants = Mocha.Runner.constants;

class Runner extends EventEmitter {
  constructor(options) {
    super();
    this._maxWorkers = options.maxWorkers;
    this._workers = new Set();
    this._freeWorkers = [];
    this._callbacks = [];
    this._workerId = 0;
    this.stats = {
      duration: 0,
      failures: 0,
      passes: 0,
      pending: 0,
      tests: 0,
    };
    this._reporter = new options.reporter(this, {});
  }

  async run(files) {
    this.emit(constants.EVENT_RUN_BEGIN, {});
    const result = new Promise(f => this._runCallback = f);
    for (const file of files) {
      const worker = await this._obtainWorker();
      worker.send({ method: 'run', params: file });
    }
    await result;
    this.emit(constants.EVENT_RUN_END, {});
  }

  async _obtainWorker() {
    if (this._freeWorkers.length)
      return this._freeWorkers.pop();

    if (this._workers.size < this._maxWorkers) {
      const worker = child_process.fork(path.join(__dirname, 'worker.js'), {
        detached: false
      });
      let readyCallback;
      const result = new Promise(f => readyCallback = f);
      worker.send({ method: 'init', params: ++this._workerId });
      worker.on('message', message => {
        if (message.method === 'ready')
            readyCallback();
        this._messageFromWorker(worker, message);
      });
      worker.on('exit', () => {
        this._workers.delete(worker);
        if (!this._workers.size)
          this._runCallback();
      });
      this._workers.add(worker);
      await result;
      return worker;
    }

    return new Promise(f => this._callbacks.push(f));
  }

  _messageFromWorker(worker, message) {
    const { method, params } = message;
    switch (method) {
      case 'done': {
        if (this._callbacks.length) {
          const callback = this._callbacks.shift();
          callback(worker);
        } else {
          this._freeWorkers.push(worker);
          if (this._freeWorkers.length === this._workers.size) {
            this._runCallback();
          }
        }
        break;
      }
      case 'start':
        break;
      case 'test':
        this.emit(constants.EVENT_TEST_BEGIN, this._parse(params.test));
        break;
      case 'pending':
        this.emit(constants.EVENT_TEST_PENDING, this._parse(params.test));
        break;
      case 'pass':
        this.emit(constants.EVENT_TEST_PASS, this._parse(params.test));
        break;
      case 'fail':
        const test = this._parse(params.test);
        this.emit(constants.EVENT_TEST_FAIL, test, params.error);
        break;
      case 'end':
        this.stats.duration += params.stats.duration;
        this.stats.failures += params.stats.failures;
        this.stats.passes += params.stats.passes;
        this.stats.pending += params.stats.pending;
        this.stats.tests += params.stats.tests;
        break;
    }
  }

  _parse(serialized) {
    return {
      ...serialized,
      currentRetry: () => serialized.currentRetry,
      fullTitle: () => serialized.fullTitle,
      slow: () => serialized.slow,
      timeout: () => serialized.timeout,
      titlePath: () => serialized.titlePath,
      isPending: () => serialized.isPending,
      parent: {
        fullTitle: () => ''
      }
    };
  }

  async stop() {
    const result = new Promise(f => this._stopCallback = f);
    for (const worker of this._workers)
      worker.send({ method: 'stop' });
    await result;
  }
}

module.exports = { Runner };
