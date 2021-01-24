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

import * as trace from '../../trace/traceTypes';
export * as trace from '../../trace/traceTypes';

export type TraceModel = {
  contexts: ContextEntry[];
}

export type ContextEntry = {
  name: string;
  filePath: string;
  startTime: number;
  endTime: number;
  created: trace.ContextCreatedTraceEvent;
  destroyed: trace.ContextDestroyedTraceEvent;
  pages: PageEntry[];
  resourcesByUrl: Map<string, trace.NetworkResourceTraceEvent[]>;
}

export type VideoEntry = {
  video: trace.PageVideoTraceEvent;
  videoId: string;
};

export type InterestingPageEvent = trace.DialogOpenedEvent | trace.DialogClosedEvent | trace.NavigationEvent | trace.LoadEvent;

export type PageEntry = {
  created: trace.PageCreatedTraceEvent;
  destroyed: trace.PageDestroyedTraceEvent;
  video?: VideoEntry;
  actions: ActionEntry[];
  interestingEvents: InterestingPageEvent[];
  resources: trace.NetworkResourceTraceEvent[];
}

export type ActionEntry = {
  actionId: string;
  action: trace.ActionTraceEvent;
  thumbnailUrl: string;
  resources: trace.NetworkResourceTraceEvent[];
};

export type VideoMetaInfo = {
  frames: number;
  width: number;
  height: number;
  fps: number;
  startTime: number;
  endTime: number;
};

export function readTraceFile(events: trace.TraceEvent[], traceModel: TraceModel, filePath: string) {
  const contextEntries = new Map<string, ContextEntry>();
  const pageEntries = new Map<string, PageEntry>();
  for (const event of events) {
    switch (event.type) {
      case 'context-created': {
        contextEntries.set(event.contextId, {
          filePath,
          name: filePath.substring(filePath.lastIndexOf('/') + 1),
          startTime: Number.MAX_VALUE,
          endTime: Number.MIN_VALUE,
          created: event,
          destroyed: undefined as any,
          pages: [],
          resourcesByUrl: new Map(),
        });
        break;
      }
      case 'context-destroyed': {
        contextEntries.get(event.contextId)!.destroyed = event;
        break;
      }
      case 'page-created': {
        const pageEntry: PageEntry = {
          created: event,
          destroyed: undefined as any,
          actions: [],
          resources: [],
          interestingEvents: [],
        };
        pageEntries.set(event.pageId, pageEntry);
        contextEntries.get(event.contextId)!.pages.push(pageEntry);
        break;
      }
      case 'page-destroyed': {
        pageEntries.get(event.pageId)!.destroyed = event;
        break;
      }
      case 'page-video': {
        const pageEntry = pageEntries.get(event.pageId)!;
        pageEntry.video = { video: event, videoId: event.contextId + '/' + event.pageId };
        break;
      }
      case 'action': {
        const pageEntry = pageEntries.get(event.pageId!)!;
        const actionId = event.contextId + '/' + event.pageId + '/' + pageEntry.actions.length;
        const action: ActionEntry = {
          actionId,
          action: event,
          thumbnailUrl: `action-preview/${actionId}.png`,
          resources: pageEntry.resources,
        };
        pageEntry.resources = [];
        pageEntry.actions.push(action);
        break;
      }
      case 'resource': {
        const contextEntry = contextEntries.get(event.contextId)!;
        const pageEntry = pageEntries.get(event.pageId!)!;
        const action = pageEntry.actions[pageEntry.actions.length - 1];
        if (action)
          action.resources.push(event);
        else
          pageEntry.resources.push(event);
        let responseEvents = contextEntry.resourcesByUrl.get(event.url);
        if (!responseEvents) {
          responseEvents = [];
          contextEntry.resourcesByUrl.set(event.url, responseEvents);
        }
        responseEvents.push(event);
        break;
      }
      case 'dialog-opened':
      case 'dialog-closed':
      case 'navigation':
      case 'load': {
        const pageEntry = pageEntries.get(event.pageId)!;
        pageEntry.interestingEvents.push(event);
        break;
      }
    }

    const contextEntry = contextEntries.get(event.contextId)!;
    contextEntry.startTime = Math.min(contextEntry.startTime, event.timestamp);
    contextEntry.endTime = Math.max(contextEntry.endTime, event.timestamp);
  }
  traceModel.contexts.push(...contextEntries.values());
}

export function actionById(traceModel: TraceModel, actionId: string): { context: ContextEntry, page: PageEntry, action: ActionEntry } {
  const [contextId, pageId, actionIndex] = actionId.split('/');
  const context = traceModel.contexts.find(entry => entry.created.contextId === contextId)!;
  const page = context.pages.find(entry => entry.created.pageId === pageId)!;
  const action = page.actions[+actionIndex];
  return { context, page, action };
}

export function videoById(traceModel: TraceModel, videoId: string): { context: ContextEntry, page: PageEntry } {
  const [contextId, pageId] = videoId.split('/');
  const context = traceModel.contexts.find(entry => entry.created.contextId === contextId)!;
  const page = context.pages.find(entry => entry.created.pageId === pageId)!;
  return { context, page };
}
