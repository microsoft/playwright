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

import { test, expect } from './fixtures';

test('headers tool requires capability', async ({ client, startClient }) => {
  const { tools } = await client.listTools();
  expect(tools.map(tool => tool.name)).not.toContain('browser_set_headers');

  const { client: headersClient } = await startClient({ args: ['--caps=headers'] });
  const headersToolList = await headersClient.listTools();
  expect(headersToolList.tools.map(tool => tool.name)).toContain('browser_set_headers');
});

test('browser_set_headers rejects empty input', async ({ startClient }) => {
  const { client } = await startClient({ args: ['--caps=headers'] });

  const response = await client.callTool({
    name: 'browser_set_headers',
    arguments: { headers: {} },
  });

  expect(response).toHaveResponse({
    isError: true,
    result: 'Please provide at least one header to set.',
  });
});

test('browser_set_headers defers invalid headers to Playwright', async ({ startClient }) => {
  const { client } = await startClient({ args: ['--caps=headers'] });

  const response = await client.callTool({
    name: 'browser_set_headers',
    arguments: { headers: { '   ': 'value' } },
  });

  expect(response).toHaveResponse({
    isError: true,
  });
});

test('browser_set_headers persists headers across navigations', async ({ startClient, server }) => {
  server.setContent('/first', '<title>First</title>', 'text/html');
  server.setContent('/second', '<title>Second</title>', 'text/html');

  const { client } = await startClient({ args: ['--caps=headers'] });

  expect(await client.callTool({
    name: 'browser_set_headers',
    arguments: {
      headers: { 'X-Tenant-ID': 'tenant-123' },
    },
  })).toHaveResponse({
    result: 'Configured 1 header for this session.',
  });

  const firstRequestPromise = server.waitForRequest('/first');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: `${server.PREFIX}/first` },
  });
  const firstRequest = await firstRequestPromise;
  expect(firstRequest.headers['x-tenant-id']).toBe('tenant-123');

  const secondRequestPromise = server.waitForRequest('/second');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: `${server.PREFIX}/second` },
  });
  const secondRequest = await secondRequestPromise;
  expect(secondRequest.headers['x-tenant-id']).toBe('tenant-123');
});

test('browser_set_headers applies to all requests from the context', async ({ startClient, server }) => {
  server.setRoute('/page', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html><script>fetch('/api/data')</script>`);
  });
  server.setRoute('/api/data', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{}');
  });

  const { client } = await startClient({ args: ['--caps=headers'] });

  expect(await client.callTool({
    name: 'browser_set_headers',
    arguments: {
      headers: {
        'X-Tenant-ID': 'tenant-456',
        'Authorization': 'Bearer token456',
      },
    },
  })).toHaveResponse({
    result: 'Configured 2 headers for this session.',
  });

  const pageRequestPromise = server.waitForRequest('/page');
  const apiRequestPromise = server.waitForRequest('/api/data');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: `${server.PREFIX}/page` },
  });

  const [pageRequest, apiRequest] = await Promise.all([pageRequestPromise, apiRequestPromise]);

  expect(pageRequest.headers['x-tenant-id']).toBe('tenant-456');
  expect(pageRequest.headers['authorization']).toBe('Bearer token456');
  expect(apiRequest.headers['x-tenant-id']).toBe('tenant-456');
  expect(apiRequest.headers['authorization']).toBe('Bearer token456');
});
