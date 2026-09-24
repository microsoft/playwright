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

import { Page } from './page';

import type { FrameExecutionContext } from './dom';
import type { Frame } from './frames';
import type * as types from './types';
import type { ParsedSelector } from '@isomorphic/selectorParser';

export type HighlightOptions = {
  style?: string;
  anyFrame?: boolean; // Highlight in all the frames the selector could resolve to, instead of a single one.
  frame?: Frame; // Resolve the selector relative to this frame, defaults to the main frame.
};

type HighlightEntry = HighlightOptions & {
  selector: string;
  frame: Frame;
};

// Custom selector engines run in the main world, so highlights may live in either world.
const worlds: types.World[] = ['utility', 'main'];

export class HighlightController {
  private _page: Page;
  private _entries = new Map<string, HighlightEntry>();
  private _resolutionTimer: NodeJS.Timeout | undefined;
  private _resolutionChain: Promise<void> = Promise.resolve();

  constructor(page: Page) {
    this._page = page;
    page.on(Page.Events.FrameDetached, frame => {
      for (const [key, entry] of this._entries) {
        if (entry.frame === frame)
          this._entries.delete(key);
      }
    });
  }

  async addHighlight(selector: string, options: HighlightOptions = {}) {
    // Validate the selector upfront, so that the caller gets a synchronous error.
    this._page.browserContext.selectors().parseSelector(selector, false);
    const frame = options.frame ?? this._page.mainFrame();
    this._entries.set(this._key(frame, selector), { selector, ...options, frame });
    await this._resolveNow();
  }

  async removeHighlight(selector: string, frame?: Frame) {
    this._entries.delete(this._key(frame ?? this._page.mainFrame(), selector));
    await this._resolveNow();
  }

  private _key(frame: Frame, selector: string) {
    return frame.guid + ':' + selector;
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
      await Promise.all(worlds.map(async world => {
        const injectedScript = await frame.existingContext(world)?.injectedScript();
        await injectedScript?.evaluate(injected => injected.hideHighlight());
      }));
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

    const perContext = new Map<FrameExecutionContext, { selector: ParsedSelector, cssStyle?: string }[]>();
    for (const entry of this._entries.values()) {
      const results = await entry.frame.selectors.resolveFramesForSelector(entry.selector, { strict: false, anyFrame: entry.anyFrame }).catch(() => []);
      for (const { frame, info } of results) {
        const context = frame.existingContext(info.world);
        if (!context)
          continue;
        let list = perContext.get(context);
        if (!list) {
          list = [];
          perContext.set(context, list);
        }
        list.push({ selector: info.parsed, cssStyle: entry.style });
      }
    }

    await Promise.all(this._page.frames().map(async frame => {
      await frame.raceAgainstEvaluationStallingEvents(async () => {
        await Promise.all(worlds.map(async world => {
          const context = frame.existingContext(world);
          if (!context)
            return;
          const highlights = perContext.get(context) || [];
          const injectedScript = await context.injectedScript();
          await injectedScript.evaluate((injected, highlights) => injected.setHighlights(highlights), highlights);
        }));
      }).catch(() => {});
    }));

    if (this._entries.size && !this._resolutionTimer && !this._page.isClosed())
      this._resolutionTimer = setTimeout(() => this._resolveNow(), 1000);
  }
}
