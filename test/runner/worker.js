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
const { fixturesUI, fixturePool } = require('./fixturesUI');
const { gracefullyCloseAll } = require('../../lib/server/processLauncher');
const GoldenUtils = require('../../utils/testrunner/GoldenUtils');

const browserName = process.env.BROWSER || 'chromium';
const goldenPath = path.join(__dirname, '..', 'golden-' + browserName);
const outputPath = path.join(__dirname, '..', 'output-' + browserName);
global.expect = require('expect');
global.testOptions = require('./testOptions');

const constants = Mocha.Runner.constants;

extendExpects();

let closed = false;

process.on('message', async message => {
  if (message.method === 'init')
    process.env.JEST_WORKER_ID = message.params.workerId;
  if (message.method === 'stop') {
    await fixturePool.teardownScope('worker');
    await gracefullyCloseAndExit();
  } if (message.method === 'run')
    await runSingleTest(message.params.file, message.params.options);
});

process.on('disconnect', gracefullyCloseAndExit);
process.on('SIGINT',() => {});
process.on('SIGTERM',() => {});
sendMessageToParent('ready');

async function gracefullyCloseAndExit() {
  closed = true;
  // Force exit after 30 seconds.
  setTimeout(() => process.exit(0), 30000);
  // Meanwhile, try to gracefully close all browsers.
  await gracefullyCloseAll();
  process.exit(0);
}

class NullReporter {}

let failedWithError = false;

async function runSingleTest(file, options) {
  let lastOrdinal = -1;
  const mocha = new Mocha({
    ui: fixturesUI.bind(null, false),
    timeout: options.timeout,
    reporter: NullReporter
  });
  if (options.grep)
    mocha.grep(options.grep);
  mocha.addFile(file);
  mocha.suite.filterOnly();

  const runner = mocha.run(() => {
    // Runner adds these; if we don't remove them, we'll get a leak.
    process.removeAllListeners('uncaughtException');
  });

  runner.on(constants.EVENT_TEST_BEGIN, test => {
    sendMessageToParent('test', { test: serializeTest(test, ++lastOrdinal) });
  });

  runner.on(constants.EVENT_TEST_PENDING, test => {
    sendMessageToParent('pending', { test: serializeTest(test, ++lastOrdinal) });
  });

  runner.on(constants.EVENT_TEST_PASS, test => {
    sendMessageToParent('pass', { test: serializeTest(test, lastOrdinal) });
  });

  runner.on(constants.EVENT_TEST_FAIL, (test, error) => {
    failedWithError = error;
    sendMessageToParent('fail', {
      test: serializeTest(test, lastOrdinal),
      error: serializeError(error),
    });
  });

  runner.once(constants.EVENT_RUN_END, async () => {
    sendMessageToParent('done', { stats: serializeStats(runner.stats), error: failedWithError });
  });
}

function sendMessageToParent(method, params = {}) {
  if (closed)
    return;
  try {
    process.send({ method, params });
  } catch (e) {
    // Can throw when closing.
  }
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

function extendExpects() {
  function toBeGolden(received, goldenName) {
    const {pass, message} =  GoldenUtils.compare(received, {
      goldenPath,
      outputPath,
      goldenName
    });
    return {pass, message: () => message};
  };
  global.expect.extend({ toBeGolden });
}
