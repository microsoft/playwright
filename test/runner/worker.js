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

const debug = require('debug');
const { fixturePool } = require('./fixturesUI');
const { gracefullyCloseAll } = require('../../lib/server/processLauncher');
const { TestRunner } = require('./testRunner');
const util = require('util');

let closed = false;

sendMessageToParent('ready');

function chunkToParams(chunk) {
  if (chunk instanceof Buffer)
    return { buffer: chunk.toString('base64') };
  if (typeof chunk !== 'string')
    return util.inspect(chunk);
  return chunk;
}

process.stdout.write = chunk => {
  sendMessageToParent('stdout', chunkToParams(chunk));
};

process.stderr.write = chunk => {
  sendMessageToParent('stderr', chunkToParams(chunk));
};

debug.log = data => {
  sendMessageToParent('debug', data);
};

process.on('disconnect', gracefullyCloseAndExit);
process.on('SIGINT',() => {});
process.on('SIGTERM',() => {});

process.on('message', async message => {
  if (message.method === 'init')
    process.env.JEST_WORKER_ID = message.params.workerId;
  if (message.method === 'stop') {
    await fixturePool.teardownScope('worker');
    await gracefullyCloseAndExit();
  } if (message.method === 'run') {
    const testRunner = new TestRunner(message.params.file, message.params.options);
    for (const event of ['test', 'pending', 'pass', 'fail', 'done'])
      testRunner.on(event, sendMessageToParent.bind(null, event));
    await testRunner.run();
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
  await gracefullyCloseAll();
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
