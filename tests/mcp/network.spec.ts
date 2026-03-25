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
      ref: 'e2',
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
    arguments: { element: 'Click me button', ref: 'e2' },
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

test('browser_network_requests saves file to output directory', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir },
  });

  server.setContent('/', `<script>fetch('/api')</script>`, 'text/html');
  server.setContent('/api', '{}', 'application/json');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  await client.callTool({
    name: 'browser_network_requests',
    arguments: { filename: 'network.txt' },
  });

  // The file should be saved in the output directory, not in cwd.
  const networkFile = path.join(outputDir, 'network.txt');
  expect(fs.existsSync(networkFile)).toBe(true);
  const content = fs.readFileSync(networkFile, 'utf-8');
  expect(content).toContain(`${server.PREFIX}/api`);
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
      ref: 'e2',
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
