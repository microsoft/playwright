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

import { z } from '../../sdk/bundle';
import { defineTabTool } from './tool';

import type * as playwright from 'playwright-core';
import type { Response } from '../response';

const requests = defineTabTool({
  capability: 'core',

  schema: {
    name: 'browser_network_requests',
    title: 'List network requests',
    description: 'Returns all network requests since loading the page',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const requests = tab.requests();
    [...requests.entries()].forEach(([req, res]) => response.addResult(renderRequest(req, res)));
  },
});

const requestDetails = defineTabTool({
  capability: 'core',

  schema: {
    name: 'browser_network_request_details',
    title: 'Get network request details',
    description: 'Returns detailed information about a specific network request by URL',
    inputSchema: z.object({
      url: z.string().describe('The URL of the request to get details for'),
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const requests = tab.requests();
    let foundRequest = false;

    for (const [req, res] of requests.entries()) {
      if (req.url() === params.url) {
        foundRequest = true;
        await renderRequestDetails(req, res, response);
        break;
      }
    }

    if (!foundRequest) {
      response.addError(`No request found with URL: ${params.url}`);
    }
  },
});

function renderRequest(request: playwright.Request, response: playwright.Response | null) {
  const result: string[] = [];
  result.push(`[${request.method().toUpperCase()}] ${request.url()}`);
  if (response)
    result.push(`=> [${response.status()}] ${response.statusText()}`);
  return result.join(' ');
}

async function renderRequestDetails(request: playwright.Request, response: playwright.Response | null, responseHandler: Response) {
  const details: string[] = [];

  details.push('=== REQUEST ===');
  details.push(`URL: ${request.url()}`);
  details.push(`Method: ${request.method()}`);
  details.push(`Resource Type: ${request.resourceType()}`);

  details.push('\n=== REQUEST HEADERS ===');
  const reqHeaders = await request.allHeaders();
  for (const [key, value] of Object.entries(reqHeaders)) {
    details.push(`${key}: ${value}`);
  }

  const postData = request.postData();
  if (postData) {
    details.push('\n=== REQUEST BODY ===');
    try {
      const parsed = JSON.parse(postData);
      details.push(JSON.stringify(parsed, null, 2));
    } catch {
      details.push(postData);
    }
  }

  if (response) {
    details.push('\n=== RESPONSE ===');
    details.push(`Status: ${response.status()} ${response.statusText()}`);
    details.push(`OK: ${response.ok()}`);

    details.push('\n=== RESPONSE HEADERS ===');
    const resHeaders = await response.allHeaders();
    for (const [key, value] of Object.entries(resHeaders)) {
      details.push(`${key}: ${value}`);
    }

    try {
      const contentType = resHeaders['content-type'] || '';
      if (contentType.includes('application/json') || contentType.includes('text/')) {
        details.push('\n=== RESPONSE BODY ===');
        const body = await response.text();
        if (contentType.includes('application/json')) {
          try {
            const parsed = JSON.parse(body);
            details.push(JSON.stringify(parsed, null, 2));
          } catch {
            details.push(body);
          }
        } else {
          details.push(body);
        }
      }
    } catch (error) {
      details.push(`\n=== RESPONSE BODY ERROR ===`);
      details.push(`Could not retrieve response body: ${error}`);
    }
  } else {
    details.push('\n=== NO RESPONSE ===');
    details.push('Request has not received a response yet or failed');
  }

  responseHandler.addResult(details.join('\n'));
}

export default [
  requests,
  requestDetails,
];
