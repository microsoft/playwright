#!/usr/bin/env node
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

const fs = require('fs');
const os = require('os');
const path = require('path');

function parseArgs() {
  const result = {
    playwrightRoot: process.cwd(),
  };
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--playwright-root') {
      result.playwrightRoot = path.resolve(process.argv[++i]);
    } else if (arg.startsWith('--playwright-root=')) {
      result.playwrightRoot = path.resolve(arg.substring('--playwright-root='.length));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return result;
}

function requireFirst(candidates, label) {
  const errors = [];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate))
        return require(candidate);
    } catch (e) {
      errors.push(`${candidate}: ${e.message}`);
    }
  }
  throw new Error([
    `Could not load ${label}.`,
    `Tried:`,
    ...candidates.map(candidate => `  ${candidate}`),
    `Build Playwright first, or pass --playwright-root to a built patched checkout/package.`,
    ...errors.map(error => `  ${error}`),
  ].join('\n'));
}

function internals(root) {
  const candidates = relative => [
    path.join(root, 'packages', 'playwright', 'lib', relative),
    path.join(root, 'lib', relative),
    path.join(root, 'node_modules', 'playwright', 'lib', relative),
  ];
  const runnerIndex = requireFirst(candidates(path.join('runner', 'index.js')), 'runner internals');
  if (runnerIndex.testRunner && runnerIndex.workerHost) {
    return {
      testRunner: runnerIndex.testRunner,
      workerHost: runnerIndex.workerHost,
    };
  }
  return {
    testRunner: requireFirst(candidates(path.join('runner', 'testRunner.js')), 'TestRunner internals'),
    workerHost: requireFirst(candidates(path.join('runner', 'workerHost.js')), 'WorkerHost internals'),
  };
}

async function mkdirp(filePath) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
}

async function writeFile(filePath, text) {
  await mkdirp(filePath);
  await fs.promises.writeFile(filePath, text);
}

function assert(condition, message) {
  if (!condition)
    throw new Error(message);
}

class SmokeReporter {
  constructor() {
    this.events = [];
    this.stdoutWithTest = false;
    this.stderrWithTest = false;
    this.attachments = [];
    this.finalStatus = undefined;
  }

  version() {
    return 'v2';
  }

  onConfigure() {
    this.events.push('onConfigure');
  }

  onBegin(suite) {
    this.events.push('onBegin');
    this.testCount = suite.allTests().length;
  }

  onTestBegin(test, result) {
    this.events.push('onTestBegin');
    this.testTitle = test.title;
    this.workerIndex = result.workerIndex;
  }

  onStepBegin(test, result, step) {
    this.events.push('onStepBegin:' + step.title);
  }

  onStepEnd(test, result, step) {
    this.events.push('onStepEnd:' + step.title);
  }

  onStdOut(chunk, test, result) {
    const text = String(chunk);
    if (text.includes('stdout-from-prefork-test')) {
      this.events.push('onStdOut');
      this.stdoutWithTest = !!test && !!result;
    }
  }

  onStdErr(chunk, test, result) {
    const text = String(chunk);
    if (text.includes('stderr-from-prefork-test')) {
      this.events.push('onStdErr');
      this.stderrWithTest = !!test && !!result;
    }
  }

  onTestEnd(test, result) {
    this.events.push('onTestEnd:' + result.status);
    this.attachments = result.attachments.map(a => ({ name: a.name, contentType: a.contentType, body: a.body && a.body.toString() }));
  }

  onEnd(result) {
    this.events.push('onEnd:' + result.status);
    this.finalStatus = result.status;
  }

  onExit() {
    this.events.push('onExit');
  }
}

async function main() {
  const { playwrightRoot } = parseArgs();
  const { testRunner, workerHost } = internals(playwrightRoot);
  const { TestRunner } = testRunner;
  const { WorkerHost } = workerHost;

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pw-prefork-smoke-'));
  const configFile = path.join(tmpDir, 'playwright.config.js');
  const testFile = path.join(tmpDir, 'prefork-smoke.spec.js');
  const nodeModulesTest = path.join(tmpDir, 'node_modules', '@playwright', 'test', 'index.js');
  const playwrightTestEntry = path.join(playwrightRoot, 'packages', 'playwright', 'test.js');
  const fallbackPlaywrightTestEntry = path.join(playwrightRoot, 'test.js');
  const testEntry = fs.existsSync(playwrightTestEntry) ? playwrightTestEntry : fallbackPlaywrightTestEntry;

  const worker = new WorkerHost(0);
  const preforkError = await worker.prefork();
  assert(!preforkError, `Prefork failed: ${JSON.stringify(preforkError)}`);

  const expectedWorkerIndex = String(worker.workerIndex);

  await writeFile(nodeModulesTest, `module.exports = require(${JSON.stringify(testEntry)});\n`);
  await writeFile(configFile, `
module.exports = {
  testDir: ${JSON.stringify(tmpDir)},
  workers: 1,
  reporter: 'null',
};
`);
  await writeFile(testFile, `
const { test, expect } = require('@playwright/test');

test('prefork smoke', async ({}, testInfo) => {
  expect(process.env.ENDFORM_LATE_ENV).toBe('from-init');
  expect(process.env.TEST_WORKER_INDEX).toBe(process.env.EXPECTED_WORKER_INDEX);
  console.log('stdout-from-prefork-test');
  console.error('stderr-from-prefork-test');
  await test.step('prefork step', async () => {
    expect(1 + 1).toBe(2);
  });
  await testInfo.attach('prefork-attachment', {
    body: Buffer.from('attachment-body'),
    contentType: 'text/plain',
  });
});
`);

  const reporter = new SmokeReporter();
  const runner = new TestRunner({ configDir: tmpDir, resolvedConfigFile: configFile }, { workers: 1 });
  await runner.initialize({});
  const { status } = await runner.runTests(reporter, {
    locations: [testFile],
    projects: [],
    preforkedWorkers: [worker],
    workerEnv: { ENDFORM_LATE_ENV: 'from-init', EXPECTED_WORKER_INDEX: expectedWorkerIndex },
  });
  await runner.stop();

  assert(status === 'passed', `Expected run status passed, got ${status}. Events: ${reporter.events.join(', ')}`);
  assert(reporter.finalStatus === 'passed', `Expected reporter final status passed, got ${reporter.finalStatus}`);
  assert(reporter.testCount === 1, `Expected one test in onBegin, got ${reporter.testCount}`);
  assert(reporter.testTitle === 'prefork smoke', `Expected prefork smoke test, got ${reporter.testTitle}`);
  assert(reporter.workerIndex === worker.workerIndex, `Expected reporter workerIndex ${worker.workerIndex}, got ${reporter.workerIndex}`);
  assert(reporter.stdoutWithTest, 'Expected stdout to be attributed to test/result');
  assert(reporter.stderrWithTest, 'Expected stderr to be attributed to test/result');
  assert(reporter.events.includes('onStepBegin:prefork step'), `Missing step begin. Events: ${reporter.events.join(', ')}`);
  assert(reporter.events.includes('onStepEnd:prefork step'), `Missing step end. Events: ${reporter.events.join(', ')}`);
  assert(reporter.attachments.some(a => a.name === 'prefork-attachment' && a.body === 'attachment-body'), `Missing attachment. Attachments: ${JSON.stringify(reporter.attachments)}`);
  for (const event of ['onConfigure', 'onBegin', 'onTestBegin', 'onStdOut', 'onStdErr', 'onTestEnd:passed', 'onEnd:passed', 'onExit'])
    assert(reporter.events.includes(event), `Missing reporter event ${event}. Events: ${reporter.events.join(', ')}`);

  console.log('PREFORK_WORKER_SMOKE_OK');
  console.log(JSON.stringify({ workerIndex: worker.workerIndex, events: reporter.events }));
}

main().catch(e => {
  console.error(e.stack || e.message || String(e));
  process.exit(1);
});
