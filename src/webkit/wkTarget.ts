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

import { BrowserContext } from '../browserContext';
import { Page } from '../page';
import { Protocol } from './protocol';
import { WKTargetSession, WKTargetSessionEvents } from './wkConnection';
import { WKFrameManager } from './wkFrameManager';
import { WKBrowser } from './wkBrowser';

const targetSymbol = Symbol('target');

export class WKTarget {
  readonly _browserContext: BrowserContext;
  readonly _targetId: string;
  readonly _type: 'page' | 'service-worker' | 'worker';
  private readonly _session: WKTargetSession;
  private _pagePromise: Promise<Page> | null = null;
  private _browser: WKBrowser;
  _frameManager: WKFrameManager | null = null;

  static fromPage(page: Page): WKTarget {
    return (page as any)[targetSymbol];
  }

  constructor(browser: WKBrowser, session: WKTargetSession, targetInfo: Protocol.Target.TargetInfo, browserContext: BrowserContext) {
    const {targetId, type} = targetInfo;
    this._browser = browser;
    this._session = session;
    this._browserContext = browserContext;
    this._targetId = targetId;
    this._type = type;
    /** @type {?Promise<!Page>} */
    this._pagePromise = null;
  }

  _didClose() {
    if (this._frameManager)
      this._frameManager.didClose();
  }

  async _initializeSession(session: WKTargetSession) {
    if (!this._frameManager)
      return;
    await this._frameManager._initializeSession(session).catch(e => {
      // Swallow initialization errors due to newer target swap in,
      // since we will reinitialize again.
      if (this._frameManager)
        throw e;
    });
  }

  async _swapWith(oldTarget: WKTarget) {
    if (!oldTarget._pagePromise)
      return;
    this._pagePromise = oldTarget._pagePromise;
    this._frameManager = oldTarget._frameManager;
    // Swapped out target should not be accessed by anyone. Reset page promise so that
    // old target does not close the page on connection reset.
    oldTarget._pagePromise = null;
    oldTarget._frameManager = null;
    this._adoptPage();
  }

  private _adoptPage() {
    (this._frameManager._page as any)[targetSymbol] = this;
    this._session.once(WKTargetSessionEvents.Disconnected, () => {
      // Once swapped out, we reset _page and won't call _didDisconnect for old session.
      if (this._frameManager)
        this._frameManager._page._didDisconnect();
    });
    this._frameManager.setSession(this._session);
  }

  async page(): Promise<Page> {
    if (this._type === 'page' && !this._pagePromise) {
      this._frameManager = new WKFrameManager(this._browser, this._browserContext);
      // Reference local page variable as |this._frameManager| may be
      // cleared on swap.
      const page = this._frameManager._page;
      this._pagePromise = new Promise(async f => {
        this._adoptPage();
        await this._initializeSession(this._session);
        f(page);
      });
    }
    return this._pagePromise;
  }
}
