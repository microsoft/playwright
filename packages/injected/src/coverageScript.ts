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

export const kCoverageStashPrefix = '__pwCoverage.';

// Harvests istanbul counters accumulated by instrumented application code in
// `__coverage__`. Every flush serializes the counters and resets them, so
// each flush reports only the delta since the previous one. The statement,
// function and branch maps are large, so they are only reported with the
// first report of each file.
export class CoverageScript {
  private _global: typeof globalThis;
  private _sessionId: string;
  private _reportedFiles = new Set<string>();
  private _stashOrdinal = 0;

  constructor(global: typeof globalThis, collectName: string, sessionId: string) {
    this._global = global;
    this._sessionId = sessionId;
    (global as any)[collectName] = () => this.collect();
    // Counters die with the document, and calls made during unload are not
    // delivered, so stash the delta in localStorage. Playwright picks it up
    // from any same origin document, including one it opens itself after the
    // page that produced the stash is gone.
    global.addEventListener('pagehide', () => this._stashCurrent());
  }

  collect(): string[] {
    const chunks = this._takeStashes();
    const delta = this._takeCurrent();
    if (delta)
      chunks.push(JSON.stringify({ data: delta }));
    return chunks;
  }

  private _takeCurrent(): IstanbulCoverageDelta | undefined {
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
    return hasFiles ? delta : undefined;
  }

  private _takeStashes(): string[] {
    return takeCoverageStashes(this._global, this._sessionId);
  }

  private _stashCurrent() {
    const delta = this._takeCurrent();
    if (!delta)
      return;
    try {
      // A stash can be picked up by several documents at once, so it carries an
      // id that lets the recorder discard the copies.
      const id = ++this._stashOrdinal + '-' + Math.random().toString(36).slice(2);
      const key = kCoverageStashPrefix + this._sessionId + '.' + id;
      this._global.localStorage.setItem(key, JSON.stringify({ id, data: delta }));
    } catch {
    }
  }
}

// Takes the stashes left by this session and discards the ones left by other
// sessions, e.g. by a previous run reusing a persistent profile. Playwright
// also evaluates this on its own page to reach the origins that have no page
// left to relay them.
export function takeCoverageStashes(global: typeof globalThis, sessionId: string): string[] {
  const result: string[] = [];
  try {
    const storage = global.localStorage;
    const sessionPrefix = kCoverageStashPrefix + sessionId + '.';
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(kCoverageStashPrefix))
        keys.push(key);
    }
    for (const key of keys) {
      const json = key.startsWith(sessionPrefix) ? storage.getItem(key) : undefined;
      storage.removeItem(key);
      if (json)
        result.push(json);
    }
  } catch {
  }
  return result;
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
