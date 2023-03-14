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
import { parseClientSideCallMetadata } from '@trace/traceUtils';
import type zip from '@zip.js/zip.js';
// @ts-ignore
import zipImport from '@zip.js/zip.js/dist/zip-no-worker-inflate.min.js';
import type { ContextEntry, PageEntry } from './entries';
import { createEmptyContext } from './entries';
import { BaseSnapshotStorage } from './snapshotStorage';

const zipjs = zipImport as typeof zip;

export class TraceModel {
  contextEntries: ContextEntry[] = [];
  pageEntries = new Map<string, PageEntry>();
  private _snapshotStorage: PersistentSnapshotStorage | undefined;
  private _entries = new Map<string, zip.Entry>();
  private _version: number | undefined;
  private _zipReader: zip.ZipReader | undefined;

  constructor() {
  }

  private _formatUrl(trace: string) {
    let url = trace.startsWith('http') || trace.startsWith('blob') ? trace : `file?path=${trace}`;
    // Dropbox does not support cors.
    if (url.startsWith('https://www.dropbox.com/'))
      url = 'https://dl.dropboxusercontent.com/' + url.substring('https://www.dropbox.com/'.length);
    return url;
  }

  async load(traceURL: string, progress: (done: number, total: number) => void) {
    this._zipReader = new zipjs.ZipReader( // @ts-ignore
        new zipjs.HttpReader(this._formatUrl(traceURL), { mode: 'cors', preventHeadRequest: true }),
        { useWebWorkers: false }) as zip.ZipReader;

    const ordinals: string[] = [];
    let hasSource = false;
    for (const entry of await this._zipReader.getEntries({ onprogress: progress })) {
      const match = entry.filename.match(/([\d]+-)?trace\.trace/);
      if (match)
        ordinals.push(match[1] || '');
      if (entry.filename.includes('src@'))
        hasSource = true;
      this._entries.set(entry.filename, entry);
    }
    if (!ordinals.length)
      throw new Error('Cannot find .trace file');

    this._snapshotStorage = new PersistentSnapshotStorage(this._entries);

    for (const ordinal of ordinals) {
      const contextEntry = createEmptyContext();
      contextEntry.traceUrl = traceURL;
      contextEntry.hasSource = hasSource;

      const traceWriter = new zipjs.TextWriter() as zip.TextWriter;
      const traceEntry = this._entries.get(ordinal + 'trace.trace')!;
      await traceEntry!.getData!(traceWriter);
      for (const line of (await traceWriter.getData()).split('\n'))
        this.appendEvent(contextEntry, line);

      const networkWriter = new zipjs.TextWriter();
      const networkEntry = this._entries.get(ordinal + 'trace.network')!;
      await networkEntry?.getData?.(networkWriter);
      for (const line of (await networkWriter.getData()).split('\n'))
        this.appendEvent(contextEntry, line);

      const stacksWriter = new zipjs.TextWriter();
      const stacksEntry = this._entries.get(ordinal + 'trace.stacks');
      if (stacksEntry) {
        await stacksEntry!.getData!(stacksWriter);
        const stacks = parseClientSideCallMetadata(JSON.parse(await stacksWriter.getData()));
        for (const action of contextEntry.actions)
          action.stack = action.stack || stacks.get(action.callId);
      }

      contextEntry.actions.sort((a1, a2) => a1.startTime - a2.startTime);
      this.contextEntries.push(contextEntry);
    }
  }

  async hasEntry(filename: string): Promise<boolean> {
    if (!this._zipReader)
      return false;
    for (const entry of await this._zipReader.getEntries()) {
      if (entry.filename === filename)
        return true;
    }
    return false;
  }

  async resourceForSha1(sha1: string): Promise<Blob | undefined> {
    const entry = this._entries.get('resources/' + sha1);
    if (!entry)
      return;
    const blobWriter = new zipjs.BlobWriter() as zip.BlobWriter;
    await entry!.getData!(blobWriter);
    return await blobWriter.getData();
  }

  storage(): PersistentSnapshotStorage {
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

  appendEvent(contextEntry: ContextEntry, line: string) {
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
      case 'action': {
        contextEntry!.actions.push(event);
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
    if (event.type === 'action') {
      contextEntry.startTime = Math.min(contextEntry.startTime, event.startTime);
      contextEntry.endTime = Math.max(contextEntry.endTime, event.endTime);
    }
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
      snapshots: metadata.snapshots,
      error: metadata.error?.error,
      result: metadata.result,
      point: metadata.point,
      pageId: metadata.pageId,
    };
  }
}

export class PersistentSnapshotStorage extends BaseSnapshotStorage {
  private _entries: Map<string, zip.Entry>;

  constructor(entries: Map<string, zip.Entry>) {
    super();
    this._entries = entries;
  }

  async resourceContent(sha1: string): Promise<Blob | undefined> {
    const entry = this._entries.get('resources/' + sha1)!;
    const writer = new zipjs.BlobWriter();
    await entry.getData!(writer);
    return writer.getData();
  }
}
