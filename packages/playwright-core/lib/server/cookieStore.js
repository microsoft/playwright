"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CookieStore = void 0;
exports.domainMatches = domainMatches;
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

class Cookie {
  constructor(data) {
    this._raw = void 0;
    this._raw = data;
  }
  name() {
    return this._raw.name;
  }

  // https://datatracker.ietf.org/doc/html/rfc6265#section-5.4
  matches(url) {
    if (this._raw.secure && url.protocol !== 'https:' && url.hostname !== 'localhost') return false;
    if (!domainMatches(url.hostname, this._raw.domain)) return false;
    if (!pathMatches(url.pathname, this._raw.path)) return false;
    return true;
  }
  equals(other) {
    return this._raw.name === other._raw.name && this._raw.domain === other._raw.domain && this._raw.path === other._raw.path;
  }
  networkCookie() {
    return this._raw;
  }
  updateExpiresFrom(other) {
    this._raw.expires = other._raw.expires;
  }
  expired() {
    if (this._raw.expires === -1) return false;
    return this._raw.expires * 1000 < Date.now();
  }
}
class CookieStore {
  constructor() {
    this._nameToCookies = new Map();
  }
  addCookies(cookies) {
    for (const cookie of cookies) this._addCookie(new Cookie(cookie));
  }
  cookies(url) {
    const result = [];
    for (const cookie of this._cookiesIterator()) {
      if (cookie.matches(url)) result.push(cookie.networkCookie());
    }
    return result;
  }
  allCookies() {
    const result = [];
    for (const cookie of this._cookiesIterator()) result.push(cookie.networkCookie());
    return result;
  }
  _addCookie(cookie) {
    let set = this._nameToCookies.get(cookie.name());
    if (!set) {
      set = new Set();
      this._nameToCookies.set(cookie.name(), set);
    }
    // https://datatracker.ietf.org/doc/html/rfc6265#section-5.3
    for (const other of set) {
      if (other.equals(cookie)) set.delete(other);
    }
    set.add(cookie);
    CookieStore.pruneExpired(set);
  }
  *_cookiesIterator() {
    for (const [name, cookies] of this._nameToCookies) {
      CookieStore.pruneExpired(cookies);
      for (const cookie of cookies) yield cookie;
      if (cookies.size === 0) this._nameToCookies.delete(name);
    }
  }
  static pruneExpired(cookies) {
    for (const cookie of cookies) {
      if (cookie.expired()) cookies.delete(cookie);
    }
  }
}
exports.CookieStore = CookieStore;
function domainMatches(value, domain) {
  if (value === domain) return true;
  // Only strict match is allowed if domain doesn't start with '.' (host-only-flag is true in the spec)
  if (!domain.startsWith('.')) return false;
  value = '.' + value;
  return value.endsWith(domain);
}
function pathMatches(value, path) {
  if (value === path) return true;
  if (!value.endsWith('/')) value = value + '/';
  if (!path.endsWith('/')) path = path + '/';
  return value.startsWith(path);
}