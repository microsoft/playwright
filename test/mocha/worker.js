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
global.testOptions = require('../harness/testOptions');

extendExpects();

let closed = false;

process.on('message', async message => {
  if (message.method === 'init')
    process.env.JEST_WORKER_ID = message.params.workerId;
  if (message.method === 'stop')
    await gracefullyCloseAndExit();
  if (message.method === 'run')
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

async function runSingleTest(file, options) {
  let nextOrdinal = 0;
  const mocha = new Mocha({
    ui: fixturesUI.bind(null, false),
    retries: options.retries === 1 ? undefined : options.retries,
    timeout: options.timeout,
    reporter: NullReporter
  });
  mocha.addFile(file);

  const runner = mocha.run();

  const constants = Mocha.Runner.constants;
  runner.on(constants.EVENT_RUN_BEGIN, () => {
    sendMessageToParent('start');
  });

  runner.on(constants.EVENT_TEST_BEGIN, test => {
    // Retries will produce new test instances, store ordinal on the original function.
    let ordinal = nextOrdinal++;
    if (typeof test.fn.__original.__ordinal !== 'number')
      test.fn.__original.__ordinal = ordinal;
    sendMessageToParent('test', { test: serializeTest(test, ordinal) });
  });

  runner.on(constants.EVENT_TEST_PENDING, test => {
    // Pending does not get test begin signal, so increment ordinal.
    sendMessageToParent('pending', { test: serializeTest(test, nextOrdinal++) });
  });

  runner.on(constants.EVENT_TEST_PASS, test => {
    sendMessageToParent('pass', { test: serializeTest(test, test.fn.__original.__ordinal) });
  });

  runner.on(constants.EVENT_TEST_FAIL, (test, error) => {
    sendMessageToParent('fail', {
      test: serializeTest(test, test.fn.__original.__ordinal),
      error: serializeError(error),
    });
  });

  runner.once(constants.EVENT_RUN_END, async () => {
    sendMessageToParent('end', { stats: serializeStats(runner.stats) });
    sendMessageToParent('done');
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
    currentRetry: test.currentRetry(),
    duration: test.duration,
    title: test.title,
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
