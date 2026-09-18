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

export function headersObjectToArray(headers: HeadersObject, separator?: string, setCookieSeparator?: string): HeadersArray {
  if (!setCookieSeparator)
    setCookieSeparator = separator;
  const result: HeadersArray = [];
  for (const name in headers) {
    const values = headers[name];
    if (values === undefined)
      continue;
    if (separator) {
      const sep = name.toLowerCase() === 'set-cookie' ? setCookieSeparator : separator;
      for (const value of values.split(sep!))
        result.push({ name, value: value.trim() });
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

export function splitSetCookieHeader(headers: HeadersArray): HeadersArray {
  const index = headers.findIndex(({ name }) => name.toLowerCase() === 'set-cookie');
  if (index === -1)
    return headers;

  const header = headers[index];
  const values = header.value.split('\n');
  if (values.length === 1)
    return headers;
  const result = headers.slice();
  result.splice(index, 1, ...values.map(value => ({ name: header.name, value })));
  return result;
}
