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

import type * as playwright from 'playwright-core';
import type { RouteEntry } from '../context';

const route = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_route',
    title: 'Mock network requests',
    description: 'Set up a route to mock network requests matching a URL pattern',
    inputSchema: z.object({
      pattern: z.string().describe('URL pattern to match (e.g., "**/api/users", "**/*.{png,jpg}")'),
      status: z.number().optional().describe('HTTP status code to return (default: 200)'),
      body: z.string().optional().describe('Response body (text or JSON string)'),
      contentType: z.string().optional().describe('Content-Type header (e.g., "application/json", "text/html")'),
      headers: z.array(z.string()).optional().describe('Headers to add in "Name: Value" format'),
      removeHeaders: z.string().optional().describe('Comma-separated list of header names to remove from request'),
    }),
    type: 'action',
  },

  handle: async (context, params, response) => {
    const addHeaders = params.headers ? Object.fromEntries(params.headers.map(h => {
      const colonIndex = h.indexOf(':');
      return [h.substring(0, colonIndex).trim(), h.substring(colonIndex + 1).trim()];
    })) : undefined;
    const removeHeaders = params.removeHeaders ? params.removeHeaders.split(',').map(h => h.trim()) : undefined;

    const handler = async (route: playwright.Route) => {
      // If we have a body or status, fulfill with mock response
      if (params.body !== undefined || params.status !== undefined) {
        await route.fulfill({
          status: params.status ?? 200,
          contentType: params.contentType,
          body: params.body,
        });
        return;
      }

      // Otherwise, modify headers and continue
      const headers = { ...route.request().headers() };
      if (addHeaders) {
        for (const [key, value] of Object.entries(addHeaders))
          headers[key] = value as string;
      }
      if (removeHeaders) {
        for (const header of removeHeaders)
          delete headers[header.toLowerCase()];
      }
      await route.continue({ headers });
    };

    const entry: RouteEntry = {
      pattern: params.pattern,
      status: params.status,
      body: params.body,
      contentType: params.contentType,
      addHeaders,
      removeHeaders,
      handler,
    };

    await context.addRoute(entry);
    response.addTextResult(`Route added for pattern: ${params.pattern}`);
    response.addCode(`await page.context().route('${params.pattern}', async route => { /* route handler */ });`);
  },
});

const routeList = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_route_list',
    title: 'List network routes',
    description: 'List all active network routes',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async (context, params, response) => {
    const routes = context.routes();
    if (routes.length === 0) {
      response.addTextResult('No active routes');
      return;
    }

    const lines: string[] = [];
    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      const details: string[] = [];
      if (route.status !== undefined)
        details.push(`status=${route.status}`);
      if (route.body !== undefined)
        details.push(`body=${route.body.length > 50 ? route.body.substring(0, 50) + '...' : route.body}`);
      if (route.contentType)
        details.push(`contentType=${route.contentType}`);
      if (route.addHeaders)
        details.push(`addHeaders=${JSON.stringify(route.addHeaders)}`);
      if (route.removeHeaders)
        details.push(`removeHeaders=${route.removeHeaders.join(',')}`);

      const detailsStr = details.length ? ` (${details.join(', ')})` : '';
      lines.push(`${i + 1}. ${route.pattern}${detailsStr}`);
    }
    response.addTextResult(lines.join('\n'));
  },
});

const unroute = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_unroute',
    title: 'Remove network routes',
    description: 'Remove network routes matching a pattern (or all routes if no pattern specified)',
    inputSchema: z.object({
      pattern: z.string().optional().describe('URL pattern to unroute (omit to remove all routes)'),
    }),
    type: 'action',
  },

  handle: async (context, params, response) => {
    const removed = await context.removeRoute(params.pattern);
    if (params.pattern)
      response.addTextResult(`Removed ${removed} route(s) for pattern: ${params.pattern}`);
    else
      response.addTextResult(`Removed all ${removed} route(s)`);
  },
});

export default [
  route,
  routeList,
  unroute,
];
