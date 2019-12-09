/**
 * Copyright 2019 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

import { BrowserContext } from './Browser';
import { Page } from './Page';
import { Protocol } from './protocol';
import { isSwappedOutError, TargetSession, TargetSessionEvents } from './Connection';

const targetSymbol = Symbol('target');

export class Target {
  readonly _browserContext: BrowserContext;
  readonly _targetId: string;
  readonly _type: 'page' | 'service-worker' | 'worker';
  private readonly _session: TargetSession;
  private _pagePromise: Promise<Page> | null = null;
  private _page: Page | null = null;

  static fromPage(page: Page): Target {
    return (page as any)[targetSymbol];
  }

  constructor(session: TargetSession, targetInfo: Protocol.Target.TargetInfo, browserContext: BrowserContext) {
    const {targetId, type} = targetInfo;
    this._session = session;
    this._browserContext = browserContext;
    this._targetId = targetId;
    this._type = type;
    /** @type {?Promise<!Page>} */
    this._pagePromise = null;
  }

  _didClose() {
    if (this._page)
      this._page._didClose();
  }

  async _swappedIn(oldTarget: Target) {
    if (!oldTarget._pagePromise)
      return;
    this._pagePromise = oldTarget._pagePromise;
    this._page = oldTarget._page;
    // Swapped out target should not be accessed by anyone. Reset page promise so that
    // old target does not close the page on connection reset.
    oldTarget._pagePromise = null;
    oldTarget._page = null;
    await this._adoptPage();
  }

  private async _adoptPage() {
    (this._page as any)[targetSymbol] = this;
    this._session.once(TargetSessionEvents.Disconnected, () => {
      // Once swapped out, we reset _page and won't call _didDisconnect for old session.
      if (this._page)
        this._page._didDisconnect();
    });
    await this._page._initialize(this._session).catch(e => {
      // Swallow initialization errors due to newer target swap in,
      // since we will reinitialize again.
      if (!isSwappedOutError(e))
        throw e;
    });
  }

  async page(): Promise<Page> {
    if (this._type === 'page' && !this._pagePromise) {
      const browser = this._browserContext.browser();
      // Reference local page variable as _page may be
      // cleared on swap.
      const page = new Page(this._browserContext);
      this._page = page;
      this._pagePromise = new Promise(async f => {
        await this._adoptPage();
        if (browser._defaultViewport)
          await page.setViewport(browser._defaultViewport);
        f(page);
      });
    }
    return this._pagePromise;
  }
}
