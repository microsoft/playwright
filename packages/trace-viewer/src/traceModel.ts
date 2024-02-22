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
import type * as traceV4 from './versions/traceV4';
import type * as traceV5 from './versions/traceV5';
import { parseClientSideCallMetadata } from '../../../packages/playwright-core/src/utils/isomorphic/traceUtils';
import type { ActionEntry, ContextEntry, PageEntry } from './entries';
import { createEmptyContext } from './entries';
import { SnapshotStorage } from './snapshotStorage';

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
  pageEntries = new Map<string, PageEntry>();
  private _snapshotStorage: SnapshotStorage | undefined;
  private _version: number | undefined;
  private _backend!: TraceModelBackend;
  private _attachments = new Map<string, trace.AfterActionTraceEventAttachment>();
  private _resourceToContentType = new Map<string, string>();
  private _jsHandles = new Map<string, { preview: string }>();
  private _consoleObjects = new Map<string, { type: string, text: string, location: { url: string, lineNumber: number, columnNumber: number }, args?: { preview: string, value: string }[] }>();

  constructor() {
  }

  async load(backend: TraceModelBackend, unzipProgress: (done: number, total: number) => void) {
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
      const actionMap = new Map<string, ActionEntry>();
      contextEntry.traceUrl = backend.traceURL();
      contextEntry.hasSource = hasSource;

      const trace = await this._backend.readText(ordinal + '.trace') || '';
      for (const line of trace.split('\n'))
        this.appendEvent(contextEntry, actionMap, line);
      unzipProgress(++done, total);

      const network = await this._backend.readText(ordinal + '.network') || '';
      for (const line of network.split('\n'))
        this.appendEvent(contextEntry, actionMap, line);
      unzipProgress(++done, total);

      contextEntry.actions = [...actionMap.values()].sort((a1, a2) => a1.startTime - a2.startTime);
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
    this._jsHandles.clear();
    this._consoleObjects.clear();
  }

  async hasEntry(filename: string): Promise<boolean> {
    return this._backend.hasEntry(filename);
  }

  async resourceForSha1(sha1: string): Promise<Blob | undefined> {
    const blob = await this._backend.readBlob('resources/' + sha1);
    if (!blob)
      return;
    return new Blob([blob], { type: this._resourceToContentType.get(sha1) || 'application/octet-stream' });
  }

  attachmentForSha1(sha1: string): trace.AfterActionTraceEventAttachment | undefined {
    return this._attachments.get(sha1);
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

  appendEvent(contextEntry: ContextEntry, actionMap: Map<string, ActionEntry>, line: string) {
    if (!line)
      return;
    const events = this._modernize(JSON.parse(line));
    for (const event of events)
      this._innerAppendEvent(contextEntry, actionMap, event);
  }

  private _innerAppendEvent(contextEntry: ContextEntry, actionMap: Map<string, ActionEntry>, event: trace.TraceEvent) {
    switch (event.type) {
      case 'context-options': {
        this._version = event.version;
        contextEntry.isPrimary = true;
        contextEntry.browserName = event.browserName;
        contextEntry.channel = event.channel;
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
      case 'log': {
        const existing = actionMap.get(event.callId);
        // We have some corrupted traces out there, tolerate them.
        if (!existing)
          return;
        existing.log.push({
          time: event.time,
          message: event.message,
        });
        break;
      }
      case 'after': {
        const existing = actionMap.get(event.callId);
        existing!.afterSnapshot = event.afterSnapshot;
        existing!.endTime = event.endTime;
        existing!.result = event.result;
        existing!.error = event.error;
        existing!.attachments = event.attachments;
        if (event.point)
          existing!.point = event.point;
        for (const attachment of event.attachments?.filter(a => a.sha1) || [])
          this._attachments.set(attachment.sha1!, attachment);
        break;
      }
      case 'action': {
        actionMap.set(event.callId, { ...event, log: [] });
        break;
      }
      case 'event': {
        contextEntry!.events.push(event);
        break;
      }
      case 'stdout': {
        contextEntry!.stdio.push(event);
        break;
      }
      case 'stderr': {
        contextEntry!.stdio.push(event);
        break;
      }
      case 'error': {
        contextEntry!.errors.push(event);
        break;
      }
      case 'console': {
        contextEntry!.events.push(event);
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

  private _modernize(event: any): trace.TraceEvent[] {
    if (this._version === undefined)
      return [event];
    const lastVersion: trace.VERSION = 6;
    let events = [event];
    for (let version = this._version; version < lastVersion; ++version)
      events = (this as any)[`_modernize_${version}_to_${version + 1}`].call(this, events);
    return events;
  }

  _modernize_0_to_1(events: any[]): any[] {
    for (const event of events) {
      if (event.type !== 'action')
        continue;
      if (typeof event.metadata.error === 'string')
        event.metadata.error = { error: { name: 'Error', message: event.metadata.error } };
    }
    return events;
  }

  _modernize_1_to_2(events: any[]): any[] {
    for (const event of events) {
      if (event.type !== 'frame-snapshot' || !event.snapshot.isMainFrame)
        continue;
      // Old versions had completely wrong viewport.
      event.snapshot.viewport = this.contextEntries[0]?.options?.viewport || { width: 1280, height: 720 };
    }
    return events;
  }

  _modernize_2_to_3(events: any[]): any[] {
    for (const event of events) {
      if (event.type !== 'resource-snapshot' || event.snapshot.request)
        continue;
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
    return events;
  }

  _modernize_3_to_4(events: traceV3.TraceEvent[]): traceV4.TraceEvent[] {
    const result: traceV4.TraceEvent[] = [];
    for (const event of events) {
      const e = this._modernize_event_3_to_4(event);
      if (e)
        result.push(e);
    }
    return result;
  }

  _modernize_event_3_to_4(event: traceV3.TraceEvent): traceV4.TraceEvent | null {
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

  _modernize_4_to_5(events: traceV4.TraceEvent[]): traceV5.TraceEvent[] {
    const result: traceV5.TraceEvent[] = [];
    for (const event of events) {
      const e = this._modernize_event_4_to_5(event);
      if (e)
        result.push(e);
    }
    return result;
  }

  _modernize_event_4_to_5(event: traceV4.TraceEvent): traceV5.TraceEvent | null {
    if (event.type === 'event' && event.method === '__create__' && event.class === 'JSHandle')
      this._jsHandles.set(event.params.guid, event.params.initializer);
    if (event.type === 'object') {
      // We do not expect any other 'object' events.
      if (event.class !== 'ConsoleMessage')
        return null;
      // Older traces might have `args` inherited from the protocol initializer - guid of JSHandle,
      // but might also have modern `args` with preview and value.
      const args: { preview: string, value: string }[] = (event.initializer as any).args?.map((arg: any) => {
        if (arg.guid) {
          const handle = this._jsHandles.get(arg.guid);
          return { preview: handle?.preview || '', value: '' };
        }
        return { preview: arg.preview || '', value: arg.value || '' };
      });
      this._consoleObjects.set(event.guid, {
        type: event.initializer.type,
        text: event.initializer.text,
        location: event.initializer.location,
        args,
      });
      return null;
    }
    if (event.type === 'event' && event.method === 'console') {
      const consoleMessage = this._consoleObjects.get(event.params.message?.guid || '');
      if (!consoleMessage)
        return null;
      return {
        type: 'console',
        time: event.time,
        pageId: event.pageId,
        messageType: consoleMessage.type,
        text: consoleMessage.text,
        args: consoleMessage.args,
        location: consoleMessage.location,
      };
    }
    return event;
  }

  _modernize_5_to_6(events: traceV5.TraceEvent[]): trace.TraceEvent[] {
    const result: trace.TraceEvent[] = [];
    for (const event of events) {
      result.push(event);
      if (event.type !== 'after' || !event.log.length)
        continue;
      for (const log of event.log) {
        result.push({
          type: 'log',
          callId: event.callId,
          message: log,
          time: -1,
        });
      }
    }
    return result;
  }
}

function stripEncodingFromContentType(contentType: string) {
  const charset = contentType.match(/^(.*);\s*charset=.*$/);
  if (charset)
    return charset[1];
  return contentType;
}
