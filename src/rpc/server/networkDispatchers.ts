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

import { Request, Response } from '../../network';
import * as types from '../../types';
import { RequestChannel, ResponseChannel } from '../channels';
import { Dispatcher, DispatcherScope } from '../dispatcher';
import { FrameDispatcher } from './frameDispatcher';

export class RequestDispatcher extends Dispatcher implements RequestChannel {
  private _request: Request;

  static from(scope: DispatcherScope, request: Request): RequestDispatcher {
    if ((request as any)[scope.dispatcherSymbol])
      return (request as any)[scope.dispatcherSymbol];
    return new RequestDispatcher(scope, request);
  }

  static fromNullable(scope: DispatcherScope, request: Request | null): RequestDispatcher | null {
    return request ? RequestDispatcher.from(scope, request) : null;
  }

  constructor(scope: DispatcherScope, request: Request) {
    super(scope, request, 'request');
    this._initialize({
      url: request.url(),
      resourceType: request.resourceType(),
      method: request.method(),
      postData: request.postData(),
      headers: request.headers(),
      isNavigationRequest: request.isNavigationRequest(),
      failure: request.failure(),
      frame: FrameDispatcher.from(this._scope, request.frame()),
      redirectedFrom: RequestDispatcher.fromNullable(this._scope, request.redirectedFrom()),
      redirectedTo: RequestDispatcher.fromNullable(this._scope, request.redirectedTo()),
    });
    this._request = request;
  }

  async continue(params: { overrides: { method?: string, headers?: types.Headers, postData?: string } }): Promise<void> {
  }

  async fulfill(params: { response: types.FulfillResponse & { path?: string } }): Promise<void> {
  }

  async abort(params: { errorCode: string }): Promise<void> {
  }

  async response(): Promise<ResponseChannel | null> {
    return ResponseDispatcher.fromNullable(this._scope, await this._request.response());
  }
}

export class ResponseDispatcher extends Dispatcher implements ResponseChannel {
  private _response: Response;

  static from(scope: DispatcherScope, response: Response): ResponseDispatcher {
    if ((response as any)[scope.dispatcherSymbol])
      return (response as any)[scope.dispatcherSymbol];
    return new ResponseDispatcher(scope, response);
  }

  static fromNullable(scope: DispatcherScope, response: Response | null): ResponseDispatcher | null {
    return response ? ResponseDispatcher.from(scope, response) : null;
  }

  constructor(scope: DispatcherScope, response: Response) {
    super(scope, response, 'response');
    this._initialize({
      frame: FrameDispatcher.from(this._scope, response.frame()),
      request: RequestDispatcher.from(this._scope, response.request())!,
      url: response.url(),
      ok: response.ok(),
      status: response.status(),
      statusText: response.statusText(),
      headers: response.headers(),
    });
    this._response = response;
  }

  async finished(): Promise<Error | null> {
    return await this._response.finished();
  }

  async body(): Promise<Buffer> {
    return await this._response.body();
  }
}
