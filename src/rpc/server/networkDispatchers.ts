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
import * as types from '../../types';
import { RequestChannel, ResponseChannel, RouteChannel, ResponseInitializer, RequestInitializer, RouteInitializer, Binary } from '../channels';
import { Dispatcher, DispatcherScope, lookupNullableDispatcher, existingDispatcher } from './dispatcher';
import { FrameDispatcher } from './frameDispatcher';

export class RequestDispatcher extends Dispatcher<Request, RequestInitializer> implements RequestChannel {

  static from(scope: DispatcherScope, request: Request): RequestDispatcher {
    const result = existingDispatcher<RequestDispatcher>(request);
    return result || new RequestDispatcher(scope, request);
  }

  static fromNullable(scope: DispatcherScope, request: Request | null): RequestDispatcher | null {
    return request ? RequestDispatcher.from(scope, request) : null;
  }

  private constructor(scope: DispatcherScope, request: Request) {
    super(scope, request, 'request', {
      frame: FrameDispatcher.from(scope, request.frame()),
      url: request.url(),
      resourceType: request.resourceType(),
      method: request.method(),
      postData: request.postData(),
      headers: request.headers(),
      isNavigationRequest: request.isNavigationRequest(),
      redirectedFrom: RequestDispatcher.fromNullable(scope, request.redirectedFrom()),
    });
  }

  async response(): Promise<{ response: ResponseChannel | null }> {
    return { response: lookupNullableDispatcher<ResponseDispatcher>(await this._object.response()) };
  }
}

export class ResponseDispatcher extends Dispatcher<Response, ResponseInitializer> implements ResponseChannel {

  constructor(scope: DispatcherScope, response: Response) {
    super(scope, response, 'response', {
      // TODO: responses in popups can point to non-reported requests.
      request: RequestDispatcher.from(scope, response.request()),
      url: response.url(),
      status: response.status(),
      statusText: response.statusText(),
      headers: response.headers(),
    });
  }

  async finished(): Promise<{ error: Error | null }> {
    return { error: await this._object.finished() };
  }

  async body(): Promise<{ binary: Binary }> {
    return { binary: (await this._object.body()).toString('base64') };
  }
}

export class RouteDispatcher extends Dispatcher<Route, RouteInitializer> implements RouteChannel {

  constructor(scope: DispatcherScope, route: Route) {
    super(scope, route, 'route', {
      // Context route can point to a non-reported request.
      request: RequestDispatcher.from(scope, route.request())
    });
  }

  async continue(params: { method?: string, headers?: types.Headers, postData?: string }): Promise<void> {
    await this._object.continue(params);
  }

  async fulfill(params: { status?: number, headers?: types.Headers, contentType?: string, body: string, isBase64: boolean }): Promise<void> {
    await this._object.fulfill({
      status: params.status,
      headers: params.headers,
      body: params.isBase64 ? Buffer.from(params.body, 'base64') : params.body,
    });
  }

  async abort(params: { errorCode: string }): Promise<void> {
    await this._object.abort(params.errorCode);
  }
}
