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

// Reports `__coverage__` as a delta: reading resets the counters, maps are sent once per file.
export class CoverageScript {
  private _global: typeof globalThis;
  private _sessionId: string;
  private _reportedFiles = new Set<string>();
  private _stashOrdinal = 0;

  constructor(global: typeof globalThis, collectName: string, sessionId: string) {
    this._global = global;
    this._sessionId = sessionId;
    (global as any)[collectName] = () => this.collect();
    // Counters die with the document and unload-time calls are not delivered.
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
      // Every file is reported once, so that the never hit ones are accounted for.
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
      // Several documents can pick up the same stash, the id discards the copies.
      const id = ++this._stashOrdinal + '-' + Math.random().toString(36).slice(2);
      const key = kCoverageStashPrefix + this._sessionId + '.' + id;
      this._global.localStorage.setItem(key, JSON.stringify({ id, data: delta }));
    } catch {
    }
  }
}

// Also evaluated by Playwright itself on the origins that have no page left.
// Stashes of other sessions are stale, e.g. left by a previous run in a persistent profile.
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

// Branch counters are positional, so a hit branch is reported with the whole array.
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
