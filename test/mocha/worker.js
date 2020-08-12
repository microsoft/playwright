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
const NoMochaUI = require('./noMochaUI');
const { TestRunner: NoMochaTestRunner } = require('../../utils/testrunner/TestRunner');
const { gracefullyCloseAll } = require('../../lib/server/processLauncher');
const GoldenUtils = require('../../utils/testrunner/GoldenUtils');

const browserName = process.env.BROWSER || 'chromium';
const goldenPath = path.join(__dirname, '..', 'golden-' + browserName);
const outputPath = path.join(__dirname, '..', 'output-' + browserName);
global.expect = require('expect');
global.testOptions = require('../harness/testOptions');

extendExpects();

let closed = false;
let noMocha = false;

process.on('message', async message => {
  if (message.method === 'init') {
    process.env.JEST_WORKER_ID = message.params.workerId;
    noMocha = message.params.noMocha;
  }
  if (message.method === 'stop')
    gracefullyCloseAndExit();
  if (message.method === 'run') {
    if (noMocha)
      await runSingleTestNoMocha(message.params);
    else
      await runSingleTest(message.params);
  }
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

async function runSingleTest(file) {
  const mocha = new Mocha({
    ui: fixturesUI,
    timeout: 10000,
    reporter: NullReporter
  });
  mocha.addFile(file);

  const runner = mocha.run();

  const constants = Mocha.Runner.constants;
  runner.on(constants.EVENT_RUN_BEGIN, () => {
    sendMessageToParent('start');
  });

  runner.on(constants.EVENT_TEST_BEGIN, test => {
    sendMessageToParent('test', { test: sanitizeTest(test) });
  });

  runner.on(constants.EVENT_TEST_PENDING, test => {
    sendMessageToParent('pending', { test: sanitizeTest(test) });
  });

  runner.on(constants.EVENT_TEST_PASS, test => {
    sendMessageToParent('pass', { test: sanitizeTest(test) });
  });

  runner.on(constants.EVENT_TEST_FAIL, (test, error) => {
    sendMessageToParent('fail', {
      test: sanitizeTest(test),
      error: serializeError(error),
     });
  });

  runner.once(constants.EVENT_RUN_END, async () => {
    sendMessageToParent('end', { stats: serializeStats(runner.stats) });
    sendMessageToParent('done');
  });
}

async function runSingleTestNoMocha(file) {
  const noMocha = new NoMochaUI({ timeout: 10000 });
  noMocha.addFile(file);
  const testRuns = noMocha.createTestRuns();

  function serializeTest(test, duration) {
    let isPending = test.skipped();
    for (let suite = test.suite(); suite; suite = suite.parentSuite())
      isPending = isPending || suite.skipped();
    return {
      currentRetry: 0,
      duration,
      file: file,
      fullTitle: test.fullName(),
      isPending,
      slow: false,
      timeout: test.timeout(),
      title: test.name(),
      titlePath: test.fullName(), // What is this?
    };
  }

  const testRunner = new NoMochaTestRunner();
  await testRunner.run(testRuns, {
    hookTimeout: 10000,
    totalTimeout: process.env.CI ? 30 * 60 * 1000 : 0, // 30 minutes on CI
    parallel: 1,
    breakOnFailure: false,
    onStarted: async (testRuns) => {
      sendMessageToParent('start');
    },
    onFinished: async (result) => {
      sendMessageToParent('end', { stats: {
        tests: result.runs.length,
        passes: result.runs.filter(run => run.result() === 'ok').length,
        duration: result.runs.map(run => run.duration()).reduce((a, b) => a + b, 0),
        failures: result.runs.filter(run => run.result() !== 'ok' && run.result() !== 'skipped').length,
        pending: result.runs.filter(run => run.result() === 'skipped').length,
      } });
      sendMessageToParent('done');
    },
    onTestRunStarted: async (testRun) => {
      sendMessageToParent('test', { test: serializeTest(testRun.test(), 0) });
    },
    onTestRunFinished: async (testRun) => {
      const serialized = serializeTest(testRun.test(), testRun.duration());
      if (testRun.result() === 'skipped') {
        sendMessageToParent('pending', { test: serialized });
      } else if (testRun.result() === 'ok') {
        sendMessageToParent('pass', { test: serialized });
      } else {
        sendMessageToParent('fail', {
          test: serialized,
          error: serializeError(testRun.error()),
        });
      }
    },
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

function sanitizeTest(test) {
  return {
    currentRetry: test.currentRetry(),
    duration: test.duration,
    file: test.file,
    fullTitle: test.fullTitle(),
    isPending: test.isPending(),
    slow: test.slow(),
    timeout: test.timeout(),
    title: test.title,
    titlePath: test.titlePath(),
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
