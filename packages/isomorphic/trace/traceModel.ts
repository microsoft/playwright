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

import { getActionGroup, renderTitleForCall } from '../protocolFormatter';

import type { Language } from '../locatorGenerators';
import type { ResourceSnapshot } from '@trace/snapshot';
import type * as trace from '@trace/trace';
import type { ActionTraceEvent } from '@trace/trace';
import type { ActionEntry, ContextEntry, PageEntry } from './entries';
import type { ActionGroup } from '../protocolFormatter';

const prevByEndTimeSymbol = Symbol('prevByEndTime');
const nextByStartTimeSymbol = Symbol('nextByStartTime');

export type SourceLocation = {
  file: string;
  line: number;
  column: number;
  source?: SourceModel;
};

export type SourceModel = {
  errors: { line: number, message: string }[];
  content: string | undefined;
};

export type ResourceEntry = ResourceSnapshot & { id: string };

export function resourceOwnerRef(resource: ResourceSnapshot): string | undefined {
  return resource.pageref ?? resource._serviceWorkerRef ?? resource._apiRequestRef;
}

export type ActionTreeItem = {
  id: string;
  children: ActionTreeItem[];
  parent: ActionTreeItem | undefined;
  action: ActionEntry;
};

export type ErrorDescription = {
  action?: ActionEntry;
  stack?: trace.StackFrame[];
  message: string;
};

export type Attachment = trace.AfterActionTraceEventAttachment & { callId: string };

export class TraceModel {
  readonly startTime: number;
  readonly endTime: number;
  readonly browserName: string;
  readonly channel?: string;
  readonly platform?: string;
  readonly playwrightVersion?: string;
  readonly wallTime?: number;
  readonly title?: string;
  readonly options: trace.BrowserContextEventOptions;
  readonly pages: PageEntry[];
  readonly videos: trace.VideoTraceEvent[];
  readonly actions: ActionEntry[];
  readonly attachments: Attachment[];
  readonly visibleAttachments: Attachment[];
  readonly events: (trace.EventTraceEvent | trace.ConsoleMessageTraceEvent)[];
  readonly stdio: trace.StdioTraceEvent[];
  readonly errors: trace.ErrorTraceEvent[];
  readonly errorDescriptors: ErrorDescription[];
  readonly hasSource: boolean;
  readonly hasStepData: boolean;
  readonly sdkLanguage: Language | undefined;
  readonly testIdAttributeName: string | undefined;
  readonly sources: Map<string, SourceModel>;
  resources: ResourceEntry[];
  readonly actionCounters: Map<string, number>;
  readonly traceUri: string;
  readonly testTimeout?: number;
  readonly annotations?: trace.TraceEventAnnotation[];
  readonly resourceOwnerRefToTitle = new Map<string, string>();
  private _eventsForAction = new Map<ActionEntry, (trace.EventTraceEvent | trace.ConsoleMessageTraceEvent)[]>();
  private _screenshots = new Map<string, trace.ScreenshotTraceEvent>();
  private _ariaSnapshots = new Map<string, trace.AriaSnapshotTraceEvent>();

  constructor(traceUri: string, contextEntry: ContextEntry) {
    this.traceUri = traceUri;
    this.browserName = contextEntry.browserName;
    this.sdkLanguage = contextEntry.sdkLanguage;
    this.channel = contextEntry.channel;
    this.testIdAttributeName = contextEntry.testIdAttributeName;
    this.platform = contextEntry.platform || '';
    this.playwrightVersion = contextEntry.playwrightVersion;
    this.title = contextEntry.title || '';
    this.options = contextEntry.options;
    this.testTimeout = contextEntry.testTimeout;
    this.annotations = contextEntry.annotations;
    this.actions = sortAndLinkActions(contextEntry.actions);
    this.pages = contextEntry.pages;
    this.videos = contextEntry.videos;
    this.wallTime = contextEntry.wallTime;
    this.startTime = contextEntry.startTime;
    this.endTime = contextEntry.endTime;
    this.events = contextEntry.events;
    this.stdio = contextEntry.stdio;
    this.errors = contextEntry.errors;
    this.hasSource = contextEntry.hasSource;
    this.hasStepData = contextEntry.hasStepData;
    this.resources = contextEntry.resources.map((entry, index) => ({ ...entry, id: `${resourceOwnerRef(entry) ?? index}-${entry.startedDateTime}-${entry.request.url}` }));
    for (const event of contextEntry.screenshots)
      this._screenshots.set(`${event.callId}/${event.phase}`, event);
    for (const event of contextEntry.ariaSnapshots)
      this._ariaSnapshots.set(`${event.callId}/${event.phase}`, event);
    this.attachments = this.actions.flatMap(action => action.attachments?.map(attachment => ({ ...attachment, callId: action.callId, traceUri })) ?? []);
    this.visibleAttachments = this.attachments.filter(attachment => !attachment.name.startsWith('_'));

    this.pages.forEach((page, index) => this.resourceOwnerRefToTitle.set(page.pageId, 'page#' + (index + 1)));

    this.events.sort((a1, a2) => a1.time - a2.time);
    this.resources.sort((a1, a2) => a1._monotonicTime! - a2._monotonicTime!);

    let serviceWorkerCount = 0;
    let apiRequestCount = 0;
    for (const resource of this.resources) {
      if (resource._serviceWorkerRef && !this.resourceOwnerRefToTitle.has(resource._serviceWorkerRef))
        this.resourceOwnerRefToTitle.set(resource._serviceWorkerRef, `service-worker#${++serviceWorkerCount}`);
      if (resource._apiRequestRef && !this.resourceOwnerRefToTitle.has(resource._apiRequestRef))
        this.resourceOwnerRefToTitle.set(resource._apiRequestRef, `api#${++apiRequestCount}`);
    }
    this.errorDescriptors = this.hasStepData ? this._errorDescriptorsFromTestRunner() : this._errorDescriptorsFromActions();
    this.sources = collectSources(this.actions, this.errorDescriptors);

    this.actionCounters = new Map();
    for (const action of this.actions) {
      action.group = action.group ?? getActionGroup({ type: action.class, method: action.method });
      if (action.group)
        this.actionCounters.set(action.group, 1 + (this.actionCounters.get(action.group) || 0));
    }
  }

  createRelativeUrl(path: string) {
    const url = new URL('http://localhost/' + path);
    url.searchParams.set('trace', this.traceUri);
    return url.toString().substring('http://localhost/'.length);
  }

  failedAction() {
    // This find innermost action for nested ones.
    return this.actions.findLast(a => a.error);
  }

  screenshotForCall(callId: string, phase: trace.ActionPhase): trace.ScreenshotTraceEvent | undefined {
    return this._screenshots.get(`${callId}/${phase}`);
  }

  ariaSnapshotForCall(callId: string, phase: trace.ActionPhase): trace.AriaSnapshotTraceEvent | undefined {
    return this._ariaSnapshots.get(`${callId}/${phase}`);
  }

  eventsForAction(action: ActionEntry): (trace.EventTraceEvent | trace.ConsoleMessageTraceEvent)[] {
    let result = this._eventsForAction.get(action);
    if (result)
      return result;

    let nextAction = nextActionByStartTime(action);
    while (nextAction && nextAction.class === 'Route')
      nextAction = nextActionByStartTime(nextAction);
    result = this.events.filter(event => {
      return event.time >= action.startTime && (!nextAction || event.time < nextAction.startTime);
    });
    this._eventsForAction.set(action, result);
    return result;
  }

  stats(action: ActionEntry): { errors: number, warnings: number } {
    let errors = 0;
    let warnings = 0;
    for (const event of this.eventsForAction(action)) {
      if (event.type === 'console') {
        const type = event.messageType;
        if (type === 'warning')
          ++warnings;
        else if (type === 'error')
          ++errors;
      }
      if (event.type === 'event' && event.method === 'pageError')
        ++errors;
    }
    return { errors, warnings };
  }

  filteredActions(actionsFilter: ActionGroup[]) {
    const filter = new Set<string>(actionsFilter);
    return this.actions.filter(action => !action.group || filter.has(action.group));
  }

  renderActionTree(filter?: ActionGroup[]) {
    const actions = this.filteredActions(filter ?? []);
    const { rootItem } = buildActionTree(actions);
    const actionTree: string[] = [];
    const visit = (actionItem: ActionTreeItem, indent: string) => {
      const title = renderTitleForCall({ ...actionItem.action, type: actionItem.action.class });
      actionTree.push(`${indent}${title || actionItem.id}`);
      for (const child of actionItem.children)
        visit(child, indent + '  ');
    };
    rootItem.children.forEach(a => visit(a, ''));
    return actionTree;
  }

  private _errorDescriptorsFromActions(): ErrorDescription[] {
    const errors: ErrorDescription[] = [];
    for (const action of this.actions || []) {
      if (!action.error?.message)
        continue;
      errors.push({
        action,
        stack: action.stack,
        message: action.error.message,
      });
    }
    return errors;
  }

  private _errorDescriptorsFromTestRunner(): ErrorDescription[] {
    return this.errors.filter(e => !!e.message).map((error, i) => ({
      stack: error.stack,
      message: error.message,
    }));
  }
}

function sortAndLinkActions(actions: ActionEntry[]) {
  const result = actions.slice();

  result.sort((a1, a2) => {
    if (a2.parentId === a1.callId)
      return 1;
    if (a1.parentId === a2.callId)
      return -1;
    return a1.endTime - a2.endTime;
  });

  for (let i = 1; i < result.length; ++i)
    (result[i] as any)[prevByEndTimeSymbol] = result[i - 1];

  result.sort((a1, a2) => {
    if (a2.parentId === a1.callId)
      return -1;
    if (a1.parentId === a2.callId)
      return 1;
    return a1.startTime - a2.startTime;
  });

  for (let i = 0; i + 1 < result.length; ++i)
    (result[i] as any)[nextByStartTimeSymbol] = result[i + 1];

  return result;
}

export function buildActionTree(actions: ActionEntry[]): { rootItem: ActionTreeItem, itemMap: Map<string, ActionTreeItem> } {
  const itemMap = new Map<string, ActionTreeItem>();

  for (const action of actions) {
    itemMap.set(action.callId, {
      id: action.callId,
      parent: undefined,
      children: [],
      action,
    });
  }

  const rootItem: ActionTreeItem = { action: { ...kFakeRootAction }, id: '', parent: undefined, children: [] };
  for (const item of itemMap.values()) {
    rootItem.action.startTime = Math.min(rootItem.action.startTime, item.action.startTime);
    rootItem.action.endTime = Math.max(rootItem.action.endTime, item.action.endTime);
    const parent = item.action.parentId ? itemMap.get(item.action.parentId) || rootItem : rootItem;
    parent.children.push(item);
    item.parent = parent;
  }

  const inheritStack = (item: ActionTreeItem) => {
    for (const child of item.children) {
      child.action.stack = child.action.stack ?? item.action.stack;
      inheritStack(child);
    }
  };
  inheritStack(rootItem);

  return { rootItem, itemMap };
}

export function previousActionByEndTime(action: ActionTraceEvent): ActionTraceEvent {
  return (action as any)[prevByEndTimeSymbol];
}

export function nextActionByStartTime(action: ActionTraceEvent): ActionTraceEvent {
  return (action as any)[nextByStartTimeSymbol];
}

function collectSources(actions: trace.ActionTraceEvent[], errorDescriptors: ErrorDescription[]): Map<string, SourceModel> {
  const result = new Map<string, SourceModel>();
  for (const action of actions) {
    for (const frame of action.stack || []) {
      let source = result.get(frame.file);
      if (!source) {
        source = { errors: [], content: undefined };
        result.set(frame.file, source);
      }
    }
  }

  for (const error of errorDescriptors) {
    const { action, stack, message } = error;
    if (!action || !stack)
      continue;
    result.get(stack[0].file)?.errors.push({
      line: stack[0].line || 0,
      message
    });
  }
  return result;
}

const kFakeRootAction: ActionEntry = {
  type: 'action',
  callId: '',
  startTime: 0,
  endTime: 0,
  class: '',
  method: '',
  params: {},
  log: [],
};
