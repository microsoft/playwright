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

import { buildActionTree } from '@isomorphic/trace/traceModel';
import { asLocatorDescription } from '@isomorphic/locatorGenerators';
import { msToString } from '@isomorphic/formatUtils';
import { loadTrace, formatTimestamp, actionTitle } from './traceUtils';

import type { ActionTraceEventInContext } from '@isomorphic/trace/traceModel';
import type { Language } from '@isomorphic/locatorGenerators';

export async function traceActions(options: { grep?: string, errorsOnly?: boolean }) {
  const trace = await loadTrace();
  const actions = filterActions(trace.model.actions, options);

  // Tree view
  const { rootItem } = buildActionTree(actions);
  console.log(`  ${'#'.padStart(4)} ${'Time'.padEnd(9)}  ${'Action'.padEnd(55)} ${'Duration'.padStart(8)}`);
  console.log(`  ${'─'.repeat(4)} ${'─'.repeat(9)}  ${'─'.repeat(55)} ${'─'.repeat(8)}`);
  const visit = (item: ReturnType<typeof buildActionTree>['rootItem'], indent: string) => {
    const action = item.action;
    const ordinal = trace.callIdToOrdinal.get(action.callId) ?? '?';
    const ts = formatTimestamp(action.startTime, trace.model.startTime);
    const duration = action.endTime ? msToString(action.endTime - action.startTime) : 'running';
    const title = actionTitle(action as ActionTraceEventInContext);
    const locator = actionLocator(action as ActionTraceEventInContext);
    const error = action.error ? '  ✗' : '';
    const prefix = `  ${(ordinal + '.').padStart(4)} ${ts}  ${indent}`;
    console.log(`${prefix}${title.padEnd(Math.max(1, 55 - indent.length))} ${duration.padStart(8)}${error}`);
    if (locator)
      console.log(`${' '.repeat(prefix.length)}${locator}`);
    for (const child of item.children)
      visit(child, indent + '  ');
  };
  for (const child of rootItem.children)
    visit(child, '');
}

function filterActions(actions: ActionTraceEventInContext[], options: { grep?: string, errorsOnly?: boolean }): ActionTraceEventInContext[] {
  let result = actions.filter(a => a.group !== 'configuration');
  if (options.grep) {
    const pattern = new RegExp(options.grep, 'i');
    result = result.filter(a => pattern.test(actionTitle(a)) || pattern.test(actionLocator(a) || ''));
  }
  if (options.errorsOnly)
    result = result.filter(a => !!a.error);
  return result;
}

function actionLocator(action: ActionTraceEventInContext, sdkLanguage?: Language): string | undefined {
  return action.params.selector ? asLocatorDescription(sdkLanguage || 'javascript', action.params.selector) : undefined;
}

export async function traceAction(actionId: string) {
  const trace = await loadTrace();
  const action = trace.resolveActionId(actionId);
  if (!action) {
    console.error(`Action '${actionId}' not found. Use 'trace actions' to see available action IDs.`);
    process.exitCode = 1;
    return;
  }

  const title = actionTitle(action);
  console.log(`\n  ${title}\n`);

  // Time
  console.log('  Time');
  console.log(`    start:     ${formatTimestamp(action.startTime, trace.model.startTime)}`);
  const duration = action.endTime ? msToString(action.endTime - action.startTime) : (action.error ? 'Timed Out' : 'Running');
  console.log(`    duration:  ${duration}`);

  // Parameters
  const paramKeys = Object.keys(action.params).filter(name => name !== 'info');
  if (paramKeys.length) {
    console.log('\n  Parameters');
    for (const key of paramKeys) {
      const value = formatParamValue(action.params[key]);
      console.log(`    ${key}: ${value}`);
    }
  }

  // Return value
  if (action.result) {
    console.log('\n  Return value');
    for (const [key, value] of Object.entries(action.result))
      console.log(`    ${key}: ${formatParamValue(value)}`);

  }

  // Error
  if (action.error) {
    console.log('\n  Error');
    console.log(`    ${action.error.message}`);
  }

  // Logs
  if (action.log.length) {
    console.log('\n  Log');
    for (const entry of action.log) {
      const time = entry.time !== -1 ? formatTimestamp(entry.time, trace.model.startTime) : '';
      console.log(`    ${time.padEnd(12)} ${entry.message}`);
    }
  }

  // Source
  if (action.stack?.length) {
    console.log('\n  Source');
    for (const frame of action.stack.slice(0, 5)) {
      const file = frame.file.replace(/.*[/\\](.*)/, '$1');
      console.log(`    ${file}:${frame.line}:${frame.column}`);
    }
  }

  // Snapshots
  const snapshots: string[] = [];
  if (action.beforeSnapshot)
    snapshots.push('before');
  if (action.inputSnapshot)
    snapshots.push('input');
  if (action.afterSnapshot)
    snapshots.push('after');
  if (snapshots.length) {
    console.log('\n  Snapshots');
    console.log(`    available: ${snapshots.join(', ')}`);
    console.log(`    usage:     npx playwright trace snapshot ${actionId} --name <${snapshots.join('|')}>`);
  }
  console.log('');
}

function formatParamValue(value: any): string {
  if (value === undefined || value === null)
    return String(value);
  if (typeof value === 'string')
    return `"${value}"`;
  if (typeof value !== 'object')
    return String(value);
  if (value.guid)
    return '<handle>';
  return JSON.stringify(value).slice(0, 1000);
}
