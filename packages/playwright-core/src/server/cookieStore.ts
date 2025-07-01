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

import { isLocalHostname, kMaxCookieExpiresDateInSeconds } from './network';

import type * as channels from '@protocol/channels';

export class Cookie {
  private _raw: channels.NetworkCookie;
  constructor(data: channels.NetworkCookie) {
    this._raw = data;
  }

  name(): string {
    return this._raw.name;
  }

  // https://datatracker.ietf.org/doc/html/rfc6265#section-5.4
  matches(url: URL): boolean {
    if (this._raw.secure && (url.protocol !== 'https:' && !isLocalHostname(url.hostname)))
      return false;
    if (!domainMatches(url.hostname, this._raw.domain))
      return false;
    if (!pathMatches(url.pathname, this._raw.path))
      return false;
    return true;
  }

  equals(other: Cookie) {
    return this._raw.name === other._raw.name &&
      this._raw.domain === other._raw.domain &&
      this._raw.path === other._raw.path;
  }

  networkCookie(): channels.NetworkCookie {
    return this._raw;
  }

  updateExpiresFrom(other: Cookie) {
    this._raw.expires = other._raw.expires;
  }

  expired() {
    if (this._raw.expires === -1)
      return false;
    return this._raw.expires * 1000 < Date.now();
  }
}

export class CookieStore {
  private readonly _nameToCookies: Map<string, Set<Cookie>> = new Map();

  addCookies(cookies: channels.NetworkCookie[]) {
    for (const cookie of cookies)
      this._addCookie(new Cookie(cookie));
  }

  cookies(url: URL): channels.NetworkCookie[] {
    const result = [];
    for (const cookie of this._cookiesIterator()) {
      if (cookie.matches(url))
        result.push(cookie.networkCookie());
    }
    return result;
  }

  allCookies(): channels.NetworkCookie[] {
    const result = [];
    for (const cookie of this._cookiesIterator())
      result.push(cookie.networkCookie());
    return result;
  }

  private _addCookie(cookie: Cookie) {
    let set = this._nameToCookies.get(cookie.name());
    if (!set) {
      set = new Set();
      this._nameToCookies.set(cookie.name(), set);
    }
    // https://datatracker.ietf.org/doc/html/rfc6265#section-5.3
    for (const other of set) {
      if (other.equals(cookie))
        set.delete(other);
    }
    set.add(cookie);
    CookieStore.pruneExpired(set);
  }

  private *_cookiesIterator(): IterableIterator<Cookie> {
    for (const [name, cookies] of this._nameToCookies) {
      CookieStore.pruneExpired(cookies);
      for (const cookie of cookies)
        yield cookie;
      if (cookies.size === 0)
        this._nameToCookies.delete(name);
    }
  }

  private static pruneExpired(cookies: Set<Cookie>) {
    for (const cookie of cookies) {
      if (cookie.expired())
        cookies.delete(cookie);
    }
  }
}

type RawCookie = {
  name: string,
  value: string,
  domain?: string,
  path?: string,
  expires?: number,
  httpOnly?: boolean,
  secure?: boolean,
  sameSite?: 'Strict' | 'Lax' | 'None',
};

export function parseRawCookie(header: string): RawCookie | null {
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
  const cookie: RawCookie = {
    name,
    value,
  };
  for (let i = 1; i < pairs.length; i++) {
    const [name, value] = pairs[i];
    switch (name.toLowerCase()) {
      case 'expires':
        const expiresMs = (+new Date(value));
        // https://datatracker.ietf.org/doc/html/rfc6265#section-5.2.1
        if (isFinite(expiresMs)) {
          if (expiresMs <= 0)
            cookie.expires = 0;
          else
            cookie.expires = Math.min(expiresMs / 1000, kMaxCookieExpiresDateInSeconds);
        }
        break;
      case 'max-age':
        const maxAgeSec = parseInt(value, 10);
        if (isFinite(maxAgeSec)) {
          // From https://datatracker.ietf.org/doc/html/rfc6265#section-5.2.2
          // If delta-seconds is less than or equal to zero (0), let expiry-time
          // be the earliest representable date and time.
          if (maxAgeSec <= 0)
            cookie.expires = 0;
          else
            cookie.expires = Math.min(Date.now() / 1000 + maxAgeSec, kMaxCookieExpiresDateInSeconds);
        }
        break;
      case 'domain':
        cookie.domain = value.toLocaleLowerCase() || '';
        if (cookie.domain && !cookie.domain.startsWith('.') && cookie.domain.includes('.'))
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
      case 'samesite':
        switch (value.toLowerCase()) {
          case 'none':
            cookie.sameSite = 'None';
            break;
          case 'lax':
            cookie.sameSite = 'Lax';
            break;
          case 'strict':
            cookie.sameSite = 'Strict';
            break;
        }
        break;
    }
  }
  return cookie;
}

export function domainMatches(value: string, domain: string): boolean {
  if (value === domain)
    return true;
  // Only strict match is allowed if domain doesn't start with '.' (host-only-flag is true in the spec)
  if (!domain.startsWith('.'))
    return false;
  value = '.' + value;
  return value.endsWith(domain);
}

function pathMatches(value: string, path: string): boolean {
  if (value === path)
    return true;
  if (!value.endsWith('/'))
    value = value + '/';
  if (!path.endsWith('/'))
    path = path + '/';
  return value.startsWith(path);
}
