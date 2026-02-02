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

import { test, expect, parseResponse } from './fixtures';

test.use({
  mcpCaps: ['network'],
});

test('browser_route mocks response with JSON body', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="fetch('/api/users').then(r => r.json()).then(d => document.body.textContent = JSON.stringify(d))">Fetch</button>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Set up a route to mock the API response
  const routeResponse = parseResponse(await client.callTool({
    name: 'browser_route',
    arguments: {
      pattern: '**/api/users',
      status: 200,
      body: JSON.stringify([{ id: 1, name: 'Alice' }]),
      contentType: 'application/json',
    },
  }));
  expect(routeResponse.result).toContain('Route added');

  // Click the button to trigger the fetch
  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Fetch button', ref: 'e2' },
  });

  // Wait for the mocked response to be rendered
  await client.callTool({
    name: 'browser_wait_for',
    arguments: { text: 'Alice' },
  });

  // Verify the mocked response was used
  expect(await client.callTool({
    name: 'browser_snapshot',
  })).toHaveResponse({
    snapshot: expect.stringContaining('Alice'),
  });
});

test('browser_route mocks response with custom status', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="fetch('/api/error').then(r => document.body.textContent = 'Status: ' + r.status)">Fetch</button>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Set up a route to return 404
  await client.callTool({
    name: 'browser_route',
    arguments: {
      pattern: '**/api/error',
      status: 404,
      body: 'Not Found',
    },
  });

  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Fetch button', ref: 'e2' },
  });

  // Wait for the status to be rendered
  await client.callTool({
    name: 'browser_wait_for',
    arguments: { text: 'Status: 404' },
  });

  expect(await client.callTool({
    name: 'browser_snapshot',
  })).toHaveResponse({
    snapshot: expect.stringContaining('Status: 404'),
  });
});

test('browser_route modifies request headers', async ({ client, server }) => {
  let receivedHeaders: Record<string, string> = {};
  server.setRoute('/api/check', (req, res) => {
    receivedHeaders = req.headers as Record<string, string>;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ received: true }));
  });

  server.setContent('/', `
    <button onclick="fetch('/api/check').then(() => document.body.textContent = 'Done')">Fetch</button>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Set up a route to add headers
  await client.callTool({
    name: 'browser_route',
    arguments: {
      pattern: '**/api/check',
      headers: ['X-Custom-Header: test-value'],
    },
  });

  const requestPromise = server.waitForRequest('/api/check');
  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Fetch button', ref: 'e2' },
  });

  await requestPromise;
  expect(receivedHeaders['x-custom-header']).toBe('test-value');
});

test('browser_route_list shows active routes', async ({ client, server }) => {
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  // Initially no routes
  const emptyList = parseResponse(await client.callTool({
    name: 'browser_route_list',
  }));
  expect(emptyList.result).toContain('No active routes');

  // Add some routes
  await client.callTool({
    name: 'browser_route',
    arguments: {
      pattern: '**/api/users',
      status: 200,
      body: '[]',
    },
  });

  await client.callTool({
    name: 'browser_route',
    arguments: {
      pattern: '**/api/posts',
      status: 201,
      contentType: 'application/json',
    },
  });

  // List routes
  const list = parseResponse(await client.callTool({
    name: 'browser_route_list',
  }));
  expect(list.result).toContain('**/api/users');
  expect(list.result).toContain('**/api/posts');
  expect(list.result).toContain('status=200');
  expect(list.result).toContain('status=201');
});

test('browser_unroute removes specific route', async ({ client, server }) => {
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  // Add routes
  await client.callTool({
    name: 'browser_route',
    arguments: { pattern: '**/api/users', status: 200 },
  });

  await client.callTool({
    name: 'browser_route',
    arguments: { pattern: '**/api/posts', status: 200 },
  });

  // Remove specific route
  const removeResponse = parseResponse(await client.callTool({
    name: 'browser_unroute',
    arguments: { pattern: '**/api/users' },
  }));
  expect(removeResponse.result).toContain('Removed 1 route');

  // Verify only one route remains
  const list = parseResponse(await client.callTool({
    name: 'browser_route_list',
  }));
  expect(list.result).not.toContain('**/api/users');
  expect(list.result).toContain('**/api/posts');
});

test('browser_unroute removes all routes', async ({ client, server }) => {
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  // Add routes
  await client.callTool({
    name: 'browser_route',
    arguments: { pattern: '**/api/users', status: 200 },
  });

  await client.callTool({
    name: 'browser_route',
    arguments: { pattern: '**/api/posts', status: 200 },
  });

  // Remove all routes
  const removeResponse = parseResponse(await client.callTool({
    name: 'browser_unroute',
    arguments: {},
  }));
  expect(removeResponse.result).toContain('Removed all 2 route');

  // Verify no routes remain
  const list = parseResponse(await client.callTool({
    name: 'browser_route_list',
  }));
  expect(list.result).toContain('No active routes');
});
