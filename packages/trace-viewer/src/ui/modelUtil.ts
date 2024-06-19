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

import type { Language } from '@isomorphic/locatorGenerators';
import type { ResourceSnapshot } from '@trace/snapshot';
import type * as trace from '@trace/trace';
import type { ActionTraceEvent } from '@trace/trace';
import type { ContextEntry, PageEntry } from '../entries';
import type { StackFrame } from '@protocol/channels';

const contextSymbol = Symbol('context');
const nextInContextSymbol = Symbol('next');
const prevInListSymbol = Symbol('prev');
const eventsSymbol = Symbol('events');

export type SourceLocation = {
  file: string;
  line: number;
  source: SourceModel;
};

export type SourceModel = {
  errors: { line: number, message: string }[];
  content: string | undefined;
};

export type ActionTraceEventInContext = ActionTraceEvent & {
  context: ContextEntry;
  log: { time: number, message: string }[];
};

export type ActionTreeItem = {
  id: string;
  children: ActionTreeItem[];
  parent: ActionTreeItem | undefined;
  action?: ActionTraceEventInContext;
};

type ErrorDescription = {
  action?: ActionTraceEventInContext;
  stack?: StackFrame[];
  message: string;
};

export class MultiTraceModel {
  readonly startTime: number;
  readonly endTime: number;
  readonly browserName: string;
  readonly channel?: string;
  readonly platform?: string;
  readonly wallTime?: number;
  readonly title?: string;
  readonly options: trace.BrowserContextEventOptions;
  readonly pages: PageEntry[];
  readonly actions: ActionTraceEventInContext[];
  readonly events: (trace.EventTraceEvent | trace.ConsoleMessageTraceEvent)[];
  readonly stdio: trace.StdioTraceEvent[];
  readonly errors: trace.ErrorTraceEvent[];
  readonly errorDescriptors: ErrorDescription[];
  readonly hasSource: boolean;
  readonly hasStepData: boolean;
  readonly sdkLanguage: Language | undefined;
  readonly testIdAttributeName: string | undefined;
  readonly sources: Map<string, SourceModel>;
  resources: ResourceSnapshot[];


  constructor(contexts: ContextEntry[]) {
    contexts.forEach(contextEntry => indexModel(contextEntry));
    const libraryContext = contexts.find(context => context.origin === 'library');

    this.browserName = libraryContext?.browserName || '';
    this.sdkLanguage = libraryContext?.sdkLanguage;
    this.channel = libraryContext?.channel;
    this.testIdAttributeName = libraryContext?.testIdAttributeName;
    this.platform = libraryContext?.platform || '';
    this.title = libraryContext?.title || '';
    this.options = libraryContext?.options || {};
    // Next call updates all timestamps for all events in library contexts, so it must be done first.
    this.actions = mergeActionsAndUpdateTiming(contexts);
    this.pages = ([] as PageEntry[]).concat(...contexts.map(c => c.pages));
    this.wallTime = contexts.map(c => c.wallTime).reduce((prev, cur) => Math.min(prev || Number.MAX_VALUE, cur!), Number.MAX_VALUE);
    this.startTime = contexts.map(c => c.startTime).reduce((prev, cur) => Math.min(prev, cur), Number.MAX_VALUE);
    this.endTime = contexts.map(c => c.endTime).reduce((prev, cur) => Math.max(prev, cur), Number.MIN_VALUE);
    this.events = ([] as (trace.EventTraceEvent | trace.ConsoleMessageTraceEvent)[]).concat(...contexts.map(c => c.events));
    this.stdio = ([] as trace.StdioTraceEvent[]).concat(...contexts.map(c => c.stdio));
    this.errors = ([] as trace.ErrorTraceEvent[]).concat(...contexts.map(c => c.errors));
    this.hasSource = contexts.some(c => c.hasSource);
    this.hasStepData = contexts.some(context => context.origin === 'testRunner');
    this.resources = [...contexts.map(c => c.resources)].flat();

    this.events.sort((a1, a2) => a1.time - a2.time);
    this.resources.sort((a1, a2) => a1._monotonicTime! - a2._monotonicTime!);
    this.errorDescriptors = this.hasStepData ? this._errorDescriptorsFromTestRunner() : this._errorDescriptorsFromActions();
    this.sources = collectSources(this.actions, this.errorDescriptors);
  }

  failedAction() {
    // This find innermost action for nested ones.
    return this.actions.findLast(a => a.error);
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
    const errors: ErrorDescription[] = [];
    for (const error of this.errors || []) {
      if (!error.message)
        continue;
      errors.push({
        stack: error.stack,
        message: error.message
      });
    }
    return errors;
  }
}

function indexModel(context: ContextEntry) {
  for (const page of context.pages)
    (page as any)[contextSymbol] = context;
  for (let i = 0; i < context.actions.length; ++i) {
    const action = context.actions[i] as any;
    action[contextSymbol] = context;
  }
  let lastNonRouteAction = undefined;
  for (let i = context.actions.length - 1; i >= 0; i--) {
    const action = context.actions[i] as any;
    action[nextInContextSymbol] = lastNonRouteAction;
    if (!action.apiName.includes('route.'))
      lastNonRouteAction = action;
  }
  for (const event of context.events)
    (event as any)[contextSymbol] = context;
  for (const resource of context.resources)
    (resource as any)[contextSymbol] = context;
}

function mergeActionsAndUpdateTiming(contexts: ContextEntry[]) {
  const traceFileToContexts = new Map<string, ContextEntry[]>();
  for (const context of contexts) {
    const traceFile = context.traceUrl;
    let list = traceFileToContexts.get(traceFile);
    if (!list) {
      list = [];
      traceFileToContexts.set(traceFile, list);
    }
    list.push(context);
  }

  const result: ActionTraceEventInContext[] = [];
  let traceFileId = 0;
  for (const [, contexts] of traceFileToContexts) {
    // Action ids are unique only within a trace file. If there are
    // traces from more than one file we make the ids unique across the
    // files. The code does not update snapshot ids as they are always
    // retrieved from a particular trace file.
    if (traceFileToContexts.size > 1)
      makeCallIdsUniqueAcrossTraceFiles(contexts, ++traceFileId);
    // Align action times across runner and library contexts within each trace file.
    const map = mergeActionsAndUpdateTimingSameTrace(contexts);
    result.push(...map.values());
  }
  result.sort((a1, a2) => {
    if (a2.parentId === a1.callId)
      return -1;
    if (a1.parentId === a2.callId)
      return 1;
    return a1.startTime - a2.startTime;
  });

  for (let i = 1; i < result.length; ++i)
    (result[i] as any)[prevInListSymbol] = result[i - 1];

  return result;
}

function makeCallIdsUniqueAcrossTraceFiles(contexts: ContextEntry[], traceFileId: number) {
  for (const context of contexts) {
    for (const action of context.actions) {
      if (action.callId)
        action.callId = `${traceFileId}:${action.callId}`;
      if (action.parentId)
        action.parentId = `${traceFileId}:${action.parentId}`;
    }
  }
}

function mergeActionsAndUpdateTimingSameTrace(contexts: ContextEntry[]) {
  const map = new Map<string, ActionTraceEventInContext>();

  const libraryContexts = contexts.filter(context => context.origin === 'library');
  const testRunnerContexts = contexts.filter(context => context.origin === 'testRunner');

  // Library actions are replaced with corresponding test runner steps. Matching with
  // the test runner steps enables us to find parent steps.
  // - In the newer versions the actions are matched by explicit step id stored in the
  //   library context actions.
  // - In the older versions the step id is not stored and the match is perfomed based on
  //   action name and wallTime.
  const matchByStepId = libraryContexts.some(c => c.actions.some(a => !!a.stepId));

  for (const context of libraryContexts) {
    for (const action of context.actions) {
      const key = matchByStepId ? action.stepId! : `${action.apiName}@${(action as any).wallTime}`;
      map.set(key, { ...action, context });
    }
  }

  // Protocol call aka library contexts have startTime/endTime as server-side times.
  // Step aka test runner contexts have startTime/endTime as client-side times.
  // Adjust startTime/endTime on the library contexts to align them with the test
  // runner steps.
  const delta = monotonicTimeDeltaBetweenLibraryAndRunner(testRunnerContexts, map, matchByStepId);
  if (delta)
    adjustMonotonicTime(libraryContexts, delta);

  const nonPrimaryIdToPrimaryId = new Map<string, string>();
  for (const context of testRunnerContexts) {
    for (const action of context.actions) {
      const key = matchByStepId ? action.callId : `${action.apiName}@${(action as any).wallTime}`;
      const existing = map.get(key);
      if (existing) {
        nonPrimaryIdToPrimaryId.set(action.callId, existing.callId);
        if (action.error)
          existing.error = action.error;
        if (action.attachments)
          existing.attachments = action.attachments;
        if (action.parentId)
          existing.parentId = nonPrimaryIdToPrimaryId.get(action.parentId) ?? action.parentId;
        // For the events that are present in the test runner context, always take
        // their time from the test runner context to preserve client side order.
        existing.startTime = action.startTime;
        existing.endTime = action.endTime;
        continue;
      }
      if (action.parentId)
        action.parentId = nonPrimaryIdToPrimaryId.get(action.parentId) ?? action.parentId;
      map.set(key, { ...action, context });
    }
  }
  return map;
}

function adjustMonotonicTime(contexts: ContextEntry[], monotonicTimeDelta: number) {
  for (const context of contexts) {
    context.startTime += monotonicTimeDelta;
    context.endTime += monotonicTimeDelta;
    for (const action of context.actions) {
      if (action.startTime)
        action.startTime += monotonicTimeDelta;
      if (action.endTime)
        action.endTime += monotonicTimeDelta;
    }
    for (const event of context.events)
      event.time += monotonicTimeDelta;
    for (const event of context.stdio)
      event.timestamp += monotonicTimeDelta;
    for (const page of context.pages) {
      for (const frame of page.screencastFrames)
        frame.timestamp += monotonicTimeDelta;
    }
    for (const resource of context.resources) {
      if (resource._monotonicTime)
        resource._monotonicTime += monotonicTimeDelta;
    }
  }
}

function monotonicTimeDeltaBetweenLibraryAndRunner(nonPrimaryContexts: ContextEntry[], libraryActions: Map<string, ActionTraceEventInContext>, matchByStepId: boolean) {
  // We cannot rely on wall time or monotonic time to be the in sync
  // between library and test runner contexts. So we find first action
  // that is present in both runner and library contexts and use it
  // to calculate the time delta, assuming the two events happened at the
  // same instant.
  for (const context of nonPrimaryContexts) {
    for (const action of context.actions) {
      if (!action.startTime)
        continue;
      const key = matchByStepId ? action.stepId! : `${action.apiName}@${(action as any).wallTime}`;
      const libraryAction = libraryActions.get(key);
      if (libraryAction)
        return action.startTime - libraryAction.startTime;
    }
  }
  return 0;
}

export function buildActionTree(actions: ActionTraceEventInContext[]): { rootItem: ActionTreeItem, itemMap: Map<string, ActionTreeItem> } {
  const itemMap = new Map<string, ActionTreeItem>();

  for (const action of actions) {
    itemMap.set(action.callId, {
      id: action.callId,
      parent: undefined,
      children: [],
      action,
    });
  }

  const rootItem: ActionTreeItem = { id: '', parent: undefined, children: [] };
  for (const item of itemMap.values()) {
    const parent = item.action!.parentId ? itemMap.get(item.action!.parentId) || rootItem : rootItem;
    parent.children.push(item);
    item.parent = parent;
  }
  return { rootItem, itemMap };
}

export function idForAction(action: ActionTraceEvent) {
  return `${action.pageId || 'none'}:${action.callId}`;
}

export function context(action: ActionTraceEvent | trace.EventTraceEvent | ResourceSnapshot): ContextEntry {
  return (action as any)[contextSymbol];
}

function nextInContext(action: ActionTraceEvent): ActionTraceEvent {
  return (action as any)[nextInContextSymbol];
}

export function prevInList(action: ActionTraceEvent): ActionTraceEvent {
  return (action as any)[prevInListSymbol];
}

export function stats(action: ActionTraceEvent): { errors: number, warnings: number } {
  let errors = 0;
  let warnings = 0;
  for (const event of eventsForAction(action)) {
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

export function eventsForAction(action: ActionTraceEvent): (trace.EventTraceEvent | trace.ConsoleMessageTraceEvent)[] {
  let result: (trace.EventTraceEvent | trace.ConsoleMessageTraceEvent)[] = (action as any)[eventsSymbol];
  if (result)
    return result;

  const nextAction = nextInContext(action);
  result = context(action).events.filter(event => {
    return event.time >= action.startTime && (!nextAction || event.time < nextAction.startTime);
  });
  (action as any)[eventsSymbol] = result;
  return result;
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
