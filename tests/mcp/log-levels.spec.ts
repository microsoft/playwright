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
import type { StartClient } from './fixtures';
import type { TestServer } from '../config/testserver';

const PAGE = `
  <title>Console messages</title>
  <script>
    console.log('log entry');
    console.warn('warn entry');
    console.error('error entry');
  </script>
`;

async function navigateAndReadConsole(startClient: StartClient, server: TestServer, path: string, args?: string[]) {
  const { client } = await startClient({ args });
  const url = `${server.PREFIX}${path}`;

  const navigateResponse = await client.callTool({
    name: 'browser_navigate',
    arguments: { url },
  });
  const consoleResponse = await client.callTool({
    name: 'browser_console_messages',
    arguments: {},
  });

  return { navigateResponse, consoleResponse };
}

test('forwards all console messages by default', async ({ startClient, server }) => {
  const path = '/console-log-levels-default';
  server.setContent(path, PAGE, 'text/html');

  const { navigateResponse, consoleResponse } = await navigateAndReadConsole(startClient, server, path);

  expect(navigateResponse).toHaveResponse({
    consoleMessages: expect.stringContaining('[LOG] log entry'),
  });
  expect(navigateResponse).toHaveResponse({
    consoleMessages: expect.stringContaining('[WARNING] warn entry'),
  });
  expect(navigateResponse).toHaveResponse({
    consoleMessages: expect.stringContaining('[ERROR] error entry'),
  });

  expect(consoleResponse).toHaveResponse({
    result: expect.stringContaining('[LOG] log entry'),
  });
  expect(consoleResponse).toHaveResponse({
    result: expect.stringContaining('[WARNING] warn entry'),
  });
  expect(consoleResponse).toHaveResponse({
    result: expect.stringContaining('[ERROR] error entry'),
  });
});

test('filters console messages by configured levels', async ({ startClient, server }) => {
  const path = '/console-log-levels-filtered';
  server.setContent(path, PAGE, 'text/html');

  const { navigateResponse, consoleResponse } = await navigateAndReadConsole(
      startClient,
      server,
      path,
      ['--console-log-levels=warning,error'],
  );

  expect(navigateResponse).not.toHaveResponse({
    consoleMessages: expect.stringContaining('[LOG] log entry'),
  });
  expect(navigateResponse).toHaveResponse({
    consoleMessages: expect.stringContaining('[WARNING] warn entry'),
  });
  expect(navigateResponse).toHaveResponse({
    consoleMessages: expect.stringContaining('[ERROR] error entry'),
  });

  expect(consoleResponse).not.toHaveResponse({
    result: expect.stringContaining('[LOG] log entry'),
  });
  expect(consoleResponse).toHaveResponse({
    result: expect.stringContaining('[WARNING] warn entry'),
  });
  expect(consoleResponse).toHaveResponse({
    result: expect.stringContaining('[ERROR] error entry'),
  });
});

test('disables console message forwarding when set to none', async ({ startClient, server }) => {
  const path = '/console-log-levels-none';
  server.setContent(path, PAGE, 'text/html');

  const { navigateResponse, consoleResponse } = await navigateAndReadConsole(
      startClient,
      server,
      path,
      ['--console-log-levels=none'],
  );

  expect(navigateResponse).toHaveResponse({
    consoleMessages: undefined,
  });
  expect(consoleResponse).toHaveResponse({
    result: undefined,
  });
});
