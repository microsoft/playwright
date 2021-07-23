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
import * as trace from '../common/traceEvents';
import { ContextResources, ResourceSnapshot } from '../../snapshot/snapshotTypes';
import { BaseSnapshotStorage } from '../../snapshot/snapshotStorage';
import { BrowserContextOptions } from '../../types';
import { shouldCaptureSnapshot, VERSION } from '../recorder/tracing';
export * as trace from '../common/traceEvents';

export class TraceModel {
  contextEntry: ContextEntry;
  pageEntries = new Map<string, PageEntry>();
  contextResources = new Map<string, ContextResources>();
  private _snapshotStorage: PersistentSnapshotStorage;
  private _version: number | undefined;

  constructor(snapshotStorage: PersistentSnapshotStorage) {
    this._snapshotStorage = snapshotStorage;
    this.contextEntry = {
      startTime: Number.MAX_VALUE,
      endTime: Number.MIN_VALUE,
      browserName: '',
      options: { sdkLanguage: '' },
      pages: [],
      resources: []
    };
  }

  build() {
    for (const page of this.contextEntry!.pages)
      page.actions.sort((a1, a2) => a1.metadata.startTime - a2.metadata.startTime);
    this.contextEntry!.resources = this._snapshotStorage.resources();
  }

  private _pageEntry(pageId: string): PageEntry {
    let pageEntry = this.pageEntries.get(pageId);
    if (!pageEntry) {
      pageEntry = {
        actions: [],
        events: [],
        objects: {},
        screencastFrames: [],
      };
      this.pageEntries.set(pageId, pageEntry);
      this.contextEntry.pages.push(pageEntry);
    }
    return pageEntry;
  }

  appendEvent(line: string) {
    const event = this._modernize(JSON.parse(line));
    switch (event.type) {
      case 'context-options': {
        this._version = event.version || 0;
        this.contextEntry.browserName = event.browserName;
        this.contextEntry.options = event.options;
        break;
      }
      case 'screencast-frame': {
        this._pageEntry(event.pageId).screencastFrames.push(event);
        break;
      }
      case 'action': {
        const metadata = event.metadata;
        const include = event.hasSnapshot;
        if (include && metadata.pageId)
          this._pageEntry(metadata.pageId).actions.push(event);
        break;
      }
      case 'event': {
        const metadata = event.metadata;
        if (metadata.pageId) {
          if (metadata.method === '__create__')
            this._pageEntry(metadata.pageId).objects[metadata.params.guid] = metadata.params.initializer;
          else
            this._pageEntry(metadata.pageId).events.push(event);
        }
        break;
      }
      case 'resource-snapshot':
        this._snapshotStorage.addResource(event.snapshot);
        break;
      case 'frame-snapshot':
        this._snapshotStorage.addFrameSnapshot(event.snapshot);
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
    for (let version = this._version; version < VERSION; ++version)
      event = (this as any)[`_modernize_${version}_to_${version + 1}`].call(this, event);
    return event;
  }

  _modernize_0_to_1(event: any): any {
    if (event.type === 'action') {
      if (typeof event.metadata.error === 'string')
        event.metadata.error = { error: { name: 'Error', message: event.metadata.error } };
      if (event.metadata && typeof event.hasSnapshot !== 'boolean')
        event.hasSnapshot = shouldCaptureSnapshot(event.metadata);
    }
    return event;
  }
}

export type ContextEntry = {
  startTime: number;
  endTime: number;
  browserName: string;
  options: BrowserContextOptions;
  pages: PageEntry[];
  resources: ResourceSnapshot[];
};

export type PageEntry = {
  actions: trace.ActionTraceEvent[];
  events: trace.ActionTraceEvent[];
  objects: { [ket: string]: any };
  screencastFrames: {
    sha1: string,
    timestamp: number,
    width: number,
    height: number,
  }[]
};

export class PersistentSnapshotStorage extends BaseSnapshotStorage {
  private _resourcesDir: string;

  constructor(resourcesDir: string) {
    super();
    this._resourcesDir = resourcesDir;
  }

  resourceContent(sha1: string): Buffer | undefined {
    return fs.readFileSync(path.join(this._resourcesDir, sha1));
  }
}
