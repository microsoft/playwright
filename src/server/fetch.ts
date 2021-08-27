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
import * as http from 'http';
import * as https from 'https';
import { BrowserContext } from './browserContext';
import * as types from './types';

export async function playwrightFetch(context: BrowserContext, params: types.FetchOptions): Promise<{fetchResponse?: types.FetchResponse, error?: string}> {
  try {
    const headers: { [name: string]: string } = {};
    if (params.headers) {
      for (const [name, value] of Object.entries(params.headers))
        headers[name.toLowerCase()] = value;
    }
    headers['user-agent'] ??= context._options.userAgent || context._browser.userAgent();
    headers['accept'] ??= '*/*';
    headers['accept-encoding'] ??= 'gzip,deflate';

    if (headers['cookie'] === undefined) {
      const cookies = await context.cookies(params.url);
      if (cookies.length) {
        const valueArray = cookies.map(c => `${c.name}=${c.value}`);
        headers['cookie'] = valueArray.join('; ');
      }
    }
    if (!params.method)
      params.method = 'GET';
    let agent;
    if (context._options.proxy) {
      // TODO: support bypass proxy
      const proxyOpts = url.parse(context._options.proxy.server);
      if (context._options.proxy.username)
        proxyOpts.auth = `${context._options.proxy.username}:${context._options.proxy.password || ''}`;
      agent = new HttpsProxyAgent(proxyOpts);
    }

    // TODO(https://github.com/microsoft/playwright/issues/8381): set user agent
    const {fetchResponse, setCookie} = await sendRequest(new URL(params.url), {
      method: params.method,
      headers: headers,
      agent,
      maxRedirects: 20
    }, params.postData);
    if (setCookie)
      await updateCookiesFromHeader(context, fetchResponse.url, setCookie);
    return { fetchResponse };
  } catch (e) {
    return { error: String(e) };
  }
}

async function updateCookiesFromHeader(context: BrowserContext, responseUrl: string, setCookie: string[]) {
  const url = new URL(responseUrl);
  // https://datatracker.ietf.org/doc/html/rfc6265#section-5.1.4
  const defaultPath = '/' + url.pathname.split('/').slice(0, -1).join('/');
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

type Response = {
  fetchResponse: types.FetchResponse,
  setCookie?: string[]
};

async function sendRequest(url: URL, options: http.RequestOptions & { maxRedirects: number }, postData?: Buffer): Promise<Response>{
  return new Promise<Response>((fulfill, reject) => {
    const requestConstructor: ((url: URL, options: http.RequestOptions, callback?: (res: http.IncomingMessage) => void) => http.ClientRequest)
      = (url.protocol === 'https:' ? https : http).request;
    const request = requestConstructor(url, options, response => {
      if (redirectStatus.includes(response.statusCode!)) {
        if (!options.maxRedirects) {
          reject(new Error('Max redirect count exceeded'));
          request.abort();
          return;
        }
        const redirectOptions: http.RequestOptions & { maxRedirects: number } = {
          method: options.method,
          headers: { ...options.headers },
          agent: options.agent,
          maxRedirects: options.maxRedirects - 1,
        };

        // HTTP-redirect fetch step 13 (https://fetch.spec.whatwg.org/#http-redirect-fetch)
        const status = response.statusCode!;
        const method = redirectOptions.method!;
        if ((status === 301 || status === 302) && method === 'POST' ||
             status === 303 && !['GET', 'HEAD'].includes(method)) {
          redirectOptions.method = 'GET';
          postData = undefined;
          delete redirectOptions.headers?.[`content-encoding`];
          delete redirectOptions.headers?.[`content-language`];
          delete redirectOptions.headers?.[`content-location`];
          delete redirectOptions.headers?.[`content-type`];
        }

        // TODO: set-cookie from response, add cookie from the context.

        // HTTP-redirect fetch step 4: If locationURL is null, then return response.
        if (response.headers.location) {
          const locationURL = new URL(response.headers.location, url);
          fulfill(sendRequest(locationURL, redirectOptions, postData));
          request.abort();
          return;
        }
      }
      const chunks: Buffer[] = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(chunks);
        fulfill({
          fetchResponse: {
            url: response.url || url.toString(),
            status: response.statusCode || 0,
            statusText: response.statusMessage || '',
            headers: flattenHeaders(response.headers),
            body
          },
          setCookie: response.headers['set-cookie']
        });
      });
      response.on('error',reject);
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
