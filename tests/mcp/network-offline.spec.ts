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

// Enable the 'network' capability for context-level tools
test.use({
  mcpCaps: ['network'],
});

test('browser_network_state_set sets network to offline', async ({ client }) => {
  // Set offline
  const setResponse = parseResponse(await client.callTool({
    name: 'browser_network_state_set',
    arguments: { state: 'offline' },
  }));
  expect(setResponse.result).toContain('Network is now offline');
});

test('browser_network_state_set restores network to online', async ({ client }) => {
  // Set offline first
  await client.callTool({
    name: 'browser_network_state_set',
    arguments: { state: 'offline' },
  });

  // Restore online
  const setResponse = parseResponse(await client.callTool({
    name: 'browser_network_state_set',
    arguments: { state: 'online' },
  }));
  expect(setResponse.result).toContain('Network is now online');
});

test('network requests fail when offline', async ({ client, server }) => {
  // Navigate to a page first
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  // Set offline
  await client.callTool({
    name: 'browser_network_state_set',
    arguments: { state: 'offline' },
  });

  // Try to navigate - should fail
  // Error messages vary by browser:
  // - Chrome: net::ERR_INTERNET_DISCONNECTED
  // - Firefox: NS_ERROR_OFFLINE
  // - WebKit: WebKit encountered an internal error
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX + '/one-style.html' },
  })).toHaveResponse({
    isError: true,
    error: expect.stringMatching(/net::ERR_INTERNET_DISCONNECTED|NS_ERROR_OFFLINE|WebKit encountered an internal error/),
  });
});

test('network requests succeed after restoring online', async ({ client, server }) => {
  // Navigate to initial page
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  // Set offline then back online
  await client.callTool({
    name: 'browser_network_state_set',
    arguments: { state: 'offline' },
  });
  await client.callTool({
    name: 'browser_network_state_set',
    arguments: { state: 'online' },
  });

  // Navigate should succeed
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX + '/one-style.html' },
  })).toHaveResponse({
    isError: undefined,
  });
});
