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

export async function playwrightFetch(context: BrowserContext, params: types.FetchOptions): Promise<{fetchResponse?: types.FetchResponse, error?: string}> {
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
    let agent;
    if (context._options.proxy) {
      // TODO: support bypass proxy
      const proxyOpts = url.parse(context._options.proxy.server);
      if (context._options.proxy.username)
        proxyOpts.auth = `${context._options.proxy.username}:${context._options.proxy.password || ''}`;
      agent = new HttpsProxyAgent(proxyOpts);
    }

    const fetchResponse = await sendRequest(context, new URL(params.url, context._options.baseURL), {
      method,
      headers,
      agent,
      maxRedirects: 20
    }, params.postData);
    return { fetchResponse };
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

async function sendRequest(context: BrowserContext, url: URL, options: http.RequestOptions & { maxRedirects: number }, postData?: Buffer): Promise<types.FetchResponse>{
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

        const redirectOptions: http.RequestOptions & { maxRedirects: number } = {
          method,
          headers,
          agent: options.agent,
          maxRedirects: options.maxRedirects - 1,
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
          headers: flattenHeaders(response.headers),
          body
        });
      });
      body.on('error',reject);
    });
    request.on('error', reject);
    if (postData)
      request.write(postData);
    request.end();
  });
}

function flattenHeaders(headers: http.IncomingHttpHeaders): types.HeadersArray {
  const result: types.HeadersArray = [];
  for (const [name, values] of Object.entries(headers)) {
    if (values === undefined)
      continue;
    if (typeof values === 'string') {
      result.push({name, value: values as string});
    } else {
      for (const value of values)
        result.push({name, value});
    }
  }
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
