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

import { parseClientSideCallMetadata } from './traceUtils';

import { createEmptyContext } from './entries';
import { SnapshotStorage } from './snapshotStorage';
import { TraceModernizer } from './traceModernizer';

import type { ActionEntry, ContextEntry } from './entries';
import type { StackFrame } from '@trace/trace';

export interface TraceLoaderBackend {
  entryNames(): Promise<string[]>;
  hasEntry(entryName: string): Promise<boolean>;
  readText(entryName: string): Promise<string | undefined>;
  readBlob(entryName: string): Promise<Blob | undefined>;
  isLive(): boolean;
}

export class TraceLoader {
  contextEntry: ContextEntry = createEmptyContext();
  private _snapshotStorage: SnapshotStorage | undefined;
  private _backend!: TraceLoaderBackend;
  private _resourceToContentType = new Map<string, string>();

  constructor() {
  }

  async load(backend: TraceLoaderBackend, traceFile?: string, unzipProgress?: (done: number, total: number) => void) {
    this._backend = backend;

    const prefix = traceFile?.match(/(.+)\.trace$/)?.[1];
    const traceNames: string[] = [];
    const networkNames: string[] = [];
    const stacksNames: string[] = [];
    let hasSource = false;
    for (const entryName of await this._backend.entryNames()) {
      if (entryName.endsWith('.trace') && (!prefix || entryName === prefix + '.trace'))
        traceNames.push(entryName);
      if (entryName.endsWith('.network') && (!prefix || entryName === prefix + '.network'))
        networkNames.push(entryName);
      if (entryName.endsWith('.stacks') && (!prefix || entryName === prefix + '.stacks'))
        stacksNames.push(entryName);
      if (entryName.startsWith('src/') || entryName.includes('src@'))
        hasSource = true;
    }
    if (!traceNames.length)
      throw new Error('Cannot find .trace file');

    this._snapshotStorage = new SnapshotStorage();

    const total = traceNames.length + networkNames.length + stacksNames.length;
    let done = 0;
    const contextEntries: ContextEntry[] = [];

    // Load trace files first to learn the trace format version, because network files do not include one.
    let version: number | undefined;
    for (const traceName of traceNames) {
      const contextEntry = createEmptyContext();
      contextEntry.hasSource = hasSource;
      const modernizer = new TraceModernizer(contextEntry, this._snapshotStorage);
      modernizer.appendTrace(await this._backend.readText(traceName) || '');
      version = Math.min(version ?? Number.MAX_SAFE_INTEGER, modernizer.version() ?? Number.MAX_SAFE_INTEGER);
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

      contextEntries.push(contextEntry);
    }

    for (const networkName of networkNames) {
      const contextEntry = createEmptyContext();
      contextEntry.origin = 'library';
      const modernizer = new TraceModernizer(contextEntry, this._snapshotStorage, version === Number.MAX_SAFE_INTEGER ? undefined : version);
      modernizer.appendTrace(await this._backend.readText(networkName) || '');
      unzipProgress?.(++done, total);

      // Network files do not include the time origin event,
      // so we derive the time origin from the resources instead.
      for (const resource of contextEntry.resources) {
        // eslint-disable-next-line no-restricted-globals
        const wallTime = resource.startedDateTime ? Date.parse(resource.startedDateTime) : NaN;
        if (resource._monotonicTime && !isNaN(wallTime)) {
          contextEntry.wallTime = wallTime;
          contextEntry.monotonicTime = resource._monotonicTime;
          break;
        }
      }

      contextEntries.push(contextEntry);
    }

    const callMetadata = new Map<string, StackFrame[]>();
    for (const stacksName of stacksNames) {
      const stacks = await this._backend.readText(stacksName);
      if (stacks) {
        for (const [callId, stack] of parseClientSideCallMetadata(JSON.parse(stacks)))
          callMetadata.set(callId, stack);
      }
      unzipProgress?.(++done, total);
    }

    for (const contextEntry of contextEntries) {
      for (const resource of contextEntry.resources) {
        if (resource.request.postData?._file)
          this._resourceToContentType.set(resource.request.postData._file, stripEncodingFromContentType(resource.request.postData.mimeType));
        if (resource.response.content?._file)
          this._resourceToContentType.set(resource.response.content._file, stripEncodingFromContentType(resource.response.content.mimeType));
      }
    }

    this.contextEntry = mergeContextEntries(contextEntries);
    for (const action of this.contextEntry.actions)
      action.stack = action.stack || callMetadata.get(action.callId);
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

function stripEncodingFromContentType(contentType: string) {
  const charset = contentType.match(/^(.*);\s*charset=.*$/);
  if (charset)
    return charset[1];
  return contentType;
}

function mergeContextEntries(entries: ContextEntry[]): ContextEntry {
  const libraryEntries = entries.filter(entry => entry.origin === 'library');
  const testRunnerEntries = entries.filter(entry => entry.origin === 'testRunner');

  // Align each file with the test runner clock. This updates all the timestamps,
  // so it must be done before merging events below.
  const timeOrigin = (entry: ContextEntry) => entry.wallTime - entry.monotonicTime;
  const runnerEntry = testRunnerEntries.find(entry => entry.monotonicTime);
  for (const entry of libraryEntries) {
    if (runnerEntry && entry.monotonicTime)
      adjustMonotonicTime(entry, timeOrigin(entry) - timeOrigin(runnerEntry));
  }

  const libraryEntry = libraryEntries[0];
  const testRunnerEntry = testRunnerEntries[0];
  const result = createEmptyContext();
  result.origin = libraryEntry ? 'library' : 'testRunner';
  result.browserName = libraryEntry?.browserName || '';
  result.channel = libraryEntry?.channel;
  result.platform = libraryEntry?.platform;
  result.playwrightVersion = entries.find(entry => entry.playwrightVersion)?.playwrightVersion;
  result.sdkLanguage = libraryEntry?.sdkLanguage;
  result.testIdAttributeName = libraryEntry?.testIdAttributeName;
  result.title = libraryEntry?.title;
  result.options = libraryEntry?.options || {};
  result.testTimeout = testRunnerEntry?.testTimeout;
  result.annotations = testRunnerEntry?.annotations;
  result.hasSource = entries.some(entry => entry.hasSource);
  result.hasStepData = !!testRunnerEntry;
  result.wallTime = entries.reduce((prev, entry) => Math.min(prev, entry.wallTime), result.wallTime);
  result.startTime = entries.reduce((prev, entry) => Math.min(prev, entry.startTime), result.startTime);
  result.endTime = entries.reduce((prev, entry) => Math.max(prev, entry.endTime), result.endTime);
  result.pages = entries.flatMap(entry => entry.pages);
  result.resources = entries.flatMap(entry => entry.resources);
  result.actions = mergeActions(entries);
  result.screenshots = entries.flatMap(entry => entry.screenshots);
  result.ariaSnapshots = entries.flatMap(entry => entry.ariaSnapshots);
  result.videos = entries.flatMap(entry => entry.videos);
  result.events = entries.flatMap(entry => entry.events);
  result.stdio = entries.flatMap(entry => entry.stdio);
  result.errors = entries.flatMap(entry => entry.errors);
  return result;
}

let lastTmpStepId = 0;

function mergeActions(entries: ContextEntry[]): ActionEntry[] {
  const libraryEntries = entries.filter(entry => entry.origin === 'library');
  const testRunnerEntries = entries.filter(entry => entry.origin === 'testRunner');

  // With library-only or test-runner-only traces there is nothing to match.
  if (!testRunnerEntries.length || !libraryEntries.length)
    return entries.flatMap(entry => entry.actions.map(action => ({ ...action })));

  const map = new Map<string, ActionEntry>();
  for (const entry of libraryEntries) {
    for (const action of entry.actions) {
      // Never merge stepless events.
      map.set(action.stepId || `tmp-step@${++lastTmpStepId}`, { ...action });
    }
  }

  const nonPrimaryIdToPrimaryId = new Map<string, string>();
  for (const entry of testRunnerEntries) {
    for (const action of entry.actions) {
      const existing = action.stepId && map.get(action.stepId);
      if (existing) {
        nonPrimaryIdToPrimaryId.set(action.callId, existing.callId);
        if (action.error)
          existing.error = action.error;
        if (action.attachments)
          existing.attachments = action.attachments;
        if (action.annotations)
          existing.annotations = action.annotations;
        if (action.parentId)
          existing.parentId = nonPrimaryIdToPrimaryId.get(action.parentId) ?? action.parentId;
        if (action.group)
          existing.group = action.group;
        // For the events that are present in the test runner context, always take
        // their time from the test runner context to preserve client side order.
        existing.startTime = action.startTime;
        existing.endTime = action.endTime;
        continue;
      }
      if (action.parentId)
        action.parentId = nonPrimaryIdToPrimaryId.get(action.parentId) ?? action.parentId;
      map.set(action.stepId || `tmp-step@${++lastTmpStepId}`, { ...action });
    }
  }
  return [...map.values()];
}

function adjustMonotonicTime(entry: ContextEntry, monotonicTimeDelta: number) {
  if (!monotonicTimeDelta)
    return;
  if (entry.startTime !== Number.MAX_SAFE_INTEGER)
    entry.startTime += monotonicTimeDelta;
  if (entry.endTime)
    entry.endTime += monotonicTimeDelta;
  entry.monotonicTime += monotonicTimeDelta;
  for (const action of entry.actions) {
    if (action.startTime)
      action.startTime += monotonicTimeDelta;
    if (action.endTime)
      action.endTime += monotonicTimeDelta;
  }
  for (const event of entry.events)
    event.time += monotonicTimeDelta;
  for (const event of entry.stdio)
    event.timestamp += monotonicTimeDelta;
  for (const page of entry.pages) {
    for (const frame of page.screencastFrames)
      frame.timestamp += monotonicTimeDelta;
  }
  for (const video of entry.videos)
    video.timestampOrigin += monotonicTimeDelta;
  for (const resource of entry.resources) {
    if (resource._monotonicTime)
      resource._monotonicTime += monotonicTimeDelta;
  }
}
