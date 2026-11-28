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
import { collectTraceActions } from './traceActions';
import { collectTraceErrors } from './traceErrors';
import { collectTraceRequests } from './traceRequests';
import { loadTrace, roundMs } from './traceUtils';

import type { LoadedTrace } from './traceUtils';

export type TraceSummary = {
  browser: string | null;
  viewport: { width: number, height: number } | null;
  platform: string | null;
  testTitle: string | null;
  duration: number;
  actions: {
    total: number;
    passed: number;
    failed: number;
    firstFailed: {
      ordinal: number;
      title: string;
    } | null;
  };
  network: {
    total: number;
    ok: number;
    errors: number;
  };
  errors: {
    console: number;
    pageError: number;
  };
};

export function collectTraceSummary(trace: LoadedTrace): TraceSummary {
  const model = trace.model;
  const contexts = trace.loader.contextEntries;

  const browser = model.browserName || contexts.find(c => c.browserName)?.browserName || null;
  const viewport = model.options.viewport ?? contexts.find(c => c.options.viewport)?.options.viewport ?? null;
  const platform = model.platform || contexts.find(c => c.platform)?.platform || null;
  const testTitle = model.title || contexts.find(c => c.title)?.title || null;
  const duration = isFinite(model.startTime) && isFinite(model.endTime) && model.endTime >= model.startTime
    ? roundMs(model.endTime - model.startTime)
    : 0;

  const actions = collectTraceActions(trace);
  const passedActions = actions.filter(a => a.status === 'passed').length;
  const failedActions = actions.filter(a => a.status === 'failed').length;
  const firstFailedAction = actions.find(a => a.status === 'failed');

  const requests = collectTraceRequests(trace);
  const okRequests = requests.filter(r => r.status >= 200 && r.status < 400).length;
  const errorRequests = requests.filter(r => r.status >= 400 || r.status <= 0 || !!r.failure).length;

  const traceErrors = collectTraceErrors(trace);
  const consoleErrorCount = traceErrors.filter(e => e.type === 'console').length;
  const pageErrorCount = traceErrors.filter(e => e.type === 'pageError').length;

  return {
    browser,
    viewport: viewport ? { width: viewport.width, height: viewport.height } : null,
    platform,
    testTitle,
    duration,
    actions: {
      total: actions.length,
      passed: passedActions,
      failed: failedActions,
      firstFailed: firstFailedAction ? { ordinal: firstFailedAction.ordinal, title: firstFailedAction.title } : null,
    },
    network: {
      total: requests.length,
      ok: okRequests,
      errors: errorRequests,
    },
    errors: {
      console: consoleErrorCount,
      pageError: pageErrorCount,
    },
  };
}

function formatTraceSummary(summary: TraceSummary) {
  const viewport = summary.viewport ? `${summary.viewport.width}x${summary.viewport.height}` : 'default';
  console.log('');
  console.log(`  Browser:       ${summary.browser ?? 'unknown'}`);
  console.log(`  Platform:      ${summary.platform ?? 'unknown'}`);
  console.log(`  Viewport:      ${viewport}`);
  if (summary.testTitle)
    console.log(`  Title:         ${summary.testTitle}`);
  console.log(`  Duration:      ${msToString(summary.duration)}`);
  console.log(`  Actions:       ${summary.actions.total} total, ${summary.actions.passed} passed, ${summary.actions.failed} failed`);
  if (summary.actions.firstFailed)
    console.log(`  First failed:  #${summary.actions.firstFailed.ordinal} ${summary.actions.firstFailed.title}`);
  console.log(`  Network:       ${summary.network.total} requests (${summary.network.ok} ok, ${summary.network.errors} errors)`);
  console.log(`  Console:       ${summary.errors.console} errors`);
  console.log(`  Page errors:   ${summary.errors.pageError}`);
  console.log('');
}

export async function traceSummary(traceFile?: string, options: { json?: boolean } = {}) {
  const trace = await loadTrace(traceFile);
  const summary = collectTraceSummary(trace);
  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  formatTraceSummary(summary);
}
