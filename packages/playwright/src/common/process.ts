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

import { setTimeOrigin, startProfiling, stopProfiling } from 'playwright-core/lib/utils';

import { serializeError } from '../util';

import type { EnvProducedPayload, ProcessInitParams, TestInfoErrorImpl } from './ipc';

export type ProtocolRequest = {
  id: number;
  method: string;
  params?: any;
};

export type ProtocolResponse = {
  id?: number;
  error?: TestInfoErrorImpl;
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

let gracefullyCloseCalled = false;
let forceExitInitiated = false;

sendMessageToParent({ method: 'ready' });

process.on('disconnect', () => gracefullyCloseAndExit(true));
process.on('SIGINT', () => {});
process.on('SIGTERM', () => {});

let processRunner: ProcessRunner | undefined;
let processName: string | undefined;
const startingEnv = { ...process.env };

process.on('message', async (message: any) => {
  if (message.method === '__init__') {
    const { processParams, runnerParams, runnerScript } = message.params as { processParams: ProcessInitParams, runnerParams: any, runnerScript: string };
    void startProfiling();
    setTimeOrigin(processParams.timeOrigin);
    const { create } = require(runnerScript);
    processRunner = create(runnerParams) as ProcessRunner;
    processName = processParams.processName;
    return;
  }
  if (message.method === '__stop__') {
    const keys = new Set([...Object.keys(process.env), ...Object.keys(startingEnv)]);
    const producedEnv: EnvProducedPayload = [...keys].filter(key => startingEnv[key] !== process.env[key]).map(key => [key, process.env[key] ?? null]);
    sendMessageToParent({ method: '__env_produced__', params: producedEnv });
    await gracefullyCloseAndExit(false);
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

const kForceExitTimeout = +(process.env.PWTEST_FORCE_EXIT_TIMEOUT || 30000);

async function gracefullyCloseAndExit(forceExit: boolean) {
  if (forceExit && !forceExitInitiated) {
    forceExitInitiated = true;
    // Force exit after 30 seconds.
    // eslint-disable-next-line no-restricted-properties
    setTimeout(() => process.exit(0), kForceExitTimeout);
  }
  if (!gracefullyCloseCalled) {
    gracefullyCloseCalled = true;
    // Meanwhile, try to gracefully shutdown.
    await processRunner?.gracefullyClose().catch(() => {});
    if (processName)
      await stopProfiling(processName).catch(() => {});
    // eslint-disable-next-line no-restricted-properties
    process.exit(0);
  }
}

function sendMessageToParent(message: { method: string, params?: any }) {
  try {
    process.send!(message);
  } catch (e) {
    try {
      // By default, the IPC messages are serialized as JSON.
      JSON.stringify(message);
    } catch {
      // Always throw serialization errors.
      throw e;
    }
    // Can throw when closing.
  }
}
