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
import type { CallMetadata } from '@protocol/callMetadata';
import { MockingProxy } from '../mockingProxy';
import type { RootDispatcher } from './dispatcher';
import { Dispatcher, existingDispatcher } from './dispatcher';
import type * as channels from '@protocol/channels';
import { APIRequestContextDispatcher, RequestDispatcher, RouteDispatcher } from './networkDispatchers';
import type { Route } from '../network';
import { urlMatches } from '../../utils/isomorphic/urlMatch';

export class MockingProxyDispatcher extends Dispatcher<MockingProxy, channels.MockingProxyChannel, RootDispatcher> implements channels.MockingProxyChannel {
  _type_MockingProxy = true;
  _type_EventTarget = true;

  static from(scope: RootDispatcher, mockingProxy: MockingProxy): MockingProxyDispatcher {
    return existingDispatcher<MockingProxyDispatcher>(mockingProxy) || new MockingProxyDispatcher(scope, mockingProxy);
  }

  private constructor(scope: RootDispatcher, mockingProxy: MockingProxy) {
    super(scope, mockingProxy, 'MockingProxy', {
      port: mockingProxy.port,
      requestContext: APIRequestContextDispatcher.from(scope, mockingProxy.fetchRequest),
    });

    this.addObjectListener(MockingProxy.Events.Route, ({ route, browserRequestRoute }: {route: Route, browserRequestRoute?: string }) => {
      const requestDispatcher = RequestDispatcher.from(this as any, route.request());
      this._dispatchEvent('route', { route: RouteDispatcher.from(requestDispatcher, route), browserRequestRoute });
    });
  }

  async setInterceptionPatterns(params: channels.MockingProxySetInterceptionPatternsParams, metadata?: CallMetadata): Promise<channels.MockingProxySetInterceptionPatternsResult> {
    if (params.patterns.length === 0)
      return this._object.setInterceptionPatterns(undefined);

    const urlMatchers = params.patterns.map(pattern => pattern.regexSource ? new RegExp(pattern.regexSource, pattern.regexFlags!) : pattern.glob!);
    this._object.setInterceptionPatterns(url => urlMatchers.some(urlMatch => urlMatches(undefined, url, urlMatch)));
  }
}
