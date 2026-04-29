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
import type { HeadersArray } from '@isomorphic/types';
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
    let hiddenStaticCount = 0;
    for (let i = 0; i < allRequests.length; i++) {
      const request = allRequests[i];
      if (!params.static && !isFetch(request) && isSuccessfulResponse(request)) {
        hiddenStaticCount++;
        continue;
      }
      if (filter) {
        filter.lastIndex = 0;
        if (!filter.test(request.url()))
          continue;
      }
      lines.push(`${i + 1}. ${renderRequestLine(request)}`);
    }
    if (hiddenStaticCount > 0) {
      const optionName = tab.context.config.skillMode ? '--static' : '"static"';
      lines.push(`\nNote: ${hiddenStaticCount} static request${hiddenStaticCount === 1 ? '' : 's'} not shown, run with ${optionName} option to see ${hiddenStaticCount === 1 ? 'it' : 'them'}.`);
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
      filename: z.string().optional().describe('Filename to save the result to. If not provided, output is returned as text.'),
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
      await renderRequestPart(request, params.part, response, params.filename);
      return;
    }
    const details = await buildRequestDetails(params.index, request);
    if (response.json && !params.filename) {
      response.setResultJSON(details);
      return;
    }
    await response.addResult('Request', renderRequestDetailsText(details, !!tab.context.config.skillMode), { prefix: 'request', ext: 'log', suggestedFilename: params.filename });
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

type RequestDetails = {
  index: number;
  method: string;
  url: string;
  resourceType: string;
  duration?: number;
  mimeType?: string;
  status?: number;
  statusText?: string;
  failure?: string;
  requestHeaders: HeadersArray;
  responseHeaders?: HeadersArray;
  hasRequestBody: boolean;
  hasResponseBody: boolean;
};

async function buildRequestDetails(index: number, request: playwright.Request): Promise<RequestDetails> {
  const httpResponse = request.existingResponse();
  const [requestHeaders, responseHeaders] = await Promise.all([
    request.headersArray(),
    httpResponse?.headersArray(),
  ]);
  const contentType = responseHeaders?.find(h => h.name.toLowerCase() === 'content-type')?.value;
  return {
    index,
    method: request.method().toUpperCase(),
    url: request.url(),
    resourceType: request.resourceType(),
    duration: computeDurationMs(request),
    mimeType: contentType ? contentType.split(';')[0].trim() : undefined,
    status: httpResponse?.status(),
    statusText: httpResponse?.statusText(),
    failure: request.failure()?.errorText,
    requestHeaders,
    responseHeaders,
    hasRequestBody: request.postData() !== null,
    hasResponseBody: canHaveResponseBody(httpResponse),
  };
}

function renderRequestDetailsText(details: RequestDetails, skillMode: boolean): string {
  const lines: string[] = [];
  lines.push(`#${details.index} [${details.method}] ${details.url}`);

  lines.push('');
  lines.push('  General');
  if (details.status !== undefined)
    lines.push(`    status:    [${details.status}] ${details.statusText}`);
  else if (details.failure)
    lines.push(`    status:    [FAILED] ${details.failure}`);
  if (details.duration !== undefined)
    lines.push(`    duration:  ${details.duration}ms`);
  lines.push(`    type:      ${details.resourceType}`);
  if (details.mimeType)
    lines.push(`    mimeType:  ${details.mimeType}`);

  appendHeaderSection(lines, 'Request headers', details.requestHeaders);

  if (details.responseHeaders)
    appendHeaderSection(lines, 'Response headers', details.responseHeaders);

  const hints: string[] = [];
  if (details.hasRequestBody)
    hints.push(partHint(skillMode, 'request-body', details.index));
  if (details.hasResponseBody)
    hints.push(partHint(skillMode, 'response-body', details.index));
  if (hints.length)
    lines.push('', ...hints);

  return lines.join('\n');
}

function partHint(skillMode: boolean, part: 'request-body' | 'response-body', index: number): string {
  const subject = part === 'request-body' ? 'request body' : 'response body';
  return skillMode
    ? `Run \`${part} ${index}\` to read the ${subject}.`
    : `Call browser_network_request with part="${part}" to read the ${subject}.`;
}

function canHaveResponseBody(httpResponse: playwright.Response | null): httpResponse is playwright.Response {
  if (!httpResponse)
    return false;
  const status = httpResponse.status();
  // Status codes that cannot have a response body per RFC 7230.
  return status !== 204 && status !== 304 && !(status >= 100 && status < 200);
}

function appendHeaderSection(lines: string[], title: string, headers: HeadersArray): void {
  if (!headers.length)
    return;
  lines.push('');
  lines.push(`  ${title}`);
  for (const { name, value } of headers)
    lines.push(`    ${name}: ${value}`);
}

function computeDurationMs(request: playwright.Request): number | undefined {
  const timing = request.timing();
  if (!timing || timing.responseEnd < 0)
    return undefined;
  return Math.round(timing.responseEnd);
}

async function renderRequestPart(request: playwright.Request, part: RequestPart, response: ToolResponse, suggestedFilename: string | undefined): Promise<void> {
  if (part === 'request-headers') {
    const headers = await request.headersArray();
    if (response.json && !suggestedFilename) {
      response.setResultJSON(headers);
      return;
    }
    await response.addResult('Request headers', renderHeaders(headers), { prefix: 'request', ext: 'txt', suggestedFilename });
    return;
  }
  if (part === 'request-body') {
    const data = request.postData();
    if (response.json && !suggestedFilename) {
      response.setResultJSON(data);
      return;
    }
    if (data !== null)
      await response.addResult('Request body', data, { prefix: 'request', ext: 'txt', suggestedFilename });
    return;
  }
  const httpResponse = request.existingResponse();
  if (!httpResponse)
    return;
  if (part === 'response-headers') {
    const headers = await httpResponse.headersArray();
    if (response.json && !suggestedFilename) {
      response.setResultJSON(headers);
      return;
    }
    await response.addResult('Response headers', renderHeaders(headers), { prefix: 'response', ext: 'txt', suggestedFilename });
    return;
  }
  // response-body
  const contentType = httpResponse.headers()['content-type'];
  if (isTextualMimeType(contentType ?? '')) {
    let text: string;
    try {
      text = await httpResponse.text();
    } catch {
      return;
    }
    if (response.json && !suggestedFilename) {
      response.setResultJSON(text);
      return;
    }
    await response.addResult('Response body', text, { prefix: 'response', ext: 'txt', suggestedFilename });
    return;
  }
  const path = await saveResponseBody(request, response, suggestedFilename);
  if (path !== undefined) {
    response.setResultJSON({ file: path });
    response.addTextResult(path);
  }
}

function renderHeaders(headers: HeadersArray): string {
  return headers.map(({ name, value }) => `${name}: ${value}`).join('\n');
}

async function saveResponseBody(request: playwright.Request, response: ToolResponse, suggestedFilename?: string): Promise<string | undefined> {
  const httpResponse = request.existingResponse();
  if (!canHaveResponseBody(httpResponse))
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
  const resolved = await response.resolveClientFile({ prefix: 'response', ext, suggestedFilename }, 'Response body');
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
