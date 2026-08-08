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

/* eslint-disable no-console */

import { msToString } from '@isomorphic/formatUtils';

import { actionTitle } from './traceUtils';

import type { LoadedTrace } from './traceUtils';
import type { ActionTraceEventInContext, ResourceEntry } from '@isomorphic/trace/traceModel';

export type PendingRequest = {
  resource: ResourceEntry;
  ordinal: number;
  // Request start, relative to the reference timestamp. Always <= 0.
  startedAt: number;
  // How long the request kept running past the reference timestamp, or undefined when it was
  // still pending at the end of the trace.
  overhang: number | undefined;
};

type PendingResult = {
  requests: PendingRequest[];
  // Requests that terminated without a recorded duration, so it cannot be known whether they
  // were still running at the reference timestamp. Reported as a count rather than guessed at.
  indeterminate: number;
};

// A request that failed or was aborted is finished, but `harEntry.time` is left at its -1
// default, so its end is unknown. Only a request with neither marker is genuinely pending.
function terminatedWithoutDuration(resource: ResourceEntry): boolean {
  return resource.response._failureText !== undefined || !!resource._wasAborted;
}

// Requests that had started but not finished at `timestamp`.
function pendingAt(trace: LoadedTrace, timestamp: number): PendingResult {
  // `model.resources` is already sorted by `_monotonicTime`, so the results come out
  // longest-running first, which is the order most likely to explain a race.
  const requests: PendingRequest[] = [];
  let indeterminate = 0;
  for (const [index, resource] of trace.model.resources.entries()) {
    const start = resource._monotonicTime;
    if (start === undefined || start > timestamp)
      continue;
    if (resource.time >= 0) {
      const end = start + resource.time;
      if (end <= timestamp)
        continue;
      requests.push({ resource, ordinal: index + 1, startedAt: start - timestamp, overhang: end - timestamp });
      continue;
    }
    if (terminatedWithoutDuration(resource)) {
      ++indeterminate;
      continue;
    }
    // Never completed within the trace, so it was outstanding from its start onwards.
    requests.push({ resource, ordinal: index + 1, startedAt: start - timestamp, overhang: undefined });
  }
  return { requests, indeterminate };
}

function requestName(resource: ResourceEntry): string {
  let name: string;
  try {
    const url = new URL(resource.request.url);
    name = url.pathname.substring(url.pathname.lastIndexOf('/') + 1) || url.host;
    if (url.search)
      name += url.search;
  } catch {
    name = resource.request.url;
  }
  return name.length > 45 ? name.substring(0, 42) + '...' : name;
}

// Whether to measure at the moment the action began or the moment it returned.
export type Phase = 'start' | 'end';

// The action timestamp to measure against. Undefined when the action never finished,
// which only happens for `end`.
function referenceTime(action: ActionTraceEventInContext, phase: Phase): number | undefined {
  if (phase === 'start')
    return action.startTime;
  return action.endTime ? action.endTime : undefined;
}

// Reads the shared `--phase` option, reporting a bad value rather than silently defaulting.
export function parsePhase(value: string | undefined): Phase | undefined {
  if (value === undefined)
    return 'start';
  if (value === 'start' || value === 'end')
    return value;
  console.error(`Invalid --phase value '${value}'. Expected 'start' or 'end'.`);
  process.exitCode = 1;
  return undefined;
}

function canComputePending(trace: LoadedTrace): boolean {
  if (!trace.model.resources.some(r => r._monotonicTime !== undefined)) {
    console.error('  This trace has no request timing information, so pending requests cannot be computed.');
    process.exitCode = 1;
    return false;
  }
  return true;
}

// `trace requests --pending-at <action-id>`: requests still pending at one action.
export function printPendingRequests(trace: LoadedTrace, actionId: string, phase: Phase, matches: (r: PendingRequest) => boolean) {
  if (!trace.model.resources.length) {
    console.log('  No network requests');
    return;
  }
  if (!canComputePending(trace))
    return;

  const action = trace.resolveActionId(actionId);
  if (!action) {
    console.error(`Action '${actionId}' not found. Use 'trace actions' to see available action IDs.`);
    process.exitCode = 1;
    return;
  }
  const timestamp = referenceTime(action, phase);
  if (timestamp === undefined) {
    console.error(`Action '${actionId}' never finished, so it has no end to measure against.`);
    process.exitCode = 1;
    return;
  }
  const result = pendingAt(trace, timestamp);
  printForAction(trace, action, phase, { ...result, requests: result.requests.filter(matches) });
}

// `trace actions --pending`: every action that overlapped a pending request.
export function printPendingActions(trace: LoadedTrace, actions: ActionTraceEventInContext[], phase: Phase, matches: (r: PendingRequest) => boolean) {
  if (!trace.model.resources.length) {
    console.log('  No network requests');
    return;
  }
  if (!canComputePending(trace))
    return;
  printSummary(trace, actions, phase, matches);
}

function printForAction(trace: LoadedTrace, action: ActionTraceEventInContext, phase: Phase, result: PendingResult) {
  const { requests, indeterminate } = result;
  const at = phase === 'end' ? 'finished' : 'started';
  const timestamp = referenceTime(action, phase)!;
  console.log(`\n  ${actionTitle(action)} — ${at} at ${msToString(timestamp - trace.model.startTime)}\n`);

  if (!requests.length) {
    console.log(`  No requests were pending when this action ${at}.`);
    printIndeterminate(indeterminate);
    console.log('');
    return;
  }

  // At the action's end a request may have been triggered by the action itself, which is a
  // different problem from one the page never settled. At the start everything predates it.
  const showOrigin = phase === 'end';
  const originHeader = showOrigin ? ` ${'Origin'.padEnd(7)}` : '';
  const originRule = showOrigin ? ` ${'─'.repeat(7)}` : '';
  console.log(`  ${'#'.padStart(4)} ${'Method'.padEnd(8)} ${'Status'.padEnd(8)} ${'Name'.padEnd(45)} ${'Started'.padStart(10)} ${'Overhang'.padStart(10)}${originHeader}`);
  console.log(`  ${'─'.repeat(4)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(45)} ${'─'.repeat(10)} ${'─'.repeat(10)}${originRule}`);

  for (const { resource, ordinal, startedAt, overhang } of requests) {
    const status = resource.response.status > 0 ? String(resource.response.status) : 'ERR';
    // `startedAt` is relative to the reference timestamp and never positive.
    const started = `-${msToString(-startedAt)}`;
    const over = overhang === undefined ? 'never' : msToString(overhang);
    const origin = showOrigin ? ` ${(resource._monotonicTime! < action.startTime ? 'before' : 'during').padEnd(7)}` : '';
    console.log(`  ${(ordinal + '.').padStart(4)} ${resource.request.method.padEnd(8)} ${status.padEnd(8)} ${requestName(resource).padEnd(45)} ${started.padStart(10)} ${over.padStart(10)}${origin}`);
  }

  console.log(`\n  ${requests.length} request(s) still pending. 'Overhang' is how long each kept running after the action ${at}.`);
  if (showOrigin)
    console.log(`  'Origin' is whether the request predated the action ('before') or was started by it ('during').`);
  printIndeterminate(indeterminate);
  console.log(`  Inspect one with 'npx playwright trace request <#>'.\n`);
}

function printIndeterminate(count: number) {
  if (count)
    console.log(`  ${count} failed or aborted request(s) have no recorded end time and were not evaluated.`);
}

function printUnfinished(count: number) {
  if (count)
    console.log(`  ${count} action(s) never finished and have no end to measure against.`);
}

function printSummary(trace: LoadedTrace, actions: ActionTraceEventInContext[], phase: Phase, matches: (r: PendingRequest) => boolean) {
  const at = phase === 'end' ? 'finished' : 'started';
  const rows: { action: ActionTraceEventInContext, requests: PendingRequest[] }[] = [];
  let unfinished = 0;
  for (const action of actions) {
    const timestamp = referenceTime(action, phase);
    if (timestamp === undefined) {
      ++unfinished;
      continue;
    }
    const requests = pendingAt(trace, timestamp).requests.filter(matches);
    if (requests.length)
      rows.push({ action, requests });
  }

  if (!rows.length) {
    console.log(`\n  No action ${at} while a request was pending.`);
    printUnfinished(unfinished);
    console.log('');
    return;
  }

  console.log(`\n  Actions that ${at} while requests were still pending\n`);
  console.log(`  ${'#'.padStart(4)} ${'Action'.padEnd(50)} ${'Pending'.padStart(9)} ${'Longest'.padStart(10)}`);
  console.log(`  ${'─'.repeat(4)} ${'─'.repeat(50)} ${'─'.repeat(9)} ${'─'.repeat(10)}`);

  for (const { action, requests } of rows) {
    const ordinal = trace.callIdToOrdinal.get(action.callId);
    // An unfinished request outranks any finished one.
    const unfinished = requests.some(r => r.overhang === undefined);
    const longest = unfinished ? 'never' : msToString(Math.max(...requests.map(r => r.overhang!)));
    let title = actionTitle(action);
    if (title.length > 50)
      title = title.substring(0, 47) + '...';
    console.log(`  ${((ordinal ?? '?') + '.').padStart(4)} ${title.padEnd(50)} ${String(requests.length).padStart(9)} ${longest.padStart(10)}`);
  }

  console.log(`\n  'Longest' is how long the slowest pending request kept running after the action ${at}.`);
  printUnfinished(unfinished);
  const phaseArg = phase === 'end' ? ' --phase end' : '';
  console.log(`  Drill in with 'npx playwright trace requests --pending-at <action-id>${phaseArg}'.\n`);
}
