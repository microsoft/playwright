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

import { test, expect, formatLog } from './fixtures';

test('closes the browser after the idle timeout and relaunches it on the next call', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/42548' },
}, async ({ startClient, server }) => {
  const { client, stderr } = await startClient({
    args: ['--idle-timeout=500'],
    env: { DEBUG: 'pw:mcp:test' },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  await expect.poll(() => formatLog(stderr())).toEqual({
    'create browser (persistent)': 1,
    'create context': 1,
    'close browser': 1,
  });

  const response = await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  expect(response).toHaveResponse({
    snapshot: expect.stringContaining(`Hello, world!`),
  });

  const nextResponse = await client.callTool({
    name: 'browser_snapshot',
    arguments: {},
  });
  expect(nextResponse).toHaveResponse({
    inlineSnapshot: expect.stringContaining(`Hello, world!`),
  });

  expect(formatLog(stderr())).toEqual({
    'create browser (persistent)': 2,
    'create context': 2,
    'close browser': 1,
  });
});

test('cdp endpoint only disconnects on idle and reconnects to the same pages', async ({ cdpServer, startClient, server }) => {
  const browserContext = await cdpServer.start();
  const { client, stderr } = await startClient({
    args: [`--cdp-endpoint=${cdpServer.endpoint}`, '--idle-timeout=500'],
    env: { DEBUG: 'pw:mcp:test' },
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    snapshot: expect.stringContaining(`Hello, world!`),
  });

  await expect.poll(() => formatLog(stderr())).toEqual({
    'create browser (cdp)': 1,
    'create context': 1,
    'close browser': 1,
  });
  expect(browserContext.pages().map(page => page.url())).toContain(server.HELLO_WORLD);

  const response = await client.callTool({
    name: 'browser_snapshot',
    arguments: {},
  });
  expect(response).toHaveResponse({
    inlineSnapshot: expect.stringContaining(`Hello, world!`),
  });
  expect(formatLog(stderr())).toEqual({
    'create browser (cdp)': 2,
    'create context': 2,
    'close browser': 1,
  });
});
