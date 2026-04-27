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

test('browser_network_requests', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="fetch('/json')">Click me</button>
    <img src="/image.png" />
  `, 'text/html');

  server.setContent('/json', JSON.stringify({ name: 'John Doe' }), 'application/json');

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Click me button',
      target: 'e2',
    },
  });

  {
    const response = parseResponse(await client.callTool({
      name: 'browser_network_requests',
    }));
    expect(response.result).not.toContain(`[GET] ${`${server.PREFIX}/`} => [200] OK`);
    expect(response.result).toContain(`[GET] ${`${server.PREFIX}/json`} => [200] OK`);
    expect(response.result).toContain(`[GET] ${`${server.PREFIX}/image.png`} => [404]`);
  }

  {
    const response = parseResponse(await client.callTool({
      name: 'browser_network_requests',
      arguments: {
        static: true,
      },
    }));
    expect(response.result).toContain(`[GET] ${`${server.PREFIX}/`} => [200] OK`);
    expect(response.result).toContain(`[GET] ${`${server.PREFIX}/json`} => [200] OK`);
    expect(response.result).toContain(`[GET] ${`${server.PREFIX}/image.png`} => [404]`);
  }
});

test('browser_network_requests filter', async ({ client, server }) => {
  server.setContent('/', `<script>
    Promise.all([fetch('/api/users'), fetch('/api/orders'), fetch('/static/image.png')]);
  </script>`, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  {
    const response = parseResponse(await client.callTool({
      name: 'browser_network_requests',
      arguments: { filter: '/api/', static: true },
    }));
    expect(response.result).toContain(`${server.PREFIX}/api/users`);
    expect(response.result).toContain(`${server.PREFIX}/api/orders`);
    expect(response.result).not.toContain(`${server.PREFIX}/static/image.png`);
  }
});

test('browser_network_requests includes request headers', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="fetch('/api', { headers: { 'X-Custom-Header': 'test-value' } })">Click me</button>
  `, 'text/html');
  server.setContent('/api', '{}', 'application/json');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Click me button', target: 'e2' },
  });

  {
    const response = parseResponse(await client.callTool({
      name: 'browser_network_requests',
    }));
    expect(response.result).not.toContain('Request headers:');
  }

  {
    const response = parseResponse(await client.callTool({
      name: 'browser_network_requests',
      arguments: { requestHeaders: true },
    }));
    expect(response.result).toContain(`[GET] ${server.PREFIX}/api => [200] OK`);
    expect(response.result).toContain('Request headers:');
    expect(response.result).toContain('x-custom-header: test-value');
  }
});

test('browser_network_requests includes response headers', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="fetch('/api')">Click me</button>
  `, 'text/html');
  server.setRoute('/api', (_req, res) => {
    res.setHeader('X-Custom-Response', 'response-value');
    res.setHeader('Content-Type', 'application/json');
    res.end('{}');
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Click me button', target: 'e2' },
  });

  {
    const response = parseResponse(await client.callTool({
      name: 'browser_network_requests',
    }));
    expect(response.result).not.toContain('Response headers:');
  }

  {
    const response = parseResponse(await client.callTool({
      name: 'browser_network_requests',
      arguments: { responseHeaders: true },
    }));
    expect(response.result).toContain(`[GET] ${server.PREFIX}/api => [200] OK`);
    expect(response.result).toContain('Response headers:');
    expect(response.result).toContain('x-custom-response: response-value');
  }
});

test('browser_network_requests includes response body', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="fetch('/api')">Click me</button>
  `, 'text/html');
  server.setContent('/api', JSON.stringify({ name: 'John Doe' }), 'application/json');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Click me button', target: 'e2' },
  });

  {
    const response = parseResponse(await client.callTool({
      name: 'browser_network_requests',
    }));
    expect(response.result).toContain(`[GET] ${server.PREFIX}/api => [200] OK`);
    expect(response.result).not.toContain('Response body:');
  }

  {
    const response = parseResponse(await client.callTool({
      name: 'browser_network_requests',
      arguments: { responseBody: true },
    }));
    expect(response.result).toContain(`[GET] ${server.PREFIX}/api => [200] OK`);
    expect(response.result).toContain('Response body: {"name":"John Doe"}');
  }
});

test('browser_network_requests skips binary response body', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="fetch('/image.png')">Click me</button>
  `, 'text/html');
  server.setRoute('/image.png', (_req, res) => {
    res.setHeader('Content-Type', 'image/png');
    res.end(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Click me button', target: 'e2' },
  });

  const response = parseResponse(await client.callTool({
    name: 'browser_network_requests',
    arguments: { responseBody: true, static: true },
  }));
  expect(response.result).toContain(`[GET] ${server.PREFIX}/image.png => [200] OK`);
  expect(response.result).toContain('Response body: <binary data (image/png)>');
});

test('browser_network_requests includes request payload', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="fetch('/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'value' }) })">Click me</button>
  `, 'text/html');

  server.setContent('/api', '{}', 'application/json');

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Click me button',
      target: 'e2',
    },
  });

  {
    const response = parseResponse(await client.callTool({
      name: 'browser_network_requests',
    }));
    expect(response.result).toContain(`[POST] ${server.PREFIX}/api => [200] OK`);
    expect(response.result).not.toContain(`Request body:`);
  }

  {
    const response = parseResponse(await client.callTool({
      name: 'browser_network_requests',
      arguments: { requestBody: true },
    }));
    expect(response.result).toContain(`[POST] ${server.PREFIX}/api => [200] OK`);
    expect(response.result).toContain(`Request body: {"key":"value"}`);
  }
});
