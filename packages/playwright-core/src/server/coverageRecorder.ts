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

import { mergeIstanbulCoverage } from '@isomorphic/istanbulCoverage';
import * as rawCoverageSource from '../generated/coverageScriptSource';

import type { BrowserContext } from './browserContext';
import type { Page } from './page';
import type { Progress } from './progress';
import type { IstanbulCoverageChunk, IstanbulFileCoverage } from '@isomorphic/istanbulCoverage';

const kCoverageCollectName = '__pwCoverageCollect';

const coverageCollectExpression = `window[${JSON.stringify(kCoverageCollectName)}] ? window[${JSON.stringify(kCoverageCollectName)}]() : []`;

export class CoverageRecorder {
  private _context: BrowserContext;
  private _coverage = new Map<string, IstanbulFileCoverage>();
  private _stashedChunkIds = new Set<string>();
  private _stashOrigins = new Set<string>();
  private _installed = false;
  private _active = false;

  constructor(context: BrowserContext) {
    this._context = context;
  }

  // Scopes the stashes in the page storage to this context, so that the ones
  // left behind by a previous run in a persistent profile are discarded.
  private _sessionId() {
    return this._context.guid;
  }

  private _bootstrapSource() {
    return `(() => {
      const module = {};
      ${rawCoverageSource.source}
      new (module.exports.CoverageScript())(window, ${JSON.stringify(kCoverageCollectName)}, ${JSON.stringify(this._sessionId())});
    })()`;
  }

  activate() {
    this._active = true;
  }

  deactivate() {
    this._active = false;
  }

  active() {
    return this._active;
  }

  async install(progress: Progress) {
    if (this._installed)
      return;
    this._installed = true;
    const bootstrapSource = this._bootstrapSource();
    await this._context.addInitScript(progress, bootstrapSource);
    // Init scripts only affect future documents, bootstrap the existing ones.
    await progress.race(this._context.safeNonStallingEvaluateInAllFrames(bootstrapSource, 'main'));
  }

  onPageClose(page: Page) {
    if (!this._active)
      return;
    // The stash of a closed page stays in the storage of its origin.
    for (const frame of page.frames())
      this._noteOrigin(frame.origin());
  }

  private _noteOrigin(origin: string | undefined) {
    if (origin)
      this._stashOrigins.add(origin);
  }

  async flush(progress: Progress) {
    for (const page of this._context.pages())
      await progress.race(this.collectFromPage(page));
    await this._harvestOriginsWithoutPage(progress);
  }

  // Collects pending coverage from all pages and returns it serialized, resetting the accumulator.
  async take(progress: Progress): Promise<string | undefined> {
    if (!this._active)
      return;
    await this.flush(progress);
    const sorted = Object.fromEntries([...this._coverage.entries()].sort(([a], [b]) => a.localeCompare(b)));
    this._coverage.clear();
    return JSON.stringify(sorted);
  }

  async collectFromPage(page: Page) {
    // A page that is going away may never answer, give up on it when it does.
    await Promise.race([page.closedPromise, this._collectFromPage(page)]);
  }

  private async _collectFromPage(page: Page) {
    for (const frame of page.frames()) {
      // A document of this origin may leave a stash behind when it goes away.
      this._noteOrigin(frame.origin());
      const chunks: string[] = await frame.nonStallingEvaluateInExistingContext(coverageCollectExpression, 'main').catch(() => []);
      for (const json of chunks || [])
        this._append(json);
    }
  }

  // Pages relay the stashes of their own origin, so only the origins that are
  // left without a page need a page of their own to relay them.
  private async _harvestOriginsWithoutPage(progress: Progress) {
    if (!this._stashOrigins.size || this._context.isClosingOrClosed())
      return;
    const liveOrigins = new Set<string>();
    for (const page of this._context.pages()) {
      for (const frame of page.frames()) {
        const origin = frame.origin();
        if (origin)
          liveOrigins.add(origin);
      }
    }
    // The origins that still have a page were just drained by the sweep above.
    const origins = new Set([...this._stashOrigins].filter(origin => !liveOrigins.has(origin)));
    this._stashOrigins.clear();
    if (!origins.size)
      return;
    const takeStashesExpression = `(() => {
      const module = {};
      ${rawCoverageSource.source}
      return (module.exports.takeCoverageStashes())(window, ${JSON.stringify(this._sessionId())});
    })()`;
    await this._context.visitOrigins(progress, origins, async frame => {
      const chunks: string[] = await frame.evaluateExpression(progress, takeStashesExpression, { world: 'main' }).catch(() => []);
      for (const json of chunks || [])
        this._append(json);
    });
  }

  private _append(json: string) {
    try {
      const chunk: IstanbulCoverageChunk = JSON.parse(json);
      if (chunk.id) {
        if (this._stashedChunkIds.has(chunk.id))
          return;
        this._stashedChunkIds.add(chunk.id);
      }
      mergeIstanbulCoverage(this._coverage, chunk.data);
    } catch {
    }
  }
}
