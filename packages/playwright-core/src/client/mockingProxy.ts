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

export class MockingProxy extends ChannelOwner<channels.MockingProxyChannel> {
  private _port: number;
  private _browserRequests = new Map<string, network.Request>();

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.MockingProxyInitializer) {
    super(parent, type, guid, initializer);

    this._port = initializer.port;
    const requestContext = APIRequestContext.from(initializer.requestContext);

    this._channel.on('route', async (params: channels.MockingProxyRouteEvent) => {
      let browserRequest: network.Request | undefined;
      if (params.correlation) {
        browserRequest = this._browserRequests.get(params.correlation);
        this._browserRequests.delete(params.correlation);
      }
      const route = network.Route.from(params.route);
      route._context = requestContext;
      this.emit(Events.MockingProxy.Route, { route, browserRequest });
    });
  }

  async setInterceptionPatterns(params: channels.MockingProxySetInterceptionPatternsParams) {
    await this._channel.setInterceptionPatterns(params);
  }

  async instrumentBrowserRequest(route: network.Route) {
    const isSimpleCORS = false; // TODO: implement simple CORS
    if (isSimpleCORS)
      return await route.fallback();

    const request = route.request();
    const correlation = request._guid.split('@')[1];
    this._browserRequests.set(correlation, request);
    const proxyUrl = `http://localhost:${this.port()}/pw_meta:${correlation}/`;

    await route.fallback({ headers: { 'x-playwright-proxy': encodeURIComponent(proxyUrl) } });
  }

  port(): number {
    return this._port;
  }

}
