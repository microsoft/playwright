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

import type { Frame } from './frames';
import type { Page } from './page';
import type { ParsedSelector } from '@isomorphic/selectorParser';

export type HighlightOptions = {
  style?: string;
  anyFrame?: boolean; // Highlight in all the frames the selector could resolve to, instead of a single one.
};

type HighlightEntry = HighlightOptions & {
  selector: string;
};

export class HighlightController {
  private _page: Page;
  private _entries = new Map<string, HighlightEntry>();
  private _resolutionTimer: NodeJS.Timeout | undefined;
  private _resolutionChain: Promise<void> = Promise.resolve();

  constructor(page: Page) {
    this._page = page;
  }

  async addHighlight(selector: string, options: HighlightOptions = {}) {
    // Validate the selector upfront, so that the caller gets a synchronous error.
    this._page.browserContext.selectors().parseSelector(selector, false);
    this._entries.set(selector, { selector, ...options });
    await this._resolveNow();
  }

  async removeHighlight(selector: string) {
    this._entries.delete(selector);
    await this._resolveNow();
  }

  dispose() {
    if (this._resolutionTimer) {
      clearTimeout(this._resolutionTimer);
      this._resolutionTimer = undefined;
    }
  }

  async hideHighlights() {
    this._entries.clear();
    await Promise.all(this._page.frames().map(frame => frame.raceAgainstEvaluationStallingEvents(async () => {
      const context = frame.existingContext('utility');
      const injectedScript = await context?.injectedScript();
      await injectedScript?.evaluate(injected => injected.hideHighlight());
    }).catch(() => {})));
  }

  private _resolveNow(): Promise<void> {
    if (this._resolutionTimer) {
      clearTimeout(this._resolutionTimer);
      this._resolutionTimer = undefined;
    }
    this._resolutionChain = this._resolutionChain.then(() => this._resolve()).catch(() => {});
    return this._resolutionChain;
  }

  private async _resolve() {
    if (this._page.isClosed())
      return;

    const perFrame = new Map<Frame, { selector: ParsedSelector, cssStyle?: string }[]>();
    for (const entry of this._entries.values()) {
      const results = await this._page.mainFrame().selectors.resolveFramesForSelector(entry.selector, { strict: false, anyFrame: entry.anyFrame }).catch(() => []);
      for (const { frame, info } of results) {
        let list = perFrame.get(frame);
        if (!list) {
          list = [];
          perFrame.set(frame, list);
        }
        list.push({ selector: info.parsed, cssStyle: entry.style });
      }
    }

    await Promise.all(this._page.frames().map(async frame => {
      const highlights = perFrame.get(frame) || [];
      await frame.raceAgainstEvaluationStallingEvents(async () => {
        const context = frame.existingContext('utility');
        const injectedScript = await context?.injectedScript();
        await injectedScript?.evaluate((injected, highlights) => injected.setHighlights(highlights), highlights);
      }).catch(() => {});
    }));

    if (this._entries.size && !this._resolutionTimer && !this._page.isClosed())
      this._resolutionTimer = setTimeout(() => this._resolveNow(), 1000);
  }
}
