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

import * as trace from '../../server/trace/common/traceEvents';
import { BaseSnapshotStorage } from './snapshotStorage';

import type zip from '@zip.js/zip.js';
import { ContextEntry, createEmptyContext, PageEntry } from './entries';
import type { CallMetadata } from '../../protocol/callMetadata';

// @ts-ignore
self.importScripts('zip.min.js');

const zipjs = (self as any).zip as typeof zip;

export class TraceModel {
  contextEntry: ContextEntry;
  pageEntries = new Map<string, PageEntry>();
  private _snapshotStorage: PersistentSnapshotStorage | undefined;
  private _entries = new Map<string, zip.Entry>();
  private _version: number | undefined;

  constructor() {
    this.contextEntry = createEmptyContext();
  }

  async load(traceURL: string, progress: (done: number, total: number) => void) {
    const zipReader = new zipjs.ZipReader( // @ts-ignore
        new zipjs.HttpReader(traceURL, { mode: 'cors' }),
        { useWebWorkers: false }) as zip.ZipReader;
    let traceEntry: zip.Entry | undefined;
    let networkEntry: zip.Entry | undefined;
    for (const entry of await zipReader.getEntries({ onprogress: progress })) {
      if (entry.filename.endsWith('.trace'))
        traceEntry = entry;
      if (entry.filename.endsWith('.network'))
        networkEntry = entry;
      if (entry.filename.includes('src@'))
        this.contextEntry.hasSource = true;
      this._entries.set(entry.filename, entry);
    }
    this._snapshotStorage = new PersistentSnapshotStorage(this._entries);

    const traceWriter = new zipjs.TextWriter() as zip.TextWriter;
    await traceEntry!.getData!(traceWriter);
    for (const line of (await traceWriter.getData()).split('\n'))
      this.appendEvent(line);

    if (networkEntry) {
      const networkWriter = new zipjs.TextWriter();
      await networkEntry.getData!(networkWriter);
      for (const line of (await networkWriter.getData()).split('\n'))
        this.appendEvent(line);
    }
    this._build();
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

  private _build() {
    this.contextEntry!.actions.sort((a1, a2) => a1.metadata.startTime - a2.metadata.startTime);
    this.contextEntry!.resources = this._snapshotStorage!.resources();
  }

  private _pageEntry(pageId: string): PageEntry {
    let pageEntry = this.pageEntries.get(pageId);
    if (!pageEntry) {
      pageEntry = {
        screencastFrames: [],
      };
      this.pageEntries.set(pageId, pageEntry);
      this.contextEntry.pages.push(pageEntry);
    }
    return pageEntry;
  }

  appendEvent(line: string) {
    if (!line)
      return;
    const event = this._modernize(JSON.parse(line));
    switch (event.type) {
      case 'context-options': {
        this.contextEntry.browserName = event.browserName;
        this.contextEntry.title = event.title;
        this.contextEntry.platform = event.platform;
        this.contextEntry.wallTime = event.wallTime;
        this.contextEntry.options = event.options;
        break;
      }
      case 'screencast-frame': {
        this._pageEntry(event.pageId).screencastFrames.push(event);
        break;
      }
      case 'action': {
        const include = !isTracing(event.metadata) && (!event.metadata.internal || event.metadata.apiName);
        if (include) {
          if (!event.metadata.apiName)
            event.metadata.apiName = event.metadata.type + '.' + event.metadata.method;
          this.contextEntry!.actions.push(event);
        }
        break;
      }
      case 'event': {
        const metadata = event.metadata;
        if (metadata.pageId) {
          if (metadata.method === '__create__')
            this.contextEntry!.objects[metadata.params.guid] = metadata.params.initializer;
          else
            this.contextEntry!.events.push(event);
        }
        break;
      }
      case 'resource-snapshot':
        this._snapshotStorage!.addResource(event.snapshot);
        break;
      case 'frame-snapshot':
        this._snapshotStorage!.addFrameSnapshot(event.snapshot);
        break;
    }
    if (event.type === 'action' || event.type === 'event') {
      this.contextEntry!.startTime = Math.min(this.contextEntry!.startTime, event.metadata.startTime);
      this.contextEntry!.endTime = Math.max(this.contextEntry!.endTime, event.metadata.endTime);
    }
  }

  private _modernize(event: any): trace.TraceEvent {
    if (this._version === undefined)
      return event;
    for (let version = this._version; version < trace.VERSION; ++version)
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
      event.snapshot.viewport = this.contextEntry.options.viewport || { width: 1280, height: 720 };
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

function isTracing(metadata: CallMetadata): boolean {
  return metadata.method.startsWith('tracing');
}
