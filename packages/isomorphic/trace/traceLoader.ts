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

import { SnapshotStorage } from './snapshotStorage';
import { TraceModernizer } from './traceModernizer';

import type { ContextEntry } from './entries';

export interface TraceLoaderBackend {
  entryNames(): Promise<string[]>;
  hasEntry(entryName: string): Promise<boolean>;
  readText(entryName: string): Promise<string | undefined>;
  readBlob(entryName: string): Promise<Blob | undefined>;
  isLive(): boolean;
}

export class TraceLoader {
  contextEntries: ContextEntry[] = [];
  private _snapshotStorage: SnapshotStorage | undefined;
  private _backend!: TraceLoaderBackend;
  private _resourceToContentType = new Map<string, string>();

  constructor() {
  }

  async load(backend: TraceLoaderBackend, traceFile?: string, unzipProgress?: (done: number, total: number) => void) {
    this._backend = backend;

    const requestedPrefix = traceFile?.match(/(.+)\.trace$/)?.[1];
    const prefixes: string[] = [];
    const entryNames = await this._backend.entryNames();
    let hasSource = false;
    for (const entryName of entryNames) {
      const match = entryName.match(/(.+)\.trace$/);
      if (match && (!requestedPrefix || requestedPrefix === match[1]))
        prefixes.push(match[1] || '');
      if (entryName.startsWith('src/') || entryName.includes('src@'))
        hasSource = true;
    }
    if (!prefixes.length)
      throw new Error('Cannot find .trace file');

    this._snapshotStorage = new SnapshotStorage();

    const traceFilesByPrefix = new Map(prefixes.map(prefix => [prefix, traceFileNames(entryNames, prefix)]));
    const total = prefixes.length + [...traceFilesByPrefix.values()].reduce((sum, files) => sum + files.length, 0);
    let done = 0;
    for (const prefix of prefixes) {
      const contextEntry = createEmptyContext();
      contextEntry.hasSource = hasSource;
      const modernizer = new TraceModernizer(contextEntry, this._snapshotStorage);

      for (const traceFileName of traceFilesByPrefix.get(prefix)!) {
        const trace = await this._backend.readText(traceFileName) || '';
        modernizer.appendTrace(trace);
        unzipProgress?.(++done, total);
      }

      const stacks = await this._backend.readText(prefix + '.stacks');
      if (stacks)
        modernizer.appendStacks(stacks);
      unzipProgress?.(++done, total);

      contextEntry.actions = modernizer.actions().sort((a1, a2) => a1.startTime - a2.startTime);

      if (!backend.isLive()) {
        // Terminate actions w/o after event gracefully.
        // This would close after hooks event that has not been closed because
        // the trace is usually saved before after hooks complete.
        for (const action of contextEntry.actions.slice().reverse()) {
          if (!action.endTime && !action.error) {
            for (const a of contextEntry.actions) {
              if (a.parentId === action.callId && action.endTime < a.endTime)
                action.endTime = a.endTime;
            }
          }
        }
      }

      for (const resource of contextEntry.resources) {
        if (resource.request.postData?._file)
          this._resourceToContentType.set(resource.request.postData._file, stripEncodingFromContentType(resource.request.postData.mimeType));
        if (resource.response.content?._file)
          this._resourceToContentType.set(resource.response.content._file, stripEncodingFromContentType(resource.response.content.mimeType));
      }

      this.contextEntries.push(contextEntry);
    }

    this._snapshotStorage.finalize();
  }

  async hasEntry(filename: string): Promise<boolean> {
    return this._backend.hasEntry(filename);
  }

  async resourceEntry(file: string): Promise<Blob | undefined> {
    const blob = await this._backend.readBlob(file);
    const contentType = this._resourceToContentType.get(file);
    // "x-unknown" in the har means "no content type".
    if (!blob || contentType === undefined || contentType === 'x-unknown')
      return blob;
    return new Blob([blob], { type: contentType });
  }

  storage(): SnapshotStorage {
    return this._snapshotStorage!;
  }
}

// The ".meta" file carries the trace version required to read everything else, and actions
// are referenced by the events in the ".trace" file, hence the order. Files with an unknown
// extension come last. The ".stacks" file is not a trace stream and is read separately.
const kTraceFileExtensions = ['.meta', '.actions', '.trace', '.network'];
const kNonTraceFileExtensions = ['.stacks'];

function traceFileNames(entryNames: string[], prefix: string): string[] {
  const remaining = new Set<string>();
  for (const entryName of entryNames) {
    if (!entryName.startsWith(prefix))
      continue;
    // Only take "<prefix>.<extension>" files, e.g. neither "<prefix>-chunk1.trace" nor "<prefix>.trace.zip".
    const extension = entryName.substring(prefix.length);
    if (/^\.[a-z]+$/.test(extension) && !kNonTraceFileExtensions.includes(extension))
      remaining.add(entryName);
  }

  const result: string[] = [];
  for (const extension of kTraceFileExtensions) {
    if (remaining.delete(prefix + extension))
      result.push(prefix + extension);
  }
  result.push(...remaining);
  return result;
}

function stripEncodingFromContentType(contentType: string) {
  const charset = contentType.match(/^(.*);\s*charset=.*$/);
  if (charset)
    return charset[1];
  return contentType;
}

function createEmptyContext(): ContextEntry {
  return {
    origin: 'testRunner',
    startTime: Number.MAX_SAFE_INTEGER,
    wallTime: Number.MAX_SAFE_INTEGER,
    monotonicTime: 0,
    endTime: 0,
    browserName: '',
    options: {
      deviceScaleFactor: 1,
      isMobile: false,
      viewport: { width: 1280, height: 800 },
    },
    pages: [],
    resources: [],
    actions: [],
    screenshots: [],
    ariaSnapshots: [],
    domSnapshots: [],
    videos: [],
    events: [],
    errors: [],
    stdio: [],
    hasSource: false,
  };
}
