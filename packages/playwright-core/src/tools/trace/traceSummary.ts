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
import { actionFullTitle, loadTrace, openTrace } from './traceUtils';
import { isFailedRequest } from './traceRequests';

export type TraceSummaryOptions = {
  json?: boolean;
};

export type TraceSummary = {
  status: 'passed' | 'failed';
  metadata: {
    browser: string;
    platform: string;
    playwrightVersion: string;
    title: string;
    duration: string;
    durationMs: number;
    startTime: string;
    viewport: string;
  };
  actions: {
    total: number;
    passed: number;
    failed: number;
    firstFailure?: {
      ordinal: number;
      title: string;
      error?: string;
    };
  };
  network: {
    total: number;
    successful: number;
    failed: number;
    failures: Array<{
      ordinal: number;
      method: string;
      url: string;
      status: number;
      failure?: string;
    }>;
  };
  errors: {
    total: number;
    testErrors: number;
    consoleErrors: number;
    pageErrors: number;
    stderr: number;
  };
};

function formatIsoTime(timestamp?: number): string {
  if (!timestamp || isNaN(timestamp) || timestamp <= 0)
    return 'unknown';
  try {
    const d = new Date(timestamp);
    return isNaN(d.getTime()) ? 'unknown' : d.toISOString();
  } catch {
    return 'unknown';
  }
}

export async function traceSummary(traceFile?: string, options: TraceSummaryOptions = {}) {
  if (traceFile)
    await openTrace(traceFile);

  const trace = await loadTrace();
  const model = trace.model;

  // Actions
  const nonConfigActions = model.actions.filter(a => a.group !== 'configuration');
  const failedActions = nonConfigActions.filter(a => !!a.error);
  const passedActionsCount = nonConfigActions.length - failedActions.length;
  const firstFailedAction = failedActions[0];
  const firstFailure = firstFailedAction ? {
    ordinal: trace.callIdToOrdinal.get(firstFailedAction.callId) ?? 0,
    title: actionFullTitle(firstFailedAction),
    error: firstFailedAction.error?.message,
  } : undefined;

  // Network
  const totalRequests = model.resources.length;
  const failedRequests = model.resources.filter(r => isFailedRequest(r));
  const successfulRequests = totalRequests - failedRequests.length;
  const networkFailures = failedRequests.map((r, i) => {
    const originalIndex = model.resources.indexOf(r);
    return {
      ordinal: originalIndex !== -1 ? originalIndex + 1 : i + 1,
      method: r.request.method,
      url: r.request.url,
      status: r.response.status,
      failure: r.response._failureText || undefined,
    };
  });

  // Errors & Console
  const testErrorsCount = model.errorDescriptors.length;
  const consoleErrors = model.events.filter(e => e.type === 'console' && e.messageType === 'error');
  const pageErrors = model.events.filter(e => e.type === 'event' && e.method === 'pageError');
  const stdErrors = model.stdio.filter(s => s.type === 'stderr');
  const totalErrors = testErrorsCount + consoleErrors.length + pageErrors.length;

  const durationMs = (model.startTime < model.endTime && model.startTime !== Number.MAX_VALUE && model.endTime !== Number.MIN_VALUE)
    ? Math.max(0, model.endTime - model.startTime)
    : 0;

  const startTime = formatIsoTime(model.wallTime);

  const status: 'passed' | 'failed' = (failedActions.length > 0 || testErrorsCount > 0) ? 'failed' : 'passed';

  const summary: TraceSummary = {
    status,
    metadata: {
      browser: model.browserName || 'unknown',
      platform: model.platform || 'unknown',
      playwrightVersion: model.playwrightVersion || 'unknown',
      title: model.title || '',
      duration: msToString(durationMs),
      durationMs,
      startTime,
      viewport: model.options.viewport ? `${model.options.viewport.width}x${model.options.viewport.height}` : 'default',
    },
    actions: {
      total: nonConfigActions.length,
      passed: passedActionsCount,
      failed: failedActions.length,
      firstFailure,
    },
    network: {
      total: totalRequests,
      successful: successfulRequests,
      failed: failedRequests.length,
      failures: networkFailures,
    },
    errors: {
      total: totalErrors,
      testErrors: testErrorsCount,
      consoleErrors: consoleErrors.length,
      pageErrors: pageErrors.length,
      stderr: stdErrors.length,
    },
  };

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  // Format terminal output
  console.log('\n  Trace Summary');
  console.log('  =============');
  console.log(`  Status:       ${summary.status.toUpperCase()}`);
  if (summary.metadata.title)
    console.log(`  Title:        ${summary.metadata.title}`);
  console.log(`  Browser:      ${summary.metadata.browser} (${summary.metadata.viewport})`);
  console.log(`  Duration:     ${summary.metadata.duration} (${summary.metadata.startTime})`);

  console.log(`\n  Actions:      ${summary.actions.total} total (${summary.actions.passed} passed, ${summary.actions.failed} failed)`);
  if (summary.actions.firstFailure) {
    console.log(`  First Fail:   #${summary.actions.firstFailure.ordinal} ${summary.actions.firstFailure.title}`);
    if (summary.actions.firstFailure.error) {
      const firstLine = summary.actions.firstFailure.error.split('\n')[0];
      console.log(`                ${firstLine}`);
    }
  }

  console.log(`\n  Network:      ${summary.network.total} requests (${summary.network.successful} ok, ${summary.network.failed} failed)`);
  if (summary.network.failures.length) {
    for (const f of summary.network.failures.slice(0, 5)) {
      const statusText = f.status > 0 ? String(f.status) : 'FAILED';
      console.log(`                #${f.ordinal} ${f.method} ${f.url} [${statusText}]`);
    }
    if (summary.network.failures.length > 5)
      console.log(`                ... and ${summary.network.failures.length - 5} more`);
  }

  console.log(`\n  Errors:       ${summary.errors.total} total (${summary.errors.testErrors} test error, ${summary.errors.consoleErrors} console, ${summary.errors.pageErrors} page, ${summary.errors.stderr} stderr)\n`);
}
