/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as types from '../../types';
import { BrowserContextBase } from '../../browserContext';
import { Events } from '../../events';
import { BrowserDispatcher } from './browserDispatcher';
import { Dispatcher, DispatcherScope } from '../dispatcher';
import { PageDispatcher } from './pageDispatcher';
import { PageChannel, BrowserContextChannel } from '../channels';

export class BrowserContextDispatcher extends Dispatcher implements BrowserContextChannel {
  private _context: BrowserContextBase;

  static from(scope: DispatcherScope, browserContext: BrowserContextBase): BrowserContextDispatcher {
    if ((browserContext as any)[scope.dispatcherSymbol])
      return (browserContext as any)[scope.dispatcherSymbol];
    return new BrowserContextDispatcher(scope, browserContext);
  }

  constructor(scope: DispatcherScope, context: BrowserContextBase) {
    super(scope, context, 'context');
    this._initialize({
      browser: BrowserDispatcher.from(scope, context._browserBase)
    });
    this._context = context;
    context.on(Events.BrowserContext.Page, page => this._dispatchEvent('page', PageDispatcher.from(this._scope, page)));
    context.on(Events.BrowserContext.Close, () => {
      this._dispatchEvent('close');
    });
  }

  async setDefaultNavigationTimeoutNoReply(params: { timeout: number }) {
    this._context.setDefaultNavigationTimeout(params.timeout);
  }

  async setDefaultTimeoutNoReply(params: { timeout: number }) {
    this._context.setDefaultTimeout(params.timeout);
  }

  async exposeBinding(params: { name: string }): Promise<void> {
  }

  async newPage(): Promise<PageChannel> {
    return PageDispatcher.from(this._scope, await this._context.newPage());
  }

  async cookies(params: { urls: string[] }): Promise<types.NetworkCookie[]> {
    return await this._context.cookies(params.urls);
  }

  async addCookies(params: { cookies: types.SetNetworkCookieParam[] }): Promise<void> {
    await this._context.addCookies(params.cookies);
  }

  async clearCookies(): Promise<void> {
    await this._context.clearCookies();
  }

  async grantPermissions(params: { permissions: string[], options: { origin?: string } }): Promise<void> {
    await this._context.grantPermissions(params.permissions, params.options);
  }

  async clearPermissions(): Promise<void> {
    await this._context.clearPermissions();
  }

  async setGeolocation(params: { geolocation: types.Geolocation | null }): Promise<void> {
    await this._context.setGeolocation(params.geolocation);
  }

  async setExtraHTTPHeaders(params: { headers: types.Headers }): Promise<void> {
    await this._context.setExtraHTTPHeaders(params.headers);
  }

  async setOffline(params: { offline: boolean }): Promise<void> {
    await this._context.setOffline(params.offline);
  }

  async setHTTPCredentials(params: { httpCredentials: types.Credentials | null }): Promise<void> {
    await this._context.setHTTPCredentials(params.httpCredentials);
  }

  async addInitScript(params: { source: string }): Promise<void> {
    await this._context._doAddInitScript(params.source);
  }

  async setNetworkInterceptionEnabled(params: { enabled: boolean }): Promise<void> {
  }

  async waitForEvent(params: { event: string }): Promise<any> {
  }

  async close(): Promise<void> {
    this._context.close();
  }
}
