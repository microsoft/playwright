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
import nodeFetch from 'node-fetch';
import * as url from 'url';
import { BrowserContext } from './browserContext';
import * as types from './types';

export async function playwrightFetch(context: BrowserContext, params: types.FetchOptions): Promise<{fetchResponse?: types.FetchResponse, error?: string}> {
  try {
    const cookies = await context.cookies(params.url);
    const valueArray = cookies.map(c => `${c.name}=${c.value}`);
    const clientCookie = params.headers?.['cookie'];
    if (clientCookie)
      valueArray.unshift(clientCookie);
    const cookieHeader = valueArray.join('; ');
    if (cookieHeader) {
      if (!params.headers)
        params.headers = {};
      params.headers['cookie'] = cookieHeader;
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
    const response = await nodeFetch(params.url, {
      method: params.method,
      headers: params.headers,
      body: params.postData,
      agent
    });
    const body = await response.buffer();
    const setCookies = response.headers.raw()['set-cookie'];
    if (setCookies) {
      const url = new URL(response.url);
      // https://datatracker.ietf.org/doc/html/rfc6265#section-5.1.4
      const defaultPath = '/' + url.pathname.split('/').slice(0, -1).join('/');
      const cookies: types.SetNetworkCookieParam[] = [];
      for (const header of setCookies) {
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

    const headers: types.HeadersArray = [];
    for (const [name, value] of response.headers.entries())
      headers.push({ name, value });
    return {
      fetchResponse: {
        url: response.url,
        status: response.status,
        statusText: response.statusText,
        headers,
        body
      }
    };
  } catch (e) {
    return { error: String(e) };
  }
}

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
