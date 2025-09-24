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

import { test, expect, prepareDebugTest } from './fixtures';

test('tool prefix', async ({ startClient, server }) => {
  const { client } = await startClient({ env: { 'PLAYWRIGHT_MCP_TOOL_PREFIX': 'test_' } });
  expect(await client.callTool({
    name: 'test_browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    code: `await page.goto('${server.HELLO_WORLD}');`,
    pageState: `- Page URL: ${server.HELLO_WORLD}
- Page Title: Title
- Page Snapshot:
\`\`\`yaml
- generic [active] [ref=e1]: Hello, world!
\`\`\``,
  });
});

test('alert dialog', async ({ server, startClient }) => {
  const { client } = await startClient({ env: { 'PLAYWRIGHT_MCP_TOOL_PREFIX': 'test_' } });
  server.setContent('/', `<button onclick="alert('Alert')">Button</button>`, 'text/html');
  expect(await client.callTool({
    name: 'test_browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    pageState: expect.stringContaining(`- button "Button" [ref=e2]`),
  });

  expect(await client.callTool({
    name: 'test_browser_click',
    arguments: {
      element: 'Button',
      ref: 'e2',
    },
  })).toHaveResponse({
    code: `await page.getByRole('button', { name: 'Button' }).click();`,
    modalState: `- ["alert" dialog with message "Alert"]: can be handled by the "test_browser_handle_dialog" tool`,
  });
});

test('browser_file_upload', async ({ server, startClient }) => {
  const { client } = await startClient({ env: { 'PLAYWRIGHT_MCP_TOOL_PREFIX': 'test_' } });
  server.setContent('/', `
    <input type="file" />
    <button>Button</button>
  `, 'text/html');

  expect(await client.callTool({
    name: 'test_browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    pageState: expect.stringContaining(`- generic [active] [ref=e1]:
  - button "Choose File" [ref=e2]
  - button "Button" [ref=e3]`),
  });

  expect(await client.callTool({
    name: 'test_browser_file_upload',
    arguments: { paths: [] },
  })).toHaveResponse({
    isError: true,
    result: expect.stringContaining(`The tool "test_browser_file_upload" can only be used when there is related modal state present.`),
    modalState: expect.stringContaining(`- There is no modal state present`),
  });
});

test.describe(() => {
  test.use({ mcpServerType: 'test-mcp' });

  test('test_debug (browser_snapshot/network/console)', async ({ startClient, server }) => {
    const { client, id } = await prepareDebugTest(startClient, `
        import { test, expect } from '@playwright/test';
        test('fail', async ({ page }) => {
          await page.goto(${JSON.stringify(server.HELLO_WORLD)});
          await page.evaluate(() => {
            console.log('hello from console');
            setTimeout(() => { throw new Error('error from page'); }, 0);
          });
          await expect(page.getByRole('button', { name: 'Missing' })).toBeVisible({ timeout: 1000 });
        });
    `, {
      env: { 'PLAYWRIGHT_MCP_TOOL_PREFIX': 'test_' },
    });
    await client.callTool({
      name: 'test_debug',
      arguments: {
        test: { id, title: 'fail' },
      },
    });
    await expect.poll(() => client.callTool({
      name: 'test_browser_network_requests',
    })).toHaveResponse({
      result: expect.stringContaining(`[GET] ${server.HELLO_WORLD} => [200] OK`),
    });
    expect(await client.callTool({
      name: 'test_browser_console_messages',
    })).toHaveResponse({
      result: expect.stringMatching(/\[LOG\] hello from console.*\nError: error from page/),
    });
    expect(await client.callTool({
      name: 'test_browser_snapshot',
    })).toHaveResponse({
      pageState: expect.stringContaining(`generic [active] [ref=e1]: Hello, world!`),
    });
  });
});
