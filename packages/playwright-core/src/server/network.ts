/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
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

import type * as frames from './frames';
import type * as types from './types';
import type * as channels from '../protocol/channels';
import { assert } from '../utils';
import { ManualPromise } from '../utils/manualPromise';
import { SdkObject } from './instrumentation';
import type { NameValue } from '../common/types';
import { APIRequestContext } from './fetch';

export function filterCookies(cookies: types.NetworkCookie[], urls: string[]): types.NetworkCookie[] {
  const parsedURLs = urls.map(s => new URL(s));
  // Chromiums's cookies are missing sameSite when it is 'None'
  return cookies.filter(c => {
    if (!parsedURLs.length)
      return true;
    for (const parsedURL of parsedURLs) {
      let domain = c.domain;
      if (!domain.startsWith('.'))
        domain = '.' + domain;
      if (!('.' + parsedURL.hostname).endsWith(domain))
        continue;
      if (!parsedURL.pathname.startsWith(c.path))
        continue;
      if (parsedURL.protocol !== 'https:' && parsedURL.hostname !== 'localhost' && c.secure)
        continue;
      return true;
    }
    return false;
  });
}

// Rollover to 5-digit year:
// 253402300799 == Fri, 31 Dec 9999 23:59:59 +0000 (UTC)
// 253402300800 == Sat,  1 Jan 1000 00:00:00 +0000 (UTC)
const kMaxCookieExpiresDateInSeconds = 253402300799;

export function rewriteCookies(cookies: types.SetNetworkCookieParam[]): types.SetNetworkCookieParam[] {
  return cookies.map(c => {
    assert(c.url || (c.domain && c.path), 'Cookie should have a url or a domain/path pair');
    assert(!(c.url && c.domain), 'Cookie should have either url or domain');
    assert(!(c.url && c.path), 'Cookie should have either url or path');
    assert(!(c.expires && c.expires < 0 && c.expires !== -1), 'Cookie should have a valid expires, only -1 or a positive number for the unix timestamp in seconds is allowed');
    assert(!(c.expires && c.expires > 0 && c.expires > kMaxCookieExpiresDateInSeconds), 'Cookie should have a valid expires, only -1 or a positive number for the unix timestamp in seconds is allowed');
    const copy = { ...c };
    if (copy.url) {
      assert(copy.url !== 'about:blank', `Blank page can not have cookie "${c.name}"`);
      assert(!copy.url.startsWith('data:'), `Data URL page can not have cookie "${c.name}"`);
      const url = new URL(copy.url);
      copy.domain = url.hostname;
      copy.path = url.pathname.substring(0, url.pathname.lastIndexOf('/') + 1);
      copy.secure = url.protocol === 'https:';
    }
    return copy;
  });
}

export function parsedURL(url: string): URL | null {
  try {
    return new URL(url);
  } catch (e) {
    return null;
  }
}

export function stripFragmentFromUrl(url: string): string {
  if (!url.includes('#'))
    return url;
  return url.substring(0, url.indexOf('#'));
}

type ResponseSize = {
  encodedBodySize: number;
  transferSize: number;
  responseHeadersSize: number;
};

export class Request extends SdkObject {
  private _response: Response | null = null;
  private _redirectedFrom: Request | null;
  _redirectedTo: Request | null = null;
  readonly _documentId?: string;
  readonly _isFavicon: boolean;
  _failureText: string | null = null;
  private _url: string;
  private _resourceType: string;
  private _method: string;
  private _postData: Buffer | null;
  readonly _headers: types.HeadersArray;
  private _headersMap = new Map<string, string>();
  private _rawRequestHeadersPromise: ManualPromise<types.HeadersArray> | undefined;
  private _frame: frames.Frame;
  private _waitForResponsePromise = new ManualPromise<Response | null>();
  _responseEndTiming = -1;
  readonly responseSize: ResponseSize = { encodedBodySize: 0, transferSize: 0, responseHeadersSize: 0 };

  constructor(frame: frames.Frame, redirectedFrom: Request | null, documentId: string | undefined,
    url: string, resourceType: string, method: string, postData: Buffer | null, headers: types.HeadersArray) {
    super(frame, 'request');
    assert(!url.startsWith('data:'), 'Data urls should not fire requests');
    this._frame = frame;
    this._redirectedFrom = redirectedFrom;
    if (redirectedFrom)
      redirectedFrom._redirectedTo = this;
    this._documentId = documentId;
    this._url = stripFragmentFromUrl(url);
    this._resourceType = resourceType;
    this._method = method;
    this._postData = postData;
    this._headers = headers;
    for (const { name, value } of this._headers)
      this._headersMap.set(name.toLowerCase(), value);
    this._isFavicon = url.endsWith('/favicon.ico') || !!redirectedFrom?._isFavicon;
  }

  _setFailureText(failureText: string) {
    this._failureText = failureText;
    this._waitForResponsePromise.resolve(null);
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

  postDataBuffer(): Buffer | null {
    return this._postData;
  }

  headers(): types.HeadersArray {
    return this._headers;
  }

  headerValue(name: string): string | undefined {
    return this._headersMap.get(name);
  }

  setWillReceiveExtraHeaders() {
    if (!this._rawRequestHeadersPromise)
      this._rawRequestHeadersPromise = new ManualPromise();
  }

  setRawRequestHeaders(headers: types.HeadersArray) {
    if (!this._rawRequestHeadersPromise)
      this._rawRequestHeadersPromise = new ManualPromise();
    this._rawRequestHeadersPromise!.resolve(headers);
  }

  async rawRequestHeaders(): Promise<NameValue[]> {
    return this._rawRequestHeadersPromise || Promise.resolve(this._headers);
  }

  rawRequestHeadersPromise(): Promise<types.HeadersArray> | undefined {
    return this._rawRequestHeadersPromise;
  }

  response(): PromiseLike<Response | null> {
    return this._waitForResponsePromise;
  }

  _existingResponse(): Response | null {
    return this._response;
  }

  _setResponse(response: Response) {
    this._response = response;
    this._waitForResponsePromise.resolve(response);
  }

  _finalRequest(): Request {
    return this._redirectedTo ? this._redirectedTo._finalRequest() : this;
  }

  frame(): frames.Frame {
    return this._frame;
  }

  isNavigationRequest(): boolean {
    return !!this._documentId;
  }

  redirectedFrom(): Request | null {
    return this._redirectedFrom;
  }

  failure(): { errorText: string } | null {
    if (this._failureText === null)
      return null;
    return {
      errorText: this._failureText
    };
  }

  bodySize(): number {
    return this.postDataBuffer()?.length || 0;
  }

  async requestHeadersSize(): Promise<number> {
    let headersSize = 4; // 4 = 2 spaces + 2 line breaks (GET /path \r\n)
    headersSize += this.method().length;
    headersSize += (new URL(this.url())).pathname.length;
    headersSize += 8; // httpVersion
    const headers = this.rawRequestHeadersPromise() ? await this.rawRequestHeadersPromise()! : this._headers;
    for (const header of headers)
      headersSize += header.name.length + header.value.length + 4; // 4 = ': ' + '\r\n'
    return headersSize;
  }
}

export class Route extends SdkObject {
  private readonly _request: Request;
  private readonly _delegate: RouteDelegate;
  private _handled = false;

  constructor(request: Request, delegate: RouteDelegate) {
    super(request.frame(), 'route');
    this._request = request;
    this._delegate = delegate;
  }

  request(): Request {
    return this._request;
  }

  async abort(errorCode: string = 'failed') {
    this._startHandling();
    await this._delegate.abort(errorCode);
  }

  async fulfill(overrides: channels.RouteFulfillParams) {
    this._startHandling();
    let body = overrides.body;
    let isBase64 = overrides.isBase64 || false;
    if (body === undefined) {
      if (overrides.fetchResponseUid) {
        const context = this._request.frame()._page._browserContext;
        const buffer = context.fetchRequest.fetchResponses.get(overrides.fetchResponseUid) || APIRequestContext.findResponseBody(overrides.fetchResponseUid);
        assert(buffer, 'Fetch response has been disposed');
        body = buffer.toString('base64');
        isBase64 = true;
      } else {
        body = '';
        isBase64 = false;
      }
    }
    const headers = [...(overrides.headers || [])];
    this._maybeAddCorsHeaders(headers);
    await this._delegate.fulfill({
      status: overrides.status || 200,
      headers,
      body,
      isBase64,
    });
  }

  // See https://github.com/microsoft/playwright/issues/12929
  private _maybeAddCorsHeaders(headers: NameValue[]) {
    const origin = this._request.headerValue('origin');
    if (!origin)
      return;
    const requestUrl = new URL(this._request.url());
    if (!requestUrl.protocol.startsWith('http'))
      return;
    if (requestUrl.origin === origin.trim())
      return;
    const corsHeader = headers.find(({ name }) => name === 'access-control-allow-origin');
    if (corsHeader)
      return;
    headers.push({ name: 'access-control-allow-origin', value: origin });
    headers.push({ name: 'access-control-allow-credentials', value: 'true' });
    headers.push({ name: 'vary', value: 'Origin' });
  }

  async continue(overrides: types.NormalizedContinueOverrides = {}) {
    this._startHandling();
    if (overrides.url) {
      const newUrl = new URL(overrides.url);
      const oldUrl = new URL(this._request.url());
      if (oldUrl.protocol !== newUrl.protocol)
        throw new Error('New URL must have same protocol as overridden URL');
    }
    await this._delegate.continue(this._request, overrides);
  }

  private _startHandling() {
    assert(!this._handled, 'Route is already handled!');
    this._handled = true;
  }
}

export type RouteHandler = (route: Route, request: Request) => void;

type GetResponseBodyCallback = () => Promise<Buffer>;

export type ResourceTiming = {
  startTime: number;
  domainLookupStart: number;
  domainLookupEnd: number;
  connectStart: number;
  secureConnectionStart: number;
  connectEnd: number;
  requestStart: number;
  responseStart: number;
};

export type ResourceSizes = {
  requestBodySize: number,
  requestHeadersSize: number,
  responseBodySize: number,
  responseHeadersSize: number,
};

export type RemoteAddr = {
  ipAddress: string;
  port: number;
};

export type SecurityDetails = {
    protocol?: string;
    subjectName?: string;
    issuer?: string;
    validFrom?: number;
    validTo?: number;
};

export class Response extends SdkObject {
  private _request: Request;
  private _contentPromise: Promise<Buffer> | null = null;
  _finishedPromise = new ManualPromise<void>();
  private _status: number;
  private _statusText: string;
  private _url: string;
  private _headers: types.HeadersArray;
  private _headersMap = new Map<string, string>();
  private _getResponseBodyCallback: GetResponseBodyCallback;
  private _timing: ResourceTiming;
  private _serverAddrPromise = new ManualPromise<RemoteAddr | undefined>();
  private _securityDetailsPromise = new ManualPromise<SecurityDetails | undefined>();
  private _rawResponseHeadersPromise: ManualPromise<types.HeadersArray> | undefined;
  private _httpVersion: string | undefined;

  constructor(request: Request, status: number, statusText: string, headers: types.HeadersArray, timing: ResourceTiming, getResponseBodyCallback: GetResponseBodyCallback, httpVersion?: string) {
    super(request.frame(), 'response');
    this._request = request;
    this._timing = timing;
    this._status = status;
    this._statusText = statusText;
    this._url = request.url();
    this._headers = headers;
    for (const { name, value } of this._headers)
      this._headersMap.set(name.toLowerCase(), value);
    this._getResponseBodyCallback = getResponseBodyCallback;
    this._request._setResponse(this);
    this._httpVersion = httpVersion;
  }

  _serverAddrFinished(addr?: RemoteAddr) {
    this._serverAddrPromise.resolve(addr);
  }

  _securityDetailsFinished(securityDetails?: SecurityDetails) {
    this._securityDetailsPromise.resolve(securityDetails);
  }

  _requestFinished(responseEndTiming: number) {
    this._request._responseEndTiming = Math.max(responseEndTiming, this._timing.responseStart);
    this._finishedPromise.resolve();
  }

  _setHttpVersion(httpVersion: string) {
    this._httpVersion = httpVersion;
  }

  url(): string {
    return this._url;
  }

  status(): number {
    return this._status;
  }

  statusText(): string {
    return this._statusText;
  }

  headers(): types.HeadersArray {
    return this._headers;
  }

  headerValue(name: string): string | undefined {
    return this._headersMap.get(name);
  }

  async rawResponseHeaders(): Promise<NameValue[]> {
    return this._rawResponseHeadersPromise || Promise.resolve(this._headers);
  }

  setWillReceiveExtraHeaders() {
    this._request.setWillReceiveExtraHeaders();
    this._rawResponseHeadersPromise = new ManualPromise();
  }

  setRawResponseHeaders(headers: types.HeadersArray) {
    if (!this._rawResponseHeadersPromise)
      this._rawResponseHeadersPromise = new ManualPromise();
    this._rawResponseHeadersPromise!.resolve(headers);
  }

  timing(): ResourceTiming {
    return this._timing;
  }

  async serverAddr(): Promise<RemoteAddr|null> {
    return await this._serverAddrPromise || null;
  }

  async securityDetails(): Promise<SecurityDetails|null> {
    return await this._securityDetailsPromise || null;
  }

  body(): Promise<Buffer> {
    if (!this._contentPromise) {
      this._contentPromise = this._finishedPromise.then(async () => {
        if (this._status >= 300 && this._status <= 399)
          throw new Error('Response body is unavailable for redirect responses');
        return this._getResponseBodyCallback();
      });
    }
    return this._contentPromise;
  }

  request(): Request {
    return this._request;
  }

  frame(): frames.Frame {
    return this._request.frame();
  }

  httpVersion(): string {
    if (!this._httpVersion)
      return 'HTTP/1.1';
    if (this._httpVersion === 'http/1.1')
      return 'HTTP/1.1';
    if (this._httpVersion === 'h2')
      return 'HTTP/2.0';
    return this._httpVersion;
  }

  private async _responseHeadersSize(): Promise<number> {
    if (this._request.responseSize.responseHeadersSize)
      return this._request.responseSize.responseHeadersSize;
    let headersSize = 4; // 4 = 2 spaces + 2 line breaks (HTTP/1.1 200 Ok\r\n)
    headersSize += 8; // httpVersion;
    headersSize += 3; // statusCode;
    headersSize += this.statusText().length;
    const headers = await this._bestEffortResponseHeaders();
    for (const header of headers)
      headersSize += header.name.length + header.value.length + 4; // 4 = ': ' + '\r\n'
    headersSize += 2; // '\r\n'
    return headersSize;
  }

  private async _bestEffortResponseHeaders(): Promise<types.HeadersArray> {
    return this._rawResponseHeadersPromise ? await this._rawResponseHeadersPromise : this._headers;
  }

  async sizes(): Promise<ResourceSizes> {
    await this._finishedPromise;
    const requestHeadersSize = await this._request.requestHeadersSize();
    const responseHeadersSize = await this._responseHeadersSize();
    let { encodedBodySize } = this._request.responseSize;
    if (!encodedBodySize) {
      const headers = await this._bestEffortResponseHeaders();
      const contentLength = headers.find(h => h.name.toLowerCase() === 'content-length')?.value;
      encodedBodySize = contentLength ? +contentLength : 0;
    }
    return {
      requestBodySize: this._request.bodySize(),
      requestHeadersSize,
      responseBodySize: encodedBodySize,
      responseHeadersSize,
    };
  }
}

export class WebSocket extends SdkObject {
  private _url: string;
  private _notified = false;

  static Events = {
    Close: 'close',
    SocketError: 'socketerror',
    FrameReceived: 'framereceived',
    FrameSent: 'framesent',
  };

  constructor(parent: SdkObject, url: string) {
    super(parent, 'ws');
    this._url = url;
  }

  markAsNotified() {
    // Sometimes we get "onWebSocketRequest" twice, at least in Chromium.
    // Perhaps websocket is restarted because of chrome.webRequest extensions api?
    // Or maybe the handshake response was a redirect?
    if (this._notified)
      return false;
    this._notified = true;
    return true;
  }

  url(): string {
    return this._url;
  }

  frameSent(opcode: number, data: string) {
    this.emit(WebSocket.Events.FrameSent, { opcode, data });
  }

  frameReceived(opcode: number, data: string) {
    this.emit(WebSocket.Events.FrameReceived, { opcode, data });
  }

  error(errorMessage: string) {
    this.emit(WebSocket.Events.SocketError, errorMessage);
  }

  closed() {
    this.emit(WebSocket.Events.Close);
  }
}

export interface RouteDelegate {
  abort(errorCode: string): Promise<void>;
  fulfill(response: types.NormalizedFulfillResponse): Promise<void>;
  continue(request: Request, overrides: types.NormalizedContinueOverrides): Promise<void>;
}

// List taken from https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml with extra 306 and 418 codes.
export const STATUS_TEXTS: { [status: string]: string } = {
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

export function singleHeader(name: string, value: string): types.HeadersArray {
  return [{ name, value }];
}

export function mergeHeaders(headers: (types.HeadersArray | undefined | null)[]): types.HeadersArray {
  const lowerCaseToValue = new Map<string, string>();
  const lowerCaseToOriginalCase = new Map<string, string>();
  for (const h of headers) {
    if (!h)
      continue;
    for (const { name, value } of h) {
      const lower = name.toLowerCase();
      lowerCaseToOriginalCase.set(lower, name);
      lowerCaseToValue.set(lower, value);
    }
  }
  const result: types.HeadersArray = [];
  for (const [lower, value] of lowerCaseToValue)
    result.push({ name: lowerCaseToOriginalCase.get(lower)!, value });
  return result;
}
