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
import { assert, helper } from './helper';
import * as platform from './platform';

export type NetworkCookie = {
  name: string,
  value: string,
  domain: string,
  path: string,
  expires: number,
  httpOnly: boolean,
  secure: boolean,
  sameSite: 'Strict' | 'Lax' | 'None'
};

export type SetNetworkCookieParam = {
  name: string,
  value: string,
  url?: string,
  domain?: string,
  path?: string,
  expires?: number,
  httpOnly?: boolean,
  secure?: boolean,
  sameSite?: 'Strict' | 'Lax' | 'None'
};

export type RouteHandler = (request: Request) => void;

export function filterCookies(cookies: NetworkCookie[], urls: string | string[] = []): NetworkCookie[] {
  if (!Array.isArray(urls))
    urls = [ urls ];
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

export function rewriteCookies(cookies: SetNetworkCookieParam[]): SetNetworkCookieParam[] {
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

export type Headers = { [key: string]: string };

export class Request {
  private _delegate: RequestDelegate | null;
  private _response: Response | null = null;
  _redirectChain: Request[];
  _finalRequest: Request;
  readonly _documentId?: string;
  readonly _isFavicon: boolean;
  private _failureText: string | null = null;
  private _url: string;
  private _resourceType: string;
  private _method: string;
  private _postData: string | null;
  private _headers: Headers;
  private _frame: frames.Frame;
  private _waitForResponsePromise: Promise<Response | null>;
  private _waitForResponsePromiseCallback: (value: Response | null) => void = () => {};
  private _interceptionHandled = false;

  constructor(delegate: RequestDelegate | null, frame: frames.Frame, redirectChain: Request[], documentId: string | undefined,
    url: string, resourceType: string, method: string, postData: string | null, headers: Headers) {
    assert(!url.startsWith('data:'), 'Data urls should not fire requests');
    this._delegate = delegate;
    this._frame = frame;
    this._redirectChain = redirectChain;
    this._finalRequest = this;
    for (const request of redirectChain)
      request._finalRequest = this;
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
    return this._postData;
  }

  headers(): {[key: string]: string} {
    return this._headers;
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

  frame(): frames.Frame {
    return this._frame;
  }

  isNavigationRequest(): boolean {
    return !!this._documentId;
  }

  redirectChain(): Request[] {
    return this._redirectChain.slice();
  }

  failure(): { errorText: string; } | null {
    if (this._failureText === null)
      return null;
    return {
      errorText: this._failureText
    };
  }

  async abort(errorCode: string = 'failed') {
    assert(this._delegate, 'Request Interception is not enabled!');
    assert(!this._interceptionHandled, 'Request is already handled!');
    this._interceptionHandled = true;
    await this._delegate.abort(errorCode);
  }

  async fulfill(response: FulfillResponse & { path?: string }) {
    assert(this._delegate, 'Request Interception is not enabled!');
    assert(!this._interceptionHandled, 'Request is already handled!');
    this._interceptionHandled = true;
    if (response.path) {
      response = {
        status: response.status,
        headers: response.headers,
        contentType: platform.getMimeType(response.path),
        body: await platform.readFileBuffer(response.path)
      };
    }
    await this._delegate.fulfill(response);
  }

  async continue(overrides: { method?: string; headers?: Headers; postData?: string } = {}) {
    assert(this._delegate, 'Request Interception is not enabled!');
    assert(!this._interceptionHandled, 'Request is already handled!');
    await this._delegate.continue(overrides);
  }

  _isIntercepted(): boolean {
    return !!this._delegate;
  }
}

type GetResponseBodyCallback = () => Promise<platform.BufferType>;

export class Response {
  private _request: Request;
  private _contentPromise: Promise<platform.BufferType> | null = null;
  _finishedPromise: Promise<Error | null>;
  private _finishedPromiseCallback: any;
  private _status: number;
  private _statusText: string;
  private _url: string;
  private _headers: Headers;
  private _getResponseBodyCallback: GetResponseBodyCallback;

  constructor(request: Request, status: number, statusText: string, headers: Headers, getResponseBodyCallback: GetResponseBodyCallback) {
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

  _requestFinished(error?: Error) {
    this._finishedPromiseCallback.call(null, error);
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

  finished(): Promise<Error | null> {
    return this._finishedPromise;
  }

  body(): Promise<platform.BufferType> {
    if (!this._contentPromise) {
      this._contentPromise = this._finishedPromise.then(async error => {
        if (error)
          throw error;
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

export type FulfillResponse = {
  status?: number,
  headers?: Headers,
  contentType?: string,
  body?: string | platform.BufferType,
};

export interface RequestDelegate {
  abort(errorCode: string): Promise<void>;
  fulfill(response: FulfillResponse): Promise<void>;
  continue(overrides: { method?: string; headers?: Headers; postData?: string; }): Promise<void>;
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

export function verifyHeaders(headers: Headers): Headers {
  const result: Headers = {};
  for (const key of Object.keys(headers)) {
    const value = headers[key];
    assert(helper.isString(value), `Expected value of header "${key}" to be String, but "${typeof value}" is found.`);
    result[key] = value;
  }
  return result;
}

export function mergeHeaders(headers: (Headers | undefined | null)[]): Headers {
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
  const result: Headers = {};
  for (const [lower, value] of lowerCaseToValue)
    result[lowerCaseToOriginalCase.get(lower)!] = value;
  return result;
}
