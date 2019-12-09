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
    if (this._pagePromise)
      this._pagePromise.then(page => page._didClose());
  }

  async _swappedIn(oldTarget: Target, session: TargetSession) {
    this._pagePromise = oldTarget._pagePromise;
    // Swapped out target should not be accessed by anyone. Reset page promise so that
    // old target does not close the page on connection reset.
    oldTarget._pagePromise = null;
    if (!this._pagePromise)
      return;
    const page = await this._pagePromise;
    (page as any)[targetSymbol] = this;
    page._swapSessionOnNavigation(session).catch(rethrowIfNotSwapped);
  }

  async page(): Promise<Page | null> {
    if (this._type === 'page' && !this._pagePromise) {
      const session = this.browser()._connection.session(this._targetId);
      this._pagePromise = new Promise(async f => {
        const page = new Page(session, this._browserContext);
        await page._initialize().catch(rethrowIfNotSwapped);
        if (this.browser()._defaultViewport)
          await page.setViewport(this.browser()._defaultViewport);
        (page as any)[targetSymbol] = this;
        session.once(TargetSessionEvents.Disconnected, () => {
          // Check that this target has not been swapped out.
          if ((page as any)[targetSymbol] === this)
            page._didDisconnect();
        });
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

function rethrowIfNotSwapped(e: Error) {
  if (!isSwappedOutError(e))
    throw e;
}
