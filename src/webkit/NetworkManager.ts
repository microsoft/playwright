/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { EventEmitter } from 'events';
import { TargetSession } from './Connection';
import { Frame, FrameManager } from './FrameManager';
import { assert, helper, RegisteredListener } from '../helper';
import { Protocol } from './protocol';

export const NetworkManagerEvents = {
  Request: Symbol('Events.NetworkManager.Request'),
  Response: Symbol('Events.NetworkManager.Response'),
  RequestFailed: Symbol('Events.NetworkManager.RequestFailed'),
  RequestFinished: Symbol('Events.NetworkManager.RequestFinished'),
};

export class NetworkManager extends EventEmitter {
  private _sesssion: TargetSession;
  private _frameManager: FrameManager;
  private _requestIdToRequest = new Map<string, Request>();
  private _extraHTTPHeaders: {[key: string]: string} = {};
  private _attemptedAuthentications = new Set<string>();
  private _userCacheDisabled = false;
  private _sessionListeners: RegisteredListener[] = [];

  constructor(client: TargetSession, frameManager: FrameManager) {
    super();
    this._sesssion = client;
    this._frameManager = frameManager;

    this._sesssion.on('Network.requestWillBeSent', this._onRequestWillBeSent.bind(this));
    this._sesssion.on('Network.responseReceived', this._onResponseReceived.bind(this));
    this._sesssion.on('Network.loadingFinished', this._onLoadingFinished.bind(this));
    this._sesssion.on('Network.loadingFailed', this._onLoadingFailed.bind(this));
  }

  setSession(newSession: TargetSession) {
    helper.removeEventListeners(this._sessionListeners);
    this._sesssion = newSession;
    this._sessionListeners = [
      helper.addEventListener(this._sesssion, 'Network.requestWillBeSent', this._onRequestWillBeSent.bind(this)),
      helper.addEventListener(this._sesssion, 'Network.responseReceived', this._onResponseReceived.bind(this)),
      helper.addEventListener(this._sesssion, 'Network.loadingFinished', this._onLoadingFinished.bind(this)),
      helper.addEventListener(this._sesssion, 'Network.loadingFailed', this._onLoadingFailed.bind(this)),
    ];
  }

  async initialize() {
    await this._sesssion.send('Network.enable');
  }

  async setExtraHTTPHeaders(extraHTTPHeaders: { [s: string]: string; }) {
    this._extraHTTPHeaders = {};
    for (const key of Object.keys(extraHTTPHeaders)) {
      const value = extraHTTPHeaders[key];
      assert(helper.isString(value), `Expected value of header "${key}" to be String, but "${typeof value}" is found.`);
      this._extraHTTPHeaders[key.toLowerCase()] = value;
    }
    await this._sesssion.send('Network.setExtraHTTPHeaders', { headers: this._extraHTTPHeaders });
  }

  extraHTTPHeaders(): { [s: string]: string; } {
    return Object.assign({}, this._extraHTTPHeaders);
  }

  async setCacheEnabled(enabled: boolean) {
    this._userCacheDisabled = !enabled;
    await this._updateProtocolCacheDisabled();
  }

  async _updateProtocolCacheDisabled() {
    await this._sesssion.send('Network.setResourceCachingDisabled', {
      disabled: this._userCacheDisabled
    });
  }

  _onRequestWillBeSent(event: Protocol.Network.requestWillBeSentPayload, interceptionId: string | null) {
    let redirectChain = [];
    if (event.redirectResponse) {
      const request = this._requestIdToRequest.get(event.requestId);
      // If we connect late to the target, we could have missed the requestWillBeSent event.
      if (request) {
        this._handleRequestRedirect(request, event.redirectResponse);
        redirectChain = request._redirectChain;
      }
    }
    const frame = event.frameId && this._frameManager ? this._frameManager.frame(event.frameId) : null;
    const request = new Request(frame, interceptionId, event, redirectChain);
    this._requestIdToRequest.set(event.requestId, request);
    this.emit(NetworkManagerEvents.Request, request);
  }

  _handleRequestRedirect(request: Request, responsePayload: Protocol.Network.Response) {
    const response = new Response(this._sesssion, request, responsePayload);
    request._response = response;
    request._redirectChain.push(request);
    response._bodyLoadedPromiseFulfill.call(null, new Error('Response body is unavailable for redirect responses'));
    this._requestIdToRequest.delete(request._requestId);
    this._attemptedAuthentications.delete(request._interceptionId);
    this.emit(NetworkManagerEvents.Response, response);
    this.emit(NetworkManagerEvents.RequestFinished, request);
  }

  _onResponseReceived(event: Protocol.Network.responseReceivedPayload) {
    const request = this._requestIdToRequest.get(event.requestId);
    // FileUpload sends a response without a matching request.
    if (!request)
      return;
    const response = new Response(this._sesssion, request, event.response);
    request._response = response;
    this.emit(NetworkManagerEvents.Response, response);
  }

  _onLoadingFinished(event: Protocol.Network.loadingFinishedPayload) {
    const request = this._requestIdToRequest.get(event.requestId);
    // For certain requestIds we never receive requestWillBeSent event.
    // @see https://crbug.com/750469
    if (!request)
      return;

    // Under certain conditions we never get the Network.responseReceived
    // event from protocol. @see https://crbug.com/883475
    if (request.response())
      request.response()._bodyLoadedPromiseFulfill.call(null);
    this._requestIdToRequest.delete(request._requestId);
    this._attemptedAuthentications.delete(request._interceptionId);
    this.emit(NetworkManagerEvents.RequestFinished, request);
  }

  _onLoadingFailed(event: Protocol.Network.loadingFailedPayload) {
    const request = this._requestIdToRequest.get(event.requestId);
    // For certain requestIds we never receive requestWillBeSent event.
    // @see https://crbug.com/750469
    if (!request)
      return;
    request._failureText = event.errorText;
    const response = request.response();
    if (response)
      response._bodyLoadedPromiseFulfill.call(null);
    this._requestIdToRequest.delete(request._requestId);
    this._attemptedAuthentications.delete(request._interceptionId);
    this.emit(NetworkManagerEvents.RequestFailed, request);
  }
}

export class Request {
  _response: Response | null = null;
  _redirectChain: Request[];
  _requestId: string;
  _interceptionId: string;
  private _isNavigationRequest: boolean;
  _failureText: string | null = null;
  private _url: string;
  private _resourceType: string;
  private _method: string;
  private _postData: string;
  private _headers: {[key: string]: string} = {};
  private _frame: Frame;

  constructor(frame: Frame | null, interceptionId: string, event: Protocol.Network.requestWillBeSentPayload, redirectChain: Request[]) {
    this._requestId = event.requestId;
    // TODO(einbinder) this will fail if we are an XHR document request
    this._isNavigationRequest = event.type === 'Document';
    this._interceptionId = interceptionId;

    this._url = event.request.url;
    this._resourceType = event.type ? event.type.toLowerCase() : 'Unknown';
    this._method = event.request.method;
    this._postData = event.request.postData;
    this._frame = frame;
    this._redirectChain = redirectChain;
    for (const key of Object.keys(event.request.headers))
      this._headers[key.toLowerCase()] = event.request.headers[key];
  }

  url(): string {
    return this._url;
  }

  resourceType(): string {
    return this._resourceType;
  }

  method(): string {
    return this._method;
  }

  postData(): string | undefined {
    return this._postData;
  }

  headers(): {[key: string]: string} {
    return this._headers;
  }

  response(): Response | null {
    return this._response;
  }

  frame(): Frame | null {
    return this._frame;
  }

  isNavigationRequest(): boolean {
    return this._isNavigationRequest;
  }

  redirectChain(): Request[] {
    return this._redirectChain.slice();
  }

  failure(): { errorText: string; } | null {
    if (!this._failureText)
      return null;
    return {
      errorText: this._failureText
    };
  }
}

export class Response {
  _bodyLoadedPromiseFulfill: any;
  private _client: TargetSession;
  private _request: Request;
  private _contentPromise: Promise<Buffer> | null = null;
  private _bodyLoadedPromise: Promise<Error | null>;
  private _status: number;
  private _statusText: string;
  private _url: string;
  private _headers: {[key: string]: string} = {};

  constructor(client: TargetSession, request: Request, responsePayload: Protocol.Network.Response) {
    this._client = client;
    this._request = request;

    this._bodyLoadedPromise = new Promise(fulfill => {
      this._bodyLoadedPromiseFulfill = fulfill;
    });

    this._status = responsePayload.status;
    this._statusText = responsePayload.statusText;
    this._url = request.url();
    for (const key of Object.keys(responsePayload.headers))
      this._headers[key.toLowerCase()] = responsePayload.headers[key];
  }

  url(): string {
    return this._url;
  }

  ok(): boolean {
    return this._status === 0 || (this._status >= 200 && this._status <= 299);
  }

  status(): number {
    return this._status;
  }

  statusText(): string {
    return this._statusText;
  }

  headers(): object {
    return this._headers;
  }

  buffer(): Promise<Buffer> {
    if (!this._contentPromise) {
      this._contentPromise = this._bodyLoadedPromise.then(async error => {
        if (error)
          throw error;
        const response = await this._client.send('Network.getResponseBody', {
          requestId: this._request._requestId
        });
        return Buffer.from(response.body, response.base64Encoded ? 'base64' : 'utf8');
      });
    }
    return this._contentPromise;
  }

  async text(): Promise<string> {
    const content = await this.buffer();
    return content.toString('utf8');
  }

  async json(): Promise<object> {
    const content = await this.text();
    return JSON.parse(content);
  }

  request(): Request {
    return this._request;
  }

  frame(): Frame | null {
    return this._request.frame();
  }
}
