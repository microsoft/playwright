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

import { playwrightTest as baseTest, expect } from '../config/browserTest';
import { startDashboardHttpServer } from '../../packages/playwright-core/lib/tools/dashboard/dashboardApp';

import type { Page } from 'playwright-core';
import type { HttpServer } from '../../packages/playwright-core/lib/server/utils/httpServer';

type DashboardFixtures = {
  dashboardServer: () => Promise<HttpServer>;
  openDashboard: () => Promise<Page>;
};

const test = baseTest.extend<DashboardFixtures>({
  dashboardServer: async ({}, use) => {
    let httpServer: HttpServer | undefined;
    await use(async () => {
      if (!httpServer)
        httpServer = await startDashboardHttpServer();
      return httpServer;
    });
    await httpServer?.stop();
  },

  openDashboard: async ({ context, dashboardServer }, use) => {
    await use(async () => {
      const httpServer = await dashboardServer();
      const page = await context.newPage();
      await page.goto(httpServer.urlPrefix('human-readable'));
      return page;
    });
  },
});

test.skip(({ mode }) => mode !== 'default');

test.beforeEach(async ({}, testInfo) => {
  process.env.PLAYWRIGHT_SERVER_REGISTRY = testInfo.outputPath('registry');
});

test('should show browser session chip', async ({ browserType, openDashboard }, testInfo) => {
  const browser = await browserType.launch();
  await (browser as any)._startServer('Test Browser', { workspaceDir: testInfo.outputPath('workspace') });
  const page = await openDashboard();
  const chips = page.locator('.session-chip');
  await expect(chips).toHaveCount(1);
  await expect(chips.locator('.session-chip-name')).toHaveText('Test Browser');
  await browser.close();
});

test('should show devtools sidebar', async ({ browserType, browserName, openDashboard, server }, testInfo) => {
  test.skip(browserName !== 'chromium', 'DevTools sidebar requires CDP, only available in Chromium');

  const browser = await browserType.launch();
  await (browser as any)._startServer('Test Browser', { workspaceDir: testInfo.outputPath('workspace') });
  const testPage = await browser.newPage();
  await testPage.goto(server.EMPTY_PAGE);

  const dashboard = await openDashboard();

  // Click the chip to enter the session detail view.
  await dashboard.locator('.session-chip').click();

  // Wait for the Chrome DevTools button — it appears once the WebSocket
  // connects and CDP returns the browser revision.
  const devToolsButton = dashboard.locator('button.nav-btn[title="Chrome DevTools"]');

  // The sidebar is hidden until the button is clicked.
  await expect(dashboard.locator('.inspector-frame')).not.toBeVisible();
  await devToolsButton.click();
  await expect(dashboard.locator('.inspector-frame')).toBeVisible();

  await browser.close();
});

test('should pick locator from browser', async ({ browserType, openDashboard, server, context }, testInfo) => {
  const browser = await browserType.launch();
  const testPage = await browser.newPage();
  await testPage.goto(server.EMPTY_PAGE);
  await testPage.setContent('<button>Submit</button>');
  await (browser as any)._startServer('Test Browser', { workspaceDir: testInfo.outputPath('workspace') });

  const dashboard = await openDashboard();
  await dashboard.locator('.session-chip').click();

  // Wait for the Pick locator button to be enabled (WebSocket connection established).
  const pickBtn = dashboard.locator('button.nav-btn[title="Pick locator"]');
  await expect(pickBtn).toBeEnabled();

  // Start pick mode and wait for the recorder script to initialize in the browser.
  const scriptReady = testPage.waitForEvent('console', msg => msg.text() === 'Recorder script ready for test');
  await pickBtn.click();
  await scriptReady;

  const copyPromise = dashboard.evaluate(() => {
    if (!navigator.clipboard)
      return 'no clipboard';
    return new Promise(f => {
      const original = navigator.clipboard.writeText;
      navigator.clipboard.writeText = text => {
        f(text);
        navigator.clipboard.writeText = original;
        return navigator.clipboard.writeText(text);
      };
    });
  }).catch(e => `Exception in eval: ${e}`);

  // Click the button element to pick its locator.
  const box = await testPage.getByRole('button', { name: 'Submit' }).boundingBox();
  await testPage.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

  // Check the captured clipboard value — robust, persists after the toast disappears.
  const text = await copyPromise;
  expect(text).toContain('Submit');

  await browser.close();
});
