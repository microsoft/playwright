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

import type { IstanbulCoverage } from '@isomorphic/istanbulCoverage';

const kBacklogKey = '__pwCoverageBacklog';

// Harvests istanbul counters accumulated by instrumented application code in
// `__coverage__`. Every flush serializes the counters and resets them, so
// each flush reports only the delta since the previous one.
export class CoverageScript {
  private _global: typeof globalThis;

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
    const json = JSON.stringify(coverage);
    for (const file of Object.values(coverage)) {
      for (const key of Object.keys(file.s))
        file.s[key] = 0;
      for (const key of Object.keys(file.f))
        file.f[key] = 0;
      for (const key of Object.keys(file.b))
        file.b[key] = file.b[key].map(() => 0);
    }
    return json;
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
