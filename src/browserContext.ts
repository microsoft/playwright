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

import { Page } from './page';
import * as input from './input';
import * as network from './network';
import * as types from './types';

export interface BrowserContextDelegate {
  pages(): Promise<Page[]>;
  newPage(): Promise<Page>;
  close(): Promise<void>;
  cookies(): Promise<network.NetworkCookie[]>;
  clearCookies(): Promise<void>;
  setCookies(cookies: network.SetNetworkCookieParam[]): Promise<void>;
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
  private readonly _delegate: BrowserContextDelegate;
  readonly _options: BrowserContextOptions;
  private _closed = false;

  constructor(delegate: BrowserContextDelegate, options: BrowserContextOptions) {
    this._delegate = delegate;
    this._options = options;
    if (!options.viewport && options.viewport !== null)
      options.viewport = { width: 800, height: 600 };
  }

  async pages(): Promise<Page[]> {
    return this._delegate.pages();
  }

  async newPage(): Promise<Page> {
    return this._delegate.newPage();
  }

  async cookies(...urls: string[]): Promise<network.NetworkCookie[]> {
    return network.filterCookies(await this._delegate.cookies(), urls);
  }

  async clearCookies() {
    await this._delegate.clearCookies();
  }

  async setCookies(cookies: network.SetNetworkCookieParam[]) {
    await this._delegate.setCookies(network.rewriteCookies(cookies));
  }

  async close() {
    if (this._closed)
      return;
    await this._delegate.close();
    this._closed = true;
  }
}
