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

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { test, expect } from './fixtures';

const BLOCK_MESSAGE = /Blocked by Web Inspector|NS_ERROR_FAILURE|net::ERR_BLOCKED_BY_CLIENT/g;

const fetchPage = async (client: Client, url: string) => {
  const result = await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url,
    },
  });

  return JSON.stringify(result, null, 2);
};

test('default to allow all', async ({ server, client }) => {
  server.setContent('/ppp', 'content:PPP', 'text/html');
  const result = await fetchPage(client, server.PREFIX + '/ppp');
  expect(result).toContain('content:PPP');
});

test('blocked works', async ({ startClient }) => {
  const { client } = await startClient({
    args: ['--blocked-origins', 'microsoft.com;example.com;playwright.dev']
  });
  const result = await fetchPage(client, 'https://example.com/');
  expect(result).toMatch(BLOCK_MESSAGE);
});

test('allowed works', async ({ server, startClient }) => {
  server.setContent('/ppp', 'content:PPP', 'text/html');
  const { client } = await startClient({
    args: ['--allowed-origins', `microsoft.com;${new URL(server.PREFIX).host};playwright.dev`]
  });
  const result = await fetchPage(client, server.PREFIX + '/ppp');
  expect(result).toContain('content:PPP');
});

test('blocked takes precedence', async ({ startClient }) => {
  const { client } = await startClient({
    args: [
      '--blocked-origins', 'example.com',
      '--allowed-origins', 'example.com',
    ],
  });
  const result = await fetchPage(client, 'https://example.com/');
  expect(result).toMatch(BLOCK_MESSAGE);
});

test('allowed without blocked blocks all non-explicitly specified origins', async ({ startClient }) => {
  const { client } = await startClient({
    args: ['--allowed-origins', 'playwright.dev'],
  });
  const result = await fetchPage(client, 'https://example.com/');
  expect(result).toMatch(BLOCK_MESSAGE);
});

test('blocked without allowed allows non-explicitly specified origins', async ({ server, startClient }) => {
  server.setContent('/ppp', 'content:PPP', 'text/html');
  const { client } = await startClient({
    args: ['--blocked-origins', 'example.com'],
  });
  const result = await fetchPage(client, server.PREFIX + '/ppp');
  expect(result).toContain('content:PPP');
});
