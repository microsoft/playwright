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

import { z } from '../../mcpBundle';
import { defineTool, defineTabTool } from './tool';

import type * as playwright from '../../..';

const requests = defineTabTool({
  capability: 'core',

  schema: {
    name: 'browser_network_requests',
    title: 'List network requests',
    description: 'Returns all network requests since loading the page',
    inputSchema: z.object({
      static: z.boolean().default(false).describe('Whether to include successful static resources like images, fonts, scripts, etc. Defaults to false.'),
      requestBody: z.boolean().default(false).describe('Whether to include request body. Defaults to false.'),
      requestHeaders: z.boolean().default(false).describe('Whether to include request headers. Defaults to false.'),
      filter: z.string().optional().describe('Only return requests whose URL matches this regexp (e.g. "/api/.*user").'),
      filename: z.string().optional().describe('Filename to save the network requests to. If not provided, requests are returned as text.'),
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const requests = await tab.requests();
    const filter = params.filter ? new RegExp(params.filter) : undefined;
    const text: string[] = [];
    for (const request of requests) {
      if (!params.static && !isFetch(request) && isSuccessfulResponse(request))
        continue;
      if (filter) {
        filter.lastIndex = 0;
        if (!filter.test(request.url()))
          continue;
      }
      text.push(await renderRequest(request, params.requestBody, params.requestHeaders));
    }
    const template = { prefix: 'network', ext: 'log', suggestedFilename: params.filename };
    if (params.filename) {
      const resolvedFile = await response.resolveOutputFile(template, 'Network');
      await response.addFileResult(resolvedFile, text.join('\n'));
    } else {
      await response.addResult('Network', text.join('\n'), template);
    }
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

export async function renderRequest(request: playwright.Request, includeBody = false, includeHeaders = false): Promise<string> {
  const response = request.existingResponse();

  const result: string[] = [];
  result.push(`[${request.method().toUpperCase()}] ${request.url()}`);
  if (response)
    result.push(` => [${response.status()}] ${response.statusText()}`);
  else if (request.failure())
    result.push(` => [FAILED] ${request.failure()?.errorText ?? 'Unknown error'}`);
  if (includeHeaders) {
    const headers = request.headers();
    const headerLines = Object.entries(headers).map(([k, v]) => `    ${k}: ${v}`).join('\n');
    if (headerLines)
      result.push(`\n  Request headers:\n${headerLines}`);
  }
  if (includeBody) {
    const postData = request.postData();
    if (postData)
      result.push(`\n  Request body: ${postData}`);
  }
  return result.join('');
}

const networkStateSet = defineTool({
  capability: 'network',

  schema: {
    name: 'browser_network_state_set',
    title: 'Set network state',
    description: 'Sets the browser network state to online or offline. When offline, all network requests will fail.',
    inputSchema: z.object({
      state: z.enum(['online', 'offline']).describe('Set to "offline" to simulate offline mode, "online" to restore network connectivity'),
    }),
    type: 'action',
  },

  handle: async (context, params, response) => {
    const browserContext = await context.ensureBrowserContext();
    const offline = params.state === 'offline';
    await browserContext.setOffline(offline);
    response.addTextResult(`Network is now ${params.state}`);
    response.addCode(`await page.context().setOffline(${offline});`);
  },
});

export default [
  requests,
  networkClear,
  networkStateSet,
];
