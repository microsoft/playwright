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
import * as network from './network';
import * as types from './types';
import { helper } from './helper';

export interface BrowserContextDelegate {
  pages(): Promise<Page[]>;
  existingPages(): Page[];
  newPage(): Promise<Page>;
  close(): Promise<void>;

  cookies(): Promise<network.NetworkCookie[]>;
  setCookies(cookies: network.SetNetworkCookieParam[]): Promise<void>;
  clearCookies(): Promise<void>;

  setPermissions(origin: string, permissions: string[]): Promise<void>;
  clearPermissions(): Promise<void>;

  setGeolocation(geolocation: types.Geolocation | null): Promise<void>;
}

export type BrowserContextOptions = {
  viewport?: types.Viewport | null,
  ignoreHTTPSErrors?: boolean,
  javaScriptEnabled?: boolean,
  bypassCSP?: boolean,
  userAgent?: string,
  cacheEnabled?: boolean;
  interceptNetwork?: boolean;
  offlineMode?: boolean;
  timezoneId?: string,
  geolocation?: types.Geolocation,
  permissions?: { [key: string]: string[] };
};

export class BrowserContext {
  private readonly _delegate: BrowserContextDelegate;
  readonly _options: BrowserContextOptions;
  private _closed = false;

  constructor(delegate: BrowserContextDelegate, options: BrowserContextOptions) {
    this._delegate = delegate;
    this._options = { ...options };
    if (!this._options.viewport && this._options.viewport !== null)
      this._options.viewport = { width: 800, height: 600 };
    if (this._options.viewport)
      this._options.viewport = { ...this._options.viewport };
    if (this._options.geolocation)
      this._options.geolocation = verifyGeolocation(this._options.geolocation);
  }

  async _initialize() {
    const entries = Object.entries(this._options.permissions || {});
    await Promise.all(entries.map(entry => this.setPermissions(entry[0], entry[1])));
    if (this._options.geolocation)
      await this.setGeolocation(this._options.geolocation);
  }

  _existingPages(): Page[] {
    return this._delegate.existingPages();
  }

  async pages(): Promise<Page[]> {
    return this._delegate.pages();
  }

  async newPage(url?: string): Promise<Page> {
    const page = await this._delegate.newPage();
    if (url)
      await page.goto(url);
    return page;
  }

  async cookies(...urls: string[]): Promise<network.NetworkCookie[]> {
    return network.filterCookies(await this._delegate.cookies(), urls);
  }

  async setCookies(cookies: network.SetNetworkCookieParam[]) {
    await this._delegate.setCookies(network.rewriteCookies(cookies));
  }

  async clearCookies() {
    await this._delegate.clearCookies();
  }

  async setPermissions(origin: string, permissions: string[]): Promise<void> {
    await this._delegate.setPermissions(origin, permissions);
  }

  async clearPermissions() {
    await this._delegate.clearPermissions();
  }

  async setGeolocation(geolocation: types.Geolocation | null): Promise<void> {
    if (geolocation)
      geolocation = verifyGeolocation(geolocation);
    this._options.geolocation = geolocation || undefined;
    await this._delegate.setGeolocation(geolocation);
  }

  async setCacheEnabled(enabled: boolean = true) {
    if (this._options.cacheEnabled === enabled)
      return;
    this._options.cacheEnabled = enabled;
    await Promise.all(this._existingPages().map(page => page._delegate.setCacheEnabled(enabled)));
  }

  async setRequestInterception(enabled: boolean) {
    if (this._options.interceptNetwork === enabled)
      return;
    this._options.interceptNetwork = enabled;
    await Promise.all(this._existingPages().map(page => page._delegate.setRequestInterception(enabled)));
  }

  async setOfflineMode(enabled: boolean) {
    if (this._options.offlineMode === enabled)
      return;
    this._options.offlineMode = enabled;
    await Promise.all(this._existingPages().map(page => page._delegate.setOfflineMode(enabled)));
  }

  async close() {
    if (this._closed)
      return;
    await this._delegate.close();
    this._closed = true;
  }

  static validateOptions(options: BrowserContextOptions) {
    if (options.geolocation)
      verifyGeolocation(options.geolocation);
  }
}

function verifyGeolocation(geolocation: types.Geolocation): types.Geolocation {
  const result = { ...geolocation };
  result.accuracy = result.accuracy || 0;
  const { longitude, latitude, accuracy } = result;
  if (!helper.isNumber(longitude) || longitude < -180 || longitude > 180)
    throw new Error(`Invalid longitude "${longitude}": precondition -180 <= LONGITUDE <= 180 failed.`);
  if (!helper.isNumber(latitude) || latitude < -90 || latitude > 90)
    throw new Error(`Invalid latitude "${latitude}": precondition -90 <= LATITUDE <= 90 failed.`);
  if (!helper.isNumber(accuracy) || accuracy < 0)
    throw new Error(`Invalid accuracy "${accuracy}": precondition 0 <= ACCURACY failed.`);
  return result;
}
