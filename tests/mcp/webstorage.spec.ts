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

test('browser_localstorage_list unavailable without storage capability', async ({ startClient, server }) => {
  const { client } = await startClient();
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  expect(await client.callTool({
    name: 'browser_localstorage_list',
  })).toHaveResponse({
    error: 'Tool "browser_localstorage_list" not found',
    isError: true,
  });
});

test('browser_localstorage_list shows no items when empty', async ({ startClient, server }) => {
  const { client } = await startClient({
    config: { capabilities: ['storage'] },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  const result = await client.callTool({
    name: 'browser_localstorage_list',
    arguments: {},
  });

  expect(result).toHaveResponse({
    result: 'No localStorage items found',
  });
});

test('browser_localstorage_set and browser_localstorage_get', async ({ startClient, server }) => {
  const { client } = await startClient({
    config: { capabilities: ['storage'] },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  // Set an item
  await client.callTool({
    name: 'browser_localstorage_set',
    arguments: { key: 'testKey', value: 'testValue' },
  });

  // Get the item
  const getResult = await client.callTool({
    name: 'browser_localstorage_get',
    arguments: { key: 'testKey' },
  });

  expect(getResult).toHaveResponse({
    result: expect.stringContaining('testKey=testValue'),
  });
});

test('browser_localstorage_list shows items', async ({ startClient, server }) => {
  const { client } = await startClient({
    config: { capabilities: ['storage'] },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  await client.callTool({
    name: 'browser_localstorage_set',
    arguments: { key: 'key1', value: 'value1' },
  });

  await client.callTool({
    name: 'browser_localstorage_set',
    arguments: { key: 'key2', value: 'value2' },
  });

  const result = await client.callTool({
    name: 'browser_localstorage_list',
    arguments: {},
  });

  expect(result).toHaveResponse({
    result: expect.stringContaining('key1=value1'),
  });

  expect(result).toHaveResponse({
    result: expect.stringContaining('key2=value2'),
  });
});

test('browser_localstorage_get returns not found for missing key', async ({ startClient, server }) => {
  const { client } = await startClient({
    config: { capabilities: ['storage'] },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  const result = await client.callTool({
    name: 'browser_localstorage_get',
    arguments: { key: 'nonexistent' },
  });

  expect(result).toHaveResponse({
    result: expect.stringContaining('not found'),
  });
});

test('browser_localstorage_delete removes item', async ({ startClient, server }) => {
  const { client } = await startClient({
    config: { capabilities: ['storage'] },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  await client.callTool({
    name: 'browser_localstorage_set',
    arguments: { key: 'toDelete', value: 'deleteMe' },
  });

  // Verify it exists
  const beforeDelete = await client.callTool({
    name: 'browser_localstorage_get',
    arguments: { key: 'toDelete' },
  });

  expect(beforeDelete).toHaveResponse({
    result: expect.stringContaining('toDelete=deleteMe'),
  });

  // Delete the item
  await client.callTool({
    name: 'browser_localstorage_delete',
    arguments: { key: 'toDelete' },
  });

  // Verify it's gone
  const afterDelete = await client.callTool({
    name: 'browser_localstorage_get',
    arguments: { key: 'toDelete' },
  });

  expect(afterDelete).toHaveResponse({
    result: expect.stringContaining('not found'),
  });
});

test('browser_localstorage_clear removes all items', async ({ startClient, server }) => {
  const { client } = await startClient({
    config: { capabilities: ['storage'] },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  await client.callTool({
    name: 'browser_localstorage_set',
    arguments: { key: 'key1', value: 'value1' },
  });

  await client.callTool({
    name: 'browser_localstorage_set',
    arguments: { key: 'key2', value: 'value2' },
  });

  // Clear all items
  await client.callTool({
    name: 'browser_localstorage_clear',
    arguments: {},
  });

  // Verify they're all gone
  const afterClear = await client.callTool({
    name: 'browser_localstorage_list',
    arguments: {},
  });

  expect(afterClear).toHaveResponse({
    result: 'No localStorage items found',
  });
});

test('browser_sessionstorage_list unavailable without storage capability', async ({ startClient, server }) => {
  const { client } = await startClient();
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  expect(await client.callTool({
    name: 'browser_sessionstorage_list',
  })).toHaveResponse({
    error: 'Tool "browser_sessionstorage_list" not found',
    isError: true,
  });
});

test('browser_sessionstorage_list shows no items when empty', async ({ startClient, server }) => {
  const { client } = await startClient({
    config: { capabilities: ['storage'] },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  const result = await client.callTool({
    name: 'browser_sessionstorage_list',
    arguments: {},
  });

  expect(result).toHaveResponse({
    result: 'No sessionStorage items found',
  });
});

test('browser_sessionstorage_set and browser_sessionstorage_get', async ({ startClient, server }) => {
  const { client } = await startClient({
    config: { capabilities: ['storage'] },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  // Set an item
  await client.callTool({
    name: 'browser_sessionstorage_set',
    arguments: { key: 'testKey', value: 'testValue' },
  });

  // Get the item
  const getResult = await client.callTool({
    name: 'browser_sessionstorage_get',
    arguments: { key: 'testKey' },
  });

  expect(getResult).toHaveResponse({
    result: expect.stringContaining('testKey=testValue'),
  });
});

test('browser_sessionstorage_list shows items', async ({ startClient, server }) => {
  const { client } = await startClient({
    config: { capabilities: ['storage'] },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  await client.callTool({
    name: 'browser_sessionstorage_set',
    arguments: { key: 'key1', value: 'value1' },
  });

  await client.callTool({
    name: 'browser_sessionstorage_set',
    arguments: { key: 'key2', value: 'value2' },
  });

  const result = await client.callTool({
    name: 'browser_sessionstorage_list',
    arguments: {},
  });

  expect(result).toHaveResponse({
    result: expect.stringContaining('key1=value1'),
  });

  expect(result).toHaveResponse({
    result: expect.stringContaining('key2=value2'),
  });
});

test('browser_sessionstorage_get returns not found for missing key', async ({ startClient, server }) => {
  const { client } = await startClient({
    config: { capabilities: ['storage'] },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  const result = await client.callTool({
    name: 'browser_sessionstorage_get',
    arguments: { key: 'nonexistent' },
  });

  expect(result).toHaveResponse({
    result: expect.stringContaining('not found'),
  });
});

test('browser_sessionstorage_delete removes item', async ({ startClient, server }) => {
  const { client } = await startClient({
    config: { capabilities: ['storage'] },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  await client.callTool({
    name: 'browser_sessionstorage_set',
    arguments: { key: 'toDelete', value: 'deleteMe' },
  });

  // Verify it exists
  const beforeDelete = await client.callTool({
    name: 'browser_sessionstorage_get',
    arguments: { key: 'toDelete' },
  });

  expect(beforeDelete).toHaveResponse({
    result: expect.stringContaining('toDelete=deleteMe'),
  });

  // Delete the item
  await client.callTool({
    name: 'browser_sessionstorage_delete',
    arguments: { key: 'toDelete' },
  });

  // Verify it's gone
  const afterDelete = await client.callTool({
    name: 'browser_sessionstorage_get',
    arguments: { key: 'toDelete' },
  });

  expect(afterDelete).toHaveResponse({
    result: expect.stringContaining('not found'),
  });
});

test('browser_sessionstorage_clear removes all items', async ({ startClient, server }) => {
  const { client } = await startClient({
    config: { capabilities: ['storage'] },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  await client.callTool({
    name: 'browser_sessionstorage_set',
    arguments: { key: 'key1', value: 'value1' },
  });

  await client.callTool({
    name: 'browser_sessionstorage_set',
    arguments: { key: 'key2', value: 'value2' },
  });

  // Clear all items
  await client.callTool({
    name: 'browser_sessionstorage_clear',
    arguments: {},
  });

  // Verify they're all gone
  const afterClear = await client.callTool({
    name: 'browser_sessionstorage_list',
    arguments: {},
  });

  expect(afterClear).toHaveResponse({
    result: 'No sessionStorage items found',
  });
});

test('localStorage and sessionStorage are isolated', async ({ startClient, server }) => {
  const { client } = await startClient({
    config: { capabilities: ['storage'] },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  // Set items in both storages
  await client.callTool({
    name: 'browser_localstorage_set',
    arguments: { key: 'sharedKey', value: 'localValue' },
  });

  await client.callTool({
    name: 'browser_sessionstorage_set',
    arguments: { key: 'sharedKey', value: 'sessionValue' },
  });

  // Verify they have different values
  const localResult = await client.callTool({
    name: 'browser_localstorage_get',
    arguments: { key: 'sharedKey' },
  });

  expect(localResult).toHaveResponse({
    result: expect.stringContaining('sharedKey=localValue'),
  });

  const sessionResult = await client.callTool({
    name: 'browser_sessionstorage_get',
    arguments: { key: 'sharedKey' },
  });

  expect(sessionResult).toHaveResponse({
    result: expect.stringContaining('sharedKey=sessionValue'),
  });

  // Clear localStorage and verify sessionStorage is unaffected
  await client.callTool({
    name: 'browser_localstorage_clear',
    arguments: {},
  });

  const afterClearLocal = await client.callTool({
    name: 'browser_localstorage_get',
    arguments: { key: 'sharedKey' },
  });

  expect(afterClearLocal).toHaveResponse({
    result: expect.stringContaining('not found'),
  });

  const sessionStillExists = await client.callTool({
    name: 'browser_sessionstorage_get',
    arguments: { key: 'sharedKey' },
  });

  expect(sessionStillExists).toHaveResponse({
    result: expect.stringContaining('sharedKey=sessionValue'),
  });
});
