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

test('browser_console_messages', async ({ client, server }) => {
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <script>
        console.log("Hello, world!");
        console.error("Error");
      </script>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  const resource = await client.callTool({
    name: 'browser_console_messages',
  });
  expect(resource).toHaveResponse({
    result: `[LOG] Hello, world! @ ${server.PREFIX}/:4
[ERROR] Error @ ${server.PREFIX}/:5`,
  });
});

test('browser_console_messages (page error)', async ({ client, server }) => {
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <script>
        throw new Error("Error in script");
      </script>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  const resource = await client.callTool({
    name: 'browser_console_messages',
  });
  expect(resource).toHaveResponse({
    result: expect.stringContaining(`Error: Error in script`),
  });
  expect(resource).toHaveResponse({
    result: expect.stringContaining(server.PREFIX),
  });
});

test('recent console messages', async ({ client, server }) => {
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <button onclick="console.log('Hello, world!');">Click me</button>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  const response = await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Click me',
      ref: 'e2',
    },
  });

  expect(response).toHaveResponse({
    consoleMessages: expect.stringContaining(`- [LOG] Hello, world! @`),
  });
});

test('recent console messages filter', async ({ startClient, server }) => {
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <script>
        console.log("console.log");
        console.error("console.error");
      </script>
    </html>
  `, 'text/html');

  const { client } = await startClient({
    args: ['--console-level', 'error'],
  });

  const response = parseResponse(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  }));

  expect(response.consoleMessages).toContain('console.error');
  expect(response.consoleMessages).not.toContain('console.log');
});

test('browser_console_messages default level', async ({ client, server }) => {
  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.HELLO_WORLD,
    },
  });

  await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: `async () => {
        console.debug("console.debug");
        console.log("console.log");
        console.warn("console.warn");
        console.error("console.error");
        setTimeout(() => { throw new Error("unhandled"); }, 0);
        await fetch('/missing');
      }`,
    },
  });

  const response = parseResponse(await client.callTool({
    name: 'browser_console_messages',
  }));
  expect.soft(response.result).toContain('console.log');
  expect.soft(response.result).toContain('console.warn');
  expect.soft(response.result).toContain('console.error');
  expect.soft(response.result).toContain('Error: unhandled');
  expect.soft(response.result).toContain('404');
  expect.soft(response.result).not.toContain('console.debug');
});

test('browser_console_messages errors only', async ({ client, server }) => {
  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.HELLO_WORLD,
    },
  });

  await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: `async () => {
        console.debug("console.debug");
        console.log("console.log");
        console.warn("console.warn");
        console.error("console.error");
        setTimeout(() => { throw new Error("unhandled"); }, 0);
        await fetch('/missing');
      }`,
    },
  });

  const response = parseResponse(await client.callTool({
    name: 'browser_console_messages',
    arguments: {
      level: 'error',
    },
  }));
  expect.soft(response.result).toContain('console.error');
  expect.soft(response.result).toContain('Error: unhandled');
  expect.soft(response.result).toContain('404');
  expect.soft(response.result).not.toContain('console.log');
  expect.soft(response.result).not.toContain('console.warn');
});
