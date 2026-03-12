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

import { test, expect } from './cli-fixtures';

test.beforeEach(({}, testInfo) => {
  process.env.PLAYWRIGHT_SERVER_REGISTRY = testInfo.outputPath('registry');
});

test('should show browser session chip', async ({ cli, server, openDashboard }) => {
  await cli('open', server.EMPTY_PAGE);

  const dashboard = await openDashboard();
  const chips = dashboard.locator('.session-chip');
  await expect(chips).toHaveCount(1);
});

test('should show devtools sidebar', async ({ cli, server, openDashboard, mcpBrowser }) => {
  test.skip(!['chrome', 'msedge', 'chromium'].includes(mcpBrowser!), 'DevTools sidebar requires CDP, only available in Chromium');

  await cli('open', server.EMPTY_PAGE);

  const dashboard = await openDashboard();
  await dashboard.locator('.session-chip').click();

  const devToolsButton = dashboard.locator('button.nav-btn[title="Chrome DevTools"]');
  await expect(dashboard.locator('.inspector-frame')).not.toBeVisible();
  await devToolsButton.click();
  await expect(dashboard.locator('.inspector-frame')).toBeVisible();
});

test('should pick locator from browser', async ({ cli, server, openDashboard }) => {
  server.setContent('/', '<button style="position:fixed;top:0;left:0;width:200px;height:100px">Submit</button>', 'text/html');

  await cli('open', server.PREFIX);

  const dashboard = await openDashboard();
  await dashboard.locator('.session-chip').click();

  const pickBtn = dashboard.locator('button.nav-btn[title="Pick locator"]');
  await pickBtn.click();

  await expect(dashboard.locator('div.dashboard-view')).toContainClass('interactive');

  // Intercept clipboard writes before clicking pick.
  const copyPromise = dashboard.evaluate(() => {
    if (!navigator.clipboard)
      return 'no clipboard';
    return new Promise<string>(f => {
      const original = navigator.clipboard.writeText;
      navigator.clipboard.writeText = text => {
        f(text);
        navigator.clipboard.writeText = original;
        return navigator.clipboard.writeText(text);
      };
    });
  }).catch(e => `Exception in eval: ${e}`);

  await dashboard.locator('img#display').click({ position: { x: 50, y: 25 } });

  const text = await copyPromise;
  expect(text).toContain('Submit');
});
