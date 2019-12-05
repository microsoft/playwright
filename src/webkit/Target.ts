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

import { helper, RegisteredListener } from '../helper';
import { Browser, BrowserContext } from './Browser';
import { Page } from './Page';
import { Protocol } from './protocol';

export class Target {
  private _browserContext: BrowserContext;
  _targetId: string;
  private _type: 'page' | 'service-worker' | 'worker';
  _pagePromise: Promise<Page> | null = null;
  private _url: string;
  _initializedPromise: Promise<boolean>;
  _initializedCallback: (value?: unknown) => void;
  _isClosedPromise: Promise<void>;
  _closedCallback: (value?: unknown) => void;
  _isInitialized: boolean;
  _eventListeners: RegisteredListener[];

  constructor(targetInfo: Protocol.Target.TargetInfo, browserContext: BrowserContext) {
    const {targetId, url, type} = targetInfo;
    this._browserContext = browserContext;
    this._targetId = targetId;
    this._type = type;
    /** @type {?Promise<!Page>} */
    this._pagePromise = null;
    this._url = url;
    this._isClosedPromise = new Promise(fulfill => this._closedCallback = fulfill);
  }

  async page(): Promise<Page | null> {
    if (this._type === 'page' && !this._pagePromise) {
      const session = this.browser()._connection.session(this._targetId);
      this._pagePromise = Page.create(session, this, this.browser()._defaultViewport, this.browser()._screenshotTaskQueue);
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
