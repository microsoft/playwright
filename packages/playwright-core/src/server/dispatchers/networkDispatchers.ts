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

import { WebSocket } from '../network';
import { Dispatcher } from './dispatcher';
import { FrameDispatcher } from './frameDispatcher';
import { WorkerDispatcher } from './pageDispatcher';
import { TracingDispatcher } from './tracingDispatcher';

import type { APIRequestContext } from '../fetch';
import type { Request, Response, Route } from '../network';
import type { BrowserContextDispatcher } from './browserContextDispatcher';
import type { RootDispatcher } from './dispatcher';
import type { PageDispatcher } from './pageDispatcher';
import type * as channels from '@protocol/channels';
import type { Progress } from '@protocol/progress';


export class RequestDispatcher extends Dispatcher<Request, channels.RequestChannel, BrowserContextDispatcher | PageDispatcher | FrameDispatcher> implements channels.RequestChannel {
  _type_Request: boolean;
  private _browserContextDispatcher: BrowserContextDispatcher;

  static from(scope: BrowserContextDispatcher, request: Request): RequestDispatcher {
    const result = scope.connection.existingDispatcher<RequestDispatcher>(request);
    return result || new RequestDispatcher(scope, request);
  }

  static fromNullable(scope: BrowserContextDispatcher, request: Request | null): RequestDispatcher | undefined {
    return request ? RequestDispatcher.from(scope, request) : undefined;
  }

  private constructor(scope: BrowserContextDispatcher, request: Request) {
    const postData = request.postDataBuffer();
    // Always try to attach request to the page, if not, frame.
    const frame = request.frame();
    const page = request.frame()?._page;
    const pageDispatcher = page ? scope.connection.existingDispatcher<PageDispatcher>(page) : null;
    const frameDispatcher = frame ? FrameDispatcher.from(scope, frame) : null;
    super(pageDispatcher || frameDispatcher || scope, request, 'Request', {
      frame: FrameDispatcher.fromNullable(scope, request.frame()),
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
    this._browserContextDispatcher = scope;
  }

  async rawRequestHeaders(params: channels.RequestRawRequestHeadersParams, progress: Progress): Promise<channels.RequestRawRequestHeadersResult> {
    return { headers: await progress.race(this._object.rawRequestHeaders()) };
  }

  async response(params: channels.RequestResponseParams, progress: Progress): Promise<channels.RequestResponseResult> {
    return { response: ResponseDispatcher.fromNullable(this._browserContextDispatcher, await progress.race(this._object.response())) };
  }
}

export class ResponseDispatcher extends Dispatcher<Response, channels.ResponseChannel, RequestDispatcher> implements channels.ResponseChannel {
  _type_Response = true;

  static from(scope: BrowserContextDispatcher, response: Response): ResponseDispatcher {
    const result = scope.connection.existingDispatcher<ResponseDispatcher>(response);
    const requestDispatcher = RequestDispatcher.from(scope, response.request());
    return result || new ResponseDispatcher(requestDispatcher, response);
  }

  static fromNullable(scope: BrowserContextDispatcher, response: Response | null): ResponseDispatcher | undefined {
    return response ? ResponseDispatcher.from(scope, response) : undefined;
  }

  private constructor(scope: RequestDispatcher, response: Response) {
    super(scope, response, 'Response', {
      // TODO: responses in popups can point to non-reported requests.
      request: scope,
      url: response.url(),
      status: response.status(),
      statusText: response.statusText(),
      headers: response.headers(),
      timing: response.timing(),
      fromServiceWorker: response.fromServiceWorker(),
    });
  }

  async body(params: channels.ResponseBodyParams, progress: Progress): Promise<channels.ResponseBodyResult> {
    return { binary: await progress.race(this._object.body()) };
  }

  async securityDetails(params: channels.ResponseSecurityDetailsParams, progress: Progress): Promise<channels.ResponseSecurityDetailsResult> {
    return { value: await progress.race(this._object.securityDetails()) || undefined };
  }

  async serverAddr(params: channels.ResponseServerAddrParams, progress: Progress): Promise<channels.ResponseServerAddrResult> {
    return { value: await progress.race(this._object.serverAddr()) || undefined };
  }

  async rawResponseHeaders(params: channels.ResponseRawResponseHeadersParams, progress: Progress): Promise<channels.ResponseRawResponseHeadersResult> {
    return { headers: await progress.race(this._object.rawResponseHeaders()) };
  }

  async sizes(params: channels.ResponseSizesParams, progress: Progress): Promise<channels.ResponseSizesResult> {
    return { sizes: await progress.race(this._object.sizes()) };
  }
}

export class RouteDispatcher extends Dispatcher<Route, channels.RouteChannel, RequestDispatcher> implements channels.RouteChannel {
  _type_Route = true;

  private _handled = false;

  constructor(scope: RequestDispatcher, route: Route) {
    super(scope, route, 'Route', {
      // Context route can point to a non-reported request, so we send the request in the initializer.
      request: scope
    });
  }

  private _checkNotHandled() {
    if (this._handled)
      throw new Error('Route is already handled!');
    this._handled = true;
  }

  async continue(params: channels.RouteContinueParams, progress: Progress): Promise<channels.RouteContinueResult> {
    // Note: progress is ignored because this operation is not cancellable and should not block in the browser anyway.
    this._checkNotHandled();
    await this._object.continue({
      url: params.url,
      method: params.method,
      headers: params.headers,
      postData: params.postData,
      isFallback: params.isFallback,
    });
  }

  async fulfill(params: channels.RouteFulfillParams, progress: Progress): Promise<void> {
    // Note: progress is ignored because this operation is not cancellable and should not block in the browser anyway.
    this._checkNotHandled();
    await this._object.fulfill(params);
  }

  async abort(params: channels.RouteAbortParams, progress: Progress): Promise<void> {
    // Note: progress is ignored because this operation is not cancellable and should not block in the browser anyway.
    this._checkNotHandled();
    await this._object.abort(params.errorCode || 'failed');
  }

  async redirectNavigationRequest(params: channels.RouteRedirectNavigationRequestParams, progress: Progress): Promise<void> {
    this._checkNotHandled();
    this._object.redirectNavigationRequest(params.url);
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
    const result = scope.connection.existingDispatcher<APIRequestContextDispatcher>(request);
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

  async storageState(params: channels.APIRequestContextStorageStateParams, progress: Progress): Promise<channels.APIRequestContextStorageStateResult> {
    return await this._object.storageState(progress, params.indexedDB);
  }

  async dispose(params: channels.APIRequestContextDisposeParams, progress: Progress): Promise<void> {
    progress.metadata.potentiallyClosesScope = true;
    await this._object.dispose(params);
    this._dispose();
  }

  async fetch(params: channels.APIRequestContextFetchParams, progress: Progress): Promise<channels.APIRequestContextFetchResult> {
    const fetchResponse = await this._object.fetch(progress, params);
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

  async fetchResponseBody(params: channels.APIRequestContextFetchResponseBodyParams, progress: Progress): Promise<channels.APIRequestContextFetchResponseBodyResult> {
    return { binary: this._object.fetchResponses.get(params.fetchUid) };
  }

  async fetchLog(params: channels.APIRequestContextFetchLogParams, progress: Progress): Promise<channels.APIRequestContextFetchLogResult> {
    const log = this._object.fetchLog.get(params.fetchUid) || [];
    return { log };
  }

  async disposeAPIResponse(params: channels.APIRequestContextDisposeAPIResponseParams, progress: Progress): Promise<void> {
    this._object.disposeResponse(params.fetchUid);
  }
}
