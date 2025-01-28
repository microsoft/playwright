/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
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
import * as network from './network';
import type * as channels from '@protocol/channels';
import { ChannelOwner } from './channelOwner';
import { APIRequestContext } from './fetch';
import { Events } from './events';
import { assert } from '../utils';
import type { Page } from './page';

export class MockingProxy extends ChannelOwner<channels.MockingProxyChannel> {
  private _pages = new Map<string, Page>();

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.MockingProxyInitializer) {
    super(parent, type, guid, initializer);

    const requestContext = APIRequestContext.from(initializer.requestContext);
    this._channel.on('route', async (params: channels.MockingProxyRouteEvent) => {
      const route = network.Route.from(params.route);
      route._context = requestContext;
      this.emit(Events.MockingProxy.Route, route);
    });

    this._channel.on('request', async (params: channels.MockingProxyRequestEvent) => {
      const page = this._pages.get(params.correlation);
      assert(page);
      const request = network.Request.from(params.request);
      request._page = page;
    });

    this._channel.on('requestFailed', async (params: channels.MockingProxyRequestFailedEvent) => {
      const request = network.Request.from(params.request);
      request._failureText = params.failureText ?? null;
      request._setResponseEndTiming(params.responseEndTiming);
    });

    this._channel.on('requestFinished', async (params: channels.MockingProxyRequestFinishedEvent) => {
      const { responseEndTiming } = params;
      const request = network.Request.from(params.request);
      const response = network.Response.fromNullable(params.response);
      request._setResponseEndTiming(responseEndTiming);
      response?._finishedPromise.resolve(null);
    });

    this._channel.on('response', async (params: channels.MockingProxyResponseEvent) => {
      // no-op
    });
  }

  async setInterceptionPatterns(params: channels.MockingProxySetInterceptionPatternsParams) {
    await this._channel.setInterceptionPatterns(params);
  }

  async instrumentPage(page: Page) {
    const correlation = page._guid.split('@')[1];
    this._pages.set(correlation, page);
    const proxyUrl = `http://localhost:${this._initializer.port}/pw_meta:${correlation}/`;
    await page.setExtraHTTPHeaders({
      'x-playwright-proxy': encodeURIComponent(proxyUrl)
    });
  }

}
