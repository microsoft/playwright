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

import { EventEmitter } from 'events';
import { assert } from '../helper';
import { Browser } from './Browser';
import { CDPSession } from './Connection';
import { Permissions } from './features/permissions';
import { Page } from './Page';
import { Target } from './Target';

export class BrowserContext extends EventEmitter {
  readonly permissions: Permissions;

  private _browser: Browser;
  private _id: string;

  constructor(client: CDPSession, browser: Browser, contextId: string | null) {
    super();
    this._browser = browser;
    this._id = contextId;
    this.permissions = new Permissions(client, contextId);
  }

  targets(): Target[] {
    return this._browser.targets().filter(target => target.browserContext() === this);
  }

  waitForTarget(predicate: (arg0: Target) => boolean, options: { timeout?: number; } | undefined): Promise<Target> {
    return this._browser.waitForTarget(target => target.browserContext() === this && predicate(target), options);
  }

  async pages(): Promise<Page[]> {
    const pages = await Promise.all(
        this.targets()
            .filter(target => target.type() === 'page')
            .map(target => target.page())
    );
    return pages.filter(page => !!page);
  }

  isIncognito(): boolean {
    return !!this._id;
  }

  newPage(): Promise<Page> {
    return this._browser._createPageInContext(this._id);
  }

  browser(): Browser {
    return this._browser;
  }

  async close() {
    assert(this._id, 'Non-incognito profiles cannot be closed!');
    await this._browser._disposeContext(this._id);
  }
}
