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
import { Page, BindingCall, waitForEvent } from './page';
import * as types from '../../types';
import * as network from './network';
import { BrowserContextChannel } from '../channels';
import { ChannelOwner } from './channelOwner';
import { helper } from '../../helper';
import { Browser } from './browser';
import { Connection } from '../connection';

export class BrowserContext extends ChannelOwner<BrowserContextChannel> {
  _pages = new Set<Page>();
  private _routes: { url: types.URLMatch, handler: network.RouteHandler }[] = [];
  _browser: Browser | undefined;
  readonly _bindings = new Map<string, frames.FunctionWithSource>();

  static from(context: BrowserContextChannel): BrowserContext {
    return context._object;
  }

  static fromNullable(context: BrowserContextChannel | null): BrowserContext | null {
    return context ? BrowserContext.from(context) : null;
  }

  constructor(connection: Connection, channel: BrowserContextChannel) {
    super(connection, channel);
  }

  _initialize() {}

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
    const func = this._bindings.get(bindingCall.name);
    if (!func)
      return;
    bindingCall.call(func);
  }

  setDefaultNavigationTimeout(timeout: number) {
    this._channel.setDefaultNavigationTimeoutNoReply({ timeout });
  }

  setDefaultTimeout(timeout: number) {
    this._channel.setDefaultTimeoutNoReply({ timeout });
  }

  pages(): Page[] {
    return [...this._pages];
  }

  async newPage(): Promise<Page> {
    return Page.from(await this._channel.newPage());
  }

  async cookies(urls?: string | string[]): Promise<network.NetworkCookie[]> {
    if (!urls)
      urls = [];
    if (urls && typeof urls === 'string')
      urls = [ urls ];
    return this._channel.cookies({ urls: urls as string[] });
  }

  async addCookies(cookies: network.SetNetworkCookieParam[]): Promise<void> {
    await this._channel.addCookies({ cookies });
  }

  async clearCookies(): Promise<void> {
    await this._channel.clearCookies();
  }

  async grantPermissions(permissions: string[], options?: { origin?: string }): Promise<void> {
    await this._channel.grantPermissions({ permissions, options });
  }

  async clearPermissions(): Promise<void> {
    await this._channel.clearPermissions();
  }

  async setGeolocation(geolocation: types.Geolocation | null): Promise<void> {
    await this._channel.setGeolocation({ geolocation });
  }

  async setExtraHTTPHeaders(headers: types.Headers): Promise<void> {
    await this._channel.setExtraHTTPHeaders({ headers });
  }

  async setOffline(offline: boolean): Promise<void> {
    await this._channel.setOffline({ offline });
  }

  async setHTTPCredentials(httpCredentials: types.Credentials | null): Promise<void> {
    await this._channel.setHTTPCredentials({ httpCredentials });
  }

  async addInitScript(script: Function | string | { path?: string, content?: string }, arg?: any): Promise<void> {
    const source = await helper.evaluationScript(script, arg);
    await this._channel.addInitScript({ source });
  }

  async exposeBinding(name: string, binding: frames.FunctionWithSource): Promise<void> {
    for (const page of this.pages()) {
      if (page._bindings.has(name))
        throw new Error(`Function "${name}" has been already registered in one of the pages`);
    }
    if (this._bindings.has(name))
      throw new Error(`Function "${name}" has been already registered`);
    this._bindings.set(name, binding);
    await this._channel.exposeBinding({ name });
  }

  async exposeFunction(name: string, playwrightFunction: Function): Promise<void> {
    await this.exposeBinding(name, (source, ...args) => playwrightFunction(...args));
  }

  async route(url: types.URLMatch, handler: network.RouteHandler): Promise<void> {
    this._routes.push({ url, handler });
    if (this._routes.length === 1)
      await this._channel.setNetworkInterceptionEnabled({ enabled: true });
  }

  async unroute(url: types.URLMatch, handler?: network.RouteHandler): Promise<void> {
    this._routes = this._routes.filter(route => route.url !== url || (handler && route.handler !== handler));
    if (this._routes.length === 0)
      await this._channel.setNetworkInterceptionEnabled({ enabled: false });
  }

  async waitForEvent(event: string, optionsOrPredicate?: Function | (types.TimeoutOptions & { predicate?: Function })): Promise<any> {
    return waitForEvent(this, event, optionsOrPredicate);
  }

  async close(): Promise<void> {
    await this._channel.close();
    this._browser!._contexts.delete(this);
  }
}
