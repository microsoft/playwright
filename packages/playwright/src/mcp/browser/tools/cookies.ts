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

const cookieSchema = z.object({
  name: z.string().describe('Cookie name'),
  value: z.string().describe('Cookie value'),
  domain: z.string().describe('Cookie domain'),
  path: z.string().optional().describe('Cookie path, defaults to "/"'),
  expires: z.number().optional().describe('Unix timestamp in seconds when cookie expires'),
  httpOnly: z.boolean().optional().describe('Whether cookie is httpOnly'),
  secure: z.boolean().optional().describe('Whether cookie is secure'),
  sameSite: z.enum(['Strict', 'Lax', 'None']).optional().describe('Cookie sameSite attribute'),
});

const addCookies = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_add_cookies',
    title: 'Add cookies',
    description: 'Add cookies to the browser context. Useful for setting authentication tokens, session cookies, or any other cookies needed for the session.',
    inputSchema: z.object({
      cookies: z.array(cookieSchema).describe('Array of cookies to add to the browser context'),
    }),
    type: 'action',
  },

  handle: async (context, params, response) => {
    const tab = await context.ensureTab();
    const browserContext = tab.page.context();
    await browserContext.addCookies(params.cookies);

    response.addCode(`await context.addCookies(${JSON.stringify(params.cookies, null, 2)});`);
    response.addLog(`Added ${params.cookies.length} cookie(s) to the browser context`);
  },
});

const getCookies = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_get_cookies',
    title: 'Get cookies',
    description: 'Get cookies from the browser context. Returns all cookies or cookies for specific URLs.',
    inputSchema: z.object({
      urls: z.array(z.string()).optional().describe('Optional list of URLs to get cookies for. If not specified, returns all cookies.'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params, response) => {
    const tab = await context.ensureTab();
    const browserContext = tab.page.context();
    const cookies = await browserContext.cookies(params.urls);

    if (params.urls) {
      response.addCode(`await context.cookies(${JSON.stringify(params.urls)});`);
    } else {
      response.addCode(`await context.cookies();`);
    }
    response.addLog(JSON.stringify(cookies, null, 2));
  },
});

const clearCookies = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_clear_cookies',
    title: 'Clear cookies',
    description: 'Clear cookies from the browser context. Can clear all cookies or filter by name, domain, and path.',
    inputSchema: z.object({
      name: z.string().optional().describe('Optional cookie name pattern to clear'),
      domain: z.string().optional().describe('Optional domain pattern to clear cookies for'),
      path: z.string().optional().describe('Optional path pattern to clear cookies for'),
    }),
    type: 'action',
  },

  handle: async (context, params, response) => {
    const tab = await context.ensureTab();
    const browserContext = tab.page.context();
    
    const hasFilters = params.name || params.domain || params.path;
    const filterOptions: { name?: string; domain?: string; path?: string } = {};
    if (params.name) filterOptions.name = params.name;
    if (params.domain) filterOptions.domain = params.domain;
    if (params.path) filterOptions.path = params.path;

    if (hasFilters) {
      await browserContext.clearCookies(filterOptions);
      response.addCode(`await context.clearCookies(${JSON.stringify(filterOptions)});`);
      response.addLog(`Cleared cookies matching: ${JSON.stringify(filterOptions)}`);
    } else {
      await browserContext.clearCookies();
      response.addCode(`await context.clearCookies();`);
      response.addLog('Cleared all cookies');
    }
  },
});

export default [
  addCookies,
  getCookies,
  clearCookies,
];
