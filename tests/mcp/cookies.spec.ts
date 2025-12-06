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

test('browser_add_cookies should add cookies to context', async ({ client, server }) => {
  server.setContent('/', '<html><body>Hello</body></html>', 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_add_cookies',
    arguments: {
      cookies: [
        {
          name: 'session_token',
          value: 'abc123',
          domain: 'localhost',
          path: '/',
        },
      ],
    },
  });

  expect(result).toHaveResponse({ result: expect.stringContaining('Added 1 cookie(s)') });
});

test('browser_add_cookies should add multiple cookies', async ({ client, server }) => {
  server.setContent('/', '<html><body>Hello</body></html>', 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_add_cookies',
    arguments: {
      cookies: [
        { name: 'cookie1', value: 'value1', domain: 'localhost' },
        { name: 'cookie2', value: 'value2', domain: 'localhost' },
      ],
    },
  });

  expect(result).toHaveResponse({ result: expect.stringContaining('Added 2 cookie(s)') });
});

test('browser_get_cookies should return added cookies', async ({ client, server }) => {
  server.setContent('/', '<html><body>Hello</body></html>', 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  await client.callTool({
    name: 'browser_add_cookies',
    arguments: {
      cookies: [
        { name: 'test_cookie', value: 'test_value', domain: 'localhost' },
      ],
    },
  });

  const result = await client.callTool({
    name: 'browser_get_cookies',
    arguments: {},
  });

  expect(result).toHaveResponse({ result: expect.stringContaining('test_cookie') });
  expect(result).toHaveResponse({ result: expect.stringContaining('test_value') });
});

test('browser_clear_cookies should clear all cookies', async ({ client, server }) => {
  server.setContent('/', '<html><body>Hello</body></html>', 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  await client.callTool({
    name: 'browser_add_cookies',
    arguments: {
      cookies: [
        { name: 'cookie1', value: 'value1', domain: 'localhost' },
      ],
    },
  });

  const clearResult = await client.callTool({
    name: 'browser_clear_cookies',
    arguments: {},
  });

  expect(clearResult).toHaveResponse({ result: expect.stringContaining('Cleared all cookies') });

  const getCookiesResult = await client.callTool({
    name: 'browser_get_cookies',
    arguments: {},
  });

  expect(getCookiesResult).toHaveResponse({ result: expect.stringContaining('[]') });
});

test('browser_clear_cookies should clear cookies by name', async ({ client, server }) => {
  server.setContent('/', '<html><body>Hello</body></html>', 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  await client.callTool({
    name: 'browser_add_cookies',
    arguments: {
      cookies: [
        { name: 'keep_me', value: 'value1', domain: 'localhost' },
        { name: 'delete_me', value: 'value2', domain: 'localhost' },
      ],
    },
  });

  await client.callTool({
    name: 'browser_clear_cookies',
    arguments: { name: 'delete_me' },
  });

  const result = await client.callTool({
    name: 'browser_get_cookies',
    arguments: {},
  });

  expect(result).toHaveResponse({ result: expect.stringContaining('keep_me') });
  expect(result).not.toHaveResponse({ result: expect.stringContaining('delete_me') });
});
