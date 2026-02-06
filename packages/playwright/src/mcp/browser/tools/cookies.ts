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

import { z } from 'playwright-core/lib/mcpBundle';
import { defineTool } from './tool';

const cookieList = defineTool({
  capability: 'storage',

  schema: {
    name: 'browser_cookie_list',
    title: 'List cookies',
    description: 'List all cookies (optionally filtered by domain/path)',
    inputSchema: z.object({
      domain: z.string().optional().describe('Filter cookies by domain'),
      path: z.string().optional().describe('Filter cookies by path'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params, response) => {
    const browserContext = await context.ensureBrowserContext();
    let cookies = await browserContext.cookies();

    if (params.domain)
      cookies = cookies.filter(c => c.domain.includes(params.domain!));
    if (params.path)
      cookies = cookies.filter(c => c.path.startsWith(params.path!));

    if (cookies.length === 0)
      response.addTextResult('No cookies found');
    else
      response.addTextResult(cookies.map(c => `${c.name}=${c.value} (domain: ${c.domain}, path: ${c.path})`).join('\n'));
    response.addCode(`await page.context().cookies();`);
  },
});

const cookieGet = defineTool({
  capability: 'storage',

  schema: {
    name: 'browser_cookie_get',
    title: 'Get cookie',
    description: 'Get a specific cookie by name',
    inputSchema: z.object({
      name: z.string().describe('Cookie name to get'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params, response) => {
    const browserContext = await context.ensureBrowserContext();
    const cookies = await browserContext.cookies();
    const cookie = cookies.find(c => c.name === params.name);

    if (!cookie)
      response.addTextResult(`Cookie '${params.name}' not found`);
    else
      response.addTextResult(`${cookie.name}=${cookie.value} (domain: ${cookie.domain}, path: ${cookie.path}, httpOnly: ${cookie.httpOnly}, secure: ${cookie.secure}, sameSite: ${cookie.sameSite})`);
    response.addCode(`await page.context().cookies();`);
  },
});

const cookieSet = defineTool({
  capability: 'storage',

  schema: {
    name: 'browser_cookie_set',
    title: 'Set cookie',
    description: 'Set a cookie with optional flags (domain, path, expires, httpOnly, secure, sameSite)',
    inputSchema: z.object({
      name: z.string().describe('Cookie name'),
      value: z.string().describe('Cookie value'),
      domain: z.string().optional().describe('Cookie domain'),
      path: z.string().optional().describe('Cookie path'),
      expires: z.number().optional().describe('Cookie expiration as Unix timestamp'),
      httpOnly: z.boolean().optional().describe('Whether the cookie is HTTP only'),
      secure: z.boolean().optional().describe('Whether the cookie is secure'),
      sameSite: z.enum(['Strict', 'Lax', 'None']).optional().describe('Cookie SameSite attribute'),
    }),
    type: 'action',
  },

  handle: async (context, params, response) => {
    const browserContext = await context.ensureBrowserContext();
    const tab = await context.ensureTab();

    // Get the current page URL to determine default domain
    const url = new URL(tab.page.url());
    const cookie: any = {
      name: params.name,
      value: params.value,
      domain: params.domain || url.hostname,
      path: params.path || '/',
    };

    if (params.expires !== undefined)
      cookie.expires = params.expires;
    if (params.httpOnly !== undefined)
      cookie.httpOnly = params.httpOnly;
    if (params.secure !== undefined)
      cookie.secure = params.secure;
    if (params.sameSite !== undefined)
      cookie.sameSite = params.sameSite;

    await browserContext.addCookies([cookie]);
    response.addCode(`await page.context().addCookies([${JSON.stringify(cookie)}]);`);
  },
});

const cookieDelete = defineTool({
  capability: 'storage',

  schema: {
    name: 'browser_cookie_delete',
    title: 'Delete cookie',
    description: 'Delete a specific cookie',
    inputSchema: z.object({
      name: z.string().describe('Cookie name to delete'),
    }),
    type: 'action',
  },

  handle: async (context, params, response) => {
    const browserContext = await context.ensureBrowserContext();
    await browserContext.clearCookies({ name: params.name });
    response.addCode(`await page.context().clearCookies({ name: '${params.name}' });`);
  },
});

const cookieClear = defineTool({
  capability: 'storage',

  schema: {
    name: 'browser_cookie_clear',
    title: 'Clear cookies',
    description: 'Clear all cookies',
    inputSchema: z.object({}),
    type: 'action',
  },

  handle: async (context, params, response) => {
    const browserContext = await context.ensureBrowserContext();
    await browserContext.clearCookies();
    response.addCode(`await page.context().clearCookies();`);
  },
});

export default [
  cookieList,
  cookieGet,
  cookieSet,
  cookieDelete,
  cookieClear,
];
