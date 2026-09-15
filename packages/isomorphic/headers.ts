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

type HeadersArray = { name: string, value: string }[];
type HeadersObject = { [key: string]: string };

export const singleValuedHeaders = new Set([
  'authorization',
  'content-disposition',
  'content-length',
  'content-range',
  'content-type',
  'date',
  'etag',
  'expires',
  'host',
  'if-modified-since',
  'if-unmodified-since',
  'last-modified',
  'location',
  'proxy-authorization',
  'referer',
  'retry-after',
  'server',
  'user-agent',
]);

export function splitSetCookieString(values: string, separator: string): string[] {
  if (separator !== ',')
    return values.split(separator).map(v => v.trim()).filter(Boolean);
  // macOS WebKit joins Set-Cookie headers with ', '.
  // However, cookie 'Expires' attribute values contain commas (e.g. 'Expires=Wed, 21 Oct 2026 07:28:00 GMT').
  // We split by comma only when it is not part of an Expires attribute.
  const cookies: string[] = [];
  let current = '';
  for (let i = 0; i < values.length; i++) {
    if (values[i] === ',') {
      if (/Expires=[^;]*$/i.test(current)) {
        current += ',';
        continue;
      }
      if (current.trim())
        cookies.push(current.trim());
      current = '';
    } else {
      current += values[i];
    }
  }
  if (current.trim())
    cookies.push(current.trim());
  return cookies;
}

export function headersObjectToArray(headers: HeadersObject, separator?: string, setCookieSeparator?: string): HeadersArray {
  if (!setCookieSeparator)
    setCookieSeparator = separator;
  const result: HeadersArray = [];
  for (const name in headers) {
    const values = headers[name];
    if (values === undefined)
      continue;
    const lowerName = name.toLowerCase();
    if (separator) {
      if (lowerName === 'set-cookie') {
        const cookies = splitSetCookieString(values, setCookieSeparator);
        for (const cookie of cookies)
          result.push({ name, value: cookie });
      } else if (singleValuedHeaders.has(lowerName)) {
        result.push({ name, value: values.trim() });
      } else {
        for (const value of values.split(separator))
          result.push({ name, value: value.trim() });
      }
    } else {
      result.push({ name, value: values });
    }
  }
  return result;
}

export function headersArrayToObject(headers: HeadersArray, lowerCase: boolean): HeadersObject {
  const result: HeadersObject = {};
  for (const { name, value } of headers)
    result[lowerCase ? name.toLowerCase() : name] = value;
  return result;
}
