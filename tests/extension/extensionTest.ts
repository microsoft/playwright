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

import { baseTest } from '../config/baseTest';
import { chromium, type BrowserContext } from 'playwright';
import { expect, type PageTestFixtures, type PageWorkerFixtures } from '../page/pageTestApi';
import type { TraceViewerFixtures } from '../config/traceViewerFixtures';
import { traceViewerFixtures } from '../config/traceViewerFixtures';
export { expect } from '@playwright/test';
import http from 'node:http';
import path from 'node:path';
import { AddressInfo } from 'node:net';

export type ExtensionTestFixtures = {
  persistentContext: BrowserContext;
  relayServer: http.Server;
};


export const extensionTest = baseTest.extend<TraceViewerFixtures>(traceViewerFixtures).extend<PageTestFixtures, PageWorkerFixtures & ExtensionTestFixtures>({
  browserVersion: [({ browser }, use) => use(browser.version()), { scope: 'worker' }],
  browserMajorVersion: [({ browserVersion }, use) => use(Number(browserVersion.split('.')[0])), { scope: 'worker' }],
  isAndroid: [false, { scope: 'worker' }],
  isElectron: [false, { scope: 'worker' }],
  electronMajorVersion: [0, { scope: 'worker' }],
  isWebView2: [false, { scope: 'worker' }],
  isHeadlessShell: [false, { scope: 'worker' }],

  relayServer: [async ({ }, use) => {
    const httpServer = http.createServer();
    await new Promise<void>(resolve => httpServer.listen(0, resolve));
    const { CDPRelayServer } = await import('../../../playwright-mcp/src/cdpRelay.ts');
    new CDPRelayServer(httpServer);
    await use(httpServer);
    httpServer.close();
  }, { scope: 'worker' }],

  persistentContext: [async ({ }, use) => {
    const pathToExtension = path.join(__dirname, '../../../playwright-mcp/extension');
    const context = await chromium.launchPersistentContext('', {
      executablePath: process.env.CRPATH,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--enable-features=AllowContentInitiatedDataUrlNavigations',
      ],
      channel: 'chromium',
    });
    context.on('dialog', dialog => {
      // Make sure the dialog is not dismissed automatically.
    });
    await use(context);
    await context.close();
  }, { scope: 'worker' }],

  browser: [async ({ persistentContext, relayServer, playwright }, use, testInfo) => {
    const origin = `ws://localhost:${(relayServer.address() as AddressInfo).port}`;
    await expect.poll(() => persistentContext.serviceWorkers()).toHaveLength(1);
    await persistentContext.pages()[0].goto(new URL('/popup.html', persistentContext.serviceWorkers()[0].url()).toString());
    await persistentContext.pages()[0].getByRole('textbox', { name: 'Bridge Server URL:' }).clear();
    await persistentContext.pages()[0].getByRole('textbox', { name: 'Bridge Server URL:' }).fill(`${origin}/extension`);
    await persistentContext.pages()[0].getByRole('button', { name: 'Share This Tab' }).click();
    await persistentContext.pages()[0].goto('about:blank');
    const browser = await playwright.chromium.connectOverCDP(`${origin}/cdp`);
    await use(browser);
  }, { scope: 'worker' }],

  context: async ({ browser }, use) => {
    await use(browser.contexts()[0]);
  },

  page: async ({ persistentContext, relayServer, playwright }, use) => {
    const page = await persistentContext.newPage();
    const origin = `ws://localhost:${(relayServer.address() as AddressInfo).port}`;
    await expect.poll(() => persistentContext.serviceWorkers()).toHaveLength(1);
    await page.goto(new URL('/popup.html', persistentContext.serviceWorkers()[0].url()).toString());
    await page.getByRole('textbox', { name: 'Bridge Server URL:' }).clear();
    await page.getByRole('textbox', { name: 'Bridge Server URL:' }).fill(`${origin}/extension`);
    await page.getByRole('button', { name: 'Share This Tab' }).click();
    await page.goto('about:blank');
    const browser = await playwright.chromium.connectOverCDP(`${origin}/cdp`);
    const pages = browser.contexts()[0].pages();
    const remotePage = pages[pages.length - 1];
    await use(remotePage);
    // Disconnect from the tab.
    await browser.close();
    // Close the page.
    await page.close();
  }
});
