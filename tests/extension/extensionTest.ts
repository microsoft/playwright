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
import { chromium } from 'playwright';
import { expect, type PageTestFixtures, type PageWorkerFixtures } from '../page/pageTestApi';
import type { TraceViewerFixtures } from '../config/traceViewerFixtures';
import { traceViewerFixtures } from '../config/traceViewerFixtures';
export { expect } from '@playwright/test';
import http from 'node:http';
import path from 'node:path';
import { AddressInfo } from 'node:net';

export const extensionTest = baseTest.extend<TraceViewerFixtures>(traceViewerFixtures).extend<PageTestFixtures, PageWorkerFixtures>({
  browserVersion: [({ browser }, use) => use(browser.version()), { scope: 'worker' }],
  browserMajorVersion: [({ browserVersion }, use) => use(Number(browserVersion.split('.')[0])), { scope: 'worker' }],
  isAndroid: [false, { scope: 'worker' }],
  isElectron: [false, { scope: 'worker' }],
  electronMajorVersion: [0, { scope: 'worker' }],
  isWebView2: [false, { scope: 'worker' }],
  isHeadlessShell: [false, { scope: 'worker' }],

  browser: [async ({ playwright }, use, testInfo) => {
    const httpServer = http.createServer();
    await new Promise<void>(resolve => httpServer.listen(0, resolve));
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
    const { CDPRelayServer } = await import('../../../playwright-mcp/src/cdpRelay.ts');
    new CDPRelayServer(httpServer);
    const origin = `ws://localhost:${(httpServer.address() as AddressInfo).port}`;
    await expect.poll(() => context?.serviceWorkers()).toHaveLength(1);
    await context.pages()[0].goto(new URL('/popup.html', context.serviceWorkers()[0].url()).toString());
    await context.pages()[0].getByRole('textbox', { name: 'Bridge Server URL:' }).clear();
    await context.pages()[0].getByRole('textbox', { name: 'Bridge Server URL:' }).fill(`${origin}/extension`);
    await context.pages()[0].getByRole('button', { name: 'Share This Tab' }).click();
    await context.pages()[0].goto('about:blank');
    const browser = await playwright.chromium.connectOverCDP(`${origin}/cdp`);
    context.on('dialog', dialog => {
      // Make sure the dialog is not dismissed automatically.
    });
    await use(browser);
    httpServer.close();
  }, { scope: 'worker' }],

  context: async ({ browser }, use) => {
    await use(browser.contexts()[0]);
  },

  page: async ({ browser }, use) => {
    await use(browser.contexts()[0].pages()[0]);
  }
});
