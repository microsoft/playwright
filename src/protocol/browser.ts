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

import { helper } from '../helper';
import { ClientConnection } from './connection';
import * as platform from '../platform';
import { ConnectionTransport } from '../transport';
import { Events } from '../events';
import * as types from '../types';

export type BrowserContextOptions = {
  viewport?: types.Viewport | null,
  // ignoreHTTPSErrors?: boolean,
  // javaScriptEnabled?: boolean,
  // bypassCSP?: boolean,
  // userAgent?: string,
  // timezoneId?: string,
  geolocation?: types.Geolocation,
  // permissions?: { [key: string]: string[] };
};

export class Browser extends platform.EventEmitter {
  readonly _connection: ClientConnection;
  readonly _browserContexts = new Map<string, BrowserContext>();

  constructor(transport: ConnectionTransport) {
    super();
    this._connection = new ClientConnection(transport, () => this.emit(Events.Browser.Disconnected));
  }

  async newContext(options: BrowserContextOptions = {}): Promise<BrowserContext> {
    options = { ...options };
    if (!options.viewport && options.viewport !== null)
      options.viewport = { width: 800, height: 600 };
    if (options.viewport)
      options.viewport = { ...options.viewport };
    if (options.geolocation)
      options.geolocation = verifyGeolocation(options.geolocation);

    const { contextId } = await this._connection.send('BrowserContext.create', {
      viewportSize: options.viewport ? { width: options.viewport.width, height: options.viewport.height } : undefined,
      geolocation: options.geolocation,
    });
    return new BrowserContext(this, contextId, options);
  }

  async disconnect() {
    const disconnected = new Promise(f => this.once(Events.Browser.Disconnected, f));
    this._connection.close();
    await disconnected;
  }

  isConnected(): boolean {
    return !this._connection.isClosed();
  }
}

export class BrowserContext {
  readonly _browser: Browser;
  readonly _browserContextId: string;
  readonly _options: BrowserContextOptions;

  private _closed = false;

  constructor(browser: Browser, browserContextId: string, options: BrowserContextOptions) {
    this._browser = browser;
    this._browserContextId = browserContextId;
    this._options = options;
    this._browser._browserContexts.set(this._browserContextId, this);
  }

  async setGeolocation(geolocation: types.Geolocation | null): Promise<void> {
    if (geolocation)
      geolocation = verifyGeolocation(geolocation);
    this._options.geolocation = geolocation || undefined;
    await this._browser._connection.send('BrowserContext.setGeolocation', {
      contextId: this._browserContextId,
      geolocation: this._options.geolocation,
    });
  }

  async close() {
    if (this._closed)
      return;
    this._closed = true;
    this._browser._browserContexts.delete(this._browserContextId);
    await this._browser._connection.send('BrowserContext.destroy', { contextId: this._browserContextId });
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
