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
import { TimeoutSettings } from './timeoutSettings';

export type BrowserContextOptions = {
  viewport?: types.Viewport | null,
  ignoreHTTPSErrors?: boolean,
  javaScriptEnabled?: boolean,
  bypassCSP?: boolean,
  userAgent?: string,
  locale?: string,
  timezoneId?: string,
  geolocation?: types.Geolocation,
  permissions?: { [key: string]: string[] };
};

export interface BrowserContext {
  setDefaultNavigationTimeout(timeout: number): void;
  setDefaultTimeout(timeout: number): void;
  pages(): Promise<Page[]>;
  newPage(): Promise<Page>;
  cookies(...urls: string[]): Promise<network.NetworkCookie[]>;
  setCookies(cookies: network.SetNetworkCookieParam[]): Promise<void>;
  clearCookies(): Promise<void>;
  setPermissions(origin: string, permissions: string[]): Promise<void>;
  clearPermissions(): Promise<void>;
  setGeolocation(geolocation: types.Geolocation | null): Promise<void>;
  close(): Promise<void>;

  _existingPages(): Page[];
  readonly _timeoutSettings: TimeoutSettings;
  readonly _options: BrowserContextOptions;
}

export function assertBrowserContextIsNotOwned(context: BrowserContext) {
  const pages = context._existingPages();
  for (const page of pages) {
    if (page._ownedContext)
      throw new Error('Please use browser.newContext() for multi-page scripts that share the context.');
  }
}

export function validateBrowserContextOptions(options: BrowserContextOptions): BrowserContextOptions {
  const result = { ...options };
  if (!result.viewport && result.viewport !== null)
    result.viewport = { width: 1280, height: 720 };
  if (result.viewport)
    result.viewport = { ...result.viewport };
  if (result.geolocation)
    result.geolocation = verifyGeolocation(result.geolocation);
  return result;
}

export function verifyGeolocation(geolocation: types.Geolocation): types.Geolocation {
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
