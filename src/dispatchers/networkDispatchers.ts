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

import { Request, Response, Route, WebSocket } from '../server/network';
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

  static from(scope: DispatcherScope, response: Response): ResponseDispatcher {
    const result = existingDispatcher<ResponseDispatcher>(response);
    return result || new ResponseDispatcher(scope, response);
  }

  static fromNullable(scope: DispatcherScope, response: Response | null): ResponseDispatcher | undefined {
    return response ? ResponseDispatcher.from(scope, response) : undefined;
  }

  private constructor(scope: DispatcherScope, response: Response) {
    super(scope, response, 'Response', {
      // TODO: responses in popups can point to non-reported requests.
      request: RequestDispatcher.from(scope, response.request()),
      url: response.url(),
      status: response.status(),
      statusText: response.statusText(),
      requestHeaders: response.request().headers(),
      headers: response.headers(),
      timing: response.timing()
    });
  }

  async finished(): Promise<channels.ResponseFinishedResult> {
    return await this._object._finishedPromise;
  }

  async body(): Promise<channels.ResponseBodyResult> {
    return { binary: (await this._object.body()).toString('base64') };
  }

  async securityDetails(): Promise<channels.ResponseSecurityDetailsResult> {
    return { value: await this._object.securityDetails() || undefined };
  }

  async serverAddr(): Promise<channels.ResponseServerAddrResult> {
    return { value: await this._object.serverAddr() || undefined };
  }
}

export class RouteDispatcher extends Dispatcher<Route, channels.RouteInitializer> implements channels.RouteChannel {

  static from(scope: DispatcherScope, route: Route): RouteDispatcher {
    const result = existingDispatcher<RouteDispatcher>(route);
    return result || new RouteDispatcher(scope, route);
  }

  private constructor(scope: DispatcherScope, route: Route) {
    super(scope, route, 'Route', {
      // Context route can point to a non-reported request.
      request: RequestDispatcher.from(scope, route.request())
    });
  }

  async responseBody(params?: channels.RouteResponseBodyParams, metadata?: channels.Metadata): Promise<channels.RouteResponseBodyResult> {
    return { binary: (await this._object.responseBody()).toString('base64') };
  }

  async continue(params: channels.RouteContinueParams, metadata?: channels.Metadata): Promise<channels.RouteContinueResult> {
    const response = await this._object.continue({
      url: params.url,
      method: params.method,
      headers: params.headers,
      postData: params.postData ? Buffer.from(params.postData, 'base64') : undefined,
      interceptResponse: params.interceptResponse
    });
    const result: channels.RouteContinueResult = {};
    if (response) {
      result.response = {
        request: RequestDispatcher.from(this._scope, response.request()),
        status: response.status(),
        statusText: response.statusText(),
        headers: response.headers(),
      };
    }
    return result;
  }

  async fulfill(params: channels.RouteFulfillParams): Promise<void> {
    await this._object.fulfill(params);
  }

  async abort(params: channels.RouteAbortParams): Promise<void> {
    await this._object.abort(params.errorCode || 'failed');
  }
}

export class WebSocketDispatcher extends Dispatcher<WebSocket, channels.WebSocketInitializer> implements channels.WebSocketChannel {
  constructor(scope: DispatcherScope, webSocket: WebSocket) {
    super(scope, webSocket, 'WebSocket', {
      url: webSocket.url(),
    });
    webSocket.on(WebSocket.Events.FrameSent, (event: { opcode: number, data: string }) => this._dispatchEvent('frameSent', event));
    webSocket.on(WebSocket.Events.FrameReceived, (event: { opcode: number, data: string }) => this._dispatchEvent('frameReceived', event));
    webSocket.on(WebSocket.Events.SocketError, (error: string) => this._dispatchEvent('socketError', { error }));
    webSocket.on(WebSocket.Events.Close, () => this._dispatchEvent('close', {}));
  }
}
