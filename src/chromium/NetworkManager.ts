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
import { CDPSession } from './Connection';
import { Frame } from './FrameManager';
import { FrameManager } from './FrameManager';
import { assert, debugError, helper } from '../helper';
import { Protocol } from './protocol';

export const NetworkManagerEvents = {
  Request: Symbol('Events.NetworkManager.Request'),
  Response: Symbol('Events.NetworkManager.Response'),
  RequestFailed: Symbol('Events.NetworkManager.RequestFailed'),
  RequestFinished: Symbol('Events.NetworkManager.RequestFinished'),
};

export class NetworkManager extends EventEmitter {
  private _client: CDPSession;
  private _ignoreHTTPSErrors: boolean;
  private _frameManager: FrameManager;
  private _requestIdToRequest = new Map<string, Request>();
  private _requestIdToRequestWillBeSentEvent = new Map<string, Protocol.Network.requestWillBeSentPayload>();
  private _extraHTTPHeaders: {[key: string]: string} = {};
  private _offline = false;
  private _credentials: {username: string, password: string} | null = null;
  private _attemptedAuthentications = new Set<string>();
  private _userRequestInterceptionEnabled = false;
  private _protocolRequestInterceptionEnabled = false;
  private _userCacheDisabled = false;
  private _requestIdToInterceptionId = new Map<string, string>();

  constructor(client: CDPSession, ignoreHTTPSErrors: boolean, frameManager: FrameManager) {
    super();
    this._client = client;
    this._ignoreHTTPSErrors = ignoreHTTPSErrors;
    this._frameManager = frameManager;

    this._client.on('Fetch.requestPaused', this._onRequestPaused.bind(this));
    this._client.on('Fetch.authRequired', this._onAuthRequired.bind(this));
    this._client.on('Network.requestWillBeSent', this._onRequestWillBeSent.bind(this));
    this._client.on('Network.responseReceived', this._onResponseReceived.bind(this));
    this._client.on('Network.loadingFinished', this._onLoadingFinished.bind(this));
    this._client.on('Network.loadingFailed', this._onLoadingFailed.bind(this));
  }

  async initialize() {
    await this._client.send('Network.enable');
    if (this._ignoreHTTPSErrors)
      await this._client.send('Security.setIgnoreCertificateErrors', {ignore: true});
  }

  async authenticate(credentials: { username: string; password: string; } | null) {
    this._credentials = credentials;
    await this._updateProtocolRequestInterception();
  }

  async setExtraHTTPHeaders(extraHTTPHeaders: { [s: string]: string; }) {
    this._extraHTTPHeaders = {};
    for (const key of Object.keys(extraHTTPHeaders)) {
      const value = extraHTTPHeaders[key];
      assert(helper.isString(value), `Expected value of header "${key}" to be String, but "${typeof value}" is found.`);
      this._extraHTTPHeaders[key.toLowerCase()] = value;
    }
    await this._client.send('Network.setExtraHTTPHeaders', { headers: this._extraHTTPHeaders });
  }

  extraHTTPHeaders(): { [s: string]: string; } {
    return Object.assign({}, this._extraHTTPHeaders);
  }

  async setOfflineMode(value: boolean) {
    if (this._offline === value)
      return;
    this._offline = value;
    await this._client.send('Network.emulateNetworkConditions', {
      offline: this._offline,
      // values of 0 remove any active throttling. crbug.com/456324#c9
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1
    });
  }

  async setUserAgent(userAgent: string) {
    await this._client.send('Network.setUserAgentOverride', { userAgent });
  }

  async setCacheEnabled(enabled: boolean) {
    this._userCacheDisabled = !enabled;
    await this._updateProtocolCacheDisabled();
  }

  async setRequestInterception(value: boolean) {
    this._userRequestInterceptionEnabled = value;
    await this._updateProtocolRequestInterception();
  }

  async _updateProtocolRequestInterception() {
    const enabled = this._userRequestInterceptionEnabled || !!this._credentials;
    if (enabled === this._protocolRequestInterceptionEnabled)
      return;
    this._protocolRequestInterceptionEnabled = enabled;
    if (enabled) {
      await Promise.all([
        this._updateProtocolCacheDisabled(),
        this._client.send('Fetch.enable', {
          handleAuthRequests: true,
          patterns: [{urlPattern: '*'}],
        }),
      ]);
    } else {
      await Promise.all([
        this._updateProtocolCacheDisabled(),
        this._client.send('Fetch.disable')
      ]);
    }
  }

  async _updateProtocolCacheDisabled() {
    await this._client.send('Network.setCacheDisabled', {
      cacheDisabled: this._userCacheDisabled || this._protocolRequestInterceptionEnabled
    });
  }

  _onRequestWillBeSent(event: Protocol.Network.requestWillBeSentPayload) {
    // Request interception doesn't happen for data URLs with Network Service.
    if (this._protocolRequestInterceptionEnabled && !event.request.url.startsWith('data:')) {
      const requestId = event.requestId;
      const interceptionId = this._requestIdToInterceptionId.get(requestId);
      if (interceptionId) {
        this._onRequest(event, interceptionId);
        this._requestIdToInterceptionId.delete(requestId);
      } else {
        this._requestIdToRequestWillBeSentEvent.set(event.requestId, event);
      }
      return;
    }
    this._onRequest(event, null);
  }

  _onAuthRequired(event: Protocol.Fetch.authRequiredPayload) {
    let response: 'Default' | 'CancelAuth' | 'ProvideCredentials' = 'Default';
    if (this._attemptedAuthentications.has(event.requestId)) {
      response = 'CancelAuth';
    } else if (this._credentials) {
      response = 'ProvideCredentials';
      this._attemptedAuthentications.add(event.requestId);
    }
    const {username, password} = this._credentials || {username: undefined, password: undefined};
    this._client.send('Fetch.continueWithAuth', {
      requestId: event.requestId,
      authChallengeResponse: { response, username, password },
    }).catch(debugError);
  }

  _onRequestPaused(event: Protocol.Fetch.requestPausedPayload) {
    if (!this._userRequestInterceptionEnabled && this._protocolRequestInterceptionEnabled) {
      this._client.send('Fetch.continueRequest', {
        requestId: event.requestId
      }).catch(debugError);
    }

    const requestId = event.networkId;
    const interceptionId = event.requestId;
    if (requestId && this._requestIdToRequestWillBeSentEvent.has(requestId)) {
      const requestWillBeSentEvent = this._requestIdToRequestWillBeSentEvent.get(requestId);
      this._onRequest(requestWillBeSentEvent, interceptionId);
      this._requestIdToRequestWillBeSentEvent.delete(requestId);
    } else {
      this._requestIdToInterceptionId.set(requestId, interceptionId);
    }
  }

  _onRequest(event: Protocol.Network.requestWillBeSentPayload, interceptionId: string | null) {
    let redirectChain = [];
    if (event.redirectResponse) {
      const request = this._requestIdToRequest.get(event.requestId);
      // If we connect late to the target, we could have missed the requestWillBeSent event.
      if (request) {
        this._handleRequestRedirect(request, event.redirectResponse);
        redirectChain = request._redirectChain;
      }
    }
    const frame = event.frameId ? this._frameManager.frame(event.frameId) : null;
    const request = new Request(this._client, frame, interceptionId, this._userRequestInterceptionEnabled, event, redirectChain);
    this._requestIdToRequest.set(event.requestId, request);
    this.emit(NetworkManagerEvents.Request, request);
  }


  _handleRequestRedirect(request: Request, responsePayload: Protocol.Network.Response) {
    const response = new Response(this._client, request, responsePayload);
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
    const response = new Response(this._client, request, event.response);
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
  private _client: CDPSession;
  private _isNavigationRequest: boolean;
  private _allowInterception: boolean;
  private _interceptionHandled = false;
  _failureText: string | null = null;
  private _url: string;
  private _resourceType: string;
  private _method: string;
  private _postData: string;
  private _headers: {[key: string]: string} = {};
  private _frame: Frame;

  constructor(client: CDPSession, frame: Frame | null, interceptionId: string, allowInterception: boolean, event: Protocol.Network.requestWillBeSentPayload, redirectChain: Request[]) {
    this._client = client;
    this._requestId = event.requestId;
    this._isNavigationRequest = event.requestId === event.loaderId && event.type === 'Document';
    this._interceptionId = interceptionId;
    this._allowInterception = allowInterception;

    this._url = event.request.url;
    this._resourceType = event.type.toLowerCase();
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

  async _continue(overrides: { url?: string; method?: string; postData?: string; headers?: {[key: string]: string}; } = {}) {
    // Request interception is not supported for data: urls.
    if (this._url.startsWith('data:'))
      return;
    assert(this._allowInterception, 'Request Interception is not enabled!');
    assert(!this._interceptionHandled, 'Request is already handled!');
    const {
      url,
      method,
      postData,
      headers
    } = overrides;
    this._interceptionHandled = true;
    await this._client.send('Fetch.continueRequest', {
      requestId: this._interceptionId,
      url,
      method,
      postData,
      headers: headers ? headersArray(headers) : undefined,
    }).catch(error => {
      // In certain cases, protocol will return error if the request was already canceled
      // or the page was closed. We should tolerate these errors.
      debugError(error);
    });
  }

  async _fulfill(response: { status: number; headers: {[key: string]: string}; contentType: string; body: (string | Buffer); }) {
    // Mocking responses for dataURL requests is not currently supported.
    if (this._url.startsWith('data:'))
      return;
    assert(this._allowInterception, 'Request Interception is not enabled!');
    assert(!this._interceptionHandled, 'Request is already handled!');
    this._interceptionHandled = true;

    const responseBody = response.body && helper.isString(response.body) ? Buffer.from(/** @type {string} */(response.body)) : /** @type {?Buffer} */(response.body || null);

    const responseHeaders: { [s: string]: string; } = {};
    if (response.headers) {
      for (const header of Object.keys(response.headers))
        responseHeaders[header.toLowerCase()] = response.headers[header];
    }
    if (response.contentType)
      responseHeaders['content-type'] = response.contentType;
    if (responseBody && !('content-length' in responseHeaders))
      responseHeaders['content-length'] = String(Buffer.byteLength(responseBody));

    await this._client.send('Fetch.fulfillRequest', {
      requestId: this._interceptionId,
      responseCode: response.status || 200,
      responsePhrase: STATUS_TEXTS[response.status || 200],
      responseHeaders: headersArray(responseHeaders),
      body: responseBody ? responseBody.toString('base64') : undefined,
    }).catch(error => {
      // In certain cases, protocol will return error if the request was already canceled
      // or the page was closed. We should tolerate these errors.
      debugError(error);
    });
  }

  async _abort(errorCode: string = 'failed') {
    // Request interception is not supported for data: urls.
    if (this._url.startsWith('data:'))
      return;
    const errorReason = errorReasons[errorCode];
    assert(errorReason, 'Unknown error code: ' + errorCode);
    assert(this._allowInterception, 'Request Interception is not enabled!');
    assert(!this._interceptionHandled, 'Request is already handled!');
    this._interceptionHandled = true;
    await this._client.send('Fetch.failRequest', {
      requestId: this._interceptionId,
      errorReason
    }).catch(error => {
      // In certain cases, protocol will return error if the request was already canceled
      // or the page was closed. We should tolerate these errors.
      debugError(error);
    });
  }
}

const errorReasons = {
  'aborted': 'Aborted',
  'accessdenied': 'AccessDenied',
  'addressunreachable': 'AddressUnreachable',
  'blockedbyclient': 'BlockedByClient',
  'blockedbyresponse': 'BlockedByResponse',
  'connectionaborted': 'ConnectionAborted',
  'connectionclosed': 'ConnectionClosed',
  'connectionfailed': 'ConnectionFailed',
  'connectionrefused': 'ConnectionRefused',
  'connectionreset': 'ConnectionReset',
  'internetdisconnected': 'InternetDisconnected',
  'namenotresolved': 'NameNotResolved',
  'timedout': 'TimedOut',
  'failed': 'Failed',
};

export class Response {
  _bodyLoadedPromiseFulfill: any;
  private _client: CDPSession;
  private _request: Request;
  private _contentPromise: Promise<Buffer> | null = null;
  private _bodyLoadedPromise: Promise<Error | null>;
  private _remoteAddress: { ip: string; port: number; };
  private _status: number;
  private _statusText: string;
  private _url: string;
  private _headers: {[key: string]: string} = {};

  constructor(client: CDPSession, request: Request, responsePayload: Protocol.Network.Response) {
    this._client = client;
    this._request = request;

    this._bodyLoadedPromise = new Promise(fulfill => {
      this._bodyLoadedPromiseFulfill = fulfill;
    });

    this._remoteAddress = {
      ip: responsePayload.remoteIPAddress,
      port: responsePayload.remotePort,
    };
    this._status = responsePayload.status;
    this._statusText = responsePayload.statusText;
    this._url = request.url();
    for (const key of Object.keys(responsePayload.headers))
      this._headers[key.toLowerCase()] = responsePayload.headers[key];
  }

  remoteAddress(): { ip: string; port: number; } {
    return this._remoteAddress;
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

function headersArray(headers: { [s: string]: string; }): { name: string; value: string; }[] {
  const result = [];
  for (const name in headers) {
    if (!Object.is(headers[name], undefined))
      result.push({name, value: headers[name] + ''});
  }
  return result;
}

// List taken from https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml with extra 306 and 418 codes.
const STATUS_TEXTS = {
  '100': 'Continue',
  '101': 'Switching Protocols',
  '102': 'Processing',
  '103': 'Early Hints',
  '200': 'OK',
  '201': 'Created',
  '202': 'Accepted',
  '203': 'Non-Authoritative Information',
  '204': 'No Content',
  '205': 'Reset Content',
  '206': 'Partial Content',
  '207': 'Multi-Status',
  '208': 'Already Reported',
  '226': 'IM Used',
  '300': 'Multiple Choices',
  '301': 'Moved Permanently',
  '302': 'Found',
  '303': 'See Other',
  '304': 'Not Modified',
  '305': 'Use Proxy',
  '306': 'Switch Proxy',
  '307': 'Temporary Redirect',
  '308': 'Permanent Redirect',
  '400': 'Bad Request',
  '401': 'Unauthorized',
  '402': 'Payment Required',
  '403': 'Forbidden',
  '404': 'Not Found',
  '405': 'Method Not Allowed',
  '406': 'Not Acceptable',
  '407': 'Proxy Authentication Required',
  '408': 'Request Timeout',
  '409': 'Conflict',
  '410': 'Gone',
  '411': 'Length Required',
  '412': 'Precondition Failed',
  '413': 'Payload Too Large',
  '414': 'URI Too Long',
  '415': 'Unsupported Media Type',
  '416': 'Range Not Satisfiable',
  '417': 'Expectation Failed',
  '418': 'I\'m a teapot',
  '421': 'Misdirected Request',
  '422': 'Unprocessable Entity',
  '423': 'Locked',
  '424': 'Failed Dependency',
  '425': 'Too Early',
  '426': 'Upgrade Required',
  '428': 'Precondition Required',
  '429': 'Too Many Requests',
  '431': 'Request Header Fields Too Large',
  '451': 'Unavailable For Legal Reasons',
  '500': 'Internal Server Error',
  '501': 'Not Implemented',
  '502': 'Bad Gateway',
  '503': 'Service Unavailable',
  '504': 'Gateway Timeout',
  '505': 'HTTP Version Not Supported',
  '506': 'Variant Also Negotiates',
  '507': 'Insufficient Storage',
  '508': 'Loop Detected',
  '510': 'Not Extended',
  '511': 'Network Authentication Required',
};
