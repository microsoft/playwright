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
import { defineTabTool } from './tool';

import type * as playwright from 'playwright-core';
import type { Request } from '../../../../../playwright-core/src/client/network';

const requests = defineTabTool({
  capability: 'core',

  schema: {
    name: 'browser_network_requests',
    title: 'List network requests',
    description: 'Returns all network requests since loading the page',
    inputSchema: z.object({
      includeStatic: z.boolean().default(false).describe('Whether to include successful static resources like images, fonts, scripts, etc. Defaults to false.'),
      filename: z.string().optional().describe('Filename to save the network requests to. If not provided, requests are returned as text.'),
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const requests = await tab.requests();
    const text: string[] = [];
    for (const request of requests) {
      const rendered = await renderRequest(request, params.includeStatic);
      if (rendered)
        text.push(rendered);
    }
    await response.addResult('Network', text.join('\n'), { prefix: 'network', ext: 'log', suggestedFilename: params.filename });
  },
});

const networkClear = defineTabTool({
  capability: 'core',
  skillOnly: true,
  schema: {
    name: 'browser_network_clear',
    title: 'Clear network requests',
    description: 'Clear all network requests',
    inputSchema: z.object({}),
    type: 'readOnly',
  },
  handle: async (tab, params, response) => {
    await tab.clearRequests();
  },
});

const networkMock = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_network_mock',
    title: 'Mock network response',
    description: 'Mock a network response for a URL pattern. When a request matches the pattern, it will be fulfilled with the provided response instead of going to the network.',
    inputSchema: z.object({
      urlPattern: z.string().describe('URL pattern to match (glob pattern). Examples: "**/api/users", "https://example.com/api/**"'),
      response: z.object({
        status: z.number().default(200).describe('HTTP status code for the mocked response'),
        contentType: z.string().default('application/json').describe('Content-Type header for the response'),
        body: z.string().describe('Response body as a string. For JSON responses, provide a JSON string.'),
        headers: z.record(z.string(), z.string()).optional().describe('Additional headers to include in the response'),
      }).describe('The mock response to return'),
    }),
    type: 'action',
  },
  handle: async (tab, params, response) => {
    const headers: Record<string, string> = {
      'content-type': params.response.contentType,
      ...params.response.headers,
    };

    await tab.page.route(params.urlPattern, route => {
      void route.fulfill({
        status: params.response.status,
        contentType: params.response.contentType,
        body: params.response.body,
        headers,
      });
    });

    response.addCode(`// Mock network response for ${params.urlPattern}`);
    response.addCode(`await page.route('${params.urlPattern}', route => {`);
    response.addCode(`  route.fulfill({`);
    response.addCode(`    status: ${params.response.status},`);
    response.addCode(`    contentType: '${params.response.contentType}',`);
    response.addCode(`    body: ${JSON.stringify(params.response.body)},`);
    if (params.response.headers)
      response.addCode(`    headers: ${JSON.stringify(headers)},`);
    response.addCode(`  });`);
    response.addCode(`});`);
  },
});

const networkUnmock = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_network_unmock',
    title: 'Remove network mock',
    description: 'Remove all network mocks for a URL pattern',
    inputSchema: z.object({
      urlPattern: z.string().describe('URL pattern to unmock (must match the pattern used in browser_network_mock)'),
    }),
    type: 'action',
  },
  handle: async (tab, params, response) => {
    await tab.page.unroute(params.urlPattern);
    response.addCode(`// Remove network mock for ${params.urlPattern}`);
    response.addCode(`await page.unroute('${params.urlPattern}');`);
  },
});

async function renderRequest(request: playwright.Request, includeStatic: boolean): Promise<string | undefined> {
  const response = (request as Request)._hasResponse ? await request.response() : undefined;
  const isStaticRequest = ['document', 'stylesheet', 'image', 'media', 'font', 'script', 'manifest'].includes(request.resourceType());
  const isSuccessfulRequest = !response || response.status() < 400;

  if (isStaticRequest && isSuccessfulRequest && !includeStatic)
    return undefined;

  const result: string[] = [];
  result.push(`[${request.method().toUpperCase()}] ${request.url()}`);
  if (response)
    result.push(`=> [${response.status()}] ${response.statusText()}`);
  return result.join(' ');
}

export default [
  requests,
  networkClear,
  networkMock,
  networkUnmock,
];
