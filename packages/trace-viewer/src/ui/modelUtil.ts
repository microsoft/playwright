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
import type { ActionTraceEvent, EventTraceEvent } from '@trace/trace';
import type { ContextEntry, PageEntry } from '../entries';

const contextSymbol = Symbol('context');
const nextSymbol = Symbol('next');
const eventsSymbol = Symbol('events');
const resourcesSymbol = Symbol('resources');

export class MultiTraceModel {
  readonly startTime: number;
  readonly endTime: number;
  readonly browserName: string;
  readonly platform?: string;
  readonly wallTime?: number;
  readonly title?: string;
  readonly options: trace.BrowserContextEventOptions;
  readonly pages: PageEntry[];
  readonly actions: trace.ActionTraceEvent[];
  readonly events: trace.EventTraceEvent[];
  readonly hasSource: boolean;
  readonly sdkLanguage: Language | undefined;
  readonly testIdAttributeName: string | undefined;

  constructor(contexts: ContextEntry[]) {
    contexts.forEach(contextEntry => indexModel(contextEntry));

    this.browserName = contexts[0]?.browserName || '';
    this.sdkLanguage = contexts[0]?.sdkLanguage;
    this.testIdAttributeName = contexts[0]?.testIdAttributeName;
    this.platform = contexts[0]?.platform || '';
    this.title = contexts[0]?.title || '';
    this.options = contexts[0]?.options || {};
    this.wallTime = contexts.map(c => c.wallTime).reduce((prev, cur) => Math.min(prev || Number.MAX_VALUE, cur!), Number.MAX_VALUE);
    this.startTime = contexts.map(c => c.startTime).reduce((prev, cur) => Math.min(prev, cur), Number.MAX_VALUE);
    this.endTime = contexts.map(c => c.endTime).reduce((prev, cur) => Math.max(prev, cur), Number.MIN_VALUE);
    this.pages = ([] as PageEntry[]).concat(...contexts.map(c => c.pages));
    this.actions = ([] as ActionTraceEvent[]).concat(...contexts.map(c => c.actions));
    this.events = ([] as EventTraceEvent[]).concat(...contexts.map(c => c.events));
    this.hasSource = contexts.some(c => c.hasSource);

    this.actions.sort((a1, a2) => a1.startTime - a2.startTime);
    this.events.sort((a1, a2) => a1.time - a2.time);
    this.actions = dedupeActions(this.actions);
  }
}

function indexModel(context: ContextEntry) {
  for (const page of context.pages)
    (page as any)[contextSymbol] = context;
  for (let i = 0; i < context.actions.length; ++i) {
    const action = context.actions[i] as any;
    action[contextSymbol] = context;
    action[nextSymbol] = context.actions[i + 1];
  }
  for (const event of context.events)
    (event as any)[contextSymbol] = context;
}

function dedupeActions(actions: ActionTraceEvent[]) {
  const callActions = actions.filter(a => a.callId.startsWith('call@'));
  const expectActions = actions.filter(a => a.callId.startsWith('expect@'));

  // Call startTime/endTime are server-side times.
  // Expect startTime/endTime are client-side times.
  // If there are call times, adjust expect startTime/endTime to align with callTime.
  if (callActions.length && expectActions.length) {
    const offset = callActions[0].startTime - callActions[0].wallTime!;
    for (const expectAction of expectActions) {
      const duration = expectAction.endTime - expectAction.startTime;
      expectAction.startTime = expectAction.wallTime! + offset;
      expectAction.endTime = expectAction.startTime + duration;
    }
  }
  const callActionsByKey = new Map<string, ActionTraceEvent>();
  for (const action of callActions)
    callActionsByKey.set(action.apiName + '@' + action.wallTime, action);

  const result = [...callActions];
  for (const expectAction of expectActions) {
    const callAction = callActionsByKey.get(expectAction.apiName + '@' + expectAction.wallTime);
    if (callAction) {
      if (expectAction.error)
        callAction.error = expectAction.error;
      continue;
    }
    result.push(expectAction);
  }

  return result.sort((a1, a2) => a1.startTime - a2.startTime);
}

export function context(action: ActionTraceEvent): ContextEntry {
  return (action as any)[contextSymbol];
}

function next(action: ActionTraceEvent): ActionTraceEvent {
  return (action as any)[nextSymbol];
}

export function stats(action: ActionTraceEvent): { errors: number, warnings: number } {
  let errors = 0;
  let warnings = 0;
  const c = context(action);
  for (const event of eventsForAction(action)) {
    if (event.method === 'console') {
      const { guid } = event.params.message;
      const type = c.initializers[guid]?.type;
      if (type === 'warning')
        ++warnings;
      else if (type === 'error')
        ++errors;
    }
    if (event.method === 'pageError')
      ++errors;
  }
  return { errors, warnings };
}

export function eventsForAction(action: ActionTraceEvent): EventTraceEvent[] {
  let result: EventTraceEvent[] = (action as any)[eventsSymbol];
  if (result)
    return result;

  const nextAction = next(action);
  result = context(action).events.filter(event => {
    return event.time >= action.startTime && (!nextAction || event.time < nextAction.startTime);
  });
  (action as any)[eventsSymbol] = result;
  return result;
}

export function resourcesForAction(action: ActionTraceEvent): ResourceSnapshot[] {
  let result: ResourceSnapshot[] = (action as any)[resourcesSymbol];
  if (result)
    return result;

  const nextAction = next(action);
  result = context(action).resources.filter(resource => {
    return typeof resource._monotonicTime === 'number' && resource._monotonicTime > action.startTime && (!nextAction || resource._monotonicTime < nextAction.startTime);
  });
  (action as any)[resourcesSymbol] = result;
  return result;
}
