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
import { Dispatcher, DispatcherScope } from '../dispatcher';
import { FrameDispatcher } from './frameDispatcher';

export class RequestDispatcher extends Dispatcher<Request, RequestInitializer> implements RequestChannel {
  static from(scope: DispatcherScope, request: Request): RequestDispatcher {
    if ((request as any)[scope.dispatcherSymbol])
      return (request as any)[scope.dispatcherSymbol];
    return new RequestDispatcher(scope, request);
  }

  static fromNullable(scope: DispatcherScope, request: Request | null): RequestDispatcher | null {
    return request ? RequestDispatcher.from(scope, request) : null;
  }

  constructor(scope: DispatcherScope, request: Request) {
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

  async response(): Promise<ResponseChannel | null> {
    return ResponseDispatcher.fromNullable(this._scope, await this._object.response());
  }
}

export class ResponseDispatcher extends Dispatcher<Response, ResponseInitializer> implements ResponseChannel {

  static from(scope: DispatcherScope, response: Response): ResponseDispatcher {
    if ((response as any)[scope.dispatcherSymbol])
      return (response as any)[scope.dispatcherSymbol];
    return new ResponseDispatcher(scope, response);
  }

  static fromNullable(scope: DispatcherScope, response: Response | null): ResponseDispatcher | null {
    return response ? ResponseDispatcher.from(scope, response) : null;
  }

  constructor(scope: DispatcherScope, response: Response) {
    super(scope, response, 'response', {
      request: RequestDispatcher.from(scope, response.request())!,
      url: response.url(),
      status: response.status(),
      statusText: response.statusText(),
      headers: response.headers(),
    });
  }

  async finished(): Promise<Error | null> {
    return await this._object.finished();
  }

  async body(): Promise<Buffer> {
    return await this._object.body();
  }
}

export class RouteDispatcher extends Dispatcher<Route, RouteInitializer> implements RouteChannel {

  static from(scope: DispatcherScope, route: Route): RouteDispatcher {
    if ((route as any)[scope.dispatcherSymbol])
      return (route as any)[scope.dispatcherSymbol];
    return new RouteDispatcher(scope, route);
  }

  static fromNullable(scope: DispatcherScope, route: Route | null): RouteDispatcher | null {
    return route ? RouteDispatcher.from(scope, route) : null;
  }

  constructor(scope: DispatcherScope, route: Route) {
    super(scope, route, 'route', {
      request: RequestDispatcher.from(scope, route.request())
    });
  }

  async continue(params: { overrides: { method?: string, headers?: types.Headers, postData?: string } }): Promise<void> {
    await this._object.continue(params.overrides);
  }

  async fulfill(params: { response: { status?: number, headers?: types.Headers, contentType?: string, body: Binary } }): Promise<void> {
    const { response } = params;
    await this._object.fulfill({
      status: response.status,
      headers: response.headers,
      contentType: response.contentType,
      body: Buffer.from(response.body, 'base64'),
    });
  }

  async abort(params: { errorCode: string }): Promise<void> {
    await this._object.abort(params.errorCode);
  }
}
