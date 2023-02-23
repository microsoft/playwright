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

import type * as channels from '@protocol/channels';
import type { APIRequestContext } from '../fetch';
import type { CallMetadata } from '../instrumentation';
import type { Request, Response, Route } from '../network';
import { WebSocket } from '../network';
import type { RootDispatcher } from './dispatcher';
import { Dispatcher, existingDispatcher } from './dispatcher';
import { TracingDispatcher } from './tracingDispatcher';
import type { BrowserContextDispatcher } from './browserContextDispatcher';
import type { PageDispatcher } from './pageDispatcher';
import { FrameDispatcher } from './frameDispatcher';
import { WorkerDispatcher } from './pageDispatcher';

export class RequestDispatcher extends Dispatcher<Request, channels.RequestChannel, BrowserContextDispatcher> implements channels.RequestChannel {
  _type_Request: boolean;

  static from(scope: BrowserContextDispatcher, request: Request): RequestDispatcher {
    const result = existingDispatcher<RequestDispatcher>(request);
    return result || new RequestDispatcher(scope, request);
  }

  static fromNullable(scope: BrowserContextDispatcher, request: Request | null): RequestDispatcher | undefined {
    return request ? RequestDispatcher.from(scope, request) : undefined;
  }

  private constructor(scope: BrowserContextDispatcher, request: Request) {
    const postData = request.postDataBuffer();
    super(scope, request, 'Request', {
      frame: FrameDispatcher.fromNullable(scope as any as PageDispatcher, request.frame()),
      serviceWorker: WorkerDispatcher.fromNullable(scope, request.serviceWorker()),
      url: request.url(),
      resourceType: request.resourceType(),
      method: request.method(),
      postData: postData === null ? undefined : postData,
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
    return { response: ResponseDispatcher.fromNullable(this.parentScope(), await this._object.response()) };
  }
}

export class ResponseDispatcher extends Dispatcher<Response, channels.ResponseChannel, BrowserContextDispatcher> implements channels.ResponseChannel {
  _type_Response = true;

  static from(scope: BrowserContextDispatcher, response: Response): ResponseDispatcher {
    const result = existingDispatcher<ResponseDispatcher>(response);
    return result || new ResponseDispatcher(scope, response);
  }

  static fromNullable(scope: BrowserContextDispatcher, response: Response | null): ResponseDispatcher | undefined {
    return response ? ResponseDispatcher.from(scope, response) : undefined;
  }

  private constructor(scope: BrowserContextDispatcher, response: Response) {
    super(scope, response, 'Response', {
      // TODO: responses in popups can point to non-reported requests.
      request: RequestDispatcher.from(scope, response.request()),
      url: response.url(),
      status: response.status(),
      statusText: response.statusText(),
      headers: response.headers(),
      timing: response.timing(),
      fromServiceWorker: response.fromServiceWorker(),
    });
  }

  async body(): Promise<channels.ResponseBodyResult> {
    return { binary: await this._object.body() };
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

export class RouteDispatcher extends Dispatcher<Route, channels.RouteChannel, RequestDispatcher> implements channels.RouteChannel {
  _type_Route = true;

  static from(scope: RequestDispatcher, route: Route): RouteDispatcher {
    const result = existingDispatcher<RouteDispatcher>(route);
    return result || new RouteDispatcher(scope, route);
  }

  private constructor(scope: RequestDispatcher, route: Route) {
    super(scope, route, 'Route', {
      // Context route can point to a non-reported request.
      request: scope
    });
  }

  async continue(params: channels.RouteContinueParams, metadata: CallMetadata): Promise<channels.RouteContinueResult> {
    // Used to discriminate between continue in tracing.
    metadata.params.requestUrl = this._object.request().url();
    await this._object.continue({
      url: params.url,
      method: params.method,
      headers: params.headers,
      postData: params.postData,
    });
  }

  async fulfill(params: channels.RouteFulfillParams, metadata: CallMetadata): Promise<void> {
    // Used to discriminate between fulfills in tracing.
    metadata.params.requestUrl = this._object.request().url();
    await this._object.fulfill(params);
  }

  async abort(params: channels.RouteAbortParams, metadata: CallMetadata): Promise<void> {
    // Used to discriminate between abort in tracing.
    metadata.params.requestUrl = this._object.request().url();
    await this._object.abort(params.errorCode || 'failed');
  }

  async redirectNavigationRequest(params: channels.RouteRedirectNavigationRequestParams): Promise<void> {
    await this._object.redirectNavigationRequest(params.url);
  }
}

export class WebSocketDispatcher extends Dispatcher<WebSocket, channels.WebSocketChannel, PageDispatcher> implements channels.WebSocketChannel {
  _type_EventTarget = true;
  _type_WebSocket = true;

  constructor(scope: PageDispatcher, webSocket: WebSocket) {
    super(scope, webSocket, 'WebSocket', {
      url: webSocket.url(),
    });
    this.addObjectListener(WebSocket.Events.FrameSent, (event: { opcode: number, data: string }) => this._dispatchEvent('frameSent', event));
    this.addObjectListener(WebSocket.Events.FrameReceived, (event: { opcode: number, data: string }) => this._dispatchEvent('frameReceived', event));
    this.addObjectListener(WebSocket.Events.SocketError, (error: string) => this._dispatchEvent('socketError', { error }));
    this.addObjectListener(WebSocket.Events.Close, () => this._dispatchEvent('close', {}));
  }
}

export class APIRequestContextDispatcher extends Dispatcher<APIRequestContext, channels.APIRequestContextChannel, RootDispatcher | BrowserContextDispatcher> implements channels.APIRequestContextChannel {
  _type_APIRequestContext = true;

  static from(scope: RootDispatcher | BrowserContextDispatcher, request: APIRequestContext): APIRequestContextDispatcher {
    const result = existingDispatcher<APIRequestContextDispatcher>(request);
    return result || new APIRequestContextDispatcher(scope, request);
  }

  static fromNullable(scope: RootDispatcher | BrowserContextDispatcher, request: APIRequestContext | null): APIRequestContextDispatcher | undefined {
    return request ? APIRequestContextDispatcher.from(scope, request) : undefined;
  }

  private constructor(parentScope: RootDispatcher | BrowserContextDispatcher, request: APIRequestContext) {
    // We will reparent these to the context below.
    const tracing = TracingDispatcher.from(parentScope as any as APIRequestContextDispatcher, request.tracing());

    super(parentScope, request, 'APIRequestContext', {
      tracing,
    });

    this.adopt(tracing);
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

  async fetchResponseBody(params: channels.APIRequestContextFetchResponseBodyParams): Promise<channels.APIRequestContextFetchResponseBodyResult> {
    return { binary: this._object.fetchResponses.get(params.fetchUid) };
  }

  async fetchLog(params: channels.APIRequestContextFetchLogParams): Promise<channels.APIRequestContextFetchLogResult> {
    const log = this._object.fetchLog.get(params.fetchUid) || [];
    return { log };
  }

  async disposeAPIResponse(params: channels.APIRequestContextDisposeAPIResponseParams): Promise<void> {
    this._object.disposeResponse(params.fetchUid);
  }
}
