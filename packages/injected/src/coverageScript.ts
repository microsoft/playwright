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

import { kCoverageStashError, kCoverageStashPrefix } from '@isomorphic/istanbulCoverage';

import type { IstanbulCoverage, IstanbulCoverageDelta, IstanbulFileCoverageDelta } from '@isomorphic/istanbulCoverage';

// Reports `__coverage__` as a delta: reading resets the counters, maps are sent once per file.
export class CoverageScript {
  private _global: typeof globalThis;
  private _takeName: string;
  private _sessionId: string;
  private _reportedFiles = new Set<string>();
  private _onPageHide = () => this._stashCurrent();

  constructor(global: typeof globalThis, takeName: string, sessionId: string) {
    this._global = global;
    this._takeName = takeName;
    this._sessionId = sessionId;
    (global as any)[takeName] = Object.assign(() => this.take(), { dispose: () => this.dispose() });
    this._resetCounters();
    // Counters die with the document and unload-time calls are not delivered.
    global.addEventListener('pagehide', this._onPageHide);
  }

  private _resetCounters() {
    const coverage: IstanbulCoverage | undefined = (this._global as any).__coverage__;
    for (const fileCoverage of Object.values(coverage || {})) {
      takeCounters(fileCoverage.s);
      takeCounters(fileCoverage.f);
      takeBranchCounters(fileCoverage.b);
    }
  }

  dispose() {
    this._global.removeEventListener('pagehide', this._onPageHide);
    delete (this._global as any)[this._takeName];
  }

  take(): string[] {
    const chunks = takeCoverageStashes(this._global, this._sessionId);
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
    }
    return Object.keys(delta).length ? delta : undefined;
  }

  private _stashCurrent() {
    const delta = this._takeCurrent();
    if (!delta)
      return;
    // Several documents can pick up the same stash, the id discards the copies.
    const id = Math.random().toString(36).slice(2);
    try {
      this._global.localStorage.setItem(kCoverageStashPrefix + this._sessionId + '.' + id, JSON.stringify({ id, data: delta }));
    } catch (error) {
      // The counters are lost, the next take surfaces the error.
      try {
        this._global.localStorage.setItem(stashErrorKey(this._sessionId), String(error));
      } catch {
      }
    }
  }
}

function stashErrorKey(sessionId: string) {
  return kCoverageStashPrefix + 'error.' + sessionId;
}

// Stashes of other sessions are stale, e.g. left by a previous run in a persistent profile.
export function takeCoverageStashes(global: typeof globalThis, sessionId: string): string[] {
  const result: string[] = [];
  let storage: Storage;
  try {
    storage = global.localStorage;
  } catch {
    return result;
  }
  const error = storage.getItem(stashErrorKey(sessionId));
  if (error) {
    storage.removeItem(stashErrorKey(sessionId));
    throw new Error(kCoverageStashError + ': ' + error);
  }
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
    counts.fill(0);
  }
  return result;
}
