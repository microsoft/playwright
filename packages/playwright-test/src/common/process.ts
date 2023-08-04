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
import type { EnvProducedPayload, ProcessInitParams, TtyParams } from './ipc';
import { startProfiling, stopProfiling } from 'playwright-core/lib/utils';
import type { TestInfoError } from '../../types/test';
import { serializeError } from '../util';

export type ProtocolRequest = {
  id: number;
  method: string;
  params?: any;
};

export type ProtocolResponse = {
  id?: number;
  error?: TestInfoError;
  method?: string;
  params?: any;
  result?: any;
};

export class ProcessRunner {
  async gracefullyClose(): Promise<void> { }

  protected dispatchEvent(method: string, params: any) {
    const response: ProtocolResponse = { method, params };
    sendMessageToParent({ method: '__dispatch__', params: response });
  }
}

let closed = false;

sendMessageToParent({ method: 'ready' });

process.on('disconnect', gracefullyCloseAndExit);
process.on('SIGINT', () => {});
process.on('SIGTERM', () => {});

let processRunner: ProcessRunner;
let processName: string;
const startingEnv = { ...process.env };

process.on('message', async (message: any) => {
  if (message.method === '__init__') {
    const { processParams, runnerParams, runnerScript } = message.params as { processParams: ProcessInitParams, runnerParams: any, runnerScript: string };
    setTtyParams(process.stdout, processParams.stdoutParams);
    setTtyParams(process.stderr, processParams.stderrParams);
    void startProfiling();
    const { create } = require(runnerScript);
    processRunner = create(runnerParams) as ProcessRunner;
    processName = processParams.processName;
    return;
  }
  if (message.method === '__stop__') {
    const keys = new Set([...Object.keys(process.env), ...Object.keys(startingEnv)]);
    const producedEnv: EnvProducedPayload = [...keys].filter(key => startingEnv[key] !== process.env[key]).map(key => [key, process.env[key] ?? null]);
    sendMessageToParent({ method: '__env_produced__', params: producedEnv });
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
      const response: ProtocolResponse = { id, error: serializeError(e) };
      sendMessageToParent({ method: '__dispatch__', params: response });
    }
  }
});

async function gracefullyCloseAndExit() {
  if (closed)
    return;
  closed = true;
  // Force exit after 30 seconds.
  // eslint-disable-next-line no-restricted-properties
  setTimeout(() => process.exit(0), 30000);
  // Meanwhile, try to gracefully shutdown.
  await processRunner.gracefullyClose().catch(() => {});
  await stopProfiling(processName).catch(() => {});
  // eslint-disable-next-line no-restricted-properties
  process.exit(0);
}

function sendMessageToParent(message: { method: string, params?: any }) {
  try {
    process.send!(message);
  } catch (e) {
    // Can throw when closing.
  }
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
