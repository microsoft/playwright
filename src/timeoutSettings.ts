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

import { TimeoutOptions } from './types';
import { helper } from './helper';

const DEFAULT_TIMEOUT = 30000;

export class TimeoutSettings {
  private _parent: TimeoutSettings | undefined;
  private _defaultTimeout: number | null = null;
  private _defaultNavigationTimeout: number | null = null;

  constructor(parent?: TimeoutSettings) {
    this._parent = parent;
  }

  setDefaultTimeout(timeout: number) {
    this._defaultTimeout = timeout;
  }

  setDefaultNavigationTimeout(timeout: number) {
    this._defaultNavigationTimeout = timeout;
  }

  navigationTimeout(): number {
    if (this._defaultNavigationTimeout !== null)
      return this._defaultNavigationTimeout;
    if (this._defaultTimeout !== null)
      return this._defaultTimeout;
    if (this._parent)
      return this._parent.navigationTimeout();
    return DEFAULT_TIMEOUT;
  }

  private _timeout(): number {
    if (this._defaultTimeout !== null)
      return this._defaultTimeout;
    if (this._parent)
      return this._parent._timeout();
    return DEFAULT_TIMEOUT;
  }

  computeDeadline(options?: TimeoutOptions) {
    const { timeout } = options || {};
    if (timeout === 0)
      return Number.MAX_SAFE_INTEGER;
    else if (typeof timeout === 'number')
      return helper.monotonicTime() + timeout;
    return helper.monotonicTime() + this._timeout();
  }
}
