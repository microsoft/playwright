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

import * as frames from './frame';
import { Page, BindingCall } from './page';
import * as types from '../../types';
import * as network from './network';
import { BrowserContextChannel, BrowserContextInitializer } from '../channels';
import { ChannelOwner } from './channelOwner';
import { helper } from '../../helper';
import { Browser } from './browser';
import { Events } from '../../events';
import { TimeoutSettings } from '../../timeoutSettings';
import { Waiter } from './waiter';
import { headersObjectToArray } from '../serializers';

export class BrowserContext extends ChannelOwner<BrowserContextChannel, BrowserContextInitializer> {
  _pages = new Set<Page>();
  private _routes: { url: types.URLMatch, handler: network.RouteHandler }[] = [];
  readonly _browser: Browser | undefined;
  readonly _browserName: string;
  readonly _bindings = new Map<string, frames.FunctionWithSource>();
  _timeoutSettings = new TimeoutSettings();
  _ownerPage: Page | undefined;
  private _isClosedOrClosing = false;
  private _closedPromise: Promise<void>;

  static from(context: BrowserContextChannel): BrowserContext {
    return (context as any)._object;
  }

  static fromNullable(context: BrowserContextChannel | null): BrowserContext | null {
    return context ? BrowserContext.from(context) : null;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: BrowserContextInitializer, browserName: string) {
    super(parent, type, guid, initializer, true);
    if (parent instanceof Browser)
      this._browser = parent;
    this._browserName = browserName;

    this._channel.on('bindingCall', ({binding}) => this._onBinding(BindingCall.from(binding)));
    this._channel.on('close', () => this._onClose());
    this._channel.on('page', ({page}) => this._onPage(Page.from(page)));
    this._channel.on('route', ({ route, request }) => this._onRoute(network.Route.from(route), network.Request.from(request)));
    this._closedPromise = new Promise(f => this.once(Events.BrowserContext.Close, f));
  }

  private _onPage(page: Page): void {
    this._pages.add(page);
    this.emit(Events.BrowserContext.Page, page);
  }

  _onRoute(route: network.Route, request: network.Request) {
    for (const {url, handler} of this._routes) {
      if (helper.urlMatches(request.url(), url)) {
        handler(route, request);
        return;
      }
    }
    route.continue();
  }

  async _onBinding(bindingCall: BindingCall) {
    const func = this._bindings.get(bindingCall._initializer.name);
    if (!func)
      return;
    bindingCall.call(func);
  }

  setDefaultNavigationTimeout(timeout: number) {
    this._timeoutSettings.setDefaultNavigationTimeout(timeout);
    this._channel.setDefaultNavigationTimeoutNoReply({ timeout });
  }

  setDefaultTimeout(timeout: number) {
    this._timeoutSettings.setDefaultTimeout(timeout);
    this._channel.setDefaultTimeoutNoReply({ timeout });
  }

  pages(): Page[] {
    return [...this._pages];
  }

  async newPage(): Promise<Page> {
    return this._wrapApiCall('browserContext.newPage', async () => {
      if (this._ownerPage)
        throw new Error('Please use browser.newContext()');
      return Page.from((await this._channel.newPage()).page);
    });
  }

  async cookies(urls?: string | string[]): Promise<network.NetworkCookie[]> {
    if (!urls)
      urls = [];
    if (urls && typeof urls === 'string')
      urls = [ urls ];
    return this._wrapApiCall('browserContext.cookies', async () => {
      return (await this._channel.cookies({ urls: urls as string[] })).cookies;
    });
  }

  async addCookies(cookies: network.SetNetworkCookieParam[]): Promise<void> {
    return this._wrapApiCall('browserContext.addCookies', async () => {
      await this._channel.addCookies({ cookies });
    });
  }

  async clearCookies(): Promise<void> {
    return this._wrapApiCall('browserContext.clearCookies', async () => {
      await this._channel.clearCookies();
    });
  }

  async grantPermissions(permissions: string[], options?: { origin?: string }): Promise<void> {
    return this._wrapApiCall('browserContext.grantPermissions', async () => {
      await this._channel.grantPermissions({ permissions, ...options });
    });
  }

  async clearPermissions(): Promise<void> {
    return this._wrapApiCall('browserContext.clearPermissions', async () => {
      await this._channel.clearPermissions();
    });
  }

  async setGeolocation(geolocation: types.Geolocation | null): Promise<void> {
    return this._wrapApiCall('browserContext.setGeolocation', async () => {
      await this._channel.setGeolocation({ geolocation: geolocation || undefined });
    });
  }

  async setExtraHTTPHeaders(headers: types.Headers): Promise<void> {
    return this._wrapApiCall('browserContext.setExtraHTTPHeaders', async () => {
      await this._channel.setExtraHTTPHeaders({ headers: headersObjectToArray(headers) });
    });
  }

  async setOffline(offline: boolean): Promise<void> {
    return this._wrapApiCall('browserContext.setOffline', async () => {
      await this._channel.setOffline({ offline });
    });
  }

  async setHTTPCredentials(httpCredentials: types.Credentials | null): Promise<void> {
    return this._wrapApiCall('browserContext.setHTTPCredentials', async () => {
      await this._channel.setHTTPCredentials({ httpCredentials: httpCredentials || undefined });
    });
  }

  async addInitScript(script: Function | string | { path?: string, content?: string }, arg?: any): Promise<void> {
    return this._wrapApiCall('browserContext.addInitScript', async () => {
      const source = await helper.evaluationScript(script, arg);
      await this._channel.addInitScript({ source });
    });
  }

  async exposeBinding(name: string, binding: frames.FunctionWithSource): Promise<void> {
    return this._wrapApiCall('browserContext.exposeBinding', async () => {
      for (const page of this.pages()) {
        if (page._bindings.has(name))
          throw new Error(`Function "${name}" has been already registered in one of the pages`);
      }
      if (this._bindings.has(name))
        throw new Error(`Function "${name}" has been already registered`);
      this._bindings.set(name, binding);
      await this._channel.exposeBinding({ name });
    });
  }

  async exposeFunction(name: string, playwrightFunction: Function): Promise<void> {
    await this.exposeBinding(name, (source, ...args) => playwrightFunction(...args));
  }

  async route(url: types.URLMatch, handler: network.RouteHandler): Promise<void> {
    return this._wrapApiCall('browserContext.route', async () => {
      this._routes.push({ url, handler });
      if (this._routes.length === 1)
        await this._channel.setNetworkInterceptionEnabled({ enabled: true });
    });
  }

  async unroute(url: types.URLMatch, handler?: network.RouteHandler): Promise<void> {
    return this._wrapApiCall('browserContext.unroute', async () => {
      this._routes = this._routes.filter(route => route.url !== url || (handler && route.handler !== handler));
      if (this._routes.length === 0)
        await this._channel.setNetworkInterceptionEnabled({ enabled: false });
    });
  }

  async waitForEvent(event: string, optionsOrPredicate: types.WaitForEventOptions = {}): Promise<any> {
    const timeout = this._timeoutSettings.timeout(typeof optionsOrPredicate === 'function'  ? {} : optionsOrPredicate);
    const predicate = typeof optionsOrPredicate === 'function'  ? optionsOrPredicate : optionsOrPredicate.predicate;
    const waiter = new Waiter();
    waiter.rejectOnTimeout(timeout, `Timeout while waiting for event "${event}"`);
    if (event !== Events.BrowserContext.Close)
      waiter.rejectOnEvent(this, Events.BrowserContext.Close, new Error('Context closed'));
    const result = await waiter.waitForEvent(this, event, predicate as any);
    waiter.dispose();
    return result;
  }

  private async _onClose() {
    this._isClosedOrClosing = true;
    if (this._browser)
      this._browser._contexts.delete(this);
    this.emit(Events.BrowserContext.Close);
    this._dispose();
  }

  async close(): Promise<void> {
    return this._wrapApiCall('browserContext.close', async () => {
      if (!this._isClosedOrClosing) {
        this._isClosedOrClosing = true;
        await this._channel.close();
      }
      await this._closedPromise;
    });
  }
}
