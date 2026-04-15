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

import { test, expect } from './cli-fixtures';

test.beforeEach(({}, testInfo) => {
  process.env.PLAYWRIGHT_SERVER_REGISTRY = testInfo.outputPath('registry');
});

test('should show browser session chip', async ({ cli, server, openDashboard }) => {
  await cli('open', server.EMPTY_PAGE);

  const dashboard = await openDashboard();
  await dashboard.locator('.tabbar-back').click();
  const chips = dashboard.locator('.session-chip');
  await expect(chips).toHaveCount(1);
});

test('show <session> selects the session', async ({ cli, server, openDashboard }) => {
  await cli('-s=alpha', 'open', server.EMPTY_PAGE);
  await cli('-s=beta', 'open', server.HELLO_WORLD);

  const dashboard = await openDashboard({ session: 'beta' });
  // Selecting a session navigates from the grid to the single-session view.
  await expect(dashboard.locator('.session-chip')).toHaveCount(0);
  await expect(dashboard.locator('.dashboard-view')).toBeVisible();
  expect(new URL(dashboard.url()).hash).toMatch(/^#session=/);
});

test('show --interactive opens the dashboard in interactive mode', async ({ cli, server, openDashboard }) => {
  await cli('open', server.EMPTY_PAGE);

  const dashboard = await openDashboard({ session: 'default', interactive: true });
  await expect(dashboard.locator('.dashboard-view')).toContainClass('interactive');
  expect(new URL(dashboard.url()).hash).toContain('interactive');
});

test('should show devtools sidebar', async ({ cli, server, openDashboard, mcpBrowser }) => {
  test.skip(!['chrome', 'msedge', 'chromium'].includes(mcpBrowser!), 'DevTools sidebar requires CDP, only available in Chromium');

  await cli('open', server.EMPTY_PAGE);

  const dashboard = await openDashboard();

  const devToolsButton = dashboard.locator('button.nav-btn[title="Chrome DevTools"]');
  await expect(dashboard.locator('.inspector-frame')).not.toBeVisible();
  await devToolsButton.click();
  await expect(dashboard.locator('.inspector-frame')).toBeVisible();
});

test('should show current workspace sessions first', async ({ cli, server, openDashboard }) => {
  const wsA = test.info().outputPath('workspace-a');
  const wsB = test.info().outputPath('workspace-b');

  await fs.promises.mkdir(path.join(wsA, '.playwright'), { recursive: true });
  await fs.promises.mkdir(path.join(wsB, '.playwright'), { recursive: true });

  await cli('open', server.EMPTY_PAGE, { cwd: wsA });
  await cli('open', server.EMPTY_PAGE, { cwd: wsB });

  const checkOrder = async (first: string, second: string) => {
    const dashboard = await openDashboard({ cwd: first });
    await dashboard.locator('.tabbar-back').click();
    const workspaceGroups = dashboard.locator('.workspace-group');
    await expect(workspaceGroups).toHaveCount(2);

    // Current workspace (first) should be first and expanded.
    await expect(workspaceGroups.nth(0).locator('.workspace-path')).toContainText(first);
    await expect(workspaceGroups.nth(0).locator('.session-chips')).toBeVisible();

    // Other workspace (second) should be second and collapsed.
    await expect(workspaceGroups.nth(1).locator('.workspace-path')).toContainText(second);
    await expect(workspaceGroups.nth(1).locator('.session-chips')).not.toBeVisible();

    await dashboard.close();
  };

  await test.step('open dashboard in workspace A', async () => {
    await checkOrder(wsA, wsB);
  });

  await test.step('open dashboard in workspace B', async () => {
    await checkOrder(wsB, wsA);
  });
});

test('should pick locator from browser', async ({ cli, server, openDashboard }) => {
  server.setContent('/', '<button style="position:fixed;top:0;left:0;width:200px;height:100px">Submit</button>', 'text/html');

  await cli('open', server.PREFIX);

  const dashboard = await openDashboard();

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

  await expect(async () => {
    await dashboard.locator('img#display').click({ position: { x: 50, y: 25 } });
    const text = await Promise.race([
      copyPromise,
      new Promise<string>(f => setTimeout(() => f('timeout'), 1000))
    ]);
    expect(text).toContain('Submit');
  }).toPass();
});
