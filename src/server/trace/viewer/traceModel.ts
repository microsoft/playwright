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

import * as trace from '../common/traceEvents';
import { ContextResources, ResourceSnapshot } from '../../snapshot/snapshotTypes';
import { SnapshotStorage } from '../../snapshot/snapshotStorage';
export * as trace from '../common/traceEvents';

export class TraceModel {
  contextEntries = new Map<string, ContextEntry>();
  pageEntries = new Map<string, { contextEntry: ContextEntry, pageEntry: PageEntry }>();
  contextResources = new Map<string, ContextResources>();

  appendEvents(events: trace.TraceEvent[], snapshotStorage: SnapshotStorage) {
    for (const event of events)
      this.appendEvent(event);
    const actions: ActionEntry[] = [];
    for (const context of this.contextEntries.values()) {
      for (const page of context.pages)
        actions.push(...page.actions);
    }

    const resources = snapshotStorage.resources().reverse();
    actions.reverse();

    for (const action of actions) {
      while (resources.length && resources[0].timestamp > action.timestamp)
        action.resources.push(resources.shift()!);
      action.resources.reverse();
    }
  }

  appendEvent(event: trace.TraceEvent) {
    switch (event.type) {
      case 'context-created': {
        this.contextEntries.set(event.contextId, {
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
          interestingEvents: [],
          screencastFrames: [],
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
      case 'page-screencast-frame': {
        this.pageEntries.get(event.pageId)!.pageEntry.screencastFrames.push(event);
        break;
      }
      case 'action': {
        const metadata = event.metadata;
        const { pageEntry } = this.pageEntries.get(metadata.pageId!)!;
        const action: ActionEntry = {
          actionId: metadata.id,
          resources: [],
          ...event,
        };
        pageEntry.actions.push(action);
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
    }
    const contextEntry = this.contextEntries.get(event.contextId)!;
    contextEntry.startTime = Math.min(contextEntry.startTime, event.timestamp);
    contextEntry.endTime = Math.max(contextEntry.endTime, event.timestamp);
  }
}

export type ContextEntry = {
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
  screencastFrames: {
    sha1: string,
    timestamp: number,
    width: number,
    height: number,
  }[]
}

export type ActionEntry = trace.ActionTraceEvent & {
  actionId: string;
  resources: ResourceSnapshot[]
};
