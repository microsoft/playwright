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

import { parseClientSideCallMetadata } from '../../../packages/playwright-core/src/utils/isomorphic/traceUtils';
import type { ActionEntry, ContextEntry } from './entries';
import { createEmptyContext } from './entries';
import { SnapshotStorage } from './snapshotStorage';
import { TraceModernizer } from './traceModernizer';

export interface TraceModelBackend {
  entryNames(): Promise<string[]>;
  hasEntry(entryName: string): Promise<boolean>;
  readText(entryName: string): Promise<string | undefined>;
  readBlob(entryName: string): Promise<Blob | undefined>;
  isLive(): boolean;
  traceURL(): string;
}

export class TraceModel {
  contextEntries: ContextEntry[] = [];
  private _snapshotStorage: SnapshotStorage | undefined;
  private _backend!: TraceModelBackend;
  private _resourceToContentType = new Map<string, string>();

  constructor() {
  }

  async load(backend: TraceModelBackend, isRecorderMode: boolean, unzipProgress: (done: number, total: number) => void) {
    this._backend = backend;

    const ordinals: string[] = [];
    let hasSource = false;
    for (const entryName of await this._backend.entryNames()) {
      const match = entryName.match(/(.+)\.trace/);
      if (match)
        ordinals.push(match[1] || '');
      if (entryName.includes('src@'))
        hasSource = true;
    }
    if (!ordinals.length)
      throw new Error('Cannot find .trace file');

    this._snapshotStorage = new SnapshotStorage();

    // 3 * ordinals progress increments below.
    const total = ordinals.length * 3;
    let done = 0;
    for (const ordinal of ordinals) {
      const contextEntry = createEmptyContext();
      contextEntry.traceUrl = backend.traceURL();
      contextEntry.hasSource = hasSource;
      const modernizer = new TraceModernizer(contextEntry, this._snapshotStorage);

      const trace = await this._backend.readText(ordinal + '.trace') || '';
      modernizer.appendTrace(trace);
      unzipProgress(++done, total);

      const network = await this._backend.readText(ordinal + '.network') || '';
      modernizer.appendTrace(network);
      unzipProgress(++done, total);

      const actions = modernizer.actions().sort((a1, a2) => a1.startTime - a2.startTime);
      contextEntry.actions = isRecorderMode ? collapseActionsForRecorder(actions) : actions;

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

      const stacks = await this._backend.readText(ordinal + '.stacks');
      if (stacks) {
        const callMetadata = parseClientSideCallMetadata(JSON.parse(stacks));
        for (const action of contextEntry.actions)
          action.stack = action.stack || callMetadata.get(action.callId);
      }
      unzipProgress(++done, total);

      for (const resource of contextEntry.resources) {
        if (resource.request.postData?._sha1)
          this._resourceToContentType.set(resource.request.postData._sha1, stripEncodingFromContentType(resource.request.postData.mimeType));
        if (resource.response.content?._sha1)
          this._resourceToContentType.set(resource.response.content._sha1, stripEncodingFromContentType(resource.response.content.mimeType));
      }

      this.contextEntries.push(contextEntry);
    }

    this._snapshotStorage!.finalize();
  }

  async hasEntry(filename: string): Promise<boolean> {
    return this._backend.hasEntry(filename);
  }

  async resourceForSha1(sha1: string): Promise<Blob | undefined> {
    const blob = await this._backend.readBlob('resources/' + sha1);
    const contentType = this._resourceToContentType.get(sha1);
    // "x-unknown" in the har means "no content type".
    if (!blob || contentType === undefined || contentType === 'x-unknown')
      return blob;
    return new Blob([blob], { type: contentType });
  }

  storage(): SnapshotStorage {
    return this._snapshotStorage!;
  }
}

function stripEncodingFromContentType(contentType: string) {
  const charset = contentType.match(/^(.*);\s*charset=.*$/);
  if (charset)
    return charset[1];
  return contentType;
}

function collapseActionsForRecorder(actions: ActionEntry[]): ActionEntry[] {
  const result: ActionEntry[] = [];
  for (const action of actions) {
    const lastAction = result[result.length - 1];
    const isSameAction = lastAction && lastAction.method === action.method && lastAction.pageId === action.pageId;
    const isSameSelector = lastAction && 'selector' in lastAction.params && 'selector' in action.params && action.params.selector === lastAction.params.selector;
    const shouldMerge = isSameAction && (action.method === 'goto' || (action.method === 'fill' && isSameSelector));
    if (!shouldMerge) {
      result.push(action);
      continue;
    }
    result[result.length - 1] = action;
  }
  return result;
}
