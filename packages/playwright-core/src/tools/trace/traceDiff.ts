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
import { gracefullyProcessExitDoNotHang } from '@utils/processLauncher';
import { actionFullTitle, loadTraceFromFile } from './traceUtils';

import type { ActionEntry } from '@isomorphic/trace/entries';
import type { LoadedTrace } from './traceUtils';
import type { TraceModel } from '@isomorphic/trace/traceModel';

export type TraceDiffOptions = {
  json?: boolean;
  only?: 'actions' | 'network' | 'console';
  ignoreTimings?: boolean;
  exitCode?: boolean;
};

export type ActionDiffStep = {
  step: number;
  baseline?: { title: string, status: 'passed' | 'failed', duration?: string, error?: string };
  target?: { title: string, status: 'passed' | 'failed', duration?: string, error?: string };
  differs: boolean;
  reason?: string;
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
    steps: ActionDiffStep[];
  };
  networkDiff?: {
    statusMismatches: {
      method: string;
      url: string;
      baselineStatus: number;
      targetStatus: number;
      occurrence: number;
    }[];
    targetOnly: { method: string, url: string, status: number, occurrence: number }[];
    baselineOnly: { method: string, url: string, status: number, occurrence: number }[];
  };
  consoleDiff?: {
    introduced: { type: string, text: string }[];
    resolved: { type: string, text: string }[];
    common: { type: string, text: string }[];
  };
};

export async function traceDiff(baselineFile: string, targetFile: string, options: TraceDiffOptions = {}) {
  if (options.only && !['actions', 'network', 'console'].includes(options.only))
    throw new Error(`Invalid --only category "${options.only}". Supported categories: actions, network, console`);

  const tmpRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pw-trace-diff-'));
  const tmpBase = path.join(tmpRoot, 'base');
  const tmpTarget = path.join(tmpRoot, 'target');

  const cleanup = () => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
    }
  };

  const exitHandler = () => cleanup();
  const sigHandler = () => {
    cleanup();
    gracefullyProcessExitDoNotHang(130);
  };

  process.on('exit', exitHandler);
  process.on('SIGINT', sigHandler);
  process.on('SIGTERM', sigHandler);

  try {
    const baselineTrace = await loadTraceFromFile(baselineFile, tmpBase);
    const targetTrace = await loadTraceFromFile(targetFile, tmpTarget);

    const result = computeTraceDiff(
        baselineTrace,
        targetTrace,
        options,
        path.basename(baselineFile),
        path.basename(targetFile),
    );

    const hasActionDiff = !!result.firstDivergence;
    const hasNetworkDiff = (result.networkDiff?.statusMismatches.length ?? 0) > 0 ||
      (result.networkDiff?.targetOnly.length ?? 0) > 0 ||
      (result.networkDiff?.baselineOnly.length ?? 0) > 0;
    const hasConsoleDiff = (result.consoleDiff?.introduced.length ?? 0) > 0;

    let hasDifferences = false;
    if (!options.only)
      hasDifferences = hasActionDiff || hasNetworkDiff || hasConsoleDiff;
    else if (options.only === 'actions')
      hasDifferences = hasActionDiff;
    else if (options.only === 'network')
      hasDifferences = hasNetworkDiff;
    else if (options.only === 'console')
      hasDifferences = hasConsoleDiff;

    if (options.exitCode && hasDifferences)
      process.exitCode = 1;

    if (options.json) {
      console.log(JSON.stringify(_filterJsonOutput(result, options.only), null, 2));
      return;
    }

    _formatDiff(result, options);
  } finally {
    process.off('exit', exitHandler);
    process.off('SIGINT', sigHandler);
    process.off('SIGTERM', sigHandler);
    cleanup();
  }
}

export function normalizeTokens(str: string): string {
  let normalized = str.replace(/https?:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+/gi, 'http://$1:<port>');
  normalized = normalized.replace(/([?&])(?:_cache|ts|timestamp|sessionId|nonce)=[\w\-.~%+/=]+/gi, '$1');
  normalized = normalized.replace(/\?[&]+/g, '?').replace(/&{2,}/g, '&').replace(/[?&]$/, '');
  return normalized;
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

  // Align actions using Longest Common Subsequence on normalized action signatures
  const { steps, firstDivergence } = _alignActions(bActions, tActions, options.ignoreTimings);
  result.firstDivergence = firstDivergence;
  result.actionsDiff = {
    divergedAtStep: firstDivergence?.step,
    steps,
  };

  // Network diff using transaction multiset
  result.networkDiff = _diffNetwork(bModel, tModel);

  // Console / page errors symmetric diff
  result.consoleDiff = _diffConsole(bModel, tModel);

  return result;
}

function _filterActions(actions: ActionEntry[]): ActionEntry[] {
  return actions.filter(a => a.group !== 'configuration');
}

function _actionSignature(action: ActionEntry): string {
  const normTitle = normalizeTokens(actionFullTitle(action));
  return `${action.class}::${action.method}::${normTitle}`;
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

function _alignActions(
  bActions: ActionEntry[],
  tActions: ActionEntry[],
  ignoreTimings?: boolean,
): { steps: ActionDiffStep[], firstDivergence?: TraceDiffResult['firstDivergence'] } {
  const bSigs = bActions.map(_actionSignature);
  const tSigs = tActions.map(_actionSignature);

  // Fast-path common prefix
  let prefixLen = 0;
  while (prefixLen < bActions.length && prefixLen < tActions.length && bSigs[prefixLen] === tSigs[prefixLen])
    prefixLen++;

  // Fast-path common suffix (non-overlapping with prefix)
  let suffixLen = 0;
  while (
    suffixLen < (bActions.length - prefixLen) &&
    suffixLen < (tActions.length - prefixLen) &&
    bSigs[bActions.length - 1 - suffixLen] === tSigs[tActions.length - 1 - suffixLen]
  )
    suffixLen++;

  type RawOp = { type: 'match' | 'delete' | 'insert', bIndex?: number, tIndex?: number };
  const rawOps: RawOp[] = [];

  // Add prefix matches
  for (let idx = 0; idx < prefixLen; idx++)
    rawOps.push({ type: 'match', bIndex: idx, tIndex: idx });

  // Slice middle
  const bMidStart = prefixLen;
  const bMidEnd = bActions.length - suffixLen;
  const tMidStart = prefixLen;
  const tMidEnd = tActions.length - suffixLen;

  const N = bMidEnd - bMidStart;
  const M = tMidEnd - tMidStart;

  if (N > 0 && M > 0 && N * M <= 25_000_000) {
    const dp: number[][] = Array.from({ length: N + 1 }, () => new Array(M + 1).fill(0));
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < M; j++) {
        if (bSigs[bMidStart + i] === tSigs[tMidStart + j])
          dp[i + 1][j + 1] = dp[i][j] + 1;
        else
          dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }

    const midOps: RawOp[] = [];
    let i = N;
    let j = M;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && bSigs[bMidStart + i - 1] === tSigs[tMidStart + j - 1]) {
        midOps.push({ type: 'match', bIndex: bMidStart + i - 1, tIndex: tMidStart + j - 1 });
        i--;
        j--;
      } else if (i > 0 && (j === 0 || dp[i - 1][j] >= dp[i][j - 1])) {
        midOps.push({ type: 'delete', bIndex: bMidStart + i - 1 });
        i--;
      } else {
        midOps.push({ type: 'insert', tIndex: tMidStart + j - 1 });
        j--;
      }
    }
    midOps.reverse();
    rawOps.push(...midOps);
  } else {
    for (let i = bMidStart; i < bMidEnd; i++)
      rawOps.push({ type: 'delete', bIndex: i });
    for (let j = tMidStart; j < tMidEnd; j++)
      rawOps.push({ type: 'insert', tIndex: j });
  }

  // Add suffix matches
  for (let s = 0; s < suffixLen; s++) {
    const bIdx = bActions.length - suffixLen + s;
    const tIdx = tActions.length - suffixLen + s;
    rawOps.push({ type: 'match', bIndex: bIdx, tIndex: tIdx });
  }

  const steps: ActionDiffStep[] = [];
  let firstDivergence: TraceDiffResult['firstDivergence'];

  for (let idx = 0; idx < rawOps.length; idx++) {
    const op = rawOps[idx];
    const step = idx + 1;
    const bAction = op.bIndex !== undefined ? bActions[op.bIndex] : undefined;
    const tAction = op.tIndex !== undefined ? tActions[op.tIndex] : undefined;

    const bInfo = bAction ? _actionSummary(bAction, ignoreTimings) : undefined;
    const tInfo = tAction ? _actionSummary(tAction, ignoreTimings) : undefined;

    let differs = false;
    let reason: string | undefined;

    if (op.type === 'match') {
      if (bInfo && tInfo) {
        if (bInfo.status !== tInfo.status) {
          differs = true;
          reason = tInfo.status === 'failed' ? 'Target action failed with error' : 'Target action passed where baseline failed';
        } else if (bInfo.status === 'failed' && tInfo.status === 'failed' && bInfo.error !== tInfo.error) {
          differs = true;
          reason = 'Target action failed with a different error';
        }
      }
    } else if (op.type === 'delete') {
      differs = true;
      reason = `Target trace stopped before baseline action "${bInfo?.title}"`;
    } else if (op.type === 'insert') {
      differs = true;
      reason = `Target trace has extra action "${tInfo?.title}"`;
    }

    steps.push({
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

  return { steps, firstDivergence };
}

function _diffNetwork(bModel: TraceModel, tModel: TraceModel): NonNullable<TraceDiffResult['networkDiff']> {
  const bResources = bModel.resources.map(r => ({
    method: r.request.method,
    url: r.request.url,
    normalizedUrl: normalizeTokens(r.request.url),
    status: r.response.status,
  }));
  const tResources = tModel.resources.map(r => ({
    method: r.request.method,
    url: r.request.url,
    normalizedUrl: normalizeTokens(r.request.url),
    status: r.response.status,
  }));

  const bGrouped = new Map<string, { url: string, status: number }[]>();
  for (const r of bResources) {
    const key = `${r.method} ${r.normalizedUrl}`;
    let list = bGrouped.get(key);
    if (!list) {
      list = [];
      bGrouped.set(key, list);
    }
    list.push({ url: r.url, status: r.status });
  }

  const tGrouped = new Map<string, { url: string, status: number }[]>();
  for (const r of tResources) {
    const key = `${r.method} ${r.normalizedUrl}`;
    let list = tGrouped.get(key);
    if (!list) {
      list = [];
      tGrouped.set(key, list);
    }
    list.push({ url: r.url, status: r.status });
  }

  const statusMismatches: NonNullable<TraceDiffResult['networkDiff']>['statusMismatches'] = [];
  const targetOnly: NonNullable<TraceDiffResult['networkDiff']>['targetOnly'] = [];
  const baselineOnly: NonNullable<TraceDiffResult['networkDiff']>['baselineOnly'] = [];

  const allKeys = new Set([...bGrouped.keys(), ...tGrouped.keys()]);
  for (const key of allKeys) {
    const bList = bGrouped.get(key) || [];
    const tList = tGrouped.get(key) || [];
    const [method] = key.split(' ');
    const commonLen = Math.min(bList.length, tList.length);

    for (let k = 0; k < commonLen; k++) {
      if (bList[k].status !== tList[k].status) {
        statusMismatches.push({
          method,
          url: tList[k].url,
          baselineStatus: bList[k].status,
          targetStatus: tList[k].status,
          occurrence: k + 1,
        });
      }
    }

    for (let k = commonLen; k < tList.length; k++) {
      targetOnly.push({
        method,
        url: tList[k].url,
        status: tList[k].status,
        occurrence: k + 1,
      });
    }

    for (let k = commonLen; k < bList.length; k++) {
      baselineOnly.push({
        method,
        url: bList[k].url,
        status: bList[k].status,
        occurrence: k + 1,
      });
    }
  }

  return { statusMismatches, targetOnly, baselineOnly };
}

function _diffConsole(bModel: TraceModel, tModel: TraceModel): NonNullable<TraceDiffResult['consoleDiff']> {
  const bErrors = _extractErrors(bModel);
  const tErrors = _extractErrors(tModel);

  const bMatched = new Set<number>();
  const tMatched = new Set<number>();

  for (let ti = 0; ti < tErrors.length; ti++) {
    const tErr = tErrors[ti];
    for (let bi = 0; bi < bErrors.length; bi++) {
      if (!bMatched.has(bi) && bErrors[bi].type === tErr.type && bErrors[bi].normalizedText === tErr.normalizedText) {
        bMatched.add(bi);
        tMatched.add(ti);
        break;
      }
    }
  }

  const common: { type: string, text: string }[] = [];
  const introduced: { type: string, text: string }[] = [];
  const resolved: { type: string, text: string }[] = [];

  for (let ti = 0; ti < tErrors.length; ti++) {
    if (tMatched.has(ti))
      common.push({ type: tErrors[ti].type, text: tErrors[ti].text });
    else
      introduced.push({ type: tErrors[ti].type, text: tErrors[ti].text });
  }

  for (let bi = 0; bi < bErrors.length; bi++) {
    if (!bMatched.has(bi))
      resolved.push({ type: bErrors[bi].type, text: bErrors[bi].text });
  }

  return { introduced, resolved, common };
}

function _extractErrors(model: TraceModel): { type: string, text: string, normalizedText: string }[] {
  const errors: { type: string, text: string, normalizedText: string }[] = [];
  for (const event of model.events) {
    if (event.type === 'console' && event.messageType === 'error') {
      errors.push({
        type: 'console.error',
        text: event.text,
        normalizedText: normalizeTokens(event.text),
      });
    }
    if (event.type === 'event' && event.method === 'pageError') {
      const error = event.params.error;
      const text = error?.error?.message || String(error?.value ?? (error?.message || ''));
      errors.push({
        type: 'pageError',
        text,
        normalizedText: normalizeTokens(text),
      });
    }
  }
  return errors;
}

function _filterJsonOutput(result: TraceDiffResult, only?: TraceDiffOptions['only']) {
  if (only === 'actions') {
    return {
      baselineName: result.baselineName,
      targetName: result.targetName,
      metadata: result.metadata,
      firstDivergence: result.firstDivergence,
      actionsDiff: result.actionsDiff,
    };
  }
  if (only === 'network') {
    return {
      baselineName: result.baselineName,
      targetName: result.targetName,
      metadata: result.metadata,
      networkDiff: result.networkDiff,
    };
  }
  if (only === 'console') {
    return {
      baselineName: result.baselineName,
      targetName: result.targetName,
      metadata: result.metadata,
      consoleDiff: result.consoleDiff,
    };
  }
  return result;
}

function _formatStatus(status: number): string {
  return status <= 0 ? 'FAILED' : String(status);
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

    let durationDelta = '';
    if (!options.ignoreTimings) {
      const deltaMs = meta.duration.deltaMs;
      const sign = deltaMs >= 0 ? '+' : '-';
      durationDelta = ` (${sign}${msToString(Math.abs(deltaMs))})`;
    }
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
        if (fd.baseline.error)
          console.log(`             ${fd.baseline.error.split('\n')[0]}`);
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
      for (const m of net.statusMismatches) {
        const occ = m.occurrence > 1 ? ` [#${m.occurrence}]` : '';
        console.log(`  ~ ${m.method} ${m.url}${occ}  ${_formatStatus(m.baselineStatus)} -> ${_formatStatus(m.targetStatus)}`);
      }
      for (const t of net.targetOnly) {
        const occ = t.occurrence > 1 ? ` [#${t.occurrence}]` : '';
        console.log(`  + ${t.method} ${t.url}${occ}  ${_formatStatus(t.status)} (new in target)`);
      }
      for (const b of net.baselineOnly) {
        const occ = b.occurrence > 1 ? ` [#${b.occurrence}]` : '';
        console.log(`  - ${b.method} ${b.url}${occ}  ${_formatStatus(b.status)} (missing in target)`);
      }
      console.log('');
    } else if (options.only === 'network') {
      console.log('Network:');
      console.log('  No network differences detected.');
      console.log('');
    }
  }

  if (showConsole && result.consoleDiff) {
    const con = result.consoleDiff;
    const hasConsoleDiff = con.introduced.length || con.resolved.length;
    if (hasConsoleDiff) {
      if (con.introduced.length) {
        console.log('Console / Page Errors (new in target):');
        for (const err of con.introduced)
          console.log(`  + [${err.type}] ${err.text}`);
        console.log('');
      }
      if (con.resolved.length) {
        console.log('Console / Page Errors (resolved from baseline):');
        for (const err of con.resolved)
          console.log(`  - [${err.type}] ${err.text}`);
        console.log('');
      }
    } else if (con.common.length && options.only === 'console') {
      console.log('Console:');
      console.log(`  ${con.common.length} common error(s) in both traces (no new errors introduced).`);
      console.log('');
    } else if (options.only === 'console') {
      console.log('Console:');
      console.log('  No errors detected in target.');
      console.log('');
    }
  }
}
