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

import { monotonicTime } from '@isomorphic/time';
import { createGuid } from '@utils/crypto';
import { removeFolders } from '@utils/fileUtils';
import { SerializedFS } from '@utils/serializedFS';

import { race } from './race';

import type { AfterActionTraceEvent, BeforeActionTraceEvent, ResourceSnapshotTraceEvent, TraceEvent } from '@tracing/format/trace';
import type { Entry as HarEntry } from '@tracing/format/har';
import type { StackFrame } from '@tracing/format/protocolTypes';
import type { NameValue } from '@isomorphic/types';

type RecordingState = {
  options: StartOptions;
  traceName: string;
  networkFile: string;
  traceFile: string;
  tracesDir: string;
  resourcesDir: string;
  chunkOrdinal: number;
  networkSha1s: Set<string>;
  traceSha1s: Set<string>;
  recording: boolean;
  groupStack: string[];
};

export type TracingSessionOptions = {
  // Where the .trace / .network files and resources/ folder live. If undefined,
  // a tmp dir is created lazily on first access.
  tracesDir: string | undefined;
  // Whether the network file (which holds resource references shared across
  // chunks) should be preserved between chunks. True for browser contexts,
  // false for API request contexts (each chunk starts a fresh network file).
  preserveNetworkResources?: boolean;
  // Entry name for the primary trace stream when stopChunk produces an archive
  // zip. Defaults to 'trace.trace'. The test runner uses 'test.trace' so its
  // entry survives mergeTraceFiles unrenamed.
  traceEntryName?: string;
  // Optional pre-write transformer applied to every event/entry before it is
  // walked for sha1 collection and JSON.stringified. Returning a value treats
  // it as a leaf (no further recursion). Used to redact non-serializable types
  // (Buffer, Dispatcher, Date) into stable string placeholders without forcing
  // the caller to deep-clone every event up-front.
  replacer?: (value: any) => any | undefined;
};

export type StartOptions = {
  name?: string;
  live?: boolean;
};

export type StartChunkOptions = {
  name?: string;
};

export type StopChunkResult = {
  entries?: NameValue[];
  zipFile?: string;
};

export class TracingSession {
  private _options: TracingSessionOptions;
  private _state: RecordingState | undefined;
  private _isStopping = false;
  private _fs = new SerializedFS();
  private _allResources = new Set<string>();
  private _precreatedTracesDir: string | undefined;
  private _tracesTmpDir: string | undefined;

  constructor(options: TracingSessionOptions) {
    this._options = options;
    this._precreatedTracesDir = options.tracesDir;
  }

  // Lazily resolves the traces directory: if a directory was pre-set, returns
  // it; otherwise creates a tmp directory the first time it is needed.
  tracesDir(): string {
    if (this._precreatedTracesDir)
      return this._precreatedTracesDir;
    if (!this._tracesTmpDir)
      this._tracesTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-tracing-'));
    return this._tracesTmpDir;
  }

  async deleteTmpTracesDir(): Promise<void> {
    if (this._tracesTmpDir)
      await removeFolders([this._tracesTmpDir]);
  }

  // Awaits any pending FS work without tearing the session down.
  async flush(): Promise<void> {
    await this._fs.syncAndGetError();
  }

  hasState(): boolean {
    return !!this._state;
  }

  isRecording(): boolean {
    return !!this._state?.recording;
  }

  isStopping(): boolean {
    return this._isStopping;
  }

  recordingOptions(): StartOptions | undefined {
    return this._state?.options;
  }

  start(options: StartOptions): void {
    if (this._isStopping)
      throw new Error('Cannot start tracing while stopping');
    if (this._state)
      throw new Error('Tracing has been already started');
    const traceName = options.name || createGuid();
    const tracesDir = this.tracesDir();
    this._state = {
      options,
      traceName,
      tracesDir,
      traceFile: path.join(tracesDir, traceName + '.trace'),
      networkFile: path.join(tracesDir, traceName + '.network'),
      resourcesDir: path.join(tracesDir, 'resources'),
      chunkOrdinal: 0,
      traceSha1s: new Set(),
      networkSha1s: new Set(),
      recording: false,
      groupStack: [],
    };
    this._fs.mkdir(this._state.resourcesDir);
    this._fs.writeFile(this._state.networkFile, '');
  }

  startChunk(options: StartChunkOptions = {}): { traceName: string } {
    if (!this._state)
      throw new Error('Must start tracing before starting a new chunk');
    if (this._state.recording)
      throw new Error('Trace chunk is already in progress');
    if (this._isStopping)
      throw new Error('Cannot start a trace chunk while stopping');

    this._state.recording = true;

    if (options.name && options.name !== this._state.traceName)
      this._changeTraceName(this._state, options.name);
    else
      this._allocateNewTraceFile(this._state);
    if (!this._options.preserveNetworkResources)
      this._fs.writeFile(this._state.networkFile, '');

    this._fs.mkdir(path.dirname(this._state.traceFile));
    return { traceName: this._state.traceName };
  }

  async stopChunk(signal: AbortSignal, mode: 'archive' | 'discard' | 'entries'): Promise<StopChunkResult> {
    if (this._isStopping)
      throw new Error('Tracing is already stopping');
    this._isStopping = true;

    if (!this._state || !this._state.recording) {
      this._isStopping = false;
      if (mode !== 'discard')
        throw new Error('Must start tracing before stopping');
      return {};
    }

    // Network file survives across chunks for browser contexts; snapshot it now
    // under a name that won't clash with future "<traceName>.network".
    const newNetworkFile = path.join(this._state.tracesDir, this._state.traceName + `-pwnetcopy-${this._state.chunkOrdinal}.network`);

    const entries: NameValue[] = [];
    entries.push({ name: this._options.traceEntryName ?? 'trace.trace', value: this._state.traceFile });
    entries.push({ name: 'trace.network', value: newNetworkFile });
    for (const sha1 of new Set([...this._state.traceSha1s, ...this._state.networkSha1s]))
      entries.push({ name: path.join('resources', sha1), value: path.join(this._state.resourcesDir, sha1) });

    // Only reset trace sha1s; network resources are preserved between chunks.
    this._state.traceSha1s = new Set();

    if (mode === 'discard') {
      this._isStopping = false;
      this._state.recording = false;
      return {};
    }

    this._fs.copyFile(this._state.networkFile, newNetworkFile);

    const zipFile = this._state.traceFile + '.zip';
    if (mode === 'archive')
      this._fs.zip(entries, zipFile);

    let error: Error | undefined;
    try {
      await race(signal, this._fs.syncAndGetError());
    } catch (e) {
      error = e as Error;
    }

    this._isStopping = false;
    if (this._state)
      this._state.recording = false;

    // IMPORTANT: no awaits after this point — recording state must be settled.

    if (error)
      throw error;

    if (mode === 'entries')
      return { entries };
    return { zipFile };
  }

  async stop(signal: AbortSignal): Promise<void> {
    if (!this._state)
      return;
    if (this._isStopping)
      throw new Error('Tracing is already stopping');
    if (this._state.recording)
      throw new Error('Must stop trace file before stopping tracing');
    await race(signal, this._fs.syncAndGetError().finally(() => {
      this._state = undefined;
    }));
  }

  appendTraceEvent(event: TraceEvent): void {
    if (!this._state)
      return;
    if (event.type === 'before' && !event.parentId && this._state.groupStack.length)
      event.parentId = this._state.groupStack[this._state.groupStack.length - 1];
    const visited = transform(event, this._state.traceSha1s, this._options.replacer);
    const flush = this._state.options.live || (event.type !== 'event' && event.type !== 'console' && event.type !== 'log');
    this._fs.appendFile(this._state.traceFile, JSON.stringify(visited) + '\n', flush);
  }

  appendResource(sha1: string, buffer: Buffer): void {
    if (!this._state)
      return;
    if (this._allResources.has(sha1))
      return;
    this._allResources.add(sha1);
    const resourcePath = path.join(this._state.resourcesDir, sha1);
    this._fs.writeFile(resourcePath, buffer, true /* skipIfExists */);
  }

  appendNetworkEntry(entry: HarEntry): void {
    if (!this._state)
      return;
    const event: ResourceSnapshotTraceEvent = { type: 'resource-snapshot', snapshot: entry };
    const visited = transform(event, this._state.networkSha1s, this._options.replacer);
    this._fs.appendFile(this._state.networkFile, JSON.stringify(visited) + '\n', true /* flush */);
  }

  appendNetworkEntries(entries: Iterable<HarEntry>): void {
    if (!this._state)
      return;
    const lines: string[] = [];
    for (const entry of entries) {
      const event: ResourceSnapshotTraceEvent = { type: 'resource-snapshot', snapshot: entry };
      const visited = transform(event, this._state.networkSha1s, this._options.replacer);
      lines.push(JSON.stringify(visited));
    }
    if (lines.length)
      this._fs.appendFile(this._state.networkFile, lines.join('\n') + '\n', true);
  }

  currentGroupId(): string | undefined {
    if (!this._state || !this._state.groupStack.length)
      return undefined;
    return this._state.groupStack[this._state.groupStack.length - 1];
  }

  group(options: { callId: string, startTime: number, title: string, stepId?: string, stack: StackFrame[] }): void {
    if (!this._state)
      return;
    const event: BeforeActionTraceEvent = {
      type: 'before',
      callId: options.callId,
      startTime: options.startTime,
      title: options.title,
      class: 'Tracing',
      method: 'tracingGroup',
      params: {},
      stepId: options.stepId,
      stack: options.stack,
    };
    // Append before pushing — appendTraceEvent will auto-default parentId from
    // the current top of the group stack (the enclosing group), not this new one.
    this.appendTraceEvent(event);
    this._state.groupStack.push(event.callId);
  }

  groupEnd(): void {
    if (!this._state)
      return;
    const callId = this._state.groupStack.pop();
    if (!callId)
      return;
    const event: AfterActionTraceEvent = {
      type: 'after',
      callId,
      endTime: monotonicTime(),
    };
    this.appendTraceEvent(event);
  }

  closeAllGroups(): void {
    while (this.currentGroupId())
      this.groupEnd();
  }

  private _allocateNewTraceFile(state: RecordingState): void {
    const suffix = state.chunkOrdinal ? `-chunk${state.chunkOrdinal}` : ``;
    state.chunkOrdinal++;
    state.traceFile = path.join(state.tracesDir, `${state.traceName}${suffix}.trace`);
  }

  private _changeTraceName(state: RecordingState, name: string): void {
    state.traceName = name;
    state.chunkOrdinal = 0; // Reset ordinal for the new name.
    this._allocateNewTraceFile(state);

    const newNetworkFile = path.join(state.tracesDir, name + '.network');
    if (this._options.preserveNetworkResources)
      this._fs.copyFile(state.networkFile, newNetworkFile);
    state.networkFile = newNetworkFile;
  }
}

// Walk the event tree, collecting any sha1 references into the provided set
// AND applying the optional replacer. Returns a (possibly transformed) copy
// suitable for JSON.stringify.
function transform(object: any, sha1s: Set<string>, replacer?: (value: any) => any | undefined): any {
  if (object === null || typeof object !== 'object')
    return object;
  if (Array.isArray(object))
    return object.map(o => transform(o, sha1s, replacer));
  if (replacer) {
    const replaced = replacer(object);
    if (replaced !== undefined)
      return replaced;
  }
  const result: any = {};
  for (const key in object) {
    if ((key === 'sha1' || key === '_sha1' || key.endsWith('Sha1')) && object[key])
      sha1s.add(object[key]);
    result[key] = transform(object[key], sha1s, replacer);
  }
  return result;
}
