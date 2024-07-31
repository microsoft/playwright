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
import type * as traceV6 from './versions/traceV6';
import type { ActionEntry, ContextEntry, PageEntry } from './entries';
import type { SnapshotStorage } from './snapshotStorage';

export class TraceVersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TraceVersionError';
  }
}

const latestVersion: trace.VERSION = 7;

export class TraceModernizer {
  private _contextEntry: ContextEntry;
  private _snapshotStorage: SnapshotStorage;
  private _actionMap = new Map<string, ActionEntry>();
  private _version: number | undefined;
  private _pageEntries = new Map<string, PageEntry>();
  private _jsHandles = new Map<string, { preview: string }>();
  private _consoleObjects = new Map<string, { type: string, text: string, location: { url: string, lineNumber: number, columnNumber: number }, args?: { preview: string, value: string }[] }>();

  constructor(contextEntry: ContextEntry, snapshotStorage: SnapshotStorage) {
    this._contextEntry = contextEntry;
    this._snapshotStorage = snapshotStorage;
  }

  appendTrace(trace: string) {
    for (const line of trace.split('\n'))
      this._appendEvent(line);
  }

  actions(): ActionEntry[] {
    return [...this._actionMap.values()];
  }

  private _pageEntry(pageId: string): PageEntry {
    let pageEntry = this._pageEntries.get(pageId);
    if (!pageEntry) {
      pageEntry = {
        screencastFrames: [],
      };
      this._pageEntries.set(pageId, pageEntry);
      this._contextEntry.pages.push(pageEntry);
    }
    return pageEntry;
  }

  private _appendEvent(line: string) {
    if (!line)
      return;
    const events = this._modernize(JSON.parse(line));
    for (const event of events)
      this._innerAppendEvent(event);
  }

  private _innerAppendEvent(event: trace.TraceEvent) {
    const contextEntry = this._contextEntry;
    switch (event.type) {
      case 'context-options': {
        if (event.version > latestVersion)
          throw new TraceVersionError('The trace was created by a newer version of Playwright and is not supported by this version of the viewer. Please use latest Playwright to open the trace.');
        this._version = event.version;
        contextEntry.origin = event.origin;
        contextEntry.browserName = event.browserName;
        contextEntry.channel = event.channel;
        contextEntry.title = event.title;
        contextEntry.platform = event.platform;
        contextEntry.wallTime = event.wallTime;
        contextEntry.startTime = event.monotonicTime;
        contextEntry.sdkLanguage = event.sdkLanguage;
        contextEntry.options = event.options;
        contextEntry.testIdAttributeName = event.testIdAttributeName;
        break;
      }
      case 'screencast-frame': {
        this._pageEntry(event.pageId).screencastFrames.push(event);
        break;
      }
      case 'before': {
        this._actionMap.set(event.callId, { ...event, type: 'action', endTime: 0, log: [] });
        break;
      }
      case 'input': {
        const existing = this._actionMap.get(event.callId);
        existing!.inputSnapshot = event.inputSnapshot;
        existing!.point = event.point;
        break;
      }
      case 'log': {
        const existing = this._actionMap.get(event.callId);
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
        const existing = this._actionMap.get(event.callId);
        existing!.afterSnapshot = event.afterSnapshot;
        existing!.endTime = event.endTime;
        existing!.result = event.result;
        existing!.error = event.error;
        existing!.attachments = event.attachments;
        if (event.point)
          existing!.point = event.point;
        break;
      }
      case 'action': {
        this._actionMap.set(event.callId, { ...event, log: [] });
        break;
      }
      case 'event': {
        contextEntry.events.push(event);
        break;
      }
      case 'stdout': {
        contextEntry.stdio.push(event);
        break;
      }
      case 'stderr': {
        contextEntry.stdio.push(event);
        break;
      }
      case 'error': {
        contextEntry.errors.push(event);
        break;
      }
      case 'console': {
        contextEntry.events.push(event);
        break;
      }
      case 'resource-snapshot':
        this._snapshotStorage.addResource(event.snapshot);
        contextEntry.resources.push(event.snapshot);
        break;
      case 'frame-snapshot':
        this._snapshotStorage.addFrameSnapshot(event.snapshot);
        break;
    }
    // Make sure there is a page entry for each page, even without screencast frames,
    // to show in the metadata view.
    if (('pageId' in event) && event.pageId)
      this._pageEntry(event.pageId);
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

  private _processedContextCreatedEvent() {
    return this._version !== undefined;
  }

  private _modernize(event: any): trace.TraceEvent[] {
    // In trace 6->7 we also need to modernize context-options event.
    let version = this._version || event.version;
    if (version === undefined)
      return [event];
    let events = [event];
    for (; version < latestVersion; ++version)
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
      event.snapshot.viewport = this._contextEntry.options?.viewport || { width: 1280, height: 720 };
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

  _modernize_5_to_6(events: traceV5.TraceEvent[]): traceV6.TraceEvent[] {
    const result: traceV6.TraceEvent[] = [];
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

  _modernize_6_to_7(events: traceV6.TraceEvent[]): trace.TraceEvent[] {
    const result: trace.TraceEvent[] = [];
    if (!this._processedContextCreatedEvent() && events[0].type !== 'context-options') {
      const event: trace.ContextCreatedTraceEvent = {
        type: 'context-options',
        origin: 'testRunner',
        version: 7,
        browserName: '',
        options: {},
        platform: process.platform,
        wallTime: 0,
        monotonicTime: 0,
        sdkLanguage: 'javascript',
      };
      result.push(event);
    }
    for (const event of events) {
      if (event.type === 'context-options') {
        result.push({ ...event, monotonicTime: 0, origin: 'library' });
        continue;
      }
      // Take wall and monotonic time from the first event.
      if (!this._contextEntry.wallTime && event.type === 'before')
        this._contextEntry.wallTime = event.wallTime;
      if (!this._contextEntry.startTime && event.type === 'before')
        this._contextEntry.startTime = event.startTime;
      result.push(event);
    }
    return result;
  }
}
