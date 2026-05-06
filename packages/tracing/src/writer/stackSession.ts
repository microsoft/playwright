/**
 * Copyright (c) Microsoft Corporation.
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

import fs from 'fs';
import os from 'os';
import path from 'path';

import { removeFolders } from '@utils/fileUtils';
import { serializeClientSideCallMetadata } from '@tracing/reader/traceUtils';

import { race } from './race';

import type { ClientSideCallMetadata } from '@tracing/format/protocolTypes';

export type StackSession = {
  file: string;
  writer: Promise<void>;
  tmpDir: string | undefined;
  callStacks: ClientSideCallMetadata[];
  live?: boolean;
};

export type TracingStartedParams = {
  tracesDir?: string;
  traceName: string;
  live?: boolean;
};

export type TracingStartedResult = {
  stacksId: string;
};

export async function tracingStarted(signal: AbortSignal, stackSessions: Map<string, StackSession>, params: TracingStartedParams): Promise<TracingStartedResult> {
  let tmpDir: string | undefined = undefined;
  if (!params.tracesDir)
    tmpDir = await race(signal, fs.promises.mkdtemp(path.join(os.tmpdir(), 'playwright-tracing-')));
  const traceStacksFile = path.join(params.tracesDir || tmpDir!, params.traceName + '.stacks');
  stackSessions.set(traceStacksFile, { callStacks: [], file: traceStacksFile, writer: Promise.resolve(), tmpDir, live: params.live });
  return { stacksId: traceStacksFile };
}

export async function traceDiscarded(signal: AbortSignal, stackSessions: Map<string, StackSession>, stacksId: string): Promise<void> {
  await deleteStackSession(signal, stackSessions, stacksId);
}

export function addStackToTracingNoReply(stackSessions: Map<string, StackSession>, callData: ClientSideCallMetadata): void {
  for (const session of stackSessions.values()) {
    session.callStacks.push(callData);
    if (session.live) {
      session.writer = session.writer.then(() => {
        const buffer = Buffer.from(JSON.stringify(serializeClientSideCallMetadata(session.callStacks)));
        return fs.promises.writeFile(session.file, buffer);
      });
    }
  }
}

export async function deleteStackSession(signal: AbortSignal, stackSessions: Map<string, StackSession>, stacksId?: string): Promise<void> {
  const session = stacksId ? stackSessions.get(stacksId) : undefined;
  if (!session)
    return;
  stackSessions.delete(stacksId!);
  if (session.tmpDir)
    await race(signal, removeFolders([session.tmpDir]));
}
