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
import { Connection } from './Connection';
import { Page } from './Page';
import { Target } from './Target';
import { Protocol } from './protocol';

export class BrowserContext extends EventEmitter {
  private _connection: Connection;
  private _browser: Browser;
  private _id: string;

  constructor(connection: Connection, browser: Browser, contextId: string | null) {
    super();
    this._connection = connection;
    this._browser = browser;
    this._id = contextId;
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

  async overridePermissions(origin: string, permissions: string[]) {
    const webPermissionToProtocol = new Map<string, Protocol.Browser.PermissionType>([
      ['geolocation', 'geolocation'],
      ['midi', 'midi'],
      ['notifications', 'notifications'],
      ['camera', 'videoCapture'],
      ['microphone', 'audioCapture'],
      ['background-sync', 'backgroundSync'],
      ['ambient-light-sensor', 'sensors'],
      ['accelerometer', 'sensors'],
      ['gyroscope', 'sensors'],
      ['magnetometer', 'sensors'],
      ['accessibility-events', 'accessibilityEvents'],
      ['clipboard-read', 'clipboardRead'],
      ['clipboard-write', 'clipboardWrite'],
      ['payment-handler', 'paymentHandler'],
      // chrome-specific permissions we have.
      ['midi-sysex', 'midiSysex'],
    ]);
    const filtered = permissions.map(permission => {
      const protocolPermission = webPermissionToProtocol.get(permission);
      if (!protocolPermission)
        throw new Error('Unknown permission: ' + permission);
      return protocolPermission;
    });
    await this._connection.send('Browser.grantPermissions', {origin, browserContextId: this._id || undefined, permissions: filtered});
  }

  async clearPermissionOverrides() {
    await this._connection.send('Browser.resetPermissions', {browserContextId: this._id || undefined});
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
