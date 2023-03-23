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

import type * as trace from '@trace/trace';
import type * as traceV3 from './versions/traceV3';
import { parseClientSideCallMetadata } from '@isomorphic/traceUtils';
import type zip from '@zip.js/zip.js';
// @ts-ignore
import zipImport from '@zip.js/zip.js/dist/zip-no-worker-inflate.min.js';
import type { ContextEntry, PageEntry } from './entries';
import { createEmptyContext } from './entries';
import { SnapshotStorage } from './snapshotStorage';

const zipjs = zipImport as typeof zip;

export class TraceModel {
  contextEntries: ContextEntry[] = [];
  pageEntries = new Map<string, PageEntry>();
  private _snapshotStorage: SnapshotStorage | undefined;
  private _version: number | undefined;
  private _backend!: TraceModelBackend;

  constructor() {
  }

  async load(traceURL: string, progress: (done: number, total: number) => void) {
    const isLive = traceURL.endsWith('json');
    this._backend = isLive ? new FetchTraceModelBackend(traceURL) : new ZipTraceModelBackend(traceURL, progress);

    const ordinals: string[] = [];
    let hasSource = false;
    for (const entryName of await this._backend.entryNames()) {
      const match = entryName.match(/(.+-)?trace\.trace/);
      if (match)
        ordinals.push(match[1] || '');
      if (entryName.includes('src@'))
        hasSource = true;
    }
    if (!ordinals.length)
      throw new Error('Cannot find .trace file');

    this._snapshotStorage = new SnapshotStorage();

    for (const ordinal of ordinals) {
      const contextEntry = createEmptyContext();
      const actionMap = new Map<string, trace.ActionTraceEvent>();
      contextEntry.traceUrl = traceURL;
      contextEntry.hasSource = hasSource;

      const trace = await this._backend.readText(ordinal + 'trace.trace') || '';
      for (const line of trace.split('\n'))
        this.appendEvent(contextEntry, actionMap, line);

      const network = await this._backend.readText(ordinal + 'trace.network') || '';
      for (const line of network.split('\n'))
        this.appendEvent(contextEntry, actionMap, line);

      contextEntry.actions = [...actionMap.values()].sort((a1, a2) => a1.startTime - a2.startTime);
      if (!isLive) {
        for (const action of contextEntry.actions) {
          if (!action.endTime && !action.error)
            action.error = { name: 'Error', message: 'Timed out' };
        }
      }

      const stacks = await this._backend.readText(ordinal + 'trace.stacks');
      if (stacks) {
        const callMetadata = parseClientSideCallMetadata(JSON.parse(stacks));
        for (const action of contextEntry.actions)
          action.stack = action.stack || callMetadata.get(action.callId);
      }

      this.contextEntries.push(contextEntry);
    }
  }

  async hasEntry(filename: string): Promise<boolean> {
    return this._backend.hasEntry(filename);
  }

  async resourceForSha1(sha1: string): Promise<Blob | undefined> {
    return this._backend.readBlob('resources/' + sha1);
  }

  storage(): SnapshotStorage {
    return this._snapshotStorage!;
  }

  private _pageEntry(contextEntry: ContextEntry, pageId: string): PageEntry {
    let pageEntry = this.pageEntries.get(pageId);
    if (!pageEntry) {
      pageEntry = {
        screencastFrames: [],
      };
      this.pageEntries.set(pageId, pageEntry);
      contextEntry.pages.push(pageEntry);
    }
    return pageEntry;
  }

  appendEvent(contextEntry: ContextEntry, actionMap: Map<string, trace.ActionTraceEvent>, line: string) {
    if (!line)
      return;
    const event = this._modernize(JSON.parse(line));
    if (!event)
      return;
    switch (event.type) {
      case 'context-options': {
        this._version = event.version;
        contextEntry.browserName = event.browserName;
        contextEntry.title = event.title;
        contextEntry.platform = event.platform;
        contextEntry.wallTime = event.wallTime;
        contextEntry.sdkLanguage = event.sdkLanguage;
        contextEntry.options = event.options;
        contextEntry.testIdAttributeName = event.testIdAttributeName;
        break;
      }
      case 'screencast-frame': {
        this._pageEntry(contextEntry, event.pageId).screencastFrames.push(event);
        break;
      }
      case 'before': {
        actionMap.set(event.callId, { ...event, type: 'action', endTime: 0, log: [] });
        break;
      }
      case 'input': {
        const existing = actionMap.get(event.callId);
        existing!.inputSnapshot = event.inputSnapshot;
        existing!.point = event.point;
        break;
      }
      case 'after': {
        const existing = actionMap.get(event.callId);
        existing!.afterSnapshot = event.afterSnapshot;
        existing!.endTime = event.endTime;
        existing!.log = event.log;
        existing!.result = event.result;
        existing!.error = event.error;
        break;
      }
      case 'action': {
        actionMap.set(event.callId, event);
        break;
      }
      case 'event': {
        contextEntry!.events.push(event);
        break;
      }
      case 'object': {
        contextEntry!.initializers[event.guid] = event.initializer;
        break;
      }
      case 'resource-snapshot':
        this._snapshotStorage!.addResource(event.snapshot);
        contextEntry.resources.push(event.snapshot);
        break;
      case 'frame-snapshot':
        this._snapshotStorage!.addFrameSnapshot(event.snapshot);
        break;
    }
    if (event.type === 'action' || event.type === 'before')
      contextEntry.startTime = Math.min(contextEntry.startTime, event.startTime);
    if (event.type === 'action' || event.type === 'after')
      contextEntry.endTime = Math.max(contextEntry.endTime, event.endTime);
    if (event.type === 'event') {
      contextEntry.startTime = Math.min(contextEntry.startTime, event.time);
      contextEntry.endTime = Math.max(contextEntry.endTime, event.time);
    }
    if (event.type === 'screencast-frame') {
      contextEntry.startTime = Math.min(contextEntry.startTime, event.timestamp);
      contextEntry.endTime = Math.max(contextEntry.endTime, event.timestamp);
    }
  }

  private _modernize(event: any): trace.TraceEvent {
    if (this._version === undefined)
      return event;
    const lastVersion: trace.VERSION = 4;
    for (let version = this._version; version < lastVersion; ++version)
      event = (this as any)[`_modernize_${version}_to_${version + 1}`].call(this, event);
    return event;
  }

  _modernize_0_to_1(event: any): any {
    if (event.type === 'action') {
      if (typeof event.metadata.error === 'string')
        event.metadata.error = { error: { name: 'Error', message: event.metadata.error } };
    }
    return event;
  }

  _modernize_1_to_2(event: any): any {
    if (event.type === 'frame-snapshot' && event.snapshot.isMainFrame) {
      // Old versions had completely wrong viewport.
      event.snapshot.viewport = this.contextEntries[0]?.options?.viewport || { width: 1280, height: 720 };
    }
    return event;
  }

  _modernize_2_to_3(event: any): any {
    if (event.type === 'resource-snapshot' && !event.snapshot.request) {
      // Migrate from old ResourceSnapshot to new har entry format.
      const resource = event.snapshot;
      event.snapshot = {
        _frameref: resource.frameId,
        request: {
          url: resource.url,
          method: resource.method,
          headers: resource.requestHeaders,
          postData: resource.requestSha1 ? { _sha1: resource.requestSha1 } : undefined,
        },
        response: {
          status: resource.status,
          headers: resource.responseHeaders,
          content: {
            mimeType: resource.contentType,
            _sha1: resource.responseSha1,
          },
        },
        _monotonicTime: resource.timestamp,
      };
    }
    return event;
  }

  _modernize_3_to_4(event: traceV3.TraceEvent): trace.TraceEvent | null {
    if (event.type !== 'action' && event.type !== 'event') {
      return event as traceV3.ContextCreatedTraceEvent |
        traceV3.ScreencastFrameTraceEvent |
        traceV3.ResourceSnapshotTraceEvent |
        traceV3.FrameSnapshotTraceEvent;
    }

    const metadata = event.metadata;
    if (metadata.internal || metadata.method.startsWith('tracing'))
      return null;

    if (event.type === 'event') {
      if (metadata.method === '__create__' && metadata.type === 'ConsoleMessage') {
        return {
          type: 'object',
          class: metadata.type,
          guid: metadata.params.guid,
          initializer: metadata.params.initializer,
        };
      }
      return {
        type: 'event',
        time: metadata.startTime,
        class: metadata.type,
        method: metadata.method,
        params: metadata.params,
        pageId: metadata.pageId,
      };
    }

    return {
      type: 'action',
      callId: metadata.id,
      startTime: metadata.startTime,
      endTime: metadata.endTime,
      apiName: metadata.apiName || metadata.type + '.' + metadata.method,
      class: metadata.type,
      method: metadata.method,
      params: metadata.params,
      wallTime: metadata.wallTime || Date.now(),
      log: metadata.log,
      beforeSnapshot: metadata.snapshots.find(s => s.title === 'before')?.snapshotName,
      inputSnapshot: metadata.snapshots.find(s => s.title === 'input')?.snapshotName,
      afterSnapshot: metadata.snapshots.find(s => s.title === 'after')?.snapshotName,
      error: metadata.error?.error,
      result: metadata.result,
      point: metadata.point,
      pageId: metadata.pageId,
    };
  }
}

export interface TraceModelBackend {
  entryNames(): Promise<string[]>;
  hasEntry(entryName: string): Promise<boolean>;
  readText(entryName: string): Promise<string | undefined>;
  readBlob(entryName: string): Promise<Blob | undefined>;
}

class ZipTraceModelBackend implements TraceModelBackend {
  private _zipReader: zip.ZipReader;
  private _entriesPromise: Promise<Map<string, zip.Entry>>;

  constructor(traceURL: string, progress: (done: number, total: number) => void) {
    this._zipReader = new zipjs.ZipReader(
        new zipjs.HttpReader(formatUrl(traceURL), { mode: 'cors', preventHeadRequest: true } as any),
        { useWebWorkers: false }) as zip.ZipReader;
    this._entriesPromise = this._zipReader.getEntries({ onprogress: progress }).then(entries => {
      const map = new Map<string, zip.Entry>();
      for (const entry of entries)
        map.set(entry.filename, entry);
      return map;
    });
  }

  async entryNames(): Promise<string[]> {
    const entries = await this._entriesPromise;
    return [...entries.keys()];
  }

  async hasEntry(entryName: string): Promise<boolean> {
    const entries = await this._entriesPromise;
    return entries.has(entryName);
  }

  async readText(entryName: string): Promise<string | undefined> {
    const entries = await this._entriesPromise;
    const entry = entries.get(entryName);
    if (!entry)
      return;
    const writer = new zipjs.TextWriter();
    await entry.getData?.(writer);
    return writer.getData();
  }

  async readBlob(entryName: string): Promise<Blob | undefined> {
    const entries = await this._entriesPromise;
    const entry = entries.get(entryName);
    if (!entry)
      return;
    const writer = new zipjs.BlobWriter() as zip.BlobWriter;
    await entry.getData!(writer);
    return writer.getData();
  }
}

class FetchTraceModelBackend implements TraceModelBackend {
  private _entriesPromise: Promise<Map<string, string>>;

  constructor(traceURL: string) {

    this._entriesPromise = fetch('/trace/file?path=' + encodeURI(traceURL)).then(async response => {
      const json = JSON.parse(await response.text());
      const entries = new Map<string, string>();
      for (const entry of json.entries)
        entries.set(entry.name, entry.path);
      return entries;
    });
  }

  async entryNames(): Promise<string[]> {
    const entries = await this._entriesPromise;
    return [...entries.keys()];
  }

  async hasEntry(entryName: string): Promise<boolean> {
    const entries = await this._entriesPromise;
    return entries.has(entryName);
  }

  async readText(entryName: string): Promise<string | undefined> {
    const response = await this._readEntry(entryName);
    return response?.text();
  }

  async readBlob(entryName: string): Promise<Blob | undefined> {
    const response = await this._readEntry(entryName);
    return response?.blob();
  }

  private async _readEntry(entryName: string): Promise<Response | undefined> {
    const entries = await this._entriesPromise;
    const fileName = entries.get(entryName);
    if (!fileName)
      return;
    return fetch('/trace/file?path=' + encodeURI(fileName));
  }
}

function formatUrl(trace: string) {
  let url = trace.startsWith('http') || trace.startsWith('blob') ? trace : `file?path=${trace}`;
  // Dropbox does not support cors.
  if (url.startsWith('https://www.dropbox.com/'))
    url = 'https://dl.dropboxusercontent.com/' + url.substring('https://www.dropbox.com/'.length);
  return url;
}
