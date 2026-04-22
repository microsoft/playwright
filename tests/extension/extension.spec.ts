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

import fs from 'fs/promises';
import { test, testWithOldExtensionVersion, expect, extensionId, clickAllowAndSelect, startWithExtensionFlag } from './extension-fixtures';

test(`navigate with extension`, async ({ startExtensionClient, server }) => {
  const { browserContext, client } = await startExtensionClient();

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  const navigateResponse = client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const selectorPage = await confirmationPagePromise;
  await clickAllowAndSelect(selectorPage, 'Welcome');

  expect(await navigateResponse).toHaveResponse({
    snapshot: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
  });
});

test(`connect.html protocolVersion search param matches fixture option`, async ({ startExtensionClient, server, protocolVersion }) => {
  const { browserContext, client } = await startExtensionClient();

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  }).catch(() => {});

  const selectorPage = await confirmationPagePromise;
  const url = new URL(selectorPage.url());
  expect(url.searchParams.get('protocolVersion')).toBe(String(protocolVersion));
});

test(`protocolVersion defaults to 1`, async ({ startExtensionClient, server, protocolVersion }) => {
  // test.fail(true, 'Server default is currently 2; this test guards the expected default of 1');
  const saved = process.env.PLAYWRIGHT_EXTENSION_PROTOCOL;
  delete process.env.PLAYWRIGHT_EXTENSION_PROTOCOL;

  const { browserContext, client } = await startExtensionClient();

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  }).catch(() => {});

  const selectorPage = await confirmationPagePromise;
  const url = new URL(selectorPage.url());
  expect(url.searchParams.get('protocolVersion')).toBe('1');

  process.env.PLAYWRIGHT_EXTENSION_PROTOCOL = saved;
});

test(`browser_run_code can evaluate in a web worker`, async ({ startExtensionClient, server, protocolVersion }) => {
  test.skip(protocolVersion === 1, 'Multi-tab not supported in protocol v1');
  server.setContent('/worker.js', `
    self.onmessage = (e) => self.postMessage('echo:' + e.data);
    self.workerName = 'mcp-worker';
  `, 'application/javascript');
  server.setContent('/worker-page', `
    <title>WorkerPage</title>
    <body>
      <script>
        window.__worker = new Worker('/worker.js');
      </script>
    </body>
  `, 'text/html');

  const { browserContext, client } = await startExtensionClient();

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  const navigateResponse = client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX + '/worker-page' },
  });

  const selectorPage = await confirmationPagePromise;
  await clickAllowAndSelect(selectorPage, 'Welcome');

  await navigateResponse;

  const runCodeResponse = await client.callTool({
    name: 'browser_run_code',
    arguments: {
      code: `async (page) => {
        const worker = page.workers().length ? page.workers()[0] : await page.waitForEvent('worker');
        return await worker.evaluate(() => self.workerName);
      }`,
    },
  });

  expect(runCodeResponse).toHaveResponse({
    result: expect.stringContaining('mcp-worker'),
  });

  // Open a second page with its own worker via browser_tabs new and verify
  // that worker eval works in that tab too. This exercises child CDP sessions
  // (the worker session) on a non-first tab — the relay must route them to
  // the correct tab rather than always falling back to the first one.
  server.setContent('/worker2.js', `
    self.workerName = 'mcp-worker-2';
  `, 'application/javascript');
  server.setContent('/worker-page-2', `
    <title>WorkerPage2</title>
    <body>
      <script>
        window.__worker = new Worker('/worker2.js');
      </script>
    </body>
  `, 'text/html');

  await client.callTool({
    name: 'browser_tabs',
    arguments: { action: 'new', url: server.PREFIX + '/worker-page-2' },
  });

  const runCodeResponse2 = await client.callTool({
    name: 'browser_run_code',
    arguments: {
      code: `async (page) => {
        const worker = page.workers().length ? page.workers()[0] : await page.waitForEvent('worker');
        return await worker.evaluate(() => self.workerName);
      }`,
    },
  });

  expect(runCodeResponse2).toHaveResponse({
    result: expect.stringContaining('mcp-worker-2'),
  });
});

test(`snapshot of an existing page`, async ({ browserWithExtension, startClient, server }) => {
  const browserContext = await browserWithExtension.launch();

  const page = await browserContext.newPage();
  await page.goto(server.HELLO_WORLD);

  // Another empty page.
  await browserContext.newPage();
  expect(browserContext.pages()).toHaveLength(3);

  const client = await startWithExtensionFlag(browserWithExtension, startClient);
  expect(browserContext.pages()).toHaveLength(3);

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  const navigateResponse = client.callTool({
    name: 'browser_snapshot',
    arguments: { },
  });

  const selectorPage = await confirmationPagePromise;
  expect(browserContext.pages()).toHaveLength(4);

  await clickAllowAndSelect(selectorPage, 'Title');

  expect(await navigateResponse).toHaveResponse({
    inlineSnapshot: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
  });
});

test(`extension not installed timeout`, async ({ startExtensionClient, server }) => {
  const { browserContext, client } = await startExtensionClient({ PWMCP_TEST_CONNECTION_TIMEOUT: '100' });

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    error: expect.stringMatching(/Extension connection timeout. Make sure the "Playwright.* is installed\./),
    isError: true,
  });

  await confirmationPagePromise;
});

testWithOldExtensionVersion(`works with old extension version`, async ({ startExtensionClient, server }) => {
  // Prelaunch the browser, so that it is properly closed after the test.
  const { browserContext, client } = await startExtensionClient({ PWMCP_TEST_CONNECTION_TIMEOUT: '500' });

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  const navigateResponse = client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const selectorPage = await confirmationPagePromise;
  await clickAllowAndSelect(selectorPage, 'Welcome');

  expect(await navigateResponse).toHaveResponse({
    snapshot: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
  });
});

test(`extension needs update`, async ({ startExtensionClient, server }) => {
  // Prelaunch the browser, so that it is properly closed after the test.
  const { browserContext, client } = await startExtensionClient({ PWMCP_TEST_CONNECTION_TIMEOUT: '500', PLAYWRIGHT_EXTENSION_PROTOCOL: '1000' });

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  const navigateResponse = client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const confirmationPage = await confirmationPagePromise;
  await expect(confirmationPage.locator('.status-banner')).toContainText(`Playwright client trying to connect requires newer extension version`);

  expect(await navigateResponse).toHaveResponse({
    error: expect.stringContaining('Extension connection timeout.'),
    isError: true,
  });
});

test(`custom executablePath`, async ({ startClient, server }) => {
  const executablePath = test.info().outputPath('echo.sh');
  await fs.writeFile(executablePath, '#!/bin/bash\necho "Custom exec args: $@" > "$(dirname "$0")/output.txt"', { mode: 0o755 });

  const { client } = await startClient({
    args: [`--extension`],
    env: { PWMCP_TEST_CONNECTION_TIMEOUT: '1000' },
    config: {
      browser: {
        launchOptions: {
          executablePath,
        },
      }
    },
  });

  const navigateResponse = await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  expect(await navigateResponse).toHaveResponse({
    error: expect.stringContaining('Extension connection timeout.'),
    isError: true,
  });
  expect(await fs.readFile(test.info().outputPath('output.txt'), 'utf8')).toMatch(new RegExp(`Custom exec args.*chrome-extension://${extensionId}/connect\\.html\\?`));
});

test(`bypass connection dialog with token`, async ({ browserWithExtension, startClient, server }) => {
  const browserContext = await browserWithExtension.launch();

  const page = await browserContext.newPage();
  await page.goto(`chrome-extension://${extensionId}/status.html`);
  const token = await page.locator('.auth-token-code').textContent();
  const [, value] = token?.split('=') || [];

  const { client } = await startClient({
    args: [`--extension`],
    config: {
      browser: {
        userDataDir: browserWithExtension.userDataDir,
      }
    },
    env: {
      PLAYWRIGHT_MCP_EXTENSION_TOKEN: value,
    },
  });

  const navigateResponse = await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  expect(await navigateResponse).toHaveResponse({
    snapshot: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
  });
});

test(`pending connection closed when client disconnects`, async ({ startExtensionClient, server }) => {
  const { browserContext, client } = await startExtensionClient();

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  }).catch(() => {});

  const selectorPage = await confirmationPagePromise;
  // Wait for the tab list to appear so we know the relay connection is established.
  await selectorPage.locator('.tab-item').first().waitFor();

  // Close the MCP client, which tears down the relay WebSocket.
  await client.close();

  await expect(selectorPage.locator('.status-banner')).toContainText('Pending client connection closed.');
  await expect(selectorPage).toHaveTitle('Playwright Extension');

  // The connect tab should be removed from the Playwright group.
  await expect.poll(async () => {
    return selectorPage.evaluate(async () => {
      const chrome = (window as any).chrome;
      const tab = await chrome.tabs.getCurrent();
      return tab?.groupId ?? -1;
    });
  }).toBe(-1);
});
