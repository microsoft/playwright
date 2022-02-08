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

import { ResourceSnapshot } from '../../../server/trace/common/snapshotTypes';
import { ActionTraceEvent } from '../../../server/trace/common/traceEvents';
import { ContextEntry, MergedContexts, PageEntry } from '../entries';

const contextSymbol = Symbol('context');
const nextSymbol = Symbol('next');
const eventsSymbol = Symbol('events');
const resourcesSymbol = Symbol('resources');

export function indexModel(context: ContextEntry) {
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
    if (event.metadata.method === 'console') {
      const { guid } = event.metadata.params.message;
      const type = c.objects[guid]?.type;
      if (type === 'warning')
        ++warnings;
      else if (type === 'error')
        ++errors;
    }
    if (event.metadata.method === 'pageError')
      ++errors;
  }
  return { errors, warnings };
}

export function eventsForAction(action: ActionTraceEvent): ActionTraceEvent[] {
  let result: ActionTraceEvent[] = (action as any)[eventsSymbol];
  if (result)
    return result;

  const nextAction = next(action);
  result = context(action).events.filter(event => {
    return event.metadata.startTime >= action.metadata.startTime && (!nextAction || event.metadata.startTime < nextAction.metadata.startTime);
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
    return resource._monotonicTime > action.metadata.startTime && (!nextAction || resource._monotonicTime < nextAction.metadata.startTime);
  });
  (action as any)[resourcesSymbol] = result;
  return result;
}

export function mergeContexts(contexts: ContextEntry[]): MergedContexts {
  const newContext: MergedContexts = {
    browserName: contexts[0].browserName,
    platform: contexts[0].platform,
    title: contexts[0].title,
    options: contexts[0].options,
    wallTime: contexts.map(c => c.wallTime).reduce((prev, cur) => Math.min(prev || Number.MAX_VALUE, cur!), Number.MAX_VALUE),
    startTime: contexts.map(c => c.startTime).reduce((prev, cur) => Math.min(prev, cur), Number.MAX_VALUE),
    endTime: contexts.map(c => c.endTime).reduce((prev, cur) => Math.max(prev, cur), Number.MIN_VALUE),
    pages: ([] as PageEntry[]).concat(...contexts.map(c => c.pages)),
    actions: ([] as ActionTraceEvent[]).concat(...contexts.map(c => c.actions)),
    events: ([] as ActionTraceEvent[]).concat(...contexts.map(c => c.events)),
    hasSource: contexts.some(c => c.hasSource)
  };
  newContext.actions.sort((a1, a2) => a1.metadata.startTime - a2.metadata.startTime);
  newContext.events.sort((a1, a2) => a1.metadata.startTime - a2.metadata.startTime);
  return newContext;
}
