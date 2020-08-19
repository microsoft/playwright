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
import { BrowserContext } from '../../browserContext';
import { Events } from '../../events';
import { Dispatcher, DispatcherScope, lookupDispatcher } from './dispatcher';
import { PageDispatcher, BindingCallDispatcher, WorkerDispatcher } from './pageDispatcher';
import { PageChannel, BrowserContextChannel, BrowserContextInitializer, CDPSessionChannel, BrowserContextSetGeolocationParams, BrowserContextSetHTTPCredentialsParams } from '../channels';
import { RouteDispatcher, RequestDispatcher } from './networkDispatchers';
import { CRBrowserContext } from '../../chromium/crBrowser';
import { CDPSessionDispatcher } from './cdpSessionDispatcher';
import { Events as ChromiumEvents } from '../../chromium/events';

export class BrowserContextDispatcher extends Dispatcher<BrowserContext, BrowserContextInitializer> implements BrowserContextChannel {
  private _context: BrowserContext;

  constructor(scope: DispatcherScope, context: BrowserContext) {
    super(scope, context, 'BrowserContext', {}, true);
    this._context = context;

    for (const page of context.pages())
      this._dispatchEvent('page', { page: new PageDispatcher(this._scope, page) });
    context.on(Events.BrowserContext.Page, page => this._dispatchEvent('page', { page: new PageDispatcher(this._scope, page) }));
    context.on(Events.BrowserContext.Close, () => {
      this._dispatchEvent('close');
      this._dispose();
    });

    if (context._browser._options.name === 'chromium') {
      for (const page of (context as CRBrowserContext).backgroundPages())
        this._dispatchEvent('crBackgroundPage', { page: new PageDispatcher(this._scope, page) });
      context.on(ChromiumEvents.ChromiumBrowserContext.BackgroundPage, page => this._dispatchEvent('crBackgroundPage', { page: new PageDispatcher(this._scope, page) }));
      for (const serviceWorker of (context as CRBrowserContext).serviceWorkers())
        this._dispatchEvent('crServiceWorker', new WorkerDispatcher(this._scope, serviceWorker));
      context.on(ChromiumEvents.ChromiumBrowserContext.ServiceWorker, serviceWorker => this._dispatchEvent('crServiceWorker', { worker: new WorkerDispatcher(this._scope, serviceWorker) }));
    }
  }

  async setDefaultNavigationTimeoutNoReply(params: { timeout: number }) {
    this._context.setDefaultNavigationTimeout(params.timeout);
  }

  async setDefaultTimeoutNoReply(params: { timeout: number }) {
    this._context.setDefaultTimeout(params.timeout);
  }

  async exposeBinding(params: { name: string }): Promise<void> {
    await this._context.exposeBinding(params.name, (source, ...args) => {
      const binding = new BindingCallDispatcher(this._scope, params.name, source, args);
      this._dispatchEvent('bindingCall', { binding });
      return binding.promise();
    });
  }

  async newPage(): Promise<{ page: PageChannel }> {
    return { page: lookupDispatcher<PageDispatcher>(await this._context.newPage()) };
  }

  async cookies(params: { urls: string[] }): Promise<{ cookies: types.NetworkCookie[] }> {
    return { cookies: await this._context.cookies(params.urls) };
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

  async setGeolocation(params: BrowserContextSetGeolocationParams): Promise<void> {
    await this._context.setGeolocation(params.geolocation);
  }

  async setExtraHTTPHeaders(params: { headers: types.HeadersArray }): Promise<void> {
    await this._context.setExtraHTTPHeaders(params.headers);
  }

  async setOffline(params: { offline: boolean }): Promise<void> {
    await this._context.setOffline(params.offline);
  }

  async setHTTPCredentials(params: BrowserContextSetHTTPCredentialsParams): Promise<void> {
    await this._context.setHTTPCredentials(params.httpCredentials);
  }

  async addInitScript(params: { source: string }): Promise<void> {
    await this._context._doAddInitScript(params.source);
  }

  async setNetworkInterceptionEnabled(params: { enabled: boolean }): Promise<void> {
    if (!params.enabled) {
      await this._context._setRequestInterceptor(undefined);
      return;
    }
    this._context._setRequestInterceptor((route, request) => {
      this._dispatchEvent('route', { route: new RouteDispatcher(this._scope, route), request: RequestDispatcher.from(this._scope, request) });
    });
  }

  async close(): Promise<void> {
    await this._context.close();
  }

  async crNewCDPSession(params: { page: PageDispatcher }): Promise<{ session: CDPSessionChannel }> {
    const crBrowserContext = this._object as CRBrowserContext;
    return { session: new CDPSessionDispatcher(this._scope, await crBrowserContext.newCDPSession(params.page._object)) };
  }
}
