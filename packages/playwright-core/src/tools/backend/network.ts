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

import fs from 'fs';

import * as z from 'zod';

import { getExtensionForMimeType, isTextualMimeType } from '@isomorphic/mimeType';

import { defineTool, defineTabTool } from './tool';

import type { Response as ToolResponse } from './response';
import type * as playwright from '../../..';

const requests = defineTabTool({
  capability: 'core',

  schema: {
    name: 'browser_network_requests',
    title: 'List network requests',
    description: 'Returns a numbered list of network requests since loading the page. Use browser_network_request with the number to get full details.',
    inputSchema: z.object({
      static: z.boolean().default(false).describe('Whether to include successful static resources like images, fonts, scripts, etc. Defaults to false.'),
      filter: z.string().optional().describe('Only return requests whose URL matches this regexp (e.g. "/api/.*user").'),
      filename: z.string().optional().describe('Filename to save the network requests to. If not provided, requests are returned as text.'),
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const allRequests = await tab.requests();
    const filter = params.filter ? new RegExp(params.filter) : undefined;
    const lines: string[] = [];
    for (let i = 0; i < allRequests.length; i++) {
      const request = allRequests[i];
      if (!params.static && !isFetch(request) && isSuccessfulResponse(request))
        continue;
      if (filter) {
        filter.lastIndex = 0;
        if (!filter.test(request.url()))
          continue;
      }
      lines.push(`${i + 1}. ${renderRequestLine(request)}`);
    }
    await response.addResult('Network', lines.join('\n'), { prefix: 'network', ext: 'log', suggestedFilename: params.filename });
  },
});

const REQUEST_PARTS = ['request-headers', 'request-body', 'response-headers', 'response-body'] as const;
type RequestPart = typeof REQUEST_PARTS[number];

const request = defineTabTool({
  capability: 'core',

  schema: {
    name: 'browser_network_request',
    title: 'Show network request details',
    description: 'Returns full details (headers and body) of a single network request, or a single part if `part` is set. Use the number from browser_network_requests.',
    inputSchema: z.object({
      index: z.number().int().min(1).describe('1-based index of the request, as printed by browser_network_requests.'),
      part: z.enum(REQUEST_PARTS).optional().describe('Return only this part of the request. Omit to return full details.'),
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const allRequests = await tab.requests();
    const request = allRequests[params.index - 1];
    if (!request) {
      response.addError(`Request #${params.index} not found. Use browser_network_requests to see available indexes.`);
      return;
    }
    if (params.part) {
      const partText = await renderRequestPart(request, params.part, response);
      if (partText !== undefined)
        response.addTextResult(partText);
      return;
    }
    const bodyPath = await saveResponseBody(request, response);
    response.addTextResult(renderRequestDetails(params.index, request, bodyPath));
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

export function renderRequestLine(request: playwright.Request): string {
  const response = request.existingResponse();
  let line = `[${request.method().toUpperCase()}] ${request.url()}`;
  if (response)
    line += ` => [${response.status()}] ${response.statusText()}`;
  else if (request.failure())
    line += ` => [FAILED] ${request.failure()?.errorText ?? 'Unknown error'}`;
  return line;
}

function renderRequestDetails(index: number, request: playwright.Request, responseBodyPath: string | undefined): string {
  const httpResponse = request.existingResponse();
  const responseHeaders = httpResponse?.headers();
  const lines: string[] = [];
  lines.push(`#${index} [${request.method().toUpperCase()}] ${request.url()}`);

  lines.push('');
  lines.push('  General');
  if (httpResponse)
    lines.push(`    status:    [${httpResponse.status()}] ${httpResponse.statusText()}`);
  else if (request.failure())
    lines.push(`    status:    [FAILED] ${request.failure()?.errorText ?? 'Unknown error'}`);
  const duration = computeDurationMs(request);
  if (duration !== undefined)
    lines.push(`    duration:  ${duration}ms`);
  lines.push(`    type:      ${request.resourceType()}`);
  const contentType = responseHeaders?.['content-type'];
  if (contentType)
    lines.push(`    mimeType:  ${contentType.split(';')[0].trim()}`);

  appendHeaderSection(lines, 'Request headers', request.headers());

  const postData = request.postData();
  if (postData) {
    lines.push('');
    lines.push('  Request body');
    lines.push(`    ${postData}`);
  }

  if (responseHeaders)
    appendHeaderSection(lines, 'Response headers', responseHeaders);

  if (responseBodyPath) {
    lines.push('');
    lines.push('  Response body');
    lines.push(`    ${responseBodyPath}`);
  }

  return lines.join('\n');
}

function appendHeaderSection(lines: string[], title: string, headers: Record<string, string>): void {
  const entries = Object.entries(headers);
  if (!entries.length)
    return;
  lines.push('');
  lines.push(`  ${title}`);
  for (const [k, v] of entries)
    lines.push(`    ${k}: ${v}`);
}

function computeDurationMs(request: playwright.Request): number | undefined {
  const timing = request.timing();
  if (!timing || timing.responseEnd < 0)
    return undefined;
  return Math.round(timing.responseEnd);
}

async function renderRequestPart(request: playwright.Request, part: RequestPart, response: ToolResponse): Promise<string | undefined> {
  if (part === 'request-headers')
    return renderHeaders(request.headers());
  if (part === 'request-body')
    return request.postData() ?? undefined;
  const httpResponse = request.existingResponse();
  if (!httpResponse)
    return undefined;
  if (part === 'response-headers')
    return renderHeaders(httpResponse.headers());
  // response-body
  const contentType = httpResponse.headers()['content-type'];
  if (isTextualMimeType(contentType ?? '')) {
    try {
      return await httpResponse.text();
    } catch {
      return undefined;
    }
  }
  return await saveResponseBody(request, response);
}

function renderHeaders(headers: Record<string, string>): string {
  return Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n');
}

async function saveResponseBody(request: playwright.Request, response: ToolResponse): Promise<string | undefined> {
  const httpResponse = request.existingResponse();
  if (!httpResponse)
    return undefined;
  const status = httpResponse.status();
  // Status codes that cannot have a response body per RFC 7230.
  if (status === 204 || status === 304 || (status >= 100 && status < 200))
    return undefined;
  let body: Buffer;
  try {
    body = await httpResponse.body();
  } catch {
    return undefined;
  }
  if (!body.length)
    return undefined;
  const ext = getExtensionForMimeType(httpResponse.headers()['content-type']);
  const resolved = await response.resolveClientFile({ prefix: 'response', ext }, 'Response body');
  await fs.promises.writeFile(resolved.fileName, body);
  return resolved.relativeName;
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
  request,
  networkClear,
  networkStateSet,
];
