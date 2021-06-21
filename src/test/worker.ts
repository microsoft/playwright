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

import { Console } from 'console';
import * as util from 'util';
import { RunPayload, TestOutputPayload, WorkerInitParams } from './ipc';
import { startProfiling, stopProfiling } from './profiler';
import { serializeError } from './util';
import { WorkerRunner } from './workerRunner';

let closed = false;

sendMessageToParent('ready');

global.console = new Console({
  stdout: process.stdout,
  stderr: process.stderr,
  colorMode: process.env.FORCE_COLOR === '1',
});

process.stdout.write = (chunk: string | Buffer) => {
  const outPayload: TestOutputPayload = {
    testId: workerRunner?._currentTest?.testId,
    ...chunkToParams(chunk)
  };
  sendMessageToParent('stdOut', outPayload);
  return true;
};

if (!process.env.PW_RUNNER_DEBUG) {
  process.stderr.write = (chunk: string | Buffer) => {
    const outPayload: TestOutputPayload = {
      testId: workerRunner?._currentTest?.testId,
      ...chunkToParams(chunk)
    };
    sendMessageToParent('stdErr', outPayload);
    return true;
  };
}

process.on('disconnect', gracefullyCloseAndExit);
process.on('SIGINT',() => {});
process.on('SIGTERM',() => {});

let workerRunner: WorkerRunner;
let workerIndex: number | undefined;

process.on('unhandledRejection', (reason, promise) => {
  if (workerRunner)
    workerRunner.unhandledError(reason);
});

process.on('uncaughtException', error => {
  if (workerRunner)
    workerRunner.unhandledError(error);
});

process.on('message', async message => {
  if (message.method === 'init') {
    const initParams = message.params as WorkerInitParams;
    workerIndex = initParams.workerIndex;
    startProfiling();
    workerRunner = new WorkerRunner(initParams);
    for (const event of ['testBegin', 'testEnd', 'done'])
      workerRunner.on(event, sendMessageToParent.bind(null, event));
    return;
  }
  if (message.method === 'stop') {
    await gracefullyCloseAndExit();
    return;
  }
  if (message.method === 'run') {
    const runPayload = message.params as RunPayload;
    await workerRunner!.run(runPayload);
  }
});

async function gracefullyCloseAndExit() {
  if (closed)
    return;
  closed = true;
  // Force exit after 30 seconds.
  setTimeout(() => process.exit(0), 30000);
  // Meanwhile, try to gracefully shutdown.
  try {
    if (workerRunner) {
      workerRunner.stop();
      await workerRunner.cleanup();
    }
    if (workerIndex !== undefined)
      await stopProfiling(workerIndex);
  } catch (e) {
    process.send!({ method: 'teardownError', params: { error: serializeError(e) } });
  }
  process.exit(0);
}

function sendMessageToParent(method: string, params = {}) {
  try {
    process.send!({ method, params });
  } catch (e) {
    // Can throw when closing.
  }
}

function chunkToParams(chunk: Buffer | string):  { text?: string, buffer?: string } {
  if (chunk instanceof Buffer)
    return { buffer: chunk.toString('base64') };
  if (typeof chunk !== 'string')
    return { text: util.inspect(chunk) };
  return { text: chunk };
}
