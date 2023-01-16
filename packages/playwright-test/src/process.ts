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

import type { WriteStream } from 'tty';
import * as util from 'util';
import type { ProcessInitParams, TeardownErrorsPayload, TestOutputPayload, TtyParams } from './ipc';
import { startProfiling, stopProfiling } from './profiler';
import type { TestInfoError } from './types';
import { serializeError } from './util';

export type ProtocolRequest = {
  id: number;
  method: string;
  params?: any;
};

export type ProtocolResponse = {
  id?: number;
  error?: string;
  method?: string;
  params?: any;
  result?: any;
};

export class ProcessRunner {
  appendProcessTeardownDiagnostics(error: TestInfoError) { }
  unhandledError(reason: any) { }
  async cleanup(): Promise<void> { }
  async stop(): Promise<void> { }

  protected dispatchEvent(method: string, params: any) {
    const response: ProtocolResponse = { method, params };
    sendMessageToParent({ method: '__dispatch__', params: response });
  }
}

let closed = false;

sendMessageToParent({ method: 'ready' });

process.stdout.write = (chunk: string | Buffer) => {
  const outPayload: TestOutputPayload = {
    ...chunkToParams(chunk)
  };
  sendMessageToParent({ method: 'stdOut', params: outPayload });
  return true;
};

if (!process.env.PW_RUNNER_DEBUG) {
  process.stderr.write = (chunk: string | Buffer) => {
    const outPayload: TestOutputPayload = {
      ...chunkToParams(chunk)
    };
    sendMessageToParent({ method: 'stdErr', params: outPayload });
    return true;
  };
}

process.on('disconnect', gracefullyCloseAndExit);
process.on('SIGINT', () => {});
process.on('SIGTERM', () => {});

let processRunner: ProcessRunner;
let workerIndex: number | undefined;

process.on('unhandledRejection', (reason, promise) => {
  if (processRunner)
    processRunner.unhandledError(reason);
});

process.on('uncaughtException', error => {
  if (processRunner)
    processRunner.unhandledError(error);
});

process.on('message', async message => {
  if (message.method === 'init') {
    const initParams = message.params as ProcessInitParams;
    workerIndex = initParams.workerIndex;
    initConsoleParameters(initParams);
    startProfiling();
    const { create } = require(process.env.PW_PROCESS_RUNNER_SCRIPT!);
    processRunner = create(initParams) as ProcessRunner;
    return;
  }
  if (message.method === 'stop') {
    await gracefullyCloseAndExit();
    return;
  }
  if (message.method === '__dispatch__') {
    const { id, method, params } = message.params as ProtocolRequest;
    try {
      const result = await (processRunner as any)[method](params);
      const response: ProtocolResponse = { id, result };
      sendMessageToParent({ method: '__dispatch__', params: response });
    } catch (e) {
      const response: ProtocolResponse = { id, error: e.toString() };
      sendMessageToParent({ method: '__dispatch__', params: response });
    }
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
    if (processRunner) {
      await processRunner.stop();
      await processRunner.cleanup();
    }
    if (workerIndex !== undefined)
      await stopProfiling(workerIndex);
  } catch (e) {
    try {
      const error = serializeError(e);
      processRunner.appendProcessTeardownDiagnostics(error);
      const payload: TeardownErrorsPayload = { fatalErrors: [error] };
      sendMessageToParent({ method: 'teardownErrors', params: payload });
    } catch {
    }
  }
  process.exit(0);
}

function sendMessageToParent(message: { method: string, params?: any }) {
  try {
    process.send!(message);
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

function initConsoleParameters(initParams: ProcessInitParams) {
  // Make sure the output supports colors.
  setTtyParams(process.stdout, initParams.stdoutParams);
  setTtyParams(process.stderr, initParams.stderrParams);
}

function setTtyParams(stream: WriteStream, params: TtyParams) {
  stream.isTTY = true;
  if (params.rows)
    stream.rows = params.rows;
  if (params.columns)
    stream.columns = params.columns;
  stream.getColorDepth = () => params.colorDepth;
  stream.hasColors = ((count = 16) => {
    // count is optional and the first argument may actually be env.
    if (typeof count !== 'number')
      count = 16;
    return count <= 2 ** params.colorDepth;
  })as any;
}
