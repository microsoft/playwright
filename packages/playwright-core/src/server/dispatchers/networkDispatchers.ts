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

import type * as channels from '../../protocol/channels';
import { APIRequestContext } from '../fetch';
import type { CallMetadata } from '../instrumentation';
import type { Request, Response, Route } from '../network';
import { WebSocket } from '../network';
import type { DispatcherScope } from './dispatcher';
import { Dispatcher, existingDispatcher, lookupNullableDispatcher } from './dispatcher';
import { FrameDispatcher } from './frameDispatcher';
import { TracingDispatcher } from './tracingDispatcher';

export class RequestDispatcher extends Dispatcher<Request, channels.RequestChannel> implements channels.RequestChannel {
  _type_Request: boolean;

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
    this._type_Request = true;
  }

  async rawRequestHeaders(params?: channels.RequestRawRequestHeadersParams): Promise<channels.RequestRawRequestHeadersResult> {
    return { headers: await this._object.rawRequestHeaders() };
  }

  async response(): Promise<channels.RequestResponseResult> {
    return { response: lookupNullableDispatcher<ResponseDispatcher>(await this._object.response()) };
  }
}

export class ResponseDispatcher extends Dispatcher<Response, channels.ResponseChannel> implements channels.ResponseChannel {
  _type_Response = true;

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
      headers: response.headers(),
      timing: response.timing()
    });
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

  async rawResponseHeaders(params?: channels.ResponseRawResponseHeadersParams): Promise<channels.ResponseRawResponseHeadersResult> {
    return { headers: await this._object.rawResponseHeaders() };
  }

  async sizes(params?: channels.ResponseSizesParams): Promise<channels.ResponseSizesResult> {
    return { sizes: await this._object.sizes() };
  }
}

export class RouteDispatcher extends Dispatcher<Route, channels.RouteChannel> implements channels.RouteChannel {
  _type_Route = true;

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

  async continue(params: channels.RouteContinueParams, metadata: CallMetadata): Promise<channels.RouteContinueResult> {
    await this._object.continue({
      url: params.url,
      method: params.method,
      headers: params.headers,
      postData: params.postData !== undefined ? Buffer.from(params.postData, 'base64') : undefined,
    });
  }

  async fulfill(params: channels.RouteFulfillParams): Promise<void> {
    await this._object.fulfill(params);
  }

  async abort(params: channels.RouteAbortParams): Promise<void> {
    await this._object.abort(params.errorCode || 'failed');
  }
}

export class WebSocketDispatcher extends Dispatcher<WebSocket, channels.WebSocketChannel> implements channels.WebSocketChannel {
  _type_EventTarget = true;
  _type_WebSocket = true;

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

export class APIRequestContextDispatcher extends Dispatcher<APIRequestContext, channels.APIRequestContextChannel> implements channels.APIRequestContextChannel {
  _type_APIRequestContext = true;

  static from(scope: DispatcherScope, request: APIRequestContext): APIRequestContextDispatcher {
    const result = existingDispatcher<APIRequestContextDispatcher>(request);
    return result || new APIRequestContextDispatcher(scope, request);
  }

  static fromNullable(scope: DispatcherScope, request: APIRequestContext | null): APIRequestContextDispatcher | undefined {
    return request ? APIRequestContextDispatcher.from(scope, request) : undefined;
  }

  private constructor(scope: DispatcherScope, request: APIRequestContext) {
    super(scope, request, 'APIRequestContext', {
      tracing: TracingDispatcher.from(scope, request.tracing()),
    }, true);
    request.once(APIRequestContext.Events.Dispose, () => {
      if (!this._disposed)
        super._dispose();
    });
  }

  async storageState(params?: channels.APIRequestContextStorageStateParams): Promise<channels.APIRequestContextStorageStateResult> {
    return this._object.storageState();
  }

  async dispose(params?: channels.APIRequestContextDisposeParams): Promise<void> {
    await this._object.dispose();
  }

  async fetch(params: channels.APIRequestContextFetchParams, metadata: CallMetadata): Promise<channels.APIRequestContextFetchResult> {
    const fetchResponse = await this._object.fetch(params, metadata);
    return {
      response: {
        url: fetchResponse.url,
        status: fetchResponse.status,
        statusText: fetchResponse.statusText,
        headers: fetchResponse.headers,
        fetchUid: fetchResponse.fetchUid
      }
    };
  }

  async fetchResponseBody(params: channels.APIRequestContextFetchResponseBodyParams, metadata?: channels.Metadata): Promise<channels.APIRequestContextFetchResponseBodyResult> {
    const buffer = this._object.fetchResponses.get(params.fetchUid);
    return { binary: buffer ? buffer.toString('base64') : undefined };
  }

  async fetchLog(params: channels.APIRequestContextFetchLogParams, metadata?: channels.Metadata): Promise<channels.APIRequestContextFetchLogResult> {
    const log = this._object.fetchLog.get(params.fetchUid) || [];
    return { log };
  }

  async disposeAPIResponse(params: channels.APIRequestContextDisposeAPIResponseParams, metadata?: channels.Metadata): Promise<void> {
    this._object.disposeResponse(params.fetchUid);
  }
}
