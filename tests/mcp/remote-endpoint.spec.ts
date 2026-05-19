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

test.skip(({ mcpBrowser }) => mcpBrowser !== 'chromium', 'Run only on the chromium project; the remote server connection is browser-agnostic.');

test('remoteHeaders selects the browser on run-server endpoint', async ({ startClient, server, runServerEndpoint }) => {
  const { client } = await startClient({
    config: {
      browser: {
        remoteEndpoint: runServerEndpoint,
        remoteHeaders: { 'x-playwright-browser': 'chromium' },
        isolated: true,
      },
    },
  });

  const response = await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  expect(response).toHaveResponse({
    page: expect.stringContaining('Page Title: Title'),
  });
});

test('connect without remoteHeaders fails on run-server endpoint', async ({ startClient, server, runServerEndpoint }) => {
  const { client } = await startClient({
    config: {
      browser: {
        remoteEndpoint: runServerEndpoint,
        isolated: true,
      },
    },
  });

  const response = await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });
  expect(response).toHaveResponse({
    isError: true,
    error: expect.stringContaining(`reading 'launch'`),
  });
});
