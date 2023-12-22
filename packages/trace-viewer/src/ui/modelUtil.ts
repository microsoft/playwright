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
    const primaryContext = contexts.find(context => context.isPrimary);

    this.browserName = primaryContext?.browserName || '';
    this.sdkLanguage = primaryContext?.sdkLanguage;
    this.channel = primaryContext?.channel;
    this.testIdAttributeName = primaryContext?.testIdAttributeName;
    this.platform = primaryContext?.platform || '';
    this.title = primaryContext?.title || '';
    this.options = primaryContext?.options || {};
    this.wallTime = contexts.map(c => c.wallTime).reduce((prev, cur) => Math.min(prev || Number.MAX_VALUE, cur!), Number.MAX_VALUE);
    this.startTime = contexts.map(c => c.startTime).reduce((prev, cur) => Math.min(prev, cur), Number.MAX_VALUE);
    this.endTime = contexts.map(c => c.endTime).reduce((prev, cur) => Math.max(prev, cur), Number.MIN_VALUE);
    this.pages = ([] as PageEntry[]).concat(...contexts.map(c => c.pages));
    this.actions = mergeActions(contexts);
    this.events = ([] as (trace.EventTraceEvent | trace.ConsoleMessageTraceEvent)[]).concat(...contexts.map(c => c.events));
    this.stdio = ([] as trace.StdioTraceEvent[]).concat(...contexts.map(c => c.stdio));
    this.errors = ([] as trace.ErrorTraceEvent[]).concat(...contexts.map(c => c.errors));
    this.hasSource = contexts.some(c => c.hasSource);
    this.hasStepData = contexts.some(context => !context.isPrimary);
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
}

function mergeActions(contexts: ContextEntry[]) {
  const map = new Map<string, ActionTraceEventInContext>();

  // Protocol call aka isPrimary contexts have startTime/endTime as server-side times.
  // Step aka non-isPrimary contexts have startTime/endTime are client-side times.
  // Adjust expect startTime/endTime on non-primary contexts to put them on a single timeline.
  let offset = 0;
  const primaryContexts = contexts.filter(context => context.isPrimary);
  const nonPrimaryContexts = contexts.filter(context => !context.isPrimary);

  for (const context of primaryContexts) {
    for (const action of context.actions)
      map.set(`${action.apiName}@${action.wallTime}`, { ...action, context });
    if (!offset && context.actions.length)
      offset = context.actions[0].startTime - context.actions[0].wallTime;
  }

  const nonPrimaryIdToPrimaryId = new Map<string, string>();
  for (const context of nonPrimaryContexts) {
    for (const action of context.actions) {
      if (offset) {
        const duration = action.endTime - action.startTime;
        if (action.startTime)
          action.startTime = action.wallTime + offset;
        if (action.endTime)
          action.endTime = action.startTime + duration;
      }

      const key = `${action.apiName}@${action.wallTime}`;
      const existing = map.get(key);
      if (existing && existing.apiName === action.apiName) {
        nonPrimaryIdToPrimaryId.set(action.callId, existing.callId);
        if (action.error)
          existing.error = action.error;
        if (action.attachments)
          existing.attachments = action.attachments;
        if (action.parentId)
          existing.parentId = nonPrimaryIdToPrimaryId.get(action.parentId) ?? action.parentId;
        continue;
      }
      if (action.parentId)
        action.parentId = nonPrimaryIdToPrimaryId.get(action.parentId) ?? action.parentId;
      map.set(key, { ...action, context });
    }
  }

  const result = [...map.values()];
  result.sort((a1, a2) => {
    if (a2.parentId === a1.callId)
      return -1;
    if (a1.parentId === a2.callId)
      return 1;
    return a1.wallTime - a2.wallTime || a1.startTime - a2.startTime;
  });

  for (let i = 1; i < result.length; ++i)
    (result[i] as any)[prevInListSymbol] = result[i - 1];

  return result;
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

export function context(action: ActionTraceEvent | trace.EventTraceEvent): ContextEntry {
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
