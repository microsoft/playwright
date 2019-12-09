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

import { RegisteredListener } from '../helper';
import { Browser, BrowserContext } from './Browser';
import { Page } from './Page';
import { Protocol } from './protocol';
import { isSwappedOutError, TargetSession, TargetSessionEvents } from './Connection';

const targetSymbol = Symbol('target');

export class Target {
  private _browserContext: BrowserContext;
  _targetId: string;
  private _type: 'page' | 'service-worker' | 'worker';
  private _pagePromise: Promise<Page> | null = null;
  private _page: Page | null = null;
  private _url: string;
  _initializedPromise: Promise<boolean>;
  _initializedCallback: (value?: unknown) => void;
  _isInitialized: boolean;
  _eventListeners: RegisteredListener[];

  static fromPage(page: Page): Target {
    return (page as any)[targetSymbol];
  }

  constructor(targetInfo: Protocol.Target.TargetInfo, browserContext: BrowserContext) {
    const {targetId, url, type} = targetInfo;
    this._browserContext = browserContext;
    this._targetId = targetId;
    this._type = type;
    /** @type {?Promise<!Page>} */
    this._pagePromise = null;
    this._url = url;
  }

  _didClose() {
    if (this._page)
      this._page._didClose();
  }

  async _swappedIn(oldTarget: Target, session: TargetSession) {
    this._pagePromise = oldTarget._pagePromise;
    this._page = oldTarget._page;
    // Swapped out target should not be accessed by anyone. Reset page promise so that
    // old target does not close the page on connection reset.
    oldTarget._pagePromise = null;
    oldTarget._page = null;
    if (this._pagePromise)
      this._adoptPage(this._page || await this._pagePromise, session);
  }

  private async _adoptPage(page: Page, session: TargetSession) {
    this._page = page;
    (page as any)[targetSymbol] = this;
    session.once(TargetSessionEvents.Disconnected, () => {
      // Once swapped out, we reset _page and won't call _didDisconnect for old session.
      if (this._page === page)
        page._didDisconnect();
    });
    await page._initialize(session).catch(e => {
      // Swallow initialization errors due to newer target swap in,
      // since we will reinitialize again.
      if (!isSwappedOutError(e))
        throw e;
    });
  }

  async page(): Promise<Page> {
    if (this._type === 'page' && !this._pagePromise) {
      const session = this.browser()._connection.session(this._targetId);
      this._pagePromise = new Promise(async f => {
        const page = new Page(this._browserContext);
        await this._adoptPage(page, session);
        if (this.browser()._defaultViewport)
          await page.setViewport(this.browser()._defaultViewport);
        f(page);
      });
    }
    return this._pagePromise;
  }

  url(): string {
    return this._url;
  }

  type(): 'page' | 'service-worker' | 'worker' {
    return this._type;
  }

  browser(): Browser {
    return this._browserContext.browser();
  }

  browserContext(): BrowserContext {
    return this._browserContext;
  }
}
