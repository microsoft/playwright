/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { IstanbulCoverage, IstanbulCoverageDelta, IstanbulFileCoverageDelta } from '@isomorphic/istanbulCoverage';

const kBacklogKey = '__pwCoverageBacklog';

// Harvests istanbul counters accumulated by instrumented application code in
// `__coverage__`. Every flush serializes the counters and resets them, so
// each flush reports only the delta since the previous one. The statement,
// function and branch maps are large, so they are only reported with the
// first report of each file.
export class CoverageScript {
  private _global: typeof globalThis;
  private _reportedFiles = new Set<string>();

  constructor(global: typeof globalThis, bindingName: string, collectName: string) {
    this._global = global;
    (global as any)[collectName] = () => this.collect();
    // Counters die with the document, and binding calls made during unload
    // are not delivered, so park the delta in sessionStorage for the next
    // same-origin document or the end-of-test sweep to pick up.
    global.addEventListener('pagehide', () => this._parkCurrent());
    // Relay deltas parked by previous documents, now that delivery is safe.
    for (const json of this._takeBacklog())
      (global as any)[bindingName](json).catch(() => {});
  }

  collect(): string[] {
    const chunks = this._takeBacklog();
    const current = this._takeCurrent();
    if (current)
      chunks.push(current);
    return chunks;
  }

  private _takeCurrent(): string | undefined {
    const coverage: IstanbulCoverage | undefined = (this._global as any).__coverage__;
    if (!coverage)
      return undefined;
    const delta: IstanbulCoverageDelta = {};
    let hasFiles = false;
    for (const [file, fileCoverage] of Object.entries(coverage)) {
      const s = takeCounters(fileCoverage.s);
      const f = takeCounters(fileCoverage.f);
      const b = takeBranchCounters(fileCoverage.b);
      // Report every file once to account for the files that were never hit,
      // afterwards only report the files that were hit since the last report.
      const isFirstReport = !this._reportedFiles.has(file);
      if (!isFirstReport && !s && !f && !b)
        continue;
      const entry: IstanbulFileCoverageDelta = { path: fileCoverage.path, s: s || {}, f: f || {}, b: b || {} };
      if (isFirstReport) {
        entry.statementMap = fileCoverage.statementMap;
        entry.fnMap = fileCoverage.fnMap;
        entry.branchMap = fileCoverage.branchMap;
        this._reportedFiles.add(file);
      }
      delta[file] = entry;
      hasFiles = true;
    }
    return hasFiles ? JSON.stringify(delta) : undefined;
  }

  private _takeBacklog(): string[] {
    try {
      const backlog = this._global.sessionStorage.getItem(kBacklogKey);
      if (backlog) {
        this._global.sessionStorage.removeItem(kBacklogKey);
        return JSON.parse(backlog);
      }
    } catch {
    }
    return [];
  }

  private _parkCurrent() {
    const json = this._takeCurrent();
    if (!json)
      return;
    try {
      const existing = this._global.sessionStorage.getItem(kBacklogKey);
      const backlog = existing ? JSON.parse(existing) : [];
      backlog.push(json);
      this._global.sessionStorage.setItem(kBacklogKey, JSON.stringify(backlog));
    } catch {
    }
  }
}

// Returns the non-zero counters and resets them, or undefined when there are none.
function takeCounters(counters: { [key: string]: number }): { [key: string]: number } | undefined {
  let result: { [key: string]: number } | undefined;
  for (const key of Object.keys(counters)) {
    const count = counters[key];
    if (!count)
      continue;
    if (!result)
      result = {};
    result[key] = count;
    counters[key] = 0;
  }
  return result;
}

// Branch counters are positional, so hit branches are reported with the whole array.
function takeBranchCounters(counters: { [key: string]: number[] }): { [key: string]: number[] } | undefined {
  let result: { [key: string]: number[] } | undefined;
  for (const key of Object.keys(counters)) {
    const counts = counters[key];
    if (!counts.some(Boolean))
      continue;
    if (!result)
      result = {};
    result[key] = counts.slice();
    counters[key] = counts.map(() => 0);
  }
  return result;
}
