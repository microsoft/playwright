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

import { initializeImageMatcher } from './expect';
import { TestRunner } from './testRunner';
import * as util from 'util';
import { FixturePool } from './fixtures';
import { RunnerConfig } from './runnerConfig';
import { Console } from 'console';

let closed = false;

sendMessageToParent('ready');

function chunkToParams(chunk) {
  if (chunk instanceof Buffer)
    return { buffer: chunk.toString('base64') };
  if (typeof chunk !== 'string')
    return util.inspect(chunk);
  return chunk;
}

global.console = new Console({
  stdout: process.stdout,
  stderr: process.stderr,
  colorMode: process.env.FORCE_COLOR === '1',
})

process.stdout.write = chunk => {
  sendMessageToParent('stdout', chunkToParams(chunk));
  return true;
};

process.stderr.write = chunk => {
  sendMessageToParent('stderr', chunkToParams(chunk));
  return true;
};

process.on('disconnect', gracefullyCloseAndExit);
process.on('SIGINT',() => {});
process.on('SIGTERM',() => {});

let workerId: number;
let testRunner: TestRunner;
let fixturePool: FixturePool<RunnerConfig>;

process.on('message', async message => {
  if (message.method === 'init') {
    fixturePool = new FixturePool<RunnerConfig>();
    workerId = message.params.workerId;
    initializeImageMatcher(message.params);
    return;
  }
  if (message.method === 'stop') {
    await gracefullyCloseAndExit();
    return;
  }
  if (message.method === 'run') {
    testRunner = new TestRunner(fixturePool, message.params.entry, message.params.config, workerId);
    for (const event of ['test', 'pending', 'pass', 'fail', 'done'])
      testRunner.on(event, sendMessageToParent.bind(null, event));
    await testRunner.run();
    testRunner = null;
    // Mocha runner adds these; if we don't remove them, we'll get a leak.
    process.removeAllListeners('uncaughtException');
  }
});

async function gracefullyCloseAndExit() {
  if (closed)
    return;
  closed = true;
  // Force exit after 30 seconds.
  setTimeout(() => process.exit(0), 30000);
  // Meanwhile, try to gracefully close all browsers.
  if (testRunner)
    await testRunner.stop();
  if (fixturePool)
    await fixturePool.teardownScope('worker');
  process.exit(0);
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
