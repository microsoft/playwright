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

import type * as har from '@trace/har';

export function generatePlaywrightRequestCall(request: har.Request, body: string | undefined): string {
  let method = request.method.toLowerCase();
  const url = new URL(request.url);
  const urlParam = `${url.origin}${url.pathname}`;
  const options: any = {};
  if (!['delete', 'get', 'head', 'post', 'put', 'patch'].includes(method)) {
    options.method = method;
    method = 'fetch';
  }
  if (url.searchParams.size)
    options.params = Object.fromEntries(url.searchParams.entries());
  if (body)
    options.data = body;
  if (request.headers.length)
    options.headers = Object.fromEntries(request.headers.map(header => [header.name, header.value]));

  const params = [`'${urlParam}'`];
  const hasOptions = Object.keys(options).length > 0;
  if (hasOptions)
    params.push(prettyPrintObject(options));
  return `await page.request.${method}(${params.join(', ')});`;
}

function prettyPrintObject(obj: any, indent = 2, level = 0): string {
  // Handle null and undefined
  if (obj === null)
    return 'null';
  if (obj === undefined)
    return 'undefined';

  // Handle primitive types
  if (typeof obj !== 'object') {
    if (typeof obj === 'string')
      return `'${obj}'`;
    return String(obj);
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    if (obj.length === 0)
      return '[]';
    const spaces = ' '.repeat(level * indent);
    const nextSpaces = ' '.repeat((level + 1) * indent);

    const items = obj.map(item =>
      `${nextSpaces}${prettyPrintObject(item, indent, level + 1)}`
    ).join(',\n');

    return `[\n${items}\n${spaces}]`;
  }

  // Handle regular objects
  if (Object.keys(obj).length === 0)
    return '{}';
  const spaces = ' '.repeat(level * indent);
  const nextSpaces = ' '.repeat((level + 1) * indent);

  const entries = Object.entries(obj).map(([key, value]) => {
    const formattedValue = prettyPrintObject(value, indent, level + 1);
    // Handle keys that need quotes
    const formattedKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ?
      key :
      `'${key}'`;
    return `${nextSpaces}${formattedKey}: ${formattedValue}`;
  }).join(',\n');

  return `{\n${entries}\n${spaces}}`;
}
