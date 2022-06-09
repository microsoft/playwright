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

import * as http from 'http';
import * as https from 'https';
import type { Readable, TransformCallback } from 'stream';
import { pipeline, Transform } from 'stream';
import url from 'url';
import zlib from 'zlib';
import type { HTTPCredentials } from '../../types/types';
import type * as channels from '../protocol/channels';
import { TimeoutSettings } from '../common/timeoutSettings';
import { getUserAgent } from '../common/userAgent';
import { assert, createGuid, monotonicTime } from '../utils';
import { BrowserContext } from './browserContext';
import { CookieStore, domainMatches } from './cookieStore';
import { MultipartFormData } from './formData';
import type { CallMetadata } from './instrumentation';
import { SdkObject } from './instrumentation';
import type { Playwright } from './playwright';
import type { Progress } from './progress';
import { ProgressController } from './progress';
import { Tracing } from './trace/recorder/tracing';
import type * as types from './types';
import type { HeadersArray, ProxySettings } from './types';
import { HttpsProxyAgent, SocksProxyAgent } from '../utilsBundle';

type FetchRequestOptions = {
  userAgent: string;
  extraHTTPHeaders?: HeadersArray;
  httpCredentials?: HTTPCredentials;
  proxy?: ProxySettings;
  timeoutSettings: TimeoutSettings;
  ignoreHTTPSErrors?: boolean;
  baseURL?: string;
};

export type APIRequestEvent = {
  url: URL,
  method: string,
  headers: { [name: string]: string },
  cookies: types.NameValueList,
  postData?: Buffer
};

export type APIRequestFinishedEvent = {
  requestEvent: APIRequestEvent,
  httpVersion: string;
  headers: http.IncomingHttpHeaders;
  cookies: types.NetworkCookie[];
  rawHeaders: string[];
  statusCode: number;
  statusMessage: string;
  body?: Buffer;
};

export abstract class APIRequestContext extends SdkObject {
  static Events = {
    Dispose: 'dispose',

    Request: 'request',
    RequestFinished: 'requestfinished',
  };

  readonly fetchResponses: Map<string, Buffer> = new Map();
  readonly fetchLog: Map<string, string[]> = new Map();
  protected static allInstances: Set<APIRequestContext> = new Set();

  static findResponseBody(guid: string): Buffer | undefined {
    for (const request of APIRequestContext.allInstances) {
      const body = request.fetchResponses.get(guid);
      if (body)
        return body;
    }
    return undefined;
  }

  constructor(parent: SdkObject) {
    super(parent, 'fetchRequest');
    APIRequestContext.allInstances.add(this);
  }

  protected _disposeImpl() {
    APIRequestContext.allInstances.delete(this);
    this.fetchResponses.clear();
    this.fetchLog.clear();
    this.emit(APIRequestContext.Events.Dispose);
  }

  disposeResponse(fetchUid: string) {
    this.fetchResponses.delete(fetchUid);
    this.fetchLog.delete(fetchUid);
  }

  abstract tracing(): Tracing;

  abstract dispose(): Promise<void>;

  abstract _defaultOptions(): FetchRequestOptions;
  abstract _addCookies(cookies: types.NetworkCookie[]): Promise<void>;
  abstract _cookies(url: URL): Promise<types.NetworkCookie[]>;
  abstract storageState(): Promise<channels.APIRequestContextStorageStateResult>;

  private _storeResponseBody(body: Buffer): string {
    const uid = createGuid();
    this.fetchResponses.set(uid, body);
    return uid;
  }

  async fetch(params: channels.APIRequestContextFetchParams, metadata: CallMetadata): Promise<Omit<types.APIResponse, 'body'> & { fetchUid: string }> {
    const headers: { [name: string]: string } = {};
    const defaults = this._defaultOptions();
    headers['user-agent'] = defaults.userAgent;
    headers['accept'] = '*/*';
    headers['accept-encoding'] = 'gzip,deflate,br';

    if (defaults.extraHTTPHeaders) {
      for (const { name, value } of defaults.extraHTTPHeaders)
        headers[name.toLowerCase()] = value;
    }

    if (params.headers) {
      for (const { name, value } of params.headers)
        headers[name.toLowerCase()] = value;
    }

    const method = params.method?.toUpperCase() || 'GET';
    const proxy = defaults.proxy;
    let agent;
    if (proxy && proxy.server !== 'per-context') {
      // TODO: support bypass proxy
      const proxyOpts = url.parse(proxy.server);
      if (proxyOpts.protocol?.startsWith('socks')) {
        agent = new SocksProxyAgent({
          host: proxyOpts.hostname,
          port: proxyOpts.port || undefined,
        });
      } else {
        if (proxy.username)
          proxyOpts.auth = `${proxy.username}:${proxy.password || ''}`;
        agent = new HttpsProxyAgent(proxyOpts);
      }
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
    if (params.ignoreHTTPSErrors || defaults.ignoreHTTPSErrors)
      options.rejectUnauthorized = false;

    const requestUrl = new URL(params.url, defaults.baseURL);
    if (params.params) {
      for (const { name, value } of params.params)
        requestUrl.searchParams.set(name, value);
    }

    let postData: Buffer | undefined;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method))
      postData = serializePostData(params, headers);
    else if (params.postData || params.jsonData || params.formData || params.multipartData)
      throw new Error(`Method ${method} does not accept post data`);
    if (postData)
      headers['content-length'] = String(postData.byteLength);
    const controller = new ProgressController(metadata, this);
    const fetchResponse = await controller.run(progress => {
      return this._sendRequest(progress, requestUrl, options, postData);
    });
    const fetchUid = this._storeResponseBody(fetchResponse.body);
    this.fetchLog.set(fetchUid, controller.metadata.log);
    if (params.failOnStatusCode && (fetchResponse.status < 200 || fetchResponse.status >= 400))
      throw new Error(`${fetchResponse.status} ${fetchResponse.statusText}`);
    return { ...fetchResponse, fetchUid };
  }

  private _parseSetCookieHeader(responseUrl: string, setCookie: string[] | undefined): types.NetworkCookie[] {
    if (!setCookie)
      return [];
    const url = new URL(responseUrl);
    // https://datatracker.ietf.org/doc/html/rfc6265#section-5.1.4
    const defaultPath = '/' + url.pathname.substr(1).split('/').slice(0, -1).join('/');
    const cookies: types.NetworkCookie[] = [];
    for (const header of setCookie) {
      // Decode cookie value?
      const cookie: types.NetworkCookie | null = parseCookie(header);
      if (!cookie)
        continue;
      // https://datatracker.ietf.org/doc/html/rfc6265#section-5.2.3
      if (!cookie.domain)
        cookie.domain = url.hostname;
      else
        assert(cookie.domain.startsWith('.'));
      if (!domainMatches(url.hostname, cookie.domain!))
        continue;
      // https://datatracker.ietf.org/doc/html/rfc6265#section-5.2.4
      if (!cookie.path || !cookie.path.startsWith('/'))
        cookie.path = defaultPath;
      cookies.push(cookie);
    }
    return cookies;
  }

  private async _updateRequestCookieHeader(url: URL, options: http.RequestOptions) {
    if (options.headers!['cookie'] !== undefined)
      return;
    const cookies = await this._cookies(url);
    if (cookies.length) {
      const valueArray = cookies.map(c => `${c.name}=${c.value}`);
      options.headers!['cookie'] = valueArray.join('; ');
    }
  }

  private async _sendRequest(progress: Progress, url: URL, options: https.RequestOptions & { maxRedirects: number, deadline: number }, postData?: Buffer): Promise<types.APIResponse>{
    await this._updateRequestCookieHeader(url, options);

    const requestCookies = (options.headers!['cookie'] as (string | undefined))?.split(';').map(p => {
      const [name, value] = p.split('=').map(v => v.trim());
      return { name, value };
    }) || [];
    const requestEvent: APIRequestEvent = {
      url,
      method: options.method!,
      headers: options.headers as { [name: string]: string },
      cookies: requestCookies,
      postData
    };
    this.emit(APIRequestContext.Events.Request, requestEvent);

    return new Promise<types.APIResponse>((fulfill, reject) => {
      const requestConstructor: ((url: URL, options: http.RequestOptions, callback?: (res: http.IncomingMessage) => void) => http.ClientRequest)
        = (url.protocol === 'https:' ? https : http).request;
      const request = requestConstructor(url, options, async response => {
        const notifyRequestFinished = (body?: Buffer) => {
          const requestFinishedEvent: APIRequestFinishedEvent = {
            requestEvent,
            httpVersion: response.httpVersion,
            statusCode: response.statusCode || 0,
            statusMessage: response.statusMessage || '',
            headers: response.headers,
            rawHeaders: response.rawHeaders,
            cookies,
            body
          };
          this.emit(APIRequestContext.Events.RequestFinished, requestFinishedEvent);
        };
        progress.log(`← ${response.statusCode} ${response.statusMessage}`);
        for (const [name, value] of Object.entries(response.headers))
          progress.log(`  ${name}: ${value}`);

        const cookies = this._parseSetCookieHeader(response.url || url.toString(), response.headers['set-cookie']) ;
        if (cookies.length)
          await this._addCookies(cookies);

        if (redirectStatus.includes(response.statusCode!)) {
          if (!options.maxRedirects) {
            reject(new Error('Max redirect count exceeded'));
            request.destroy();
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
            delete headers[`content-length`];
            delete headers[`content-location`];
            delete headers[`content-type`];
          }

          const redirectOptions: https.RequestOptions & { maxRedirects: number, deadline: number } = {
            method,
            headers,
            agent: options.agent,
            maxRedirects: options.maxRedirects - 1,
            timeout: options.timeout,
            deadline: options.deadline
          };
          // rejectUnauthorized = undefined is treated as true in node 12.
          if (options.rejectUnauthorized === false)
            redirectOptions.rejectUnauthorized = false;

          // HTTP-redirect fetch step 4: If locationURL is null, then return response.
          if (response.headers.location) {
            const locationURL = new URL(response.headers.location, url);
            notifyRequestFinished();
            fulfill(this._sendRequest(progress, locationURL, redirectOptions, postData));
            request.destroy();
            return;
          }
        }
        if (response.statusCode === 401 && !options.headers!['authorization']) {
          const auth = response.headers['www-authenticate'];
          const credentials = this._defaultOptions().httpCredentials;
          if (auth?.trim().startsWith('Basic') && credentials) {
            const { username, password } = credentials;
            const encoded = Buffer.from(`${username || ''}:${password || ''}`).toString('base64');
            options.headers!['authorization'] = `Basic ${encoded}`;
            notifyRequestFinished();
            fulfill(this._sendRequest(progress, url, options, postData));
            request.destroy();
            return;
          }
        }
        response.on('aborted', () => reject(new Error('aborted')));

        const chunks: Buffer[] = [];
        const notifyBodyFinished = () => {
          const body = Buffer.concat(chunks);
          notifyRequestFinished(body);
          fulfill({
            url: response.url || url.toString(),
            status: response.statusCode || 0,
            statusText: response.statusMessage || '',
            headers: toHeadersArray(response.rawHeaders),
            body
          });
        };

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
          // Brotli and deflate decompressors throw if the input stream is empty.
          const emptyStreamTransform = new SafeEmptyStreamTransform(notifyBodyFinished);
          body = pipeline(response, emptyStreamTransform, transform, e => {
            if (e)
              reject(new Error(`failed to decompress '${encoding}' encoding: ${e}`));
          });
        } else {
          body.on('error', reject);
        }

        body.on('data', chunk => chunks.push(chunk));
        body.on('end', notifyBodyFinished);
      });
      request.on('error', reject);

      const disposeListener = () => {
        reject(new Error('Request context disposed.'));
        request.destroy();
      };
      this.on(APIRequestContext.Events.Dispose, disposeListener);
      request.on('close', () => this.off(APIRequestContext.Events.Dispose, disposeListener));

      progress.log(`→ ${options.method} ${url.toString()}`);
      if (options.headers) {
        for (const [name, value] of Object.entries(options.headers))
          progress.log(`  ${name}: ${value}`);
      }

      if (options.deadline) {
        const rejectOnTimeout = () =>  {
          reject(new Error(`Request timed out after ${options.timeout}ms`));
          request.destroy();
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

class SafeEmptyStreamTransform extends Transform {
  private _receivedSomeData: boolean = false;
  private _onEmptyStreamCallback: () => void;

  constructor(onEmptyStreamCallback: () => void) {
    super();
    this._onEmptyStreamCallback = onEmptyStreamCallback;
  }
  override _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void {
    this._receivedSomeData = true;
    callback(null, chunk);
  }
  override _flush(callback: TransformCallback): void {
    if (this._receivedSomeData)
      callback(null);
    else
      this._onEmptyStreamCallback();
  }
}

export class BrowserContextAPIRequestContext extends APIRequestContext {
  private readonly _context: BrowserContext;

  constructor(context: BrowserContext) {
    super(context);
    this._context = context;
    context.once(BrowserContext.Events.Close, () => this._disposeImpl());
  }

  override tracing() {
    return this._context.tracing;
  }

  override async dispose() {
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

  async _addCookies(cookies: types.NetworkCookie[]): Promise<void> {
    await this._context.addCookies(cookies);
  }

  async _cookies(url: URL): Promise<types.NetworkCookie[]> {
    return await this._context.cookies(url.toString());
  }

  override async storageState(): Promise<channels.APIRequestContextStorageStateResult> {
    return this._context.storageState();
  }
}


export class GlobalAPIRequestContext extends APIRequestContext {
  private readonly _cookieStore: CookieStore = new CookieStore();
  private readonly _options: FetchRequestOptions;
  private readonly _origins: channels.OriginStorage[] | undefined;
  private readonly _tracing: Tracing;

  constructor(playwright: Playwright, options: channels.PlaywrightNewRequestOptions) {
    super(playwright);
    this.attribution.context = this;
    const timeoutSettings = new TimeoutSettings();
    if (options.timeout !== undefined)
      timeoutSettings.setDefaultTimeout(options.timeout);
    const proxy = options.proxy;
    if (proxy?.server) {
      let url = proxy?.server.trim();
      if (!/^\w+:\/\//.test(url))
        url = 'http://' + url;
      proxy.server = url;
    }
    if (options.storageState) {
      this._origins = options.storageState.origins;
      this._cookieStore.addCookies(options.storageState.cookies);
    }
    this._options = {
      baseURL: options.baseURL,
      userAgent: options.userAgent || getUserAgent(),
      extraHTTPHeaders: options.extraHTTPHeaders,
      ignoreHTTPSErrors: !!options.ignoreHTTPSErrors,
      httpCredentials: options.httpCredentials,
      proxy,
      timeoutSettings,
    };
    this._tracing = new Tracing(this, options.tracesDir);
  }

  override tracing() {
    return this._tracing;
  }

  override async dispose() {
    await this._tracing.flush();
    await this._tracing.deleteTmpTracesDir();
    this._tracing.dispose();
    this._disposeImpl();
  }

  _defaultOptions(): FetchRequestOptions {
    return this._options;
  }

  async _addCookies(cookies: types.NetworkCookie[]): Promise<void> {
    this._cookieStore.addCookies(cookies);
  }

  async _cookies(url: URL): Promise<types.NetworkCookie[]> {
    return this._cookieStore.cookies(url);
  }

  override async storageState(): Promise<channels.APIRequestContextStorageStateResult> {
    return {
      cookies: this._cookieStore.allCookies(),
      origins: this._origins || []
    };
  }
}

function toHeadersArray(rawHeaders: string[]): types.HeadersArray {
  const result: types.HeadersArray = [];
  for (let i = 0; i < rawHeaders.length; i += 2)
    result.push({ name: rawHeaders[i], value: rawHeaders[i + 1] });
  return result;
}

const redirectStatus = [301, 302, 303, 307, 308];

function parseCookie(header: string): types.NetworkCookie | null {
  const pairs = header.split(';').filter(s => s.trim().length > 0).map(p => {
    let key = '';
    let value = '';
    const separatorPos = p.indexOf('=');
    if (separatorPos === -1) {
      // If only a key is specified, the value is left undefined.
      key = p.trim();
    } else {
      // Otherwise we assume that the key is the element before the first `=`
      key = p.slice(0, separatorPos).trim();
      // And the value is the rest of the string.
      value = p.slice(separatorPos + 1).trim();
    }
    return [key, value];
  });
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
        cookie.domain = value.toLocaleLowerCase() || '';
        if (cookie.domain && !cookie.domain.startsWith('.'))
          cookie.domain = '.' + cookie.domain;
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

function isJsonParsable(value: any) {
  if (typeof value !== 'string')
    return false;
  try {
    JSON.parse(value);
    return true;
  } catch (e) {
    if (e instanceof SyntaxError)
      return false;
    else
      throw e;
  }
}

function serializePostData(params: channels.APIRequestContextFetchParams, headers: { [name: string]: string }): Buffer | undefined {
  assert((params.postData ? 1 : 0) + (params.jsonData ? 1 : 0) + (params.formData ? 1 : 0) + (params.multipartData ? 1 : 0) <= 1, `Only one of 'data', 'form' or 'multipart' can be specified`);
  if (params.jsonData !== undefined) {
    const json = isJsonParsable(params.jsonData) ? params.jsonData : JSON.stringify(params.jsonData);
    headers['content-type'] ??= 'application/json';
    return Buffer.from(json, 'utf8');
  } else if (params.formData) {
    const searchParams = new URLSearchParams();
    for (const { name, value } of params.formData)
      searchParams.append(name, value);
    headers['content-type'] ??= 'application/x-www-form-urlencoded';
    return Buffer.from(searchParams.toString(), 'utf8');
  } else if (params.multipartData) {
    const formData = new MultipartFormData();
    for (const field of params.multipartData) {
      if (field.file)
        formData.addFileField(field.name, field.file);
      else if (field.value)
        formData.addField(field.name, field.value);
    }
    headers['content-type'] ??= formData.contentTypeHeader();
    return formData.finish();
  } else if (params.postData !== undefined) {
    headers['content-type'] ??= 'application/octet-stream';
    return Buffer.from(params.postData, 'base64');
  }
  return undefined;
}
