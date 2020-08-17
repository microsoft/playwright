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

const path = require('path');
const Mocha = require('mocha');
const { fixturesUI } = require('./fixturesUI');
const { EventEmitter } = require('events');

global.expect = require('expect');
global.testOptions = require('./testOptions');
const GoldenUtils = require('./GoldenUtils');

class NullReporter {}

class TestRunner extends EventEmitter {
  constructor(file, startOrdinal, options) {
    super();
    this.mocha = new Mocha({
      forbidOnly: options.forbidOnly,
      reporter: NullReporter,
      timeout: options.timeout,
      ui: fixturesUI.bind(null, this),
    });
    if (options.grep)
      this.mocha.grep(options.grep);
    this._currentOrdinal = -1;
    this._failedWithError = false;
    this._startOrdinal = startOrdinal;
    this._trialRun = options.trialRun;
    this._passes = 0;
    this._failures = 0;
    this._pending = 0;
    this._relativeTestFile = path.relative(options.testDir, file);
    this.mocha.addFile(file);
    this.mocha.suite.filterOnly();
    this.mocha.loadFiles();
    this.suite = this.mocha.suite;
  }

  async run() {
    let callback;
    const result = new Promise(f => callback = f);
    const runner = this.mocha.run(callback);
    let remaining = 0;

    const constants = Mocha.Runner.constants;
    runner.on(constants.EVENT_TEST_BEGIN, test => {
      relativeTestFile = this._relativeTestFile;
      if (this._failedWithError) {
        ++remaining;
        return;
      }
      if (++this._currentOrdinal < this._startOrdinal)
        return;
      this.emit('test', { test: serializeTest(test, this._currentOrdinal) });
    });

    runner.on(constants.EVENT_TEST_PENDING, test => {
      if (this._failedWithError) {
        ++remaining;
        return;
      }
      if (++this._currentOrdinal < this._startOrdinal)
        return;
      ++this._pending;
      this.emit('pending', { test: serializeTest(test, this._currentOrdinal) });
    });

    runner.on(constants.EVENT_TEST_PASS, test => {
      if (this._failedWithError)
        return;

      if (this._currentOrdinal < this._startOrdinal)
        return;
      ++this._passes;
      this.emit('pass', { test: serializeTest(test, this._currentOrdinal) });
    });

    runner.on(constants.EVENT_TEST_FAIL, (test, error) => {
      if (this._failedWithError)
        return;
      ++this._failures;
      this._failedWithError = error;
      this.emit('fail', {
        test: serializeTest(test, this._currentOrdinal),
        error: serializeError(error),
      });
    });

    runner.once(constants.EVENT_RUN_END, async () => {
      this.emit('done', {
        stats: this._serializeStats(runner.stats),
        error: this._failedWithError,
        remaining,
        total: runner.stats.tests
      });
    });
    await result;
  }

  shouldRunTest(hook) {
    if (this._trialRun || this._failedWithError)
      return false;
    if (hook) {
      // Hook starts before we bump the test ordinal.
      if (this._currentOrdinal + 1 < this._startOrdinal)
        return false;
    } else {
      if (this._currentOrdinal < this._startOrdinal)
        return false;
    }
    return true;
  }

  grepTotal() {
    let total = 0;
    this.suite.eachTest(test => {
      if (this.mocha.options.grep.test(test.fullTitle()))
        total++;
    });
    return total;
  }

  _serializeStats(stats) {
    return {
      passes: this._passes,
      failures: this._failures,
      pending: this._pending,
      duration: stats.duration || 0,
    }
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

let relativeTestFile;

function initializeImageMatcher(options) {
  function toMatchImage(received, name, config) {
    const { pass, message } = GoldenUtils.compare(received, name, { ...options, relativeTestFile, config });
    return { pass, message: () => message };
  };
  global.expect.extend({ toMatchImage });
}

module.exports = { TestRunner, createTestSuite, initializeImageMatcher };
