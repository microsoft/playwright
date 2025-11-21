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
      const lowerCaseName = name.toLowerCase();
      const sep = lowerCaseName === 'set-cookie' ? setCookieSeparator : separator;
      const splitValues = lowerCaseName === 'set-cookie' ? splitSetCookieHeader(values, sep!) : values.split(sep!);
      for (const value of splitValues)
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

function splitSetCookieHeader(value: string, separator: string): string[] {
  if (!separator || !value.includes(separator))
    return [value];
  if (separator !== ',')
    return value.split(separator);
  const result: string[] = [];
  let lastIndex = 0;
  let inExpires = false;
  const lowerValue = value.toLowerCase();
  for (let i = 0; i < value.length; ++i) {
    if (!inExpires && lowerValue.startsWith('expires=', i))
      inExpires = true;
    if (value[i] === ';')
      inExpires = false;
    if (value[i] === ',' && !inExpires && looksLikeCookieStart(value, i + 1)) {
      result.push(value.substring(lastIndex, i).trim());
      lastIndex = i + 1;
    }
  }
  result.push(value.substring(lastIndex).trim());
  return result.filter(v => v);
}

function looksLikeCookieStart(header: string, start: number): boolean {
  const rest = header.substring(start).trimStart();
  const eqIndex = rest.indexOf('=');
  if (eqIndex <= 0)
    return false;
  const semicolonIndex = rest.indexOf(';');
  if (semicolonIndex !== -1 && semicolonIndex < eqIndex)
    return false;
  const name = rest.substring(0, eqIndex).trim();
  if (!name)
    return false;
  return !/[\s;,]/.test(name);
}
