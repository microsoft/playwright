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

import { Request, Response, Route } from '../server/network';
import * as channels from '../protocol/channels';
import { Dispatcher, DispatcherScope, lookupNullableDispatcher, existingDispatcher } from './dispatcher';
import { FrameDispatcher } from './frameDispatcher';

export class RequestDispatcher extends Dispatcher<Request, channels.RequestInitializer> implements channels.RequestChannel {

  static from(scope: DispatcherScope, request: Request): RequestDispatcher {
    const result = existingDispatcher<RequestDispatcher>(request);
    return result || new RequestDispatcher(scope, request);
  }

  static fromNullable(scope: DispatcherScope, request: Request | null): RequestDispatcher | undefined {
    return request ? RequestDispatcher.from(scope, request) : undefined;
  }

  private constructor(scope: DispatcherScope, request: Request) {
    const postData = request.postDataBuffer();
    super(scope, request, 'Request', {
      frame: FrameDispatcher.from(scope, request.frame()),
      url: request.url(),
      resourceType: request.resourceType(),
      method: request.method(),
      postData: postData === null ? undefined : postData.toString('base64'),
      headers: request.headers(),
      isNavigationRequest: request.isNavigationRequest(),
      redirectedFrom: RequestDispatcher.fromNullable(scope, request.redirectedFrom()),
    });
  }

  async response(): Promise<channels.RequestResponseResult> {
    return { response: lookupNullableDispatcher<ResponseDispatcher>(await this._object.response()) };
  }
}

export class ResponseDispatcher extends Dispatcher<Response, channels.ResponseInitializer> implements channels.ResponseChannel {

  constructor(scope: DispatcherScope, response: Response) {
    super(scope, response, 'Response', {
      // TODO: responses in popups can point to non-reported requests.
      request: RequestDispatcher.from(scope, response.request()),
      url: response.url(),
      status: response.status(),
      statusText: response.statusText(),
      headers: response.headers(),
    });
  }

  async finished(): Promise<channels.ResponseFinishedResult> {
    return await this._object._finishedPromise;
  }

  async body(): Promise<channels.ResponseBodyResult> {
    return { binary: (await this._object.body()).toString('base64') };
  }
}

export class RouteDispatcher extends Dispatcher<Route, channels.RouteInitializer> implements channels.RouteChannel {

  constructor(scope: DispatcherScope, route: Route) {
    super(scope, route, 'Route', {
      // Context route can point to a non-reported request.
      request: RequestDispatcher.from(scope, route.request())
    });
  }

  async continue(params: channels.RouteContinueParams): Promise<void> {
    await this._object.continue({
      method: params.method,
      headers: params.headers,
      postData: params.postData ? Buffer.from(params.postData, 'base64') : undefined,
    });
  }

  async fulfill(params: channels.RouteFulfillParams): Promise<void> {
    await this._object.fulfill(params);
  }

  async abort(params: channels.RouteAbortParams): Promise<void> {
    await this._object.abort(params.errorCode || 'failed');
  }
}
