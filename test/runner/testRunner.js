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

const Mocha = require('mocha');
const { fixturesUI } = require('./fixturesUI');
const { EventEmitter } = require('events');

global.expect = require('expect');
global.testOptions = require('./testOptions');
const GoldenUtils = require('./GoldenUtils');

(function extendExpects() {
  function toMatchImage(received, path) {
    const {pass, message} =  GoldenUtils.compare(received, path);
    return {pass, message: () => message};
  };
  global.expect.extend({ toMatchImage });
})();

class NullReporter {}

class TestRunner extends EventEmitter {
  constructor(file, options) {
    super();
    this.mocha = new Mocha({
      forbidOnly: options.forbidOnly,
      reporter: NullReporter,
      timeout: options.timeout,
      ui: fixturesUI.bind(null, options.trialRun),
    });
    if (options.grep)
      this.mocha.grep(options.grep);
    this.mocha.addFile(file);
    this.mocha.suite.filterOnly();
    this.mocha.loadFiles();
    this.suite = this.mocha.suite;
    this._lastOrdinal = -1;
    this._failedWithError = false;
  }

  async run() {
    let callback;
    const result = new Promise(f => callback = f);
    const runner = this.mocha.run(callback);

    const constants = Mocha.Runner.constants;
    runner.on(constants.EVENT_TEST_BEGIN, test => {
      this.emit('test', { test: serializeTest(test, ++this._lastOrdinal) });
    });

    runner.on(constants.EVENT_TEST_PENDING, test => {
      this.emit('pending', { test: serializeTest(test, ++this._lastOrdinal) });
    });

    runner.on(constants.EVENT_TEST_PASS, test => {
      this.emit('pass', { test: serializeTest(test, this._lastOrdinal) });
    });

    runner.on(constants.EVENT_TEST_FAIL, (test, error) => {
      this._failedWithError = error;
      this.emit('fail', {
        test: serializeTest(test, this._lastOrdinal),
        error: serializeError(error),
      });
    });

    runner.once(constants.EVENT_RUN_END, async () => {
      this.emit('done', { stats: serializeStats(runner.stats), error: this._failedWithError });
    });
    await result;
  }

  grepTotal() {
    let total = 0;
    this.suite.eachTest(test => {
      if (this.mocha.options.grep.test(test.fullTitle()))
        total++;
    });
    return total;
  }
}

function createTestSuite() {
  return new Mocha.Suite('', new Mocha.Context(), true);
}

function serializeTest(test, origin) {
  return {
    id: `${test.file}::${origin}`,
    duration: test.duration,
  };
}

function serializeStats(stats) {
  return {
    tests: stats.tests,
    passes: stats.passes,
    duration: stats.duration,
    failures: stats.failures,
    pending: stats.pending,
  }
}

function trimCycles(obj) {
  const cache = new Set();
  return JSON.parse(
    JSON.stringify(obj, function(key, value) {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value))
          return '' + value;
        cache.add(value);
      }
      return value;
    })
  );
}

function serializeError(error) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack
    }
  }
  return trimCycles(error);
}

module.exports = { TestRunner, createTestSuite };
