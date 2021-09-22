/**
 * Copyright (c) Microsoft Corporation.
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

import { HttpsProxyAgent } from 'https-proxy-agent';
import url from 'url';
import zlib from 'zlib';
import * as http from 'http';
import * as https from 'https';
import { BrowserContext } from './browserContext';
import * as types from './types';
import { pipeline, Readable, Transform } from 'stream';
import { createGuid, isFilePayload, monotonicTime } from '../utils/utils';
import { SdkObject } from './instrumentation';
import { Playwright } from './playwright';
import { HeadersArray, ProxySettings } from './types';
import { HTTPCredentials } from '../../types/types';
import { TimeoutSettings } from '../utils/timeoutSettings';
import { MultipartFormData } from './formData';


type FetchRequestOptions = {
  userAgent: string;
  extraHTTPHeaders?: HeadersArray;
  httpCredentials?: HTTPCredentials;
  proxy?: ProxySettings;
  timeoutSettings: TimeoutSettings;
  ignoreHTTPSErrors?: boolean;
  baseURL?: string;
};

export abstract class FetchRequest extends SdkObject {
  static Events = {
    Dispose: 'dispose',
  };

  readonly fetchResponses: Map<string, Buffer> = new Map();
  protected static allInstances: Set<FetchRequest> = new Set();

  static findResponseBody(guid: string): Buffer | undefined {
    for (const request of FetchRequest.allInstances) {
      const body = request.fetchResponses.get(guid);
      if (body)
        return body;
    }
    return undefined;
  }

  constructor(parent: SdkObject) {
    super(parent, 'fetchRequest');
    FetchRequest.allInstances.add(this);
  }

  protected _disposeImpl() {
    FetchRequest.allInstances.delete(this);
    this.fetchResponses.clear();
    this.emit(FetchRequest.Events.Dispose);
  }

  abstract dispose(): void;

  abstract _defaultOptions(): FetchRequestOptions;
  abstract _addCookies(cookies: types.SetNetworkCookieParam[]): Promise<void>;
  abstract _cookies(url: string): Promise<types.NetworkCookie[]>;

  private _storeResponseBody(body: Buffer): string {
    const uid = createGuid();
    this.fetchResponses.set(uid, body);
    return uid;
  }

  async fetch(params: types.FetchOptions): Promise<{fetchResponse?: Omit<types.FetchResponse, 'body'> & { fetchUid: string }, error?: string}> {
    try {
      const headers: { [name: string]: string } = {};
      const defaults = this._defaultOptions();
      headers['user-agent'] = defaults.userAgent;
      headers['accept'] = '*/*';
      headers['accept-encoding'] = 'gzip,deflate,br';

      if (defaults.extraHTTPHeaders) {
        for (const {name, value} of defaults.extraHTTPHeaders)
          headers[name.toLowerCase()] = value;
      }

      if (params.headers) {
        for (const [name, value] of Object.entries(params.headers))
          headers[name.toLowerCase()] = value;
      }

      const method = params.method?.toUpperCase() || 'GET';
      const proxy = defaults.proxy;
      let agent;
      if (proxy) {
        // TODO: support bypass proxy
        const proxyOpts = url.parse(proxy.server);
        if (proxy.username)
          proxyOpts.auth = `${proxy.username}:${proxy.password || ''}`;
        agent = new HttpsProxyAgent(proxyOpts);
      }

      const timeout = defaults.timeoutSettings.timeout(params);
      const deadline = timeout && (monotonicTime() + timeout);

      const options: https.RequestOptions & { maxRedirects: number, deadline: number } = {
        method,
        headers,
        agent,
        maxRedirects: 20,
        timeout,
        deadline
      };
      // rejectUnauthorized = undefined is treated as true in node 12.
      if (defaults.ignoreHTTPSErrors)
        options.rejectUnauthorized = false;

      const requestUrl = new URL(params.url, defaults.baseURL);
      if (params.params) {
        for (const [name, value] of Object.entries(params.params))
          requestUrl.searchParams.set(name, value);
      }

      let postData;
      if (['POST', 'PUSH', 'PATCH'].includes(method))
        postData = params.formData ? serializeFormData(params.formData, headers) : params.postData;
      else if (params.postData || params.formData)
        throw new Error(`Method ${method} does not accept post data`);
      if (postData) {
        headers['content-length'] = String(postData.byteLength);
        headers['content-type'] ??= 'application/octet-stream';
      }
      const fetchResponse = await this._sendRequest(requestUrl, options, postData);
      const fetchUid = this._storeResponseBody(fetchResponse.body);
      if (params.failOnStatusCode && (fetchResponse.status < 200 || fetchResponse.status >= 400))
        return { error: `${fetchResponse.status} ${fetchResponse.statusText}` };
      return { fetchResponse: { ...fetchResponse, fetchUid } };
    } catch (e) {
      return { error: String(e) };
    }
  }

  private async _updateCookiesFromHeader(responseUrl: string, setCookie: string[]) {
    const url = new URL(responseUrl);
    // https://datatracker.ietf.org/doc/html/rfc6265#section-5.1.4
    const defaultPath = '/' + url.pathname.substr(1).split('/').slice(0, -1).join('/');
    const cookies: types.SetNetworkCookieParam[] = [];
    for (const header of setCookie) {
      // Decode cookie value?
      const cookie: types.SetNetworkCookieParam | null = parseCookie(header);
      if (!cookie)
        continue;
      if (!cookie.domain)
        cookie.domain = url.hostname;
      if (!canSetCookie(cookie.domain!, url.hostname))
        continue;
      // https://datatracker.ietf.org/doc/html/rfc6265#section-5.2.4
      if (!cookie.path || !cookie.path.startsWith('/'))
        cookie.path = defaultPath;
      cookies.push(cookie);
    }
    if (cookies.length)
      await this._addCookies(cookies);
  }

  private async _updateRequestCookieHeader(url: URL, options: http.RequestOptions) {
    if (options.headers!['cookie'] !== undefined)
      return;
    const cookies = await this._cookies(url.toString());
    if (cookies.length) {
      const valueArray = cookies.map(c => `${c.name}=${c.value}`);
      options.headers!['cookie'] = valueArray.join('; ');
    }
  }

  private async _sendRequest(url: URL, options: https.RequestOptions & { maxRedirects: number, deadline: number }, postData?: Buffer): Promise<types.FetchResponse>{
    await this._updateRequestCookieHeader(url, options);
    return new Promise<types.FetchResponse>((fulfill, reject) => {
      const requestConstructor: ((url: URL, options: http.RequestOptions, callback?: (res: http.IncomingMessage) => void) => http.ClientRequest)
        = (url.protocol === 'https:' ? https : http).request;
      const request = requestConstructor(url, options, async response => {
        if (response.headers['set-cookie'])
          await this._updateCookiesFromHeader(response.url || url.toString(), response.headers['set-cookie']);
        if (redirectStatus.includes(response.statusCode!)) {
          if (!options.maxRedirects) {
            reject(new Error('Max redirect count exceeded'));
            request.abort();
            return;
          }
          const headers = { ...options.headers };
          delete headers[`cookie`];

          // HTTP-redirect fetch step 13 (https://fetch.spec.whatwg.org/#http-redirect-fetch)
          const status = response.statusCode!;
          let method = options.method!;
          if ((status === 301 || status === 302) && method === 'POST' ||
              status === 303 && !['GET', 'HEAD'].includes(method)) {
            method = 'GET';
            postData = undefined;
            delete headers[`content-encoding`];
            delete headers[`content-language`];
            delete headers[`content-location`];
            delete headers[`content-type`];
          }

          const redirectOptions: http.RequestOptions & { maxRedirects: number, deadline: number } = {
            method,
            headers,
            agent: options.agent,
            maxRedirects: options.maxRedirects - 1,
            timeout: options.timeout,
            deadline: options.deadline
          };

          // HTTP-redirect fetch step 4: If locationURL is null, then return response.
          if (response.headers.location) {
            const locationURL = new URL(response.headers.location, url);
            fulfill(this._sendRequest(locationURL, redirectOptions, postData));
            request.abort();
            return;
          }
        }
        if (response.statusCode === 401 && !options.headers!['authorization']) {
          const auth = response.headers['www-authenticate'];
          const credentials = this._defaultOptions().httpCredentials;
          if (auth?.trim().startsWith('Basic ') && credentials) {
            const {username, password} = credentials;
            const encoded = Buffer.from(`${username || ''}:${password || ''}`).toString('base64');
            options.headers!['authorization'] = `Basic ${encoded}`;
            fulfill(this._sendRequest(url, options, postData));
            request.abort();
            return;
          }
        }
        response.on('aborted', () => reject(new Error('aborted')));

        let body: Readable = response;
        let transform: Transform | undefined;
        const encoding = response.headers['content-encoding'];
        if (encoding === 'gzip' || encoding === 'x-gzip') {
          transform = zlib.createGunzip({
            flush: zlib.constants.Z_SYNC_FLUSH,
            finishFlush: zlib.constants.Z_SYNC_FLUSH
          });
        } else if (encoding === 'br') {
          transform = zlib.createBrotliDecompress();
        } else if (encoding === 'deflate') {
          transform = zlib.createInflate();
        }
        if (transform) {
          body = pipeline(response, transform, e => {
            if (e)
              reject(new Error(`failed to decompress '${encoding}' encoding: ${e}`));
          });
        }

        const chunks: Buffer[] = [];
        body.on('data', chunk => chunks.push(chunk));
        body.on('end', () => {
          const body = Buffer.concat(chunks);
          fulfill({
            url: response.url || url.toString(),
            status: response.statusCode || 0,
            statusText: response.statusMessage || '',
            headers: toHeadersArray(response.rawHeaders),
            body
          });
        });
        body.on('error',reject);
      });
      request.on('error', reject);

      if (options.deadline) {
        const rejectOnTimeout = () =>  {
          reject(new Error(`Request timed out after ${options.timeout}ms`));
          request.abort();
        };
        const remaining = options.deadline - monotonicTime();
        if (remaining <= 0) {
          rejectOnTimeout();
          return;
        }
        request.setTimeout(remaining, rejectOnTimeout);
      }

      if (postData)
        request.write(postData);
      request.end();
    });
  }
}

export class BrowserContextFetchRequest extends FetchRequest {
  private readonly _context: BrowserContext;

  constructor(context: BrowserContext) {
    super(context);
    this._context = context;
    context.once(BrowserContext.Events.Close, () => this._disposeImpl());
  }

  override dispose() {
    this.fetchResponses.clear();
  }

  _defaultOptions(): FetchRequestOptions {
    return {
      userAgent: this._context._options.userAgent || this._context._browser.userAgent(),
      extraHTTPHeaders: this._context._options.extraHTTPHeaders,
      httpCredentials: this._context._options.httpCredentials,
      proxy: this._context._options.proxy || this._context._browser.options.proxy,
      timeoutSettings: this._context._timeoutSettings,
      ignoreHTTPSErrors: this._context._options.ignoreHTTPSErrors,
      baseURL: this._context._options.baseURL,
    };
  }

  async _addCookies(cookies: types.SetNetworkCookieParam[]): Promise<void> {
    await this._context.addCookies(cookies);
  }

  async _cookies(url: string): Promise<types.NetworkCookie[]> {
    return await this._context.cookies(url);
  }
}


export class GlobalFetchRequest extends FetchRequest {
  constructor(playwright: Playwright) {
    super(playwright);
  }

  override dispose() {
    this._disposeImpl();
  }

  _defaultOptions(): FetchRequestOptions {
    return {
      userAgent: '',
      extraHTTPHeaders: undefined,
      proxy: undefined,
      timeoutSettings: new TimeoutSettings(),
      ignoreHTTPSErrors: false,
      baseURL: undefined,
    };
  }

  async _addCookies(cookies: types.SetNetworkCookieParam[]): Promise<void> {
  }

  async _cookies(url: string): Promise<types.NetworkCookie[]> {
    return [];
  }
}

function toHeadersArray(rawHeaders: string[]): types.HeadersArray {
  const result: types.HeadersArray = [];
  for (let i = 0; i < rawHeaders.length; i += 2)
    result.push({ name: rawHeaders[i], value: rawHeaders[i + 1] });
  return result;
}

const redirectStatus = [301, 302, 303, 307, 308];

function canSetCookie(cookieDomain: string, hostname: string) {
  // TODO: check public suffix list?
  hostname = '.' + hostname;
  if (!cookieDomain.startsWith('.'))
    cookieDomain = '.' + cookieDomain;
  return hostname.endsWith(cookieDomain);
}

function parseCookie(header: string) {
  const pairs = header.split(';').filter(s => s.trim().length > 0).map(p => p.split('=').map(s => s.trim()));
  if (!pairs.length)
    return null;
  const [name, value] = pairs[0];
  const cookie: types.NetworkCookie = {
    name,
    value,
    domain: '',
    path: '',
    expires: -1,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax' // None for non-chromium
  };
  for (let i = 1; i < pairs.length; i++) {
    const [name, value] = pairs[i];
    switch (name.toLowerCase()) {
      case 'expires':
        const expiresMs = (+new Date(value));
        if (isFinite(expiresMs))
          cookie.expires = expiresMs / 1000;
        break;
      case 'max-age':
        const maxAgeSec = parseInt(value, 10);
        if (isFinite(maxAgeSec))
          cookie.expires = Date.now() / 1000 + maxAgeSec;
        break;
      case 'domain':
        cookie.domain = value || '';
        break;
      case 'path':
        cookie.path = value || '';
        break;
      case 'secure':
        cookie.secure = true;
        break;
      case 'httponly':
        cookie.httpOnly = true;
        break;
    }
  }
  return cookie;
}

function serializeFormData(data: any, headers: { [name: string]: string }): Buffer {
  const contentType = headers['content-type'] || 'application/json';
  if (contentType === 'application/json') {
    const json = JSON.stringify(data);
    headers['content-type'] ??= contentType;
    return Buffer.from(json, 'utf8');
  } else if (contentType === 'application/x-www-form-urlencoded') {
    const searchParams = new URLSearchParams();
    for (const [name, value] of Object.entries(data))
      searchParams.append(name, String(value));
    return Buffer.from(searchParams.toString(), 'utf8');
  } else if (contentType === 'multipart/form-data') {
    const formData = new MultipartFormData();
    for (const [name, value] of Object.entries(data)) {
      if (isFilePayload(value)) {
        const payload = value as types.FilePayload;
        formData.addFileField(name, payload);
      } else if (value !== undefined) {
        formData.addField(name, String(value));
      }
    }
    headers['content-type'] = formData.contentTypeHeader();
    return formData.finish();
  } else {
    throw new Error(`Cannot serialize data using content type: ${contentType}`);
  }
}
