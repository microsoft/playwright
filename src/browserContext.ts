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
import * as input from './input';
import * as network from './network';
import * as types from './types';
import * as childProcess from 'child_process';

export interface BrowserInterface {
  browserContexts(): BrowserContext[];
  close(): Promise<void>;
  newContext(): Promise<BrowserContext>;
  defaultContext(): BrowserContext;
  newPage(): Promise<Page>;
  pages(): Promise<Page[]>;
  process(): childProcess.ChildProcess | null;
  version(): Promise<string>;
  userAgent(): Promise<string>;
}

export interface BrowserDelegate {
  contextPages(): Promise<Page[]>;
  createPageInContext(): Promise<Page>;
  closeContext(): Promise<void>;
  getContextCookies(): Promise<network.NetworkCookie[]>;
  clearContextCookies(): Promise<void>;
  setContextCookies(cookies: network.SetNetworkCookieParam[]): Promise<void>;
}

export type BrowserContextOptions = {
  viewport?: types.Viewport | null,
  ignoreHTTPSErrors?: boolean,
  javaScriptEnabled?: boolean,
  bypassCSP?: boolean,
  mediaType?: input.MediaType,
  colorScheme?: input.ColorScheme,
  userAgent?: string,
  timezoneId?: string
};

export class BrowserContext {
  private readonly _delegate: BrowserDelegate;
  private readonly _browser: BrowserInterface;
  private readonly _isIncognito: boolean;
  readonly _options: BrowserContextOptions;

  constructor(delegate: BrowserDelegate, browser: BrowserInterface, isIncognito: boolean, options: BrowserContextOptions) {
    this._delegate = delegate;
    this._browser = browser;
    this._isIncognito = isIncognito;
    this._options = options;
    if (!options.viewport && options.viewport !== null)
      options.viewport = { width: 800, height: 600 };
  }

  async pages(): Promise<Page[]> {
    return this._delegate.contextPages();
  }

  isIncognito(): boolean {
    return this._isIncognito;
  }

  async newPage(): Promise<Page> {
    return this._delegate.createPageInContext();
  }

  async _createOwnerPage(): Promise<Page> {
    const page = await this._delegate.createPageInContext();
    page._isContextOwner = true;
    return page;
  }

  browser(): BrowserInterface {
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
