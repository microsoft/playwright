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

import { Request, Response, Route } from '../../network';
import { RequestChannel, ResponseChannel, RouteChannel, ResponseInitializer, RequestInitializer, RouteInitializer, Binary } from '../channels';
import { Dispatcher, DispatcherScope, lookupNullableDispatcher, existingDispatcher } from './dispatcher';
import { FrameDispatcher } from './frameDispatcher';
import { headersObjectToArray, headersArrayToObject } from '../../converters';
import * as types from '../../types';

export class RequestDispatcher extends Dispatcher<Request, RequestInitializer> implements RequestChannel {

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
      headers: headersObjectToArray(request.headers()),
      isNavigationRequest: request.isNavigationRequest(),
      redirectedFrom: RequestDispatcher.fromNullable(scope, request.redirectedFrom()),
    });
  }

  async response(): Promise<{ response?: ResponseChannel }> {
    return { response: lookupNullableDispatcher<ResponseDispatcher>(await this._object.response()) };
  }
}

export class ResponseDispatcher extends Dispatcher<Response, ResponseInitializer> implements ResponseChannel {

  constructor(scope: DispatcherScope, response: Response) {
    super(scope, response, 'Response', {
      // TODO: responses in popups can point to non-reported requests.
      request: RequestDispatcher.from(scope, response.request()),
      url: response.url(),
      status: response.status(),
      statusText: response.statusText(),
      headers: headersObjectToArray(response.headers()),
    });
  }

  async finished(): Promise<{ error?: string }> {
    return await this._object._finishedPromise;
  }

  async body(): Promise<{ binary: Binary }> {
    return { binary: (await this._object.body()).toString('base64') };
  }
}

export class RouteDispatcher extends Dispatcher<Route, RouteInitializer> implements RouteChannel {

  constructor(scope: DispatcherScope, route: Route) {
    super(scope, route, 'Route', {
      // Context route can point to a non-reported request.
      request: RequestDispatcher.from(scope, route.request())
    });
  }

  async continue(params: { method?: string, headers?: types.HeadersArray, postData?: string }): Promise<void> {
    await this._object.continue({
      method: params.method,
      headers: params.headers ? headersArrayToObject(params.headers) : undefined,
      postData: params.postData ? Buffer.from(params.postData, 'base64') : undefined,
    });
  }

  async fulfill(params: types.NormalizedFulfillResponse): Promise<void> {
    await this._object.fulfill({
      status: params.status,
      headers: params.headers ? headersArrayToObject(params.headers) : undefined,
      body: params.isBase64 ? Buffer.from(params.body, 'base64') : params.body,
    });
  }

  async abort(params: { errorCode: string }): Promise<void> {
    await this._object.abort(params.errorCode);
  }
}
