/**
 * Copyright 2017 Google Inc. All rights reserved.
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

import { assert } from './helper';
import { Page } from './page';
import * as network from './network';

export interface BrowserDelegate<Browser> {
  contextPages(): Promise<Page<Browser>[]>;
  createPageInContext(): Promise<Page<Browser>>;
  closeContext(): Promise<void>;
  getContextCookies(): Promise<network.NetworkCookie[]>;
  clearContextCookies(): Promise<void>;
  setContextCookies(cookies: network.SetNetworkCookieParam[]): Promise<void>;
}

export class BrowserContext<Browser> {
  private readonly _delegate: BrowserDelegate<Browser>;
  private readonly _browser: Browser;
  private readonly _isIncognito: boolean;

  constructor(delegate: BrowserDelegate<Browser>, browser: Browser, isIncognito: boolean) {
    this._delegate = delegate;
    this._browser = browser;
    this._isIncognito = isIncognito;
  }

  async pages(): Promise<Page<Browser>[]> {
    return this._delegate.contextPages();
  }

  isIncognito(): boolean {
    return this._isIncognito;
  }

  async newPage(): Promise<Page<Browser>> {
    return this._delegate.createPageInContext();
  }

  browser(): Browser {
    return this._browser;
  }

  async cookies(...urls: string[]): Promise<network.NetworkCookie[]> {
    return network.filterCookies(await this._delegate.getContextCookies(), urls);
  }

  async clearCookies() {
    await this._delegate.clearContextCookies();
  }

  async setCookies(cookies: network.SetNetworkCookieParam[]) {
    await this._delegate.setContextCookies(network.rewriteCookies(cookies));
  }

  async close() {
    assert(this._isIncognito, 'Non-incognito profiles cannot be closed!');
    await this._delegate.closeContext();
  }
}
