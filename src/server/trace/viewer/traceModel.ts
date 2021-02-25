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

import { createGuid } from '../../../utils/utils';
import * as trace from '../common/traceEvents';
import { SnapshotRenderer } from '../../snapshot/snapshotRenderer';
import { ContextResources } from '../../snapshot/snapshot';
export * as trace from '../common/traceEvents';

export class TraceModel {
  contextEntries = new Map<string, ContextEntry>();
  pageEntries = new Map<string, { contextEntry: ContextEntry, pageEntry: PageEntry }>();
  resourceById = new Map<string, trace.NetworkResourceTraceEvent>();
  contextResources = new Map<string, ContextResources>();

  appendEvents(events: trace.TraceEvent[]) {
    for (const event of events)
      this.appendEvent(event);
  }

  appendEvent(event: trace.TraceEvent) {
    switch (event.type) {
      case 'context-created': {
        this.contextEntries.set(event.contextId, {
          name: event.debugName || createGuid(),
          startTime: Number.MAX_VALUE,
          endTime: Number.MIN_VALUE,
          created: event,
          destroyed: undefined as any,
          pages: [],
        });
        this.contextResources.set(event.contextId, new Map());
        break;
      }
      case 'context-destroyed': {
        this.contextEntries.get(event.contextId)!.destroyed = event;
        break;
      }
      case 'page-created': {
        const pageEntry: PageEntry = {
          created: event,
          destroyed: undefined as any,
          actions: [],
          resources: [],
          interestingEvents: [],
          snapshotsByFrameId: {},
        };
        const contextEntry = this.contextEntries.get(event.contextId)!;
        this.pageEntries.set(event.pageId, { pageEntry, contextEntry });
        contextEntry.pages.push(pageEntry);
        break;
      }
      case 'page-destroyed': {
        this.pageEntries.get(event.pageId)!.pageEntry.destroyed = event;
        break;
      }
      case 'action': {
        if (!kInterestingActions.includes(event.method))
          break;
        const { pageEntry } = this.pageEntries.get(event.pageId!)!;
        const actionId = event.contextId + '/' + event.pageId + '/' + pageEntry.actions.length;
        const action: ActionEntry = {
          actionId,
          action: event,
          resources: pageEntry.resources,
        };
        pageEntry.resources = [];
        pageEntry.actions.push(action);
        break;
      }
      case 'resource': {
        const { pageEntry } = this.pageEntries.get(event.pageId!)!;
        const action = pageEntry.actions[pageEntry.actions.length - 1];
        (action || pageEntry).resources.push(event);
        this.appendResource(event);
        break;
      }
      case 'dialog-opened':
      case 'dialog-closed':
      case 'navigation':
      case 'load': {
        const { pageEntry } = this.pageEntries.get(event.pageId)!;
        pageEntry.interestingEvents.push(event);
        break;
      }
      case 'snapshot': {
        const { pageEntry } = this.pageEntries.get(event.pageId!)!;
        let snapshots = pageEntry.snapshotsByFrameId[event.frameId];
        if (!snapshots) {
          snapshots = [];
          pageEntry.snapshotsByFrameId[event.frameId] = snapshots;
        }
        snapshots.push(event);
        for (const override of event.snapshot.resourceOverrides) {
          if (override.ref) {
            const refOverride = snapshots[snapshots.length - 1 - override.ref]?.snapshot.resourceOverrides.find(o => o.url === override.url);
            override.sha1 = refOverride?.sha1;
            delete override.ref;
          }
        }
        break;
      }
    }
    const contextEntry = this.contextEntries.get(event.contextId)!;
    contextEntry.startTime = Math.min(contextEntry.startTime, event.timestamp);
    contextEntry.endTime = Math.max(contextEntry.endTime, event.timestamp);
  }

  appendResource(event: trace.NetworkResourceTraceEvent) {
    const contextResources = this.contextResources.get(event.contextId)!;
    let responseEvents = contextResources.get(event.url);
    if (!responseEvents) {
      responseEvents = [];
      contextResources.set(event.url, responseEvents);
    }
    responseEvents.push({ frameId: event.frameId, resourceId: event.resourceId });
    this.resourceById.set(event.resourceId, event);
  }

  actionById(actionId: string): { context: ContextEntry, page: PageEntry, action: ActionEntry } {
    const [contextId, pageId, actionIndex] = actionId.split('/');
    const context = this.contextEntries.get(contextId)!;
    const page = context.pages.find(entry => entry.created.pageId === pageId)!;
    const action = page.actions[+actionIndex];
    return { context, page, action };
  }

  findPage(pageId: string): { contextEntry: ContextEntry | undefined, pageEntry: PageEntry | undefined } {
    let contextEntry;
    let pageEntry;
    for (const c of this.contextEntries.values()) {
      for (const p of c.pages) {
        if (p.created.pageId === pageId) {
          contextEntry = c;
          pageEntry = p;
        }
      }
    }
    return { contextEntry, pageEntry };
  }

  findSnapshotById(pageId: string, frameId: string, snapshotId: string): SnapshotRenderer | undefined {
    const { pageEntry, contextEntry } = this.pageEntries.get(pageId)!;
    const frameSnapshots = pageEntry.snapshotsByFrameId[frameId];
    for (let index = 0; index < frameSnapshots.length; index++) {
      if (frameSnapshots[index].snapshot.snapshotId === snapshotId)
        return new SnapshotRenderer(this.contextResources.get(contextEntry.created.contextId)!, frameSnapshots.map(fs => fs.snapshot), index);
    }
  }

  findSnapshotByTime(pageId: string, frameId: string, timestamp: number): SnapshotRenderer | undefined {
    const { pageEntry, contextEntry } = this.pageEntries.get(pageId)!;
    const frameSnapshots = pageEntry.snapshotsByFrameId[frameId];
    let snapshotIndex = -1;
    for (let index = 0; index < frameSnapshots.length; index++) {
      const snapshot = frameSnapshots[index];
      if (timestamp && snapshot.timestamp <= timestamp)
        snapshotIndex = index;
    }
    return snapshotIndex >= 0 ? new SnapshotRenderer(this.contextResources.get(contextEntry.created.contextId)!, frameSnapshots.map(fs => fs.snapshot), snapshotIndex) : undefined;
  }
}

export type ContextEntry = {
  name: string;
  startTime: number;
  endTime: number;
  created: trace.ContextCreatedTraceEvent;
  destroyed: trace.ContextDestroyedTraceEvent;
  pages: PageEntry[];
}

export type InterestingPageEvent = trace.DialogOpenedEvent | trace.DialogClosedEvent | trace.NavigationEvent | trace.LoadEvent;

export type PageEntry = {
  created: trace.PageCreatedTraceEvent;
  destroyed: trace.PageDestroyedTraceEvent;
  actions: ActionEntry[];
  interestingEvents: InterestingPageEvent[];
  resources: trace.NetworkResourceTraceEvent[];
  snapshotsByFrameId: { [key: string]: trace.FrameSnapshotTraceEvent[] };
}

export type ActionEntry = {
  actionId: string;
  action: trace.ActionTraceEvent;
  resources: trace.NetworkResourceTraceEvent[];
};

const kInterestingActions = ['click', 'dblclick', 'hover', 'check', 'uncheck', 'tap', 'fill', 'press', 'type', 'selectOption', 'setInputFiles', 'goto', 'setContent', 'goBack', 'goForward', 'reload'];
