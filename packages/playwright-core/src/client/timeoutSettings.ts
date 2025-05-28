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

import { DEFAULT_PLAYWRIGHT_LAUNCH_TIMEOUT, DEFAULT_PLAYWRIGHT_TIMEOUT } from '../utils/isomorphic/time';

import type { Platform } from './platform';

export class TimeoutSettings {
  private _parent: TimeoutSettings | undefined;
  private _defaultTimeout: number | undefined;
  private _defaultNavigationTimeout: number | undefined;
  private _platform: Platform;

  constructor(platform: Platform, parent?: TimeoutSettings) {
    this._parent = parent;
    this._platform = platform;
  }

  setDefaultTimeout(timeout: number | undefined) {
    this._defaultTimeout = timeout;
  }

  setDefaultNavigationTimeout(timeout: number | undefined) {
    this._defaultNavigationTimeout = timeout;
  }

  defaultNavigationTimeout() {
    return this._defaultNavigationTimeout;
  }

  defaultTimeout() {
    return this._defaultTimeout;
  }

  navigationTimeout(options: { timeout?: number }): number {
    if (typeof options.timeout === 'number')
      return options.timeout;
    if (this._defaultNavigationTimeout !== undefined)
      return this._defaultNavigationTimeout;
    if (this._platform.isDebugMode())
      return 0;
    if (this._defaultTimeout !== undefined)
      return this._defaultTimeout;
    if (this._parent)
      return this._parent.navigationTimeout(options);
    return DEFAULT_PLAYWRIGHT_TIMEOUT;
  }

  timeout(options: { timeout?: number }): number {
    if (typeof options.timeout === 'number')
      return options.timeout;
    if (this._platform.isDebugMode())
      return 0;
    if (this._defaultTimeout !== undefined)
      return this._defaultTimeout;
    if (this._parent)
      return this._parent.timeout(options);
    return DEFAULT_PLAYWRIGHT_TIMEOUT;
  }

  launchTimeout(options: { timeout?: number }): number {
    if (typeof options.timeout === 'number')
      return options.timeout;
    if (this._platform.isDebugMode())
      return 0;
    if (this._parent)
      return this._parent.launchTimeout(options);
    return DEFAULT_PLAYWRIGHT_LAUNCH_TIMEOUT;
  }
}
