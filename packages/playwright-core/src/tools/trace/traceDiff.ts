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

import fs from 'fs';
import os from 'os';
import path from 'path';

import { msToString } from '@isomorphic/formatUtils';
import { actionFullTitle, loadTraceFromFile } from './traceUtils';

import type { ActionEntry } from '@isomorphic/trace/entries';
import type { LoadedTrace } from './traceUtils';

export type TraceDiffOptions = {
  json?: boolean;
  only?: 'actions' | 'network' | 'console';
  ignoreTimings?: boolean;
};

export type TraceDiffResult = {
  baselineName: string;
  targetName: string;
  metadata: {
    browser: { baseline: string, target: string, match: boolean };
    viewport: { baseline: string, target: string, match: boolean };
    duration: { baseline: string, target: string, deltaMs: number };
    actions: { baseline: number, target: number };
  };
  firstDivergence?: {
    step: number;
    reason: string;
    baseline?: { title: string, status: 'passed' | 'failed', duration?: string, error?: string };
    target?: { title: string, status: 'passed' | 'failed', duration?: string, error?: string };
  };
  actionsDiff?: {
    divergedAtStep?: number;
    steps: {
      step: number;
      baseline?: { title: string, status: 'passed' | 'failed', duration?: string, error?: string };
      target?: { title: string, status: 'passed' | 'failed', duration?: string, error?: string };
      differs: boolean;
      reason?: string;
    }[];
  };
  networkDiff?: {
    statusMismatches: {
      method: string;
      url: string;
      baselineStatus: number;
      targetStatus: number;
    }[];
    targetOnly: { method: string, url: string, status: number }[];
    baselineOnly: { method: string, url: string, status: number }[];
  };
  consoleDiff?: {
    targetErrors: { type: string, text: string }[];
  };
};

export async function traceDiff(baselineFile: string, targetFile: string, options: TraceDiffOptions = {}) {
  const tmpBase = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pw-trace-diff-1-'));
  const tmpTarget = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pw-trace-diff-2-'));

  try {
    const [baselineTrace, targetTrace] = await Promise.all([
      loadTraceFromFile(baselineFile, tmpBase),
      loadTraceFromFile(targetFile, tmpTarget),
    ]);

    const result = computeTraceDiff(
        baselineTrace,
        targetTrace,
        options,
        path.basename(baselineFile),
        path.basename(targetFile),
    );

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    _formatDiff(result, options);
  } finally {
    await Promise.all([
      fs.promises.rm(tmpBase, { recursive: true, force: true }),
      fs.promises.rm(tmpTarget, { recursive: true, force: true }),
    ]);
  }
}

export function computeTraceDiff(
  baseline: LoadedTrace,
  target: LoadedTrace,
  options: TraceDiffOptions,
  baselineName: string,
  targetName: string,
): TraceDiffResult {
  const bModel = baseline.model;
  const tModel = target.model;

  const bViewport = bModel.options.viewport ? `${bModel.options.viewport.width}x${bModel.options.viewport.height}` : 'default';
  const tViewport = tModel.options.viewport ? `${tModel.options.viewport.width}x${tModel.options.viewport.height}` : 'default';

  const bDuration = Math.max(0, bModel.endTime - bModel.startTime);
  const tDuration = Math.max(0, tModel.endTime - tModel.startTime);

  const bActions = _filterActions(bModel.actions);
  const tActions = _filterActions(tModel.actions);

  const result: TraceDiffResult = {
    baselineName,
    targetName,
    metadata: {
      browser: {
        baseline: bModel.browserName || 'unknown',
        target: tModel.browserName || 'unknown',
        match: (bModel.browserName || 'unknown') === (tModel.browserName || 'unknown'),
      },
      viewport: {
        baseline: bViewport,
        target: tViewport,
        match: bViewport === tViewport,
      },
      duration: {
        baseline: msToString(bDuration),
        target: msToString(tDuration),
        deltaMs: tDuration - bDuration,
      },
      actions: {
        baseline: bActions.length,
        target: tActions.length,
      },
    },
  };

  // Actions diff
  const actionSteps: NonNullable<TraceDiffResult['actionsDiff']>['steps'] = [];
  let firstDivergence: TraceDiffResult['firstDivergence'];
  const maxActions = Math.max(bActions.length, tActions.length);

  for (let i = 0; i < maxActions; i++) {
    const bAction = bActions[i];
    const tAction = tActions[i];
    const step = i + 1;

    const bInfo = bAction ? _actionSummary(bAction, options.ignoreTimings) : undefined;
    const tInfo = tAction ? _actionSummary(tAction, options.ignoreTimings) : undefined;

    let differs = false;
    let reason: string | undefined;

    if (bInfo && tInfo) {
      if (bInfo.status !== tInfo.status) {
        differs = true;
        reason = tInfo.status === 'failed' ? 'Target action failed with error' : 'Target action passed where baseline failed';
      } else if (bInfo.title !== tInfo.title) {
        differs = true;
        reason = `Action title mismatch: "${bInfo.title}" vs "${tInfo.title}"`;
      }
    } else if (bInfo && !tInfo) {
      differs = true;
      reason = `Target trace stopped before baseline action "${bInfo.title}"`;
    } else if (!bInfo && tInfo) {
      differs = true;
      reason = `Target trace has extra action "${tInfo.title}"`;
    }

    actionSteps.push({
      step,
      baseline: bInfo,
      target: tInfo,
      differs,
      reason,
    });

    if (differs && !firstDivergence) {
      firstDivergence = {
        step,
        reason: reason!,
        baseline: bInfo,
        target: tInfo,
      };
    }
  }

  result.firstDivergence = firstDivergence;
  result.actionsDiff = {
    divergedAtStep: firstDivergence?.step,
    steps: actionSteps,
  };

  // Network diff
  const bRequests = bModel.resources.map(r => ({ method: r.request.method, url: r.request.url, status: r.response.status }));
  const tRequests = tModel.resources.map(r => ({ method: r.request.method, url: r.request.url, status: r.response.status }));

  const statusMismatches: NonNullable<TraceDiffResult['networkDiff']>['statusMismatches'] = [];
  const targetOnly: NonNullable<TraceDiffResult['networkDiff']>['targetOnly'] = [];
  const baselineOnly: NonNullable<TraceDiffResult['networkDiff']>['baselineOnly'] = [];

  const bMap = new Map<string, number>();
  for (const r of bRequests)
    bMap.set(`${r.method} ${r.url}`, r.status);

  const tMap = new Map<string, number>();
  for (const r of tRequests)
    tMap.set(`${r.method} ${r.url}`, r.status);

  for (const [key, tStatus] of tMap) {
    if (bMap.has(key)) {
      const bStatus = bMap.get(key)!;
      if (bStatus !== tStatus) {
        const [method, ...urlParts] = key.split(' ');
        statusMismatches.push({
          method,
          url: urlParts.join(' '),
          baselineStatus: bStatus,
          targetStatus: tStatus,
        });
      }
    } else {
      const [method, ...urlParts] = key.split(' ');
      targetOnly.push({ method, url: urlParts.join(' '), status: tStatus });
    }
  }

  for (const [key, bStatus] of bMap) {
    if (!tMap.has(key)) {
      const [method, ...urlParts] = key.split(' ');
      baselineOnly.push({ method, url: urlParts.join(' '), status: bStatus });
    }
  }

  result.networkDiff = {
    statusMismatches,
    targetOnly,
    baselineOnly,
  };

  // Console / page errors diff
  const tErrors: NonNullable<TraceDiffResult['consoleDiff']>['targetErrors'] = [];
  for (const event of tModel.events) {
    if (event.type === 'console' && event.messageType === 'error')
      tErrors.push({ type: 'console.error', text: event.text });
    if (event.type === 'event' && event.method === 'pageError')
      tErrors.push({ type: 'pageError', text: event.params.error?.message || String(event.params.error) });
  }

  result.consoleDiff = {
    targetErrors: tErrors,
  };

  return result;
}

function _filterActions(actions: ActionEntry[]): ActionEntry[] {
  return actions.filter(a => a.group !== 'configuration');
}

function _actionSummary(action: ActionEntry, ignoreTimings?: boolean) {
  const duration = action.endTime && !ignoreTimings ? msToString(action.endTime - action.startTime) : undefined;
  const status: 'passed' | 'failed' = action.error ? 'failed' : 'passed';
  return {
    title: actionFullTitle(action),
    status,
    duration,
    error: action.error?.message,
  };
}

function _formatDiff(result: TraceDiffResult, options: TraceDiffOptions) {
  const showAll = !options.only;
  const showActions = showAll || options.only === 'actions';
  const showNetwork = showAll || options.only === 'network';
  const showConsole = showAll || options.only === 'console';

  console.log('');
  console.log(`Trace Diff: ${result.baselineName} -> ${result.targetName}`);
  console.log('='.repeat(60));

  if (showAll) {
    const meta = result.metadata;
    console.log('Metadata:');
    console.log(`  Browser:   ${meta.browser.baseline}${meta.browser.match ? ' (same)' : ` -> ${meta.browser.target}`}`);
    console.log(`  Viewport:  ${meta.viewport.baseline}${meta.viewport.match ? ' (same)' : ` -> ${meta.viewport.target}`}`);

    const deltaSign = meta.duration.deltaMs >= 0 ? '+' : '';
    const durationDelta = !options.ignoreTimings ? ` (${deltaSign}${msToString(meta.duration.deltaMs)})` : '';
    console.log(`  Duration:  ${meta.duration.baseline} -> ${meta.duration.target}${durationDelta}`);
    console.log(`  Actions:   ${meta.actions.baseline} -> ${meta.actions.target}`);
    console.log('');
  }

  if (showActions) {
    if (result.firstDivergence) {
      const fd = result.firstDivergence;
      console.log(`First Divergence (Step #${fd.step}):`);
      console.log(`  Reason:    ${fd.reason}`);
      if (fd.baseline) {
        const dur = fd.baseline.duration ? `, ${fd.baseline.duration}` : '';
        console.log(`  Baseline:  ${fd.baseline.title} [${fd.baseline.status}${dur}]`);
      }
      if (fd.target) {
        const dur = fd.target.duration ? `, ${fd.target.duration}` : '';
        console.log(`  Target:    ${fd.target.title} [${fd.target.status}${dur}]`);
        if (fd.target.error)
          console.log(`             ${fd.target.error.split('\n')[0]}`);
      }
      console.log('');
    } else {
      console.log('Actions:');
      console.log('  No divergence detected in action sequence.');
      console.log('');
    }
  }

  if (showNetwork && result.networkDiff) {
    const net = result.networkDiff;
    const hasNetDiff = net.statusMismatches.length || net.targetOnly.length || net.baselineOnly.length;
    if (hasNetDiff) {
      console.log('Network Diff:');
      for (const m of net.statusMismatches)
        console.log(`  ~ ${m.method} ${m.url}  ${m.baselineStatus} -> ${m.targetStatus}`);
      for (const t of net.targetOnly)
        console.log(`  + ${t.method} ${t.url}  ${t.status} (new in target)`);
      for (const b of net.baselineOnly)
        console.log(`  - ${b.method} ${b.url}  ${b.status} (missing in target)`);
      console.log('');
    } else if (options.only === 'network') {
      console.log('Network:');
      console.log('  No network differences detected.');
      console.log('');
    }
  }

  if (showConsole && result.consoleDiff) {
    const con = result.consoleDiff;
    if (con.targetErrors.length) {
      console.log('Console / Page Errors (target):');
      for (const err of con.targetErrors)
        console.log(`  ✗ [${err.type}] ${err.text}`);
      console.log('');
    } else if (options.only === 'console') {
      console.log('Console:');
      console.log('  No errors detected in target.');
      console.log('');
    }
  }
}
