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

import { mergeIstanbulCoverage, sortedIstanbulCoverage } from '@isomorphic/istanbulCoverage';
import * as rawCoverageSource from '../generated/coverageScriptSource';

import type { BrowserContext } from './browserContext';
import type { InitScript, Page } from './page';
import type { Progress } from './progress';
import type { IstanbulCoverageChunk, IstanbulFileCoverage } from '@isomorphic/istanbulCoverage';

const kCoverageCollectName = '__pwCoverageCollect';

const coverageCollectExpression = `window[${JSON.stringify(kCoverageCollectName)}] ? window[${JSON.stringify(kCoverageCollectName)}]() : []`;

export class CoverageRecorder {
  private _context: BrowserContext;
  private _coverage = new Map<string, IstanbulFileCoverage>();
  private _stashedChunkIds = new Set<string>();
  private _stashOrigins = new Set<string>();
  private _initScript: InitScript | undefined;

  constructor(context: BrowserContext) {
    this._context = context;
  }

  private _moduleExpression(call: string) {
    return `(() => {
      const module = {};
      ${rawCoverageSource.source}
      ${call}
    })()`;
  }

  // The stashes in the page storage are scoped to the context that collects them.
  private _sessionId() {
    return JSON.stringify(this._context.guid);
  }

  async install(progress: Progress) {
    if (this._initScript)
      return;
    const source = this._moduleExpression(`new (module.exports.CoverageScript())(window, ${JSON.stringify(kCoverageCollectName)}, ${this._sessionId()});`);
    this._initScript = await this._context.addInitScript(progress, source);
    // Init scripts only affect future documents, bootstrap the existing ones.
    await progress.race(this._context.safeNonStallingEvaluateInAllFrames(source, 'main'));
  }

  async uninstall() {
    const initScript = this._initScript;
    this._initScript = undefined;
    this._stashOrigins.clear();
    this._stashedChunkIds.clear();
    this._coverage.clear();
    await initScript?.dispose().catch(() => {});
  }

  onPageClose(page: Page) {
    for (const frame of page.frames())
      this._noteOrigin(frame.origin());
  }

  private _noteOrigin(origin: string | undefined) {
    if (origin)
      this._stashOrigins.add(origin);
  }

  async flush(progress: Progress) {
    await progress.race(Promise.all(this._context.pages().map(page => this.collectFromPage(page))));
    await this._harvestOriginsWithoutPage(progress);
  }

  async take(progress: Progress, mode: 'keep' | 'discard'): Promise<string | undefined> {
    if (mode === 'discard') {
      // The coverage of a chunk is discarded together with it.
      this._coverage.clear();
      return;
    }
    await this.flush(progress);
    this._stashedChunkIds.clear();
    if (!this._coverage.size)
      return;
    const sorted = sortedIstanbulCoverage(this._coverage);
    this._coverage.clear();
    return JSON.stringify(sorted);
  }

  async collectFromPage(page: Page) {
    // Pages of Playwright's own making never run the application under test.
    if (page.isStorageStatePage)
      return;
    // A page that is going away may never answer.
    await Promise.race([page.closedPromise, this._collectFromPage(page)]);
  }

  private async _collectFromPage(page: Page) {
    await Promise.all(page.frames().map(async frame => {
      this._noteOrigin(frame.origin());
      const chunks: string[] = await frame.nonStallingRawEvaluateInExistingMainContext(coverageCollectExpression).catch(() => []);
      for (const json of chunks)
        this._append(json);
    }));
  }

  // Pages relay the stashes of their own origin, the rest need a page of their own.
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
    // The origins that still have a page were drained by the sweep above.
    const origins = new Set([...this._stashOrigins].filter(origin => !liveOrigins.has(origin)));
    this._stashOrigins.clear();
    if (!origins.size)
      return;
    const source = this._moduleExpression(`return (module.exports.takeCoverageStashes())(window, ${this._sessionId()});`);
    await this._context.visitOrigins(progress, origins, async frame => {
      const chunks: string[] = await frame.evaluateExpression(progress, source, { world: 'main' }).catch(() => []);
      for (const json of chunks)
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
