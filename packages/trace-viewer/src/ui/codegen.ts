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

import type { Language } from '@isomorphic/locatorGenerators';
import type * as har from '@trace/har';

interface APIRequestCodegen {
  generatePlaywrightRequestCall(request: har.Request, body: string | undefined): string;
}

class JSCodeGen implements APIRequestCodegen {
  generatePlaywrightRequestCall(request: har.Request, body: string | undefined): string {
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
      params.push(this.prettyPrintObject(options));
    return `await page.request.${method}(${params.join(', ')});`;
  }

  private prettyPrintObject(obj: any, indent = 2, level = 0): string {
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
        `${nextSpaces}${this.prettyPrintObject(item, indent, level + 1)}`
      ).join(',\n');

      return `[\n${items}\n${spaces}]`;
    }

    // Handle regular objects
    if (Object.keys(obj).length === 0)
      return '{}';
    const spaces = ' '.repeat(level * indent);
    const nextSpaces = ' '.repeat((level + 1) * indent);

    const entries = Object.entries(obj).map(([key, value]) => {
      const formattedValue = this.prettyPrintObject(value, indent, level + 1);
      // Handle keys that need quotes
      const formattedKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ?
        key :
        `'${key}'`;
      return `${nextSpaces}${formattedKey}: ${formattedValue}`;
    }).join(',\n');

    return `{\n${entries}\n${spaces}}`;
  }
}

class PythonCodeGen implements APIRequestCodegen {
  generatePlaywrightRequestCall(request: har.Request, body: string | undefined): string {
    const url = new URL(request.url);
    const urlParam = `${url.origin}${url.pathname}`;
    const params: string[] = [`"${urlParam}"`];


    let method = request.method.toLowerCase();
    if (!['delete', 'get', 'head', 'post', 'put', 'patch'].includes(method)) {
      params.push(`method="${method}"`);
      method = 'fetch';
    }

    if (url.searchParams.size)
      params.push(`params=${this.prettyPrintObject(Object.fromEntries(url.searchParams.entries()))}`);
    if (body)
      params.push(`data=${this.prettyPrintObject(body)}`);
    if (request.headers.length)
      params.push(`headers=${this.prettyPrintObject(Object.fromEntries(request.headers.map(header => [header.name, header.value])))}`);

    const paramsString = params.length === 1 ? params[0] : `\n${params.map(p => this.indent(p, 2)).join(',\n')}\n`;
    return `await page.request.${method}(${paramsString})`;
  }

  private indent(v: string, level: number): string {
    return v.split('\n').map(s => ' '.repeat(level) + s).join('\n');
  }

  private prettyPrintObject(obj: any, indent = 2, level = 0): string {
    // Handle null and undefined
    if (obj === null)
      return 'None';
    if (obj === undefined)
      return 'None';

    // Handle primitive types
    if (typeof obj !== 'object') {
      if (typeof obj === 'string')
        return `"${obj.replaceAll('"', '\\"')}"`;
      if (typeof obj === 'boolean')
        return obj ? 'True' : 'False';
      return String(obj);
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      if (obj.length === 0)
        return '[]';
      const spaces = ' '.repeat(level * indent);
      const nextSpaces = ' '.repeat((level + 1) * indent);

      const items = obj.map(item =>
        `${nextSpaces}${this.prettyPrintObject(item, indent, level + 1)}`
      ).join(',\n');

      return `[\n${items}\n${spaces}]`;
    }

    // Handle regular objects
    if (Object.keys(obj).length === 0)
      return '{}';
    const spaces = ' '.repeat(level * indent);
    const nextSpaces = ' '.repeat((level + 1) * indent);

    const entries = Object.entries(obj).map(([key, value]) => {
      const formattedValue = this.prettyPrintObject(value, indent, level + 1);
      return `${nextSpaces}"${key}": ${formattedValue}`;
    }).join(',\n');

    return `{\n${entries}\n${spaces}}`;
  }
}

class CSharpCodeGen implements APIRequestCodegen {
  generatePlaywrightRequestCall(request: har.Request, body: string | undefined): string {
    const url = new URL(request.url);
    const urlParam = `${url.origin}${url.pathname}`;
    const options: any = {};

    const initLines: string[] = [];

    let method = request.method.toLowerCase();
    if (!['delete', 'get', 'head', 'post', 'put', 'patch'].includes(method)) {
      options.Method = method;
      method = 'fetch';
    }

    if (url.searchParams.size)
      options.Params = Object.fromEntries(url.searchParams.entries());
    if (body)
      options.Data = body;
    if (request.headers.length)
      options.Headers = Object.fromEntries(request.headers.map(header => [header.name, header.value]));

    const params = [`"${urlParam}"`];
    const hasOptions = Object.keys(options).length > 0;
    if (hasOptions)
      params.push(this.prettyPrintObject(options));

    return `${initLines.join('\n')}${initLines.length ? '\n' : ''}await request.${this.toFunctionName(method)}(${params.join(', ')});`;
  }

  private toFunctionName(method: string): string {
    return method[0].toUpperCase() + method.slice(1) + 'Async';
  }

  private indent(v: string, level: number): string {
    return v.split('\n').map(s => ' '.repeat(level) + s).join('\n');
  }

  private prettyPrintObject(obj: any, indent = 2, level = 0): string {
    // Handle null and undefined
    if (obj === null)
      return 'null';
    if (obj === undefined)
      return 'null';

    // Handle primitive types
    if (typeof obj !== 'object') {
      if (typeof obj === 'string')
        return `"${obj.replace(/"/g, '\\"')}"`;
      if (typeof obj === 'boolean')
        return obj ? 'true' : 'false';
      return String(obj);
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      if (obj.length === 0)
        return 'new object[] {}';
      const spaces = ' '.repeat(level * indent);
      const nextSpaces = ' '.repeat((level + 1) * indent);

      const items = obj.map(item =>
        `${nextSpaces}${this.prettyPrintObject(item, indent, level + 1)}`
      ).join(',\n');

      return `new object[] {\n${items}\n${spaces}}`;
    }

    // Handle regular objects
    if (Object.keys(obj).length === 0)
      return 'new {}';
    const spaces = ' '.repeat(level * indent);
    const nextSpaces = ' '.repeat((level + 1) * indent);

    const entries = Object.entries(obj).map(([key, value]) => {
      const formattedValue = this.prettyPrintObject(value, indent, level + 1);
      const formattedKey = level === 0 ? key : `["${key}"]`;
      return `${nextSpaces}${formattedKey} = ${formattedValue}`;
    }).join(',\n');

    return `new() {\n${entries}\n${spaces}}`;
  }
}

class JavaCodeGen implements APIRequestCodegen {
  generatePlaywrightRequestCall(request: har.Request, body: string | undefined): string {
    const url = new URL(request.url);
    const params = [`"${url.origin}${url.pathname}"`];

    const options: string[] = [];

    let method = request.method.toLowerCase();
    if (!['delete', 'get', 'head', 'post', 'put', 'patch'].includes(method)) {
      options.push(`setMethod("${method}")`);
      method = 'fetch';
    }

    for (const [key, value] of url.searchParams)
      options.push(`setQueryParam("${key}", "${value}")`);
    if (body)
      options.push(`setData("${body.replaceAll('"', '\\"')}")`);
    for (const header of request.headers)
      options.push(`setHeader("${header.name}", "${header.value}")`);

    if (options.length > 0)
      params.push(`RequestOptions.create()\n  .${options.join('\n  .')}\n`);
    return `request.${method}(${params.join(', ')});`;
  }
}

export function getAPIRequestCodeGen(language: Language): APIRequestCodegen {
  if (language === 'javascript')
    return new JSCodeGen();
  if (language === 'python')
    return new PythonCodeGen();
  if (language === 'csharp')
    return new CSharpCodeGen();
  if (language === 'java')
    return new JavaCodeGen();
  throw new Error('Unsupported language: ' + language);
}
