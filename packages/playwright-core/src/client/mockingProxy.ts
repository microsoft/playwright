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

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.MockingProxyInitializer) {
    super(parent, type, guid, initializer);

    this._port = initializer.port;
    const requestContext = APIRequestContext.from(initializer.requestContext);

    this._channel.on('route', (params: channels.MockingProxyRouteEvent) => {
      const route = network.Route.from(params.route);
      route._context = requestContext;
      this.emit(Events.MockingProxy.Route, route);
    });
  }

  async setInterceptionPatterns(params: channels.MockingProxySetInterceptionPatternsParams) {
    await this._channel.setInterceptionPatterns(params);
  }

  port(): number {
    return this._port;
  }

}
