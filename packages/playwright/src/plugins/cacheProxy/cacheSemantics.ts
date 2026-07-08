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

import type http from 'http';

// RFC 9111 6.1 heuristically cacheable status codes, minus 206 (partial) and
// temporary redirects (302/307), which only cache with explicit freshness that
// this cache intentionally ignores.
const CACHEABLE_STATUS = new Set([200, 203, 204, 300, 301, 308, 404, 405, 410, 414, 501]);
const SEC_FETCH_DEST_STATIC = new Set(['audio', 'audioworklet', 'embed', 'font', 'image', 'manifest', 'object', 'paintworklet', 'script', 'serviceworker', 'sharedworker', 'style', 'track', 'video', 'worker', 'xslt']);

export type ProxyHeaders = [string, string][] | http.IncomingHttpHeaders;

export function isCacheableStatus(status: number): boolean {
  return CACHEABLE_STATUS.has(status);
}

export function isHardBlocked(requestHeaders: ProxyHeaders, status: number, responseHeaders: ProxyHeaders): boolean {
  if (!isCacheableStatus(status))
    return true;
  if (parseCacheControl(requestHeaders).has('no-store'))
    return true;
  if (parseCacheControl(responseHeaders).has('no-store'))
    return true;
  if (varyNames(responseHeaders).includes('*'))
    return true;
  return false;
}

export function isDefaultStorable(requestHeaders: ProxyHeaders, status: number, responseHeaders: ProxyHeaders): boolean {
  if (isHardBlocked(requestHeaders, status, responseHeaders))
    return false;
  if (isPersonalized(responseHeaders))
    return false;
  if (status === 301 || status === 308)
    return true;
  return SEC_FETCH_DEST_STATIC.has(headerValue(requestHeaders, 'sec-fetch-dest'));
}

function isPersonalized(responseHeaders: ProxyHeaders): boolean {
  if (parseCacheControl(responseHeaders).has('private'))
    return true;
  if (headerValues(responseHeaders, 'set-cookie').length)
    return true;
  const vary = varyNames(responseHeaders);
  return vary.includes('cookie') || vary.includes('authorization');
}

export function parseCacheControl(headers: ProxyHeaders): Set<string> {
  const directives = new Set<string>();
  for (const value of headerValues(headers, 'cache-control')) {
    for (const part of value.split(',')) {
      const name = part.split('=')[0].trim().toLowerCase();
      if (name)
        directives.add(name);
    }
  }
  return directives;
}

export function computeVaryFields(responseHeaders: ProxyHeaders, requestHeaders: ProxyHeaders): [string, string][] | undefined {
  const names = varyNames(responseHeaders).filter(name => name !== '*');
  if (!names.length)
    return undefined;
  return names.map(name => [name, headerValue(requestHeaders, name)]);
}

export function varyMatches(fields: [string, string][] | undefined, requestHeaders: ProxyHeaders): boolean {
  if (!fields)
    return true;
  return fields.every(([name, value]) => headerValue(requestHeaders, name) === value);
}

function varyNames(headers: ProxyHeaders): string[] {
  return headerValues(headers, 'vary').flatMap(value => value.split(',').map(name => name.trim().toLowerCase()).filter(Boolean));
}

function headerValue(headers: ProxyHeaders, name: string): string {
  return headerValues(headers, name).join(', ');
}

function headerValues(headers: ProxyHeaders, name: string): string[] {
  if (Array.isArray(headers)) {
    const result: string[] = [];
    for (const [key, value] of headers) {
      if (key.toLowerCase() === name)
        result.push(value);
    }
    return result;
  }
  const value = headers[name];
  if (value === undefined)
    return [];
  return Array.isArray(value) ? value : [value];
}
