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

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { test as base, expect } from './fixtures';

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { BrowserContext } from 'playwright';
import type { StartClient } from './fixtures';

type BrowserWithExtension = {
  userDataDir: string;
  launch: (mode?: 'disable-extension') => Promise<BrowserContext>;
};

type TestFixtures = {
  browserWithExtension: BrowserWithExtension,
  pathToExtension: string,
  useShortConnectionTimeout: (timeoutMs: number) => void
  overrideProtocolVersion: (version: number) => void
};

const test = base.extend<TestFixtures>({
  pathToExtension: async ({}, use) => {
    await use(path.resolve(__dirname, '../../packages/mcp-extension/dist'));
  },

  browserWithExtension: async ({ mcpBrowser, pathToExtension }, use, testInfo) => {
    // The flags no longer work in Chrome since
    // https://chromium.googlesource.com/chromium/src/+/290ed8046692651ce76088914750cb659b65fb17%5E%21/chrome/browser/extensions/extension_service.cc?pli=1#
    test.skip('chromium' !== mcpBrowser, '--load-extension is not supported for official builds of Chromium');

    let browserContext: BrowserContext | undefined;
    const userDataDir = testInfo.outputPath('extension-user-data-dir');
    await use({
      userDataDir,
      launch: async (mode?: 'disable-extension') => {
        browserContext = await chromium.launchPersistentContext(userDataDir, {
          channel: mcpBrowser,
          // Opening the browser singleton only works in headed.
          headless: false,
          // Automation disables singleton browser process behavior, which is necessary for the extension.
          ignoreDefaultArgs: ['--enable-automation'],
          args: mode === 'disable-extension' ? [] : [
            `--disable-extensions-except=${pathToExtension}`,
            `--load-extension=${pathToExtension}`,
          ],
        });

        // for manifest v3:
        let [serviceWorker] = browserContext.serviceWorkers();
        if (!serviceWorker)
          serviceWorker = await browserContext.waitForEvent('serviceworker');

        return browserContext;
      }
    });
    await browserContext?.close();
  },

  useShortConnectionTimeout: async ({}, use) => {
    await use((timeoutMs: number) => {
      process.env.PWMCP_TEST_CONNECTION_TIMEOUT = timeoutMs.toString();
    });
    process.env.PWMCP_TEST_CONNECTION_TIMEOUT = undefined;
  },

  overrideProtocolVersion: async ({}, use) => {
    await use((version: number) => {
      process.env.PWMCP_TEST_PROTOCOL_VERSION = version.toString();
    });
    process.env.PWMCP_TEST_PROTOCOL_VERSION = undefined;
  }
});

async function startAndCallConnectTool(browserWithExtension: BrowserWithExtension, startClient: StartClient): Promise<Client> {
  const { client } = await startClient({
    args: [`--connect-tool`],
    config: {
      browser: {
        userDataDir: browserWithExtension.userDataDir,
      }
    },
  });

  expect(await client.callTool({
    name: 'browser_connect',
    arguments: {
      name: 'extension'
    }
  })).toHaveResponse({
    result: 'Successfully changed connection method.',
  });

  return client;
}

async function startWithExtensionFlag(browserWithExtension: BrowserWithExtension, startClient: StartClient): Promise<Client> {
  const { client } = await startClient({
    args: [`--extension`],
    config: {
      browser: {
        userDataDir: browserWithExtension.userDataDir,
      }
    },
  });
  return client;
}

const testWithOldExtensionVersion = test.extend({
  pathToExtension: async ({}, use, testInfo) => {
    const extensionDir = testInfo.outputPath('extension');
    const oldPath = path.resolve(__dirname, '../../packages/mcp-extension/dist');

    await fs.promises.cp(oldPath, extensionDir, { recursive: true });
    const manifestPath = path.join(extensionDir, 'manifest.json');
    const manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'));
    manifest.version = '0.0.1';
    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

    await use(extensionDir);
  },
});

for (const [mode, startClientMethod] of [
  ['connect-tool', startAndCallConnectTool],
  ['extension-flag', startWithExtensionFlag],
] as const) {

  test(`navigate with extension (${mode})`, async ({ browserWithExtension, startClient, server }) => {
    const browserContext = await browserWithExtension.launch();

    const client = await startClientMethod(browserWithExtension, startClient);

    const confirmationPagePromise = browserContext.waitForEvent('page', page => {
      return page.url().startsWith('chrome-extension://jakfalbnbhgkpmoaakfflhflbfpkailf/connect.html');
    });

    const navigateResponse = client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    });

    const selectorPage = await confirmationPagePromise;
    // For browser_navigate command, the UI shows Allow/Reject buttons instead of tab selector
    await selectorPage.getByRole('button', { name: 'Allow' }).click();

    expect(await navigateResponse).toHaveResponse({
      pageState: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
    });
  });

  test(`snapshot of an existing page (${mode})`, async ({ browserWithExtension, startClient, server }) => {
    const browserContext = await browserWithExtension.launch();

    const page = await browserContext.newPage();
    await page.goto(server.HELLO_WORLD);

    // Another empty page.
    await browserContext.newPage();
    expect(browserContext.pages()).toHaveLength(3);

    const client = await startClientMethod(browserWithExtension, startClient);
    expect(browserContext.pages()).toHaveLength(3);

    const confirmationPagePromise = browserContext.waitForEvent('page', page => {
      return page.url().startsWith('chrome-extension://jakfalbnbhgkpmoaakfflhflbfpkailf/connect.html');
    });

    const navigateResponse = client.callTool({
      name: 'browser_snapshot',
      arguments: { },
    });

    const selectorPage = await confirmationPagePromise;
    expect(browserContext.pages()).toHaveLength(4);

    await selectorPage.locator('.tab-item', { hasText: 'Title' }).getByRole('button', { name: 'Connect' }).click();

    expect(await navigateResponse).toHaveResponse({
      pageState: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
    });

    expect(browserContext.pages()).toHaveLength(4);
  });

  test(`extension not installed timeout (${mode})`, async ({ browserWithExtension, startClient, server, useShortConnectionTimeout }) => {
    useShortConnectionTimeout(100);

    const browserContext = await browserWithExtension.launch();

    const client = await startClientMethod(browserWithExtension, startClient);

    const confirmationPagePromise = browserContext.waitForEvent('page', page => {
      return page.url().startsWith('chrome-extension://jakfalbnbhgkpmoaakfflhflbfpkailf/connect.html');
    });

    expect(await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    })).toHaveResponse({
      result: expect.stringContaining('Extension connection timeout. Make sure the "Playwright MCP Bridge" extension is installed.'),
      isError: true,
    });

    await confirmationPagePromise;
  });

  testWithOldExtensionVersion(`works with old extension version (${mode})`, async ({ browserWithExtension, startClient, server, useShortConnectionTimeout }) => {
    useShortConnectionTimeout(500);

    // Prelaunch the browser, so that it is properly closed after the test.
    const browserContext = await browserWithExtension.launch();

    const client = await startClientMethod(browserWithExtension, startClient);

    const confirmationPagePromise = browserContext.waitForEvent('page', page => {
      return page.url().startsWith('chrome-extension://jakfalbnbhgkpmoaakfflhflbfpkailf/connect.html');
    });

    const navigateResponse = client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    });

    const selectorPage = await confirmationPagePromise;
    // For browser_navigate command, the UI shows Allow/Reject buttons instead of tab selector
    await selectorPage.getByRole('button', { name: 'Allow' }).click();

    expect(await navigateResponse).toHaveResponse({
      pageState: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
    });
  });

  test(`extension needs update (${mode})`, async ({ browserWithExtension, startClient, server, useShortConnectionTimeout, overrideProtocolVersion }) => {
    useShortConnectionTimeout(500);
    overrideProtocolVersion(1000);

    // Prelaunch the browser, so that it is properly closed after the test.
    const browserContext = await browserWithExtension.launch();

    const client = await startClientMethod(browserWithExtension, startClient);

    const confirmationPagePromise = browserContext.waitForEvent('page', page => {
      return page.url().startsWith('chrome-extension://jakfalbnbhgkpmoaakfflhflbfpkailf/connect.html');
    });

    const navigateResponse = client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    });

    const confirmationPage = await confirmationPagePromise;
    await expect(confirmationPage.locator('.status-banner')).toContainText(`Playwright MCP version trying to connect requires newer extension version`);

    expect(await navigateResponse).toHaveResponse({
      result: expect.stringContaining('Extension connection timeout.'),
      isError: true,
    });
  });

}

test(`custom executablePath`, async ({ startClient, server, useShortConnectionTimeout }) => {
  useShortConnectionTimeout(1000);

  const executablePath = test.info().outputPath('echo.sh');
  await fs.promises.writeFile(executablePath, '#!/bin/bash\necho "Custom exec args: $@" > "$(dirname "$0")/output.txt"', { mode: 0o755 });

  const { client } = await startClient({
    args: [`--extension`],
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
    timeout: 1000,
  });
  expect(await navigateResponse).toHaveResponse({
    result: expect.stringContaining('Extension connection timeout.'),
    isError: true,
  });
  expect(await fs.promises.readFile(test.info().outputPath('output.txt'), 'utf8')).toContain('Custom exec args: chrome-extension://jakfalbnbhgkpmoaakfflhflbfpkailf/connect.html?');
});
