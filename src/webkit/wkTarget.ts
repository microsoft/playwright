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
import { WKTargetSession } from './wkConnection';
import { WKPage } from './wkPage';
import { WKBrowser } from './wkBrowser';

export class WKTarget {
  readonly _browserContext: BrowserContext;
  readonly _targetId: string;
  readonly _session: WKTargetSession;
  private _pagePromise: Promise<Page> | null = null;
  private _browser: WKBrowser;
  _wkPage: WKPage | null = null;

  constructor(browser: WKBrowser, session: WKTargetSession, targetInfo: Protocol.Target.TargetInfo, browserContext: BrowserContext) {
    this._browser = browser;
    this._session = session;
    this._browserContext = browserContext;
    this._targetId = targetInfo.targetId;
    /** @type {?Promise<!Page>} */
    this._pagePromise = null;
  }

  _didClose(crashed: boolean) {
    if (this._wkPage)
      this._wkPage.didClose(crashed);
  }

  async _initializeSession(session: WKTargetSession) {
    if (!this._wkPage)
      return;
    await this._wkPage._initializeSession(session).catch(e => {
      // Swallow initialization errors due to newer target swap in,
      // since we will reinitialize again.
      if (this._wkPage)
        throw e;
    });
  }

  async _swapWith(oldTarget: WKTarget) {
    if (!oldTarget._pagePromise)
      return;
    this._pagePromise = oldTarget._pagePromise;
    this._wkPage = oldTarget._wkPage;
    // Swapped out target should not be accessed by anyone. Reset page promise so that
    // old target does not close the page on connection reset.
    oldTarget._pagePromise = null;
    oldTarget._wkPage = null;
    this._wkPage.setSession(this._session);
  }

  async page(): Promise<Page> {
    if (!this._pagePromise) {
      this._wkPage = new WKPage(this._browser, this._browserContext);
      this._wkPage.setSession(this._session);
      // Reference local page variable as |this._frameManager| may be
      // cleared on swap.
      const page = this._wkPage._page;
      this._pagePromise = this._initializeSession(this._session).then(() => page);
    }
    return this._pagePromise;
  }
}
