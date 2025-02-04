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
import type { APIRequestContext } from './fetch';
import { assert } from '../utils';
import type { Page } from './page';
import type { Playwright } from './playwright';

export class MockingProxy extends ChannelOwner<channels.MockingProxyChannel> {
  _requestContext!: APIRequestContext;
  _playwright!: Playwright;

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.MockingProxyInitializer) {
    super(parent, type, guid, initializer);

    this._channel.on('route', async (params: channels.MockingProxyRouteEvent) => {
      const route = network.Route.from(params.route);
      route._apiRequestContext = this._requestContext;
      const page = route.request()._pageForMockingProxy!;
      await page._onRoute(route);
    });

    this._channel.on('request', async (params: channels.MockingProxyRequestEvent) => {
      const page = this.findPage(params.correlation);
      assert(page);
      const request = network.Request.from(params.request);
      request._pageForMockingProxy = page;
      page.context()._onRequest(request, page);
    });

    this._channel.on('requestFailed', async (params: channels.MockingProxyRequestFailedEvent) => {
      const request = network.Request.from(params.request);
      const page = request._pageForMockingProxy!;
      page.context()._onRequestFailed(request, params.responseEndTiming, params.failureText, page);
    });

    this._channel.on('requestFinished', async (params: channels.MockingProxyRequestFinishedEvent) => {
      const { responseEndTiming } = params;
      const request = network.Request.from(params.request);
      const response = network.Response.fromNullable(params.response);
      const page = request._pageForMockingProxy!;
      page.context()._onRequestFinished(request, response, page, responseEndTiming);
    });

    this._channel.on('response', async (params: channels.MockingProxyResponseEvent) => {
      const response = network.Response.from(params.response);
      const page = response.request()._pageForMockingProxy!;
      page.context()._onResponse(response, page);
    });
  }

  static from(channel: channels.MockingProxyChannel): MockingProxy {
    return (channel as any)._object;
  }

  findPage(correlation: string): Page | undefined {
    const guid = `page@${correlation}`;
    // TODO: move this as list onto Playwright directly
    for (const browserType of [this._playwright.chromium, this._playwright.firefox, this._playwright.webkit]) {
      for (const context of browserType._contexts) {
        for (const page of context._pages) {
          if (page._guid === guid)
            return page;
        }
      }
    }
  }

  baseURL() {
    return this._initializer.baseURL;
  }
}
