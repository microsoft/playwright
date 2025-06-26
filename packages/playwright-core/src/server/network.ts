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

import { assert } from '../utils';
import { BrowserContext } from './browserContext';
import { APIRequestContext } from './fetch';
import { SdkObject } from './instrumentation';
import { ManualPromise } from '../utils/isomorphic/manualPromise';

import type * as contexts from './browserContext';
import type * as frames from './frames';
import type * as pages from './page';
import type * as types from './types';
import type { NormalizedContinueOverrides } from './types';
import type { HeadersArray, NameValue } from '../utils/isomorphic/types';
import type * as channels from '@protocol/channels';


export function filterCookies(cookies: channels.NetworkCookie[], urls: string[]): channels.NetworkCookie[] {
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
      if (parsedURL.protocol !== 'https:' && !isLocalHostname(parsedURL.hostname) && c.secure)
        continue;
      return true;
    }
    return false;
  });
}

export function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname.endsWith('.localhost');
}

// Rollover to 5-digit year:
// 253402300799 == Fri, 31 Dec 9999 23:59:59 +0000 (UTC)
// 253402300800 == Sat,  1 Jan 1000 00:00:00 +0000 (UTC)
export const kMaxCookieExpiresDateInSeconds = 253402300799;

export function rewriteCookies(cookies: channels.SetNetworkCookie[]): channels.SetNetworkCookie[] {
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

export function parseURL(url: string): URL | null {
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
  readonly _headers: HeadersArray;
  private _headersMap = new Map<string, string>();
  readonly _frame: frames.Frame | null = null;
  readonly _serviceWorker: pages.Worker | null = null;
  readonly _context: contexts.BrowserContext;
  private _rawRequestHeadersPromise = new ManualPromise<HeadersArray>();
  private _waitForResponsePromise = new ManualPromise<Response | null>();
  _responseEndTiming = -1;
  private _overrides: NormalizedContinueOverrides | undefined;
  private _bodySize: number | undefined;

  constructor(context: contexts.BrowserContext, frame: frames.Frame | null, serviceWorker: pages.Worker | null, redirectedFrom: Request | null, documentId: string | undefined,
    url: string, resourceType: string, method: string, postData: Buffer | null, headers: HeadersArray) {
    super(frame || context, 'request');
    assert(!url.startsWith('data:'), 'Data urls should not fire requests');
    this._context = context;
    this._frame = frame;
    this._serviceWorker = serviceWorker;
    this._redirectedFrom = redirectedFrom;
    if (redirectedFrom)
      redirectedFrom._redirectedTo = this;
    this._documentId = documentId;
    this._url = stripFragmentFromUrl(url);
    this._resourceType = resourceType;
    this._method = method;
    this._postData = postData;
    this._headers = headers;
    this._updateHeadersMap();
    this._isFavicon = url.endsWith('/favicon.ico') || !!redirectedFrom?._isFavicon;
  }

  _setFailureText(failureText: string) {
    this._failureText = failureText;
    this._waitForResponsePromise.resolve(null);
  }

  _applyOverrides(overrides: types.NormalizedContinueOverrides) {
    this._overrides = { ...this._overrides, ...overrides };
    this._updateHeadersMap();
    return this._overrides;
  }

  private _updateHeadersMap() {
    for (const { name, value } of this.headers())
      this._headersMap.set(name.toLowerCase(), value);
  }

  overrides() {
    return this._overrides;
  }

  url(): string {
    return this._overrides?.url || this._url;
  }

  resourceType(): string {
    return this._resourceType;
  }

  method(): string {
    return this._overrides?.method || this._method;
  }

  postDataBuffer(): Buffer | null {
    return this._overrides?.postData || this._postData;
  }

  headers(): HeadersArray {
    return this._overrides?.headers || this._headers;
  }

  headerValue(name: string): string | undefined {
    return this._headersMap.get(name);
  }

  // "null" means no raw headers available - we'll use provisional headers as raw headers.
  setRawRequestHeaders(headers: HeadersArray | null) {
    if (!this._rawRequestHeadersPromise.isDone())
      this._rawRequestHeadersPromise.resolve(headers || this._headers);
  }

  async rawRequestHeaders(): Promise<HeadersArray> {
    return this._overrides?.headers || this._rawRequestHeadersPromise;
  }

  response(): Promise<Response | null> {
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

  frame(): frames.Frame | null {
    return this._frame;
  }

  serviceWorker(): pages.Worker | null {
    return this._serviceWorker;
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

  // TODO(bidi): remove once post body is available.
  _setBodySize(size: number) {
    this._bodySize = size;
  }

  bodySize(): number {
    return this._bodySize || this.postDataBuffer()?.length || 0;
  }

  async requestHeadersSize(): Promise<number> {
    let headersSize = 4; // 4 = 2 spaces + 2 line breaks (GET /path \r\n)
    headersSize += this.method().length;
    headersSize += (new URL(this.url())).pathname.length;
    headersSize += 8; // httpVersion
    const headers = await this.rawRequestHeaders();
    for (const header of headers)
      headersSize += header.name.length + header.value.length + 4; // 4 = ': ' + '\r\n'
    return headersSize;
  }
}

export class Route extends SdkObject {
  private readonly _request: Request;
  private readonly _delegate: RouteDelegate;
  private _handled = false;
  private _currentHandler: RouteHandler | undefined;
  private _futureHandlers: RouteHandler[] = [];

  constructor(request: Request, delegate: RouteDelegate) {
    super(request._frame || request._context, 'route');
    this._request = request;
    this._delegate = delegate;
    this._request._context.addRouteInFlight(this);
  }

  handle(handlers: RouteHandler[]) {
    this._futureHandlers = [...handlers];
    this.continue({ isFallback: true }).catch(() => {});
  }

  async removeHandler(handler: RouteHandler) {
    this._futureHandlers = this._futureHandlers.filter(h => h !== handler);
    if (handler === this._currentHandler) {
      await this.continue({ isFallback: true }).catch(() => {});
      return;
    }
  }

  request(): Request {
    return this._request;
  }

  async abort(errorCode: string = 'failed') {
    this._startHandling();
    this._request._context.emit(BrowserContext.Events.RequestAborted, this._request);
    await this._delegate.abort(errorCode);
    this._endHandling();
  }

  redirectNavigationRequest(url: string) {
    this._startHandling();
    assert(this._request.isNavigationRequest());
    this._request.frame()!.redirectNavigation(url, this._request._documentId!, this._request.headerValue('referer'));
    this._endHandling();
  }

  async fulfill(overrides: channels.RouteFulfillParams) {
    this._startHandling();
    let body = overrides.body;
    let isBase64 = overrides.isBase64 || false;
    if (body === undefined) {
      if (overrides.fetchResponseUid) {
        const buffer = this._request._context.fetchRequest.fetchResponses.get(overrides.fetchResponseUid) || APIRequestContext.findResponseBody(overrides.fetchResponseUid);
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
    this._request._context.emit(BrowserContext.Events.RequestFulfilled, this._request);
    await this._delegate.fulfill({
      status: overrides.status || 200,
      headers,
      body: body!,
      isBase64,
    });
    this._endHandling();
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

  async continue(overrides: types.NormalizedContinueOverrides) {
    if (overrides.url) {
      const newUrl = new URL(overrides.url);
      const oldUrl = new URL(this._request.url());
      if (oldUrl.protocol !== newUrl.protocol)
        throw new Error('New URL must have same protocol as overridden URL');
    }
    if (overrides.headers)
      overrides.headers = overrides.headers?.filter(header => header.name.toLowerCase() !== 'cookie');
    overrides = this._request._applyOverrides(overrides);

    const nextHandler = this._futureHandlers.shift();
    if (nextHandler) {
      this._currentHandler = nextHandler;
      nextHandler(this, this._request);
      return;
    }

    if (!overrides.isFallback)
      this._request._context.emit(BrowserContext.Events.RequestContinued, this._request);
    this._startHandling();
    await this._delegate.continue(overrides);
    this._endHandling();
  }

  private _startHandling() {
    assert(!this._handled, 'Route is already handled!');
    this._handled = true;
    this._currentHandler = undefined;
  }

  private _endHandling() {
    this._futureHandlers = [];
    this._currentHandler = undefined;
    this._request._context.removeRouteInFlight(this);
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
  transferSize: number,
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
  private _headers: HeadersArray;
  private _headersMap = new Map<string, string>();
  private _getResponseBodyCallback: GetResponseBodyCallback;
  private _timing: ResourceTiming;
  private _serverAddrPromise = new ManualPromise<RemoteAddr | undefined>();
  private _securityDetailsPromise = new ManualPromise<SecurityDetails | undefined>();
  private _rawResponseHeadersPromise = new ManualPromise<HeadersArray>();
  private _httpVersion: string | undefined;
  private _fromServiceWorker: boolean;
  private _encodedBodySizePromise = new ManualPromise<number | null>();
  private _transferSizePromise = new ManualPromise<number | null>();
  private _responseHeadersSizePromise = new ManualPromise<number | null>();

  constructor(request: Request, status: number, statusText: string, headers: HeadersArray, timing: ResourceTiming, getResponseBodyCallback: GetResponseBodyCallback, fromServiceWorker: boolean, httpVersion?: string) {
    super(request.frame() || request._context, 'response');
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
    this._fromServiceWorker = fromServiceWorker;
  }

  _serverAddrFinished(addr?: RemoteAddr) {
    this._serverAddrPromise.resolve(addr);
  }

  _securityDetailsFinished(securityDetails?: SecurityDetails) {
    this._securityDetailsPromise.resolve(securityDetails);
  }

  _requestFinished(responseEndTiming: number) {
    this._request._responseEndTiming = Math.max(responseEndTiming, this._timing.responseStart);
    // Set start time equal to end when request is served from memory cache.
    if (this._timing.requestStart === -1)
      this._timing.requestStart = this._request._responseEndTiming;
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

  headers(): HeadersArray {
    return this._headers;
  }

  headerValue(name: string): string | undefined {
    return this._headersMap.get(name);
  }

  async rawResponseHeaders(): Promise<NameValue[]> {
    return this._rawResponseHeadersPromise;
  }

  // "null" means no raw headers available - we'll use provisional headers as raw headers.
  setRawResponseHeaders(headers: HeadersArray | null) {
    if (!this._rawResponseHeadersPromise.isDone())
      this._rawResponseHeadersPromise.resolve(headers || this._headers);
  }

  setTransferSize(size: number | null) {
    this._transferSizePromise.resolve(size);
  }

  setEncodedBodySize(size: number | null) {
    this._encodedBodySizePromise.resolve(size);
  }

  setResponseHeadersSize(size: number | null) {
    this._responseHeadersSizePromise.resolve(size);
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

  frame(): frames.Frame | null {
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

  fromServiceWorker(): boolean {
    return this._fromServiceWorker;
  }

  async responseHeadersSize(): Promise<number> {
    const availableSize = await this._responseHeadersSizePromise;
    if (availableSize !== null)
      return availableSize;

    // Fallback to calculating it manually.
    let headersSize = 4; // 4 = 2 spaces + 2 line breaks (HTTP/1.1 200 Ok\r\n)
    headersSize += 8; // httpVersion;
    headersSize += 3; // statusCode;
    headersSize += this.statusText().length;
    const headers = await this._rawResponseHeadersPromise;
    for (const header of headers)
      headersSize += header.name.length + header.value.length + 4; // 4 = ': ' + '\r\n'
    headersSize += 2; // '\r\n'
    return headersSize;
  }

  async sizes(): Promise<ResourceSizes> {
    const requestHeadersSize = await this._request.requestHeadersSize();
    const responseHeadersSize = await this.responseHeadersSize();

    let encodedBodySize = await this._encodedBodySizePromise;
    if (encodedBodySize === null) {
      // Fallback to calculating it manually.
      const headers = await this._rawResponseHeadersPromise;
      const contentLength = headers.find(h => h.name.toLowerCase() === 'content-length')?.value;
      encodedBodySize = contentLength ? +contentLength : 0;
    }

    let transferSize = await this._transferSizePromise;
    if (transferSize === null) {
      // Fallback to calculating it manually.
      transferSize = responseHeadersSize + encodedBodySize;
    }

    return {
      requestBodySize: this._request.bodySize(),
      requestHeadersSize,
      responseBodySize: encodedBodySize,
      responseHeadersSize,
      transferSize,
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
  continue(overrides: types.NormalizedContinueOverrides): Promise<void>;
}

// List taken from https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml with extra 306 and 418 codes.
const STATUS_TEXTS: { [status: string]: string } = {
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

export function statusText(status: number): string {
  return STATUS_TEXTS[String(status)] || 'Unknown';
}

export function singleHeader(name: string, value: string): HeadersArray {
  return [{ name, value }];
}

export function mergeHeaders(headers: (HeadersArray | undefined | null)[]): HeadersArray {
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
  const result: HeadersArray = [];
  for (const [lower, value] of lowerCaseToValue)
    result.push({ name: lowerCaseToOriginalCase.get(lower)!, value });
  return result;
}
