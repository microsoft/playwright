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
import { monotonicTime } from '../utils/utils';

export async function playwrightFetch(context: BrowserContext, params: types.FetchOptions): Promise<{fetchResponse?: Omit<types.FetchResponse, 'body'> & { fetchUid: string }, error?: string}> {
  try {
    const headers: { [name: string]: string } = {};
    if (params.headers) {
      for (const [name, value] of Object.entries(params.headers))
        headers[name.toLowerCase()] = value;
    }
    headers['user-agent'] ??= context._options.userAgent || context._browser.userAgent();
    headers['accept'] ??= '*/*';
    headers['accept-encoding'] ??= 'gzip,deflate,br';

    if (context._options.extraHTTPHeaders) {
      for (const {name, value} of context._options.extraHTTPHeaders)
        headers[name.toLowerCase()] = value;
    }

    const method = params.method?.toUpperCase() || 'GET';
    const proxy = context._options.proxy || context._browser.options.proxy;
    let agent;
    if (proxy) {
      // TODO: support bypass proxy
      const proxyOpts = url.parse(proxy.server);
      if (proxy.username)
        proxyOpts.auth = `${proxy.username}:${proxy.password || ''}`;
      agent = new HttpsProxyAgent(proxyOpts);
    }

    const timeout = context._timeoutSettings.timeout(params);
    const deadline = monotonicTime() + timeout;

    const options: https.RequestOptions & { maxRedirects: number, deadline: number } = {
      method,
      headers,
      agent,
      maxRedirects: 20,
      timeout,
      deadline
    };
    // rejectUnauthorized = undefined is treated as true in node 12.
    if (context._options.ignoreHTTPSErrors)
      options.rejectUnauthorized = false;

    const fetchResponse = await sendRequest(context, new URL(params.url, context._options.baseURL), options, params.postData);
    const fetchUid = context.storeFetchResponseBody(fetchResponse.body);
    return { fetchResponse: { ...fetchResponse, fetchUid } };
  } catch (e) {
    return { error: String(e) };
  }
}

async function updateCookiesFromHeader(context: BrowserContext, responseUrl: string, setCookie: string[]) {
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
    await context.addCookies(cookies);
}

async function updateRequestCookieHeader(context: BrowserContext, url: URL, options: http.RequestOptions) {
  if (options.headers!['cookie'] !== undefined)
    return;
  const cookies = await context.cookies(url.toString());
  if (cookies.length) {
    const valueArray = cookies.map(c => `${c.name}=${c.value}`);
    options.headers!['cookie'] = valueArray.join('; ');
  }
}

async function sendRequest(context: BrowserContext, url: URL, options: https.RequestOptions & { maxRedirects: number, deadline: number }, postData?: Buffer): Promise<types.FetchResponse>{
  await updateRequestCookieHeader(context, url, options);
  return new Promise<types.FetchResponse>((fulfill, reject) => {
    const requestConstructor: ((url: URL, options: http.RequestOptions, callback?: (res: http.IncomingMessage) => void) => http.ClientRequest)
      = (url.protocol === 'https:' ? https : http).request;
    const request = requestConstructor(url, options, async response => {
      if (response.headers['set-cookie'])
        await updateCookiesFromHeader(context, response.url || url.toString(), response.headers['set-cookie']);
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
          fulfill(sendRequest(context, locationURL, redirectOptions, postData));
          request.abort();
          return;
        }
      }
      if (response.statusCode === 401 && !options.headers!['authorization']) {
        const auth = response.headers['www-authenticate'];
        const credentials = context._options.httpCredentials;
        if (auth?.trim().startsWith('Basic ') && credentials) {
          const {username, password} = credentials;
          const encoded = Buffer.from(`${username || ''}:${password || ''}`).toString('base64');
          options.headers!['authorization'] = `Basic ${encoded}`;
          fulfill(sendRequest(context, url, options, postData));
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
    if (postData)
      request.write(postData);
    request.end();
  });
}

function toHeadersArray(rawHeaders: string[]): types.HeadersArray {
  const result: types.HeadersArray = [];
  for (let i = 0; i < rawHeaders.length; i += 2)
    result.push({ name: rawHeaders[i], value: rawHeaders[i+1] });
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
