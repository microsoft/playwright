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
