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

import { kMaxCookieExpiresDateInSeconds } from './network';

import type * as channels from './channels';

export class Cookie {
  private _raw: channels.NetworkCookie;
  constructor(data: channels.NetworkCookie) {
    this._raw = data;
  }

  _name(): string {
    return this._raw.name;
  }

  _equals(other: Cookie) {
    return this._raw.name === other._raw.name &&
      this._raw.domain === other._raw.domain &&
      this._raw.path === other._raw.path;
  }

  _networkCookie(): channels.NetworkCookie {
    return this._raw;
  }

  _updateExpiresFrom(other: Cookie) {
    this._raw.expires = other._raw.expires;
  }

  _expired() {
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

  allCookies(): channels.NetworkCookie[] {
    const result = [];
    for (const cookie of this._cookiesIterator())
      result.push(cookie._networkCookie());
    return result;
  }

  removeCookies(predicate: (cookie: channels.NetworkCookie) => boolean) {
    for (const [name, cookies] of this._nameToCookies) {
      for (const cookie of cookies) {
        if (predicate(cookie._networkCookie()))
          cookies.delete(cookie);
      }
      if (cookies.size === 0)
        this._nameToCookies.delete(name);
    }
  }

  private _addCookie(cookie: Cookie) {
    let set = this._nameToCookies.get(cookie._name());
    if (!set) {
      set = new Set();
      this._nameToCookies.set(cookie._name(), set);
    }
    // https://datatracker.ietf.org/doc/html/rfc6265#section-5.3
    for (const other of set) {
      if (other._equals(cookie))
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
      if (cookie._expired())
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

// https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis#section-5.6
export function parseCookieNameValue(pair: string): { name: string, value: string } {
  const separatorPos = pair.indexOf('=');
  if (separatorPos === -1)
    return { name: '', value: pair.trim() };
  return { name: pair.slice(0, separatorPos).trim(), value: pair.slice(separatorPos + 1).trim() };
}

// https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis#section-5.8.3
export function serializeCookieNameValue(cookie: { name: string, value: string }): string {
  return cookie.name ? `${cookie.name}=${cookie.value}` : cookie.value;
}

export function parseRawCookie(header: string): RawCookie | null {
  const [nameValue, ...attributes] = header.split(';');
  const cookie: RawCookie = parseCookieNameValue(nameValue);
  if (!cookie.name && !cookie.value)
    return null;
  const pairs = attributes.filter(s => s.trim().length > 0).map(p => {
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
  let maxAgeExpires: number | undefined;
  for (const [name, value] of pairs) {
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
        // From https://datatracker.ietf.org/doc/html/rfc6265#section-5.2.2
        // If the attribute-value is not an optional "-" followed by digits, ignore the cookie-av.
        if (/^-?\d+$/.test(value)) {
          const maxAgeSec = parseInt(value, 10);
          // If delta-seconds is less than or equal to zero (0), let expiry-time
          // be the earliest representable date and time.
          if (maxAgeSec <= 0)
            maxAgeExpires = 0;
          else
            maxAgeExpires = Math.min(Date.now() / 1000 + maxAgeSec, kMaxCookieExpiresDateInSeconds);
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
  // https://datatracker.ietf.org/doc/html/rfc6265#section-5.3
  // Max-Age takes precedence over Expires, regardless of the order of attributes.
  if (maxAgeExpires !== undefined)
    cookie.expires = maxAgeExpires;
  return cookie;
}
