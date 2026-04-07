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
import path from 'path';

import { TraceModel, buildActionTree } from '@isomorphic/trace/traceModel';
import { TraceLoader } from '@isomorphic/trace/traceLoader';
import { renderTitleForCall } from '@isomorphic/protocolFormatter';
import { DirTraceLoaderBackend, extractTrace } from './traceParser';

import type { ActionTraceEventInContext } from '@isomorphic/trace/traceModel';

const traceDir = path.join('.playwright-cli', 'trace');
const cliOutputDir = '.playwright-cli';

export class LoadedTrace {
  readonly model: TraceModel;
  readonly loader: TraceLoader;
  readonly ordinalToCallId: Map<number, string>;
  readonly callIdToOrdinal: Map<string, number>;

  constructor(model: TraceModel, loader: TraceLoader, ordinals: { ordinalToCallId: Map<number, string>, callIdToOrdinal: Map<string, number> }) {
    this.model = model;
    this.loader = loader;
    this.ordinalToCallId = ordinals.ordinalToCallId;
    this.callIdToOrdinal = ordinals.callIdToOrdinal;
  }

  resolveActionId(actionId: string): ActionTraceEventInContext | undefined {
    const ordinal = parseInt(actionId, 10);
    if (!isNaN(ordinal)) {
      const callId = this.ordinalToCallId.get(ordinal);
      if (callId)
        return this.model.actions.find(a => a.callId === callId);
    }
    return this.model.actions.find(a => a.callId === actionId);
  }
}

function ensureTraceOpen(): string {
  if (!fs.existsSync(traceDir))
    throw new Error(`No trace opened. Run 'npx playwright trace open <file>' first.`);
  return traceDir;
}

export async function closeTrace() {
  if (fs.existsSync(traceDir))
    await fs.promises.rm(traceDir, { recursive: true });
}

export async function openTrace(traceFile: string) {
  const filePath = path.resolve(traceFile);
  if (!fs.existsSync(filePath))
    throw new Error(`Trace file not found: ${filePath}`);
  await closeTrace();
  await fs.promises.mkdir(traceDir, { recursive: true });
  if (filePath.endsWith('.zip'))
    await extractTrace(filePath, traceDir);
  else
    await fs.promises.writeFile(path.join(traceDir, '.link'), filePath, 'utf-8');
}

export async function loadTrace(): Promise<LoadedTrace> {
  const dir = ensureTraceOpen();
  const linkFile = path.join(dir, '.link');
  let traceDir: string;
  let traceFile: string | undefined;
  if (fs.existsSync(linkFile)) {
    const tracePath = await fs.promises.readFile(linkFile, 'utf-8');
    traceDir = path.dirname(tracePath);
    traceFile = path.basename(tracePath);
  } else {
    traceDir = dir;
  }
  const backend = new DirTraceLoaderBackend(traceDir);
  const loader = new TraceLoader();
  await loader.load(backend, traceFile);
  const model = new TraceModel(traceDir, loader.contextEntries);
  return new LoadedTrace(model, loader, buildOrdinalMap(model));
}

export function formatTimestamp(ms: number, base: number): string {
  const relative = ms - base;
  if (relative < 0)
    return '0:00.000';
  const totalMs = Math.floor(relative);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}

export function actionTitle(action: ActionTraceEventInContext): string {
  return renderTitleForCall({ ...action, type: action.class }) || `${action.class}.${action.method}`;
}

export async function saveOutputFile(fileName: string, content: string | Buffer, explicitOutput?: string): Promise<string> {
  let outFile: string;
  if (explicitOutput) {
    outFile = explicitOutput;
  } else {
    await fs.promises.mkdir(cliOutputDir, { recursive: true });
    outFile = path.join(cliOutputDir, fileName);
  }
  await fs.promises.writeFile(outFile, content);
  return outFile;
}


function buildOrdinalMap(model: TraceModel): { ordinalToCallId: Map<number, string>, callIdToOrdinal: Map<string, number> } {
  const actions = model.actions.filter(a => a.group !== 'configuration');
  const { rootItem } = buildActionTree(actions);
  const ordinalToCallId = new Map<number, string>();
  const callIdToOrdinal = new Map<string, number>();
  let ordinal = 1;
  const visit = (item: ReturnType<typeof buildActionTree>['rootItem']) => {
    ordinalToCallId.set(ordinal, item.action.callId);
    callIdToOrdinal.set(item.action.callId, ordinal);
    ordinal++;
    for (const child of item.children)
      visit(child);
  };
  for (const child of rootItem.children)
    visit(child);
  return { ordinalToCallId, callIdToOrdinal };
}
