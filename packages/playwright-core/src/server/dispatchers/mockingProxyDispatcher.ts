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
import { Dispatcher } from './dispatcher';
import type * as channels from '@protocol/channels';
import { RequestDispatcher, ResponseDispatcher, RouteDispatcher } from './networkDispatchers';
import type { Request } from '../network';
import type { LocalUtilsDispatcher } from './localUtilsDispatcher';

export class MockingProxyDispatcher extends Dispatcher<MockingProxy, channels.MockingProxyChannel, LocalUtilsDispatcher> implements channels.MockingProxyChannel {
  _type_MockingProxy = true;
  _type_EventTarget = true;

  constructor(scope: LocalUtilsDispatcher, mockingProxy: MockingProxy) {
    super(scope, mockingProxy, 'MockingProxy', {
      baseURL: mockingProxy.baseURL(),
    });

    mockingProxy.onRoute = async route => {
      const requestDispatcher = RequestDispatcher.from(this, route.request());
      this._dispatchEvent('route', { route: RouteDispatcher.from(requestDispatcher, route) });
    };
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

  override _onDispose(): void {
    this._object.stop();
  }
}
