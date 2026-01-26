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
        includeStatic: true,
      },
    }));
    expect(response.result).toContain(`[GET] ${`${server.PREFIX}/`} => [200] OK`);
    expect(response.result).toContain(`[GET] ${`${server.PREFIX}/json`} => [200] OK`);
    expect(response.result).toContain(`[GET] ${`${server.PREFIX}/image.png`} => [404]`);
  }
});

test('browser_network_mock - mock JSON API response', async ({ client, server }) => {
  server.setContent('/', `
    <button id="fetch-btn" onclick="fetch('/api/users').then(r => r.json()).then(data => document.getElementById('result').textContent = data[0].name)">Fetch users</button>
    <div id="result">Empty</div>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  // Set up the mock before clicking the button
  const mockResponse = await client.callTool({
    name: 'browser_network_mock',
    arguments: {
      urlPattern: '**/api/users',
      response: {
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 1, name: 'Mocked User' }]),
      },
    },
  });

  expect(parseResponse(mockResponse).code).toContain('page.route');

  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Fetch users button',
      ref: 'e2',
    },
  });

  // Wait for the result to appear
  await client.callTool({
    name: 'browser_wait_for',
    arguments: {
      text: 'Mocked User',
      state: 'visible',
    },
  });
});

test('browser_network_unmock - remove mock', async ({ client, server }) => {
  server.setContent('/', `
    <button id="fetch-btn" onclick="fetch('/api/test').then(r => r.json()).then(data => document.getElementById('result').textContent = data.source)">Fetch test</button>
    <div id="result">Empty</div>
  `, 'text/html');

  server.setContent('/api/test', JSON.stringify({ source: 'real-server' }), 'application/json');

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  // Set up mock
  await client.callTool({
    name: 'browser_network_mock',
    arguments: {
      urlPattern: '**/api/test',
      response: {
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ source: 'mocked' }),
      },
    },
  });

  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Fetch test button',
      ref: 'e2',
    },
  });

  await client.callTool({
    name: 'browser_wait_for',
    arguments: {
      text: 'mocked',
      state: 'visible',
    },
  });

  // Remove the mock
  const unmockResponse = await client.callTool({
    name: 'browser_network_unmock',
    arguments: {
      urlPattern: '**/api/test',
    },
  });

  expect(parseResponse(unmockResponse).code).toContain('page.unroute');
});
