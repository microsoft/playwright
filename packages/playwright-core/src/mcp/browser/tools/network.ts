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

import { z } from '../../../mcpBundle';
import { defineTool, defineTabTool } from './tool';

import type * as playwright from '../../../..';

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
      if (!params.includeStatic && !isFetch(request) && isSuccessfulResponse(request))
        continue;
      text.push(await renderRequest(request));
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

function isSuccessfulResponse(request: playwright.Request): boolean {
  if (request.failure())
    return false;
  const response = request.existingResponse();
  return !!response && response.status() < 400;
}

export function isFetch(request: playwright.Request): boolean {
  return ['fetch', 'xhr'].includes(request.resourceType());
}

export async function renderRequest(request: playwright.Request): Promise<string> {
  const response = request.existingResponse();

  const result: string[] = [];
  result.push(`[${request.method().toUpperCase()}] ${request.url()}`);
  if (response)
    result.push(`=> [${response.status()}] ${response.statusText()}`);
  else if (request.failure())
    result.push(`=> [FAILED] ${request.failure()?.errorText ?? 'Unknown error'}`);
  return result.join(' ');
}

const networkStatus = defineTool({
  capability: 'network',

  schema: {
    name: 'browser_network_status',
    title: 'Get network status',
    description: 'Returns the current network state (online or offline)',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async (context, params, response) => {
    const browserContext = await context.ensureBrowserContext();
    const offline = await browserContext.isOffline();
    const status = offline ? 'offline' : 'online';
    response.addTextResult(`Network is currently ${status}`);
  },
});

const networkSetOffline = defineTool({
  capability: 'network',

  schema: {
    name: 'browser_network_set_offline',
    title: 'Set network offline state',
    description: 'Sets the browser network state to online or offline. When offline, all network requests will fail.',
    inputSchema: z.object({
      offline: z.boolean().describe('Set to true to simulate offline mode, false to restore network connectivity'),
    }),
    type: 'action',
  },

  handle: async (context, params, response) => {
    const browserContext = await context.ensureBrowserContext();
    await browserContext.setOffline(params.offline);
    const status = params.offline ? 'offline' : 'online';
    response.addTextResult(`Network is now ${status}`);
    response.addCode(`await page.context().setOffline(${params.offline});`);
  },
});

export default [
  requests,
  networkClear,
  networkStatus,
  networkSetOffline,
];
