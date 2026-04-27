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
import path from 'path';

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
    expect(response.result).toMatch(new RegExp(String.raw`^\d+\. \[GET\] ${escapeRegExp(`${server.PREFIX}/json`)} => \[200\] OK$`, 'm'));
    expect(response.result).toMatch(new RegExp(String.raw`^\d+\. \[GET\] ${escapeRegExp(`${server.PREFIX}/image.png`)} => \[404\]`, 'm'));
  }

  {
    const response = parseResponse(await client.callTool({
      name: 'browser_network_requests',
      arguments: {
        static: true,
      },
    }));
    expect(response.result).toMatch(new RegExp(String.raw`^\d+\. \[GET\] ${escapeRegExp(`${server.PREFIX}/`)} => \[200\] OK$`, 'm'));
    expect(response.result).toMatch(new RegExp(String.raw`^\d+\. \[GET\] ${escapeRegExp(`${server.PREFIX}/json`)} => \[200\] OK$`, 'm'));
    expect(response.result).toMatch(new RegExp(String.raw`^\d+\. \[GET\] ${escapeRegExp(`${server.PREFIX}/image.png`)} => \[404\]`, 'm'));
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

test('browser_network_requests numbers requests with stable indexes', async ({ client, server }) => {
  server.setContent('/', `<script>
    (async () => {
      await fetch('/api/users');
      await fetch('/api/orders');
    })();
  </script>`, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Index assignment is stable across calls — the same request keeps the same number.
  const response = parseResponse(await client.callTool({
    name: 'browser_network_requests',
    arguments: { static: true },
  }));
  const lines = response.result.split('\n').filter(Boolean);
  expect(lines[0]).toMatch(/^1\. \[GET\] /);
  expect(lines).toHaveLength(3);
});

test('browser_network_request shows full request and response details', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="fetch('/api', { method: 'POST', headers: { 'X-Custom-Header': 'test-value' }, body: JSON.stringify({ key: 'value' }) })">Click me</button>
  `, 'text/html');
  server.setRoute('/api', (_req, res) => {
    res.setHeader('X-Custom-Response', 'response-value');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ name: 'John Doe' }));
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Click me button', target: 'e2' },
  });

  // Find the index of the /api request from the listing.
  const list = parseResponse(await client.callTool({
    name: 'browser_network_requests',
  }));
  const match = list.result.match(/^(\d+)\. \[POST\] [^ ]+\/api =>/m);
  expect(match).not.toBeNull();
  const index = Number(match![1]);

  const detail = parseResponse(await client.callTool({
    name: 'browser_network_request',
    arguments: { index },
  }));
  expect(detail.result).toContain(`#${index} [POST] ${server.PREFIX}/api`);
  expect(detail.result).toContain('General');
  expect(detail.result).toContain('status:    [200] OK');
  expect(detail.result).toContain('mimeType:  application/json');
  expect(detail.result).toContain('Request headers');
  expect(detail.result).toContain('x-custom-header: test-value');
  expect(detail.result).toContain('Request body');
  expect(detail.result).toContain('{"key":"value"}');
  expect(detail.result).toContain('Response headers');
  expect(detail.result).toContain('x-custom-response: response-value');

  const bodyMatch = detail.result.match(/Response body\n\s+(\S+\.json)/);
  expect(bodyMatch).not.toBeNull();
  const bodyPath = path.resolve(test.info().outputPath(), bodyMatch![1]);
  expect(fs.readFileSync(bodyPath, 'utf-8')).toBe('{"name":"John Doe"}');
});

test('browser_network_request saves binary response body to a file', async ({ client, server }) => {
  const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  server.setContent('/', `
    <button onclick="fetch('/image.png')">Click me</button>
  `, 'text/html');
  server.setRoute('/image.png', (_req, res) => {
    res.setHeader('Content-Type', 'image/png');
    res.end(pngBytes);
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Click me button', target: 'e2' },
  });

  const list = parseResponse(await client.callTool({
    name: 'browser_network_requests',
    arguments: { static: true },
  }));
  const match = list.result.match(/^(\d+)\. \[GET\] [^ ]+\/image\.png =>/m);
  expect(match).not.toBeNull();

  const detail = parseResponse(await client.callTool({
    name: 'browser_network_request',
    arguments: { index: Number(match![1]) },
  }));
  const bodyMatch = detail.result.match(/Response body\n\s+(\S+\.png)/);
  expect(bodyMatch).not.toBeNull();
  const bodyPath = path.resolve(test.info().outputPath(), bodyMatch![1]);
  expect(fs.readFileSync(bodyPath)).toEqual(pngBytes);
});

test('browser_network_request reports failed requests', async ({ client, server }) => {
  server.setContent('/', `<img src="/missing.png" />`, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const list = parseResponse(await client.callTool({
    name: 'browser_network_requests',
    arguments: { static: true },
  }));
  const match = list!.result!.match(/^(\d+)\. \[GET\] [^ ]+\/missing\.png =>/m);
  expect(match).not.toBeNull();

  const detail = parseResponse(await client.callTool({
    name: 'browser_network_request',
    arguments: { index: Number(match![1]) },
  }));
  expect(detail!.result).toContain(`#${match![1]} [GET] ${server.PREFIX}/missing.png`);
  expect(detail!.result).toContain('status:    [404]');
});

test('browser_network_request rejects out-of-range index', async ({ client, server }) => {
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_network_request',
    arguments: { index: 999 },
  });
  const parsed = parseResponse(response);
  expect(parsed!.error).toContain('Request #999 not found');
});

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
