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

test('browser_cookie_list unavailable without storage capability', async ({ startClient, server }) => {
  const { client } = await startClient();
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  expect(await client.callTool({
    name: 'browser_cookie_list',
  })).toHaveResponse({
    error: 'Tool "browser_cookie_list" not found',
    isError: true,
  });
});

test('browser_cookie_list shows no cookies when empty', async ({ startClient, server, mcpBrowser }) => {
  test.skip(mcpBrowser === 'msedge', 'Edge is leaking some internal cookies');
  const { client } = await startClient({
    config: { capabilities: ['storage'] },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  const result = await client.callTool({
    name: 'browser_cookie_list',
    arguments: {},
  });

  expect(result).toHaveResponse({
    result: 'No cookies found',
  });
});

test('browser_cookie_set and browser_cookie_get', async ({ startClient, server }) => {
  const { client } = await startClient({
    config: { capabilities: ['storage'] },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  // Set a cookie
  await client.callTool({
    name: 'browser_cookie_set',
    arguments: { name: 'testCookie', value: 'testValue' },
  });

  // Get the cookie
  const getResult = await client.callTool({
    name: 'browser_cookie_get',
    arguments: { name: 'testCookie' },
  });

  expect(getResult).toHaveResponse({
    result: expect.stringContaining('testCookie=testValue'),
  });
});

test('browser_cookie_list shows cookies', async ({ startClient, server }) => {
  const { client } = await startClient({
    config: { capabilities: ['storage'] },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  await client.callTool({
    name: 'browser_cookie_set',
    arguments: { name: 'cookie1', value: 'value1' },
  });

  await client.callTool({
    name: 'browser_cookie_set',
    arguments: { name: 'cookie2', value: 'value2' },
  });

  const result = await client.callTool({
    name: 'browser_cookie_list',
    arguments: {},
  });

  expect(result).toHaveResponse({
    result: expect.stringContaining('cookie1=value1'),
  });

  expect(result).toHaveResponse({
    result: expect.stringContaining('cookie2=value2'),
  });
});

test('browser_cookie_list filters by domain', async ({ startClient, server }) => {
  const { client } = await startClient({
    config: { capabilities: ['storage'] },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  await client.callTool({
    name: 'browser_cookie_set',
    arguments: { name: 'localCookie', value: 'localValue' },
  });

  const result = await client.callTool({
    name: 'browser_cookie_list',
    arguments: { domain: 'localhost' },
  });

  expect(result).toHaveResponse({
    result: expect.stringContaining('localCookie=localValue'),
  });

  const noResult = await client.callTool({
    name: 'browser_cookie_list',
    arguments: { domain: 'nonexistent.com' },
  });

  expect(noResult).toHaveResponse({
    result: 'No cookies found',
  });
});

test('browser_cookie_get returns not found for missing cookie', async ({ startClient, server }) => {
  const { client } = await startClient({
    config: { capabilities: ['storage'] },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  const result = await client.callTool({
    name: 'browser_cookie_get',
    arguments: { name: 'nonexistent' },
  });

  expect(result).toHaveResponse({
    result: expect.stringContaining('not found'),
  });
});

test('browser_cookie_set with all options', async ({ startClient, server, mcpBrowser }) => {
  const { client } = await startClient({
    config: { capabilities: ['storage'] },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

  await client.callTool({
    name: 'browser_cookie_set',
    arguments: {
      name: 'fullCookie',
      value: 'fullValue',
      path: '/test',
      expires: futureTime,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  });

  // Verify the cookie with detailed info
  const getResult = await client.callTool({
    name: 'browser_cookie_get',
    arguments: { name: 'fullCookie' },
  });

  expect(getResult).toHaveResponse({
    result: expect.stringContaining('fullCookie=fullValue'),
  });

  expect(getResult).toHaveResponse({
    result: expect.stringContaining('httpOnly: true'),
  });

  const sameSite = process.platform === 'win32' && mcpBrowser === 'webkit' ? 'None' : 'Lax';
  expect(getResult).toHaveResponse({
    result: expect.stringContaining(`sameSite: ${sameSite}`),
  });
});

test('browser_cookie_delete removes cookie', async ({ startClient, server }) => {
  const { client } = await startClient({
    config: { capabilities: ['storage'] },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  await client.callTool({
    name: 'browser_cookie_set',
    arguments: { name: 'toDelete', value: 'deleteMe' },
  });

  // Verify it exists
  const beforeDelete = await client.callTool({
    name: 'browser_cookie_get',
    arguments: { name: 'toDelete' },
  });

  expect(beforeDelete).toHaveResponse({
    result: expect.stringContaining('toDelete=deleteMe'),
  });

  // Delete the cookie
  await client.callTool({
    name: 'browser_cookie_delete',
    arguments: { name: 'toDelete' },
  });

  // Verify it's gone
  const afterDelete = await client.callTool({
    name: 'browser_cookie_get',
    arguments: { name: 'toDelete' },
  });

  expect(afterDelete).toHaveResponse({
    result: expect.stringContaining('not found'),
  });
});

test('browser_cookie_delete for nonexistent cookie does not error', async ({ startClient, server }) => {
  const { client } = await startClient({
    config: { capabilities: ['storage'] },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  // Set a cookie to verify delete of nonexistent doesn't affect existing cookies
  await client.callTool({
    name: 'browser_cookie_set',
    arguments: { name: 'existing', value: 'value' },
  });

  // Deleting nonexistent cookie should not throw
  await client.callTool({
    name: 'browser_cookie_delete',
    arguments: { name: 'nonexistent' },
  });

  // Existing cookie should still be there
  const result = await client.callTool({
    name: 'browser_cookie_get',
    arguments: { name: 'existing' },
  });

  expect(result).toHaveResponse({
    result: expect.stringContaining('existing=value'),
  });
});

test('browser_cookie_clear removes all cookies', async ({ startClient, server }) => {
  const { client } = await startClient({
    config: { capabilities: ['storage'] },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  // Set multiple cookies
  await client.callTool({
    name: 'browser_cookie_set',
    arguments: { name: 'cookie1', value: 'value1' },
  });

  await client.callTool({
    name: 'browser_cookie_set',
    arguments: { name: 'cookie2', value: 'value2' },
  });

  // Verify they exist
  const beforeClear = await client.callTool({
    name: 'browser_cookie_list',
    arguments: {},
  });

  expect(beforeClear).toHaveResponse({
    result: expect.stringContaining('cookie1'),
  });

  // Clear all cookies
  await client.callTool({
    name: 'browser_cookie_clear',
    arguments: {},
  });

  // Verify they're all gone
  const afterClear = await client.callTool({
    name: 'browser_cookie_list',
    arguments: {},
  });

  expect(afterClear).toHaveResponse({
    result: 'No cookies found',
  });
});
