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

import { BrowserContext } from '../server/browserContext';
import { Dispatcher, DispatcherScope, lookupDispatcher } from './dispatcher';
import { PageDispatcher, BindingCallDispatcher, WorkerDispatcher } from './pageDispatcher';
import * as channels from '../protocol/channels';
import { RouteDispatcher, RequestDispatcher } from './networkDispatchers';
import { CRBrowserContext } from '../server/chromium/crBrowser';
import { CDPSessionDispatcher } from './cdpSessionDispatcher';

export class BrowserContextDispatcher extends Dispatcher<BrowserContext, channels.BrowserContextInitializer> implements channels.BrowserContextChannel {
  private _context: BrowserContext;

  constructor(scope: DispatcherScope, context: BrowserContext) {
    super(scope, context, 'BrowserContext', { browserName: context._browser._options.name }, true);
    this._context = context;

    for (const page of context.pages())
      this._dispatchEvent('page', { page: new PageDispatcher(this._scope, page) });
    context.on(BrowserContext.Events.Page, page => this._dispatchEvent('page', { page: new PageDispatcher(this._scope, page) }));
    context.on(BrowserContext.Events.Close, () => {
      this._dispatchEvent('close');
      this._dispose();
    });

    if (context._browser._options.name === 'chromium') {
      for (const page of (context as CRBrowserContext).backgroundPages())
        this._dispatchEvent('crBackgroundPage', { page: new PageDispatcher(this._scope, page) });
      context.on(CRBrowserContext.CREvents.BackgroundPage, page => this._dispatchEvent('crBackgroundPage', { page: new PageDispatcher(this._scope, page) }));
      for (const serviceWorker of (context as CRBrowserContext).serviceWorkers())
        this._dispatchEvent('crServiceWorker', new WorkerDispatcher(this._scope, serviceWorker));
      context.on(CRBrowserContext.CREvents.ServiceWorker, serviceWorker => this._dispatchEvent('crServiceWorker', { worker: new WorkerDispatcher(this._scope, serviceWorker) }));
    }
  }

  async setDefaultNavigationTimeoutNoReply(params: channels.BrowserContextSetDefaultNavigationTimeoutNoReplyParams) {
    this._context.setDefaultNavigationTimeout(params.timeout);
  }

  async setDefaultTimeoutNoReply(params: channels.BrowserContextSetDefaultTimeoutNoReplyParams) {
    this._context.setDefaultTimeout(params.timeout);
  }

  async exposeBinding(params: channels.BrowserContextExposeBindingParams): Promise<void> {
    await this._context.exposeBinding(params.name, !!params.needsHandle, (source, ...args) => {
      const binding = new BindingCallDispatcher(this._scope, params.name, !!params.needsHandle, source, args);
      this._dispatchEvent('bindingCall', { binding });
      return binding.promise();
    });
  }

  async newPage(): Promise<channels.BrowserContextNewPageResult> {
    return { page: lookupDispatcher<PageDispatcher>(await this._context.newPage()) };
  }

  async cookies(params: channels.BrowserContextCookiesParams): Promise<channels.BrowserContextCookiesResult> {
    return { cookies: await this._context.cookies(params.urls) };
  }

  async addCookies(params: channels.BrowserContextAddCookiesParams): Promise<void> {
    await this._context.addCookies(params.cookies);
  }

  async clearCookies(): Promise<void> {
    await this._context.clearCookies();
  }

  async grantPermissions(params: channels.BrowserContextGrantPermissionsParams): Promise<void> {
    await this._context.grantPermissions(params.permissions, params.origin);
  }

  async clearPermissions(): Promise<void> {
    await this._context.clearPermissions();
  }

  async setGeolocation(params: channels.BrowserContextSetGeolocationParams): Promise<void> {
    await this._context.setGeolocation(params.geolocation);
  }

  async setExtraHTTPHeaders(params: channels.BrowserContextSetExtraHTTPHeadersParams): Promise<void> {
    await this._context.setExtraHTTPHeaders(params.headers);
  }

  async setOffline(params: channels.BrowserContextSetOfflineParams): Promise<void> {
    await this._context.setOffline(params.offline);
  }

  async setHTTPCredentials(params: channels.BrowserContextSetHTTPCredentialsParams): Promise<void> {
    await this._context.setHTTPCredentials(params.httpCredentials);
  }

  async addInitScript(params: channels.BrowserContextAddInitScriptParams): Promise<void> {
    await this._context._doAddInitScript(params.source);
  }

  async setNetworkInterceptionEnabled(params: channels.BrowserContextSetNetworkInterceptionEnabledParams): Promise<void> {
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

  async crNewCDPSession(params: channels.BrowserContextCrNewCDPSessionParams): Promise<channels.BrowserContextCrNewCDPSessionResult> {
    if (this._object._browser._options.name !== 'chromium')
      throw new Error(`CDP session is only available in Chromium`);
    const crBrowserContext = this._object as CRBrowserContext;
    return { session: new CDPSessionDispatcher(this._scope, await crBrowserContext.newCDPSession((params.page as PageDispatcher)._object)) };
  }
}
