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
import { MockingProxy } from '../mockingProxy';
import type { RootDispatcher } from './dispatcher';
import { Dispatcher, existingDispatcher } from './dispatcher';
import type * as channels from '@protocol/channels';
import { APIRequestContextDispatcher, RequestDispatcher, ResponseDispatcher, RouteDispatcher } from './networkDispatchers';
import type { Request, Route } from '../network';

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

    this.addObjectListener(MockingProxy.Events.Route, (route: Route) => {
      const requestDispatcher = RequestDispatcher.from(this, route.request());
      this._dispatchEvent('route', { route: RouteDispatcher.from(requestDispatcher, route) });
    });
    this.addObjectListener(MockingProxy.Events.Request, ({ request, correlation }: { request: Request, correlation: string }) => {
      this._dispatchEvent('request', { request: RequestDispatcher.from(this, request), correlation });
    });
    this.addObjectListener(MockingProxy.Events.RequestFailed, (request: Request) => {
      this._dispatchEvent('requestFailed', {
        request: RequestDispatcher.from(this, request),
        failureText: request._failureText ?? undefined,
        responseEndTiming: request._responseEndTiming,
      });
    });
    this.addObjectListener(MockingProxy.Events.RequestFinished, (request: Request) => {
      this._dispatchEvent('requestFinished', {
        request: RequestDispatcher.from(this, request),
        response: ResponseDispatcher.fromNullable(this, request._existingResponse()),
        responseEndTiming: request._responseEndTiming,
      });
    });
  }
}
