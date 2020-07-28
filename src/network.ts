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

import * as frames from './frames';
import * as types from './types';
import { assert, helper } from './helper';
import { URLSearchParams } from 'url';
import { normalizeFulfillParameters, normalizeContinueOverrides } from './converters';

export function filterCookies(cookies: types.NetworkCookie[], urls: string[]): types.NetworkCookie[] {
  const parsedURLs = urls.map(s => new URL(s));
  // Chromiums's cookies are missing sameSite when it is 'None'
  return cookies.filter(c => {
    if (!parsedURLs.length)
      return true;
    for (const parsedURL of parsedURLs) {
      if (parsedURL.hostname !== c.domain)
        continue;
      if (!parsedURL.pathname.startsWith(c.path))
        continue;
      if ((parsedURL.protocol === 'https:') !== c.secure)
        continue;
      return true;
    }
    return false;
  });
}

export function rewriteCookies(cookies: types.SetNetworkCookieParam[]): types.SetNetworkCookieParam[] {
  return cookies.map(c => {
    assert(c.name, 'Cookie should have a name');
    assert(c.value, 'Cookie should have a value');
    assert(c.url || (c.domain && c.path), 'Cookie should have a url or a domain/path pair');
    assert(!(c.url && c.domain), 'Cookie should have either url or domain');
    assert(!(c.url && c.path), 'Cookie should have either url or domain');
    const copy = {...c};
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

function stripFragmentFromUrl(url: string): string {
  if (!url.indexOf('#'))
    return url;
  const parsed = new URL(url);
  parsed.hash = '';
  return parsed.href;
}

export class Request {
  readonly _routeDelegate: RouteDelegate | null;
  private _response: Response | null = null;
  private _redirectedFrom: Request | null;
  private _redirectedTo: Request | null = null;
  readonly _documentId?: string;
  readonly _isFavicon: boolean;
  _failureText: string | null = null;
  private _url: string;
  private _resourceType: string;
  private _method: string;
  private _postData: Buffer | null;
  private _headers: types.Headers;
  private _frame: frames.Frame;
  private _waitForResponsePromise: Promise<Response | null>;
  private _waitForResponsePromiseCallback: (value: Response | null) => void = () => {};

  constructor(routeDelegate: RouteDelegate | null, frame: frames.Frame, redirectedFrom: Request | null, documentId: string | undefined,
    url: string, resourceType: string, method: string, postData: Buffer | null, headers: types.Headers) {
    assert(!url.startsWith('data:'), 'Data urls should not fire requests');
    assert(!(routeDelegate && redirectedFrom), 'Should not be able to intercept redirects');
    this._routeDelegate = routeDelegate;
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
    this._waitForResponsePromise = new Promise(f => this._waitForResponsePromiseCallback = f);
    this._isFavicon = url.endsWith('/favicon.ico');
  }

  _setFailureText(failureText: string) {
    this._failureText = failureText;
    this._waitForResponsePromiseCallback(null);
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

  postData(): string | null {
    return this._postData ? this._postData.toString('utf8') : null;
  }

  postDataBuffer(): Buffer | null {
    return this._postData;
  }

  postDataJSON(): Object | null {
    const postData = this.postData();
    if (!postData)
      return null;

    const contentType = this.headers()['content-type'];
    if (!contentType)
      return null;

    if (contentType === 'application/x-www-form-urlencoded') {
      const entries: Record<string, string> = {};
      const parsed = new URLSearchParams(postData);
      for (const [k, v] of parsed.entries())
        entries[k] = v;
      return entries;
    }

    return JSON.parse(postData);
  }

  headers(): {[key: string]: string} {
    return { ...this._headers };
  }

  response(): Promise<Response | null> {
    return this._waitForResponsePromise;
  }

  _existingResponse(): Response | null {
    return this._response;
  }

  _setResponse(response: Response) {
    this._response = response;
    this._waitForResponsePromiseCallback(response);
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

  redirectedTo(): Request | null {
    return this._redirectedTo;
  }

  failure(): { errorText: string } | null {
    if (this._failureText === null)
      return null;
    return {
      errorText: this._failureText
    };
  }

  _route(): Route | null {
    if (!this._routeDelegate)
      return null;
    return new Route(this, this._routeDelegate);
  }
}

export class Route {
  private readonly _request: Request;
  private readonly _delegate: RouteDelegate;
  private _handled = false;

  constructor(request: Request, delegate: RouteDelegate) {
    this._request = request;
    this._delegate = delegate;
  }

  request(): Request {
    return this._request;
  }

  async abort(errorCode: string = 'failed') {
    assert(!this._handled, 'Route is already handled!');
    this._handled = true;
    await this._delegate.abort(errorCode);
  }

  async fulfill(response: types.FulfillResponse & { path?: string }) {
    assert(!this._handled, 'Route is already handled!');
    this._handled = true;
    await this._delegate.fulfill(await normalizeFulfillParameters(response));
  }

  async continue(overrides: types.ContinueOverrides = {}) {
    assert(!this._handled, 'Route is already handled!');
    await this._delegate.continue(normalizeContinueOverrides(overrides));
  }
}

export type RouteHandler = (route: Route, request: Request) => void;

type GetResponseBodyCallback = () => Promise<Buffer>;

export class Response {
  private _request: Request;
  private _contentPromise: Promise<Buffer> | null = null;
  _finishedPromise: Promise<{ error?: string }>;
  private _finishedPromiseCallback: (arg: { error?: string }) => void = () => {};
  private _status: number;
  private _statusText: string;
  private _url: string;
  private _headers: types.Headers;
  private _getResponseBodyCallback: GetResponseBodyCallback;

  constructor(request: Request, status: number, statusText: string, headers: types.Headers, getResponseBodyCallback: GetResponseBodyCallback) {
    this._request = request;
    this._status = status;
    this._statusText = statusText;
    this._url = request.url();
    this._headers = headers;
    this._getResponseBodyCallback = getResponseBodyCallback;
    this._finishedPromise = new Promise(f => {
      this._finishedPromiseCallback = f;
    });
    this._request._setResponse(this);
  }

  _requestFinished(error?: string) {
    this._finishedPromiseCallback({ error });
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

  headers(): types.Headers {
    return { ...this._headers };
  }

  finished(): Promise<Error | null> {
    return this._finishedPromise.then(({ error }) => error ? new Error(error) : null);
  }

  body(): Promise<Buffer> {
    if (!this._contentPromise) {
      this._contentPromise = this._finishedPromise.then(async ({ error }) => {
        if (error)
          throw new Error(error);
        return this._getResponseBodyCallback();
      });
    }
    return this._contentPromise;
  }

  async text(): Promise<string> {
    const content = await this.body();
    return content.toString('utf8');
  }

  async json(): Promise<object> {
    const content = await this.text();
    return JSON.parse(content);
  }

  request(): Request {
    return this._request;
  }

  frame(): frames.Frame {
    return this._request.frame();
  }
}

export interface RouteDelegate {
  abort(errorCode: string): Promise<void>;
  fulfill(response: types.NormalizedFulfillResponse): Promise<void>;
  continue(overrides: types.NormalizedContinueOverrides): Promise<void>;
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

export function verifyHeaders(headers: types.Headers): types.Headers {
  const result: types.Headers = {};
  for (const key of Object.keys(headers)) {
    const value = headers[key];
    assert(helper.isString(value), `Expected value of header "${key}" to be String, but "${typeof value}" is found.`);
    result[key] = value;
  }
  return result;
}

export function mergeHeaders(headers: (types.Headers | undefined | null)[]): types.Headers {
  const lowerCaseToValue = new Map<string, string>();
  const lowerCaseToOriginalCase = new Map<string, string>();
  for (const h of headers) {
    if (!h)
      continue;
    for (const key of Object.keys(h)) {
      const lower = key.toLowerCase();
      lowerCaseToOriginalCase.set(lower, key);
      lowerCaseToValue.set(lower, h[key]);
    }
  }
  const result: types.Headers = {};
  for (const [lower, value] of lowerCaseToValue)
    result[lowerCaseToOriginalCase.get(lower)!] = value;
  return result;
}
