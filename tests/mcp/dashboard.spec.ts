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
  const chips = dashboard.locator('.session-chip');
  await expect(chips).toHaveCount(1);
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
    const workspaceGroups = dashboard.locator('.workspace-group');
    await expect(workspaceGroups).toHaveCount(2);

    // Current workspace (first) should be first.
    await expect(workspaceGroups.nth(0).locator('.workspace-path-full')).toContainText(first);
    await expect(workspaceGroups.nth(0).locator('.session-chip')).toHaveCount(1);

    // Other workspace (second) should be second.
    await expect(workspaceGroups.nth(1).locator('.workspace-path-full')).toContainText(second);
    await expect(workspaceGroups.nth(1).locator('.session-chip')).toHaveCount(1);

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
  server.setContent('/', '<button style="position:fixed;inset:0;width:100vw;height:100vh">Submit</button>', 'text/html');

  await cli('open', server.PREFIX);

  const dashboard = await openDashboard();
  await dashboard.locator('.sidebar-tab').first().click();

  await dashboard.getByRole('button', { name: 'Show sidebar' }).click();
  await dashboard.getByRole('button', { name: 'Pick locator' }).click();

  await expect(dashboard.locator('div.dashboard-view')).toContainClass('interactive');

  await expect(async () => {
    const box = await dashboard.locator('img#display').boundingBox();
    await dashboard.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await expect(dashboard.locator('.cm-wrapper').first()).toContainText(`getByRole('button', { name: 'Submit' })`);
  }).toPass();
});

test('should show console and network tabs in sidebar', async ({ cli, server, openDashboard }) => {
  server.setContent('/dashboard-network-marker', JSON.stringify({ marker: 'dashboard-response-payload-marker' }), 'application/json');
  await cli('open', server.PREFIX);

  const dashboard = await openDashboard();
  await dashboard.locator('.session-chip').click();
  await dashboard.getByRole('button', { name: 'Show sidebar' }).click();

  await cli('run-code', `async (page) => {
    await page.evaluate(async () => {
      console.log('dashboard-console-marker');
      await fetch('${server.PREFIX}/dashboard-network-marker');
    });
  }`);

  await dashboard.getByRole('tab', { name: 'Console' }).click();
  await expect(dashboard.locator('.console-tab')).toContainText('dashboard-console-marker');

  await dashboard.getByRole('tab', { name: 'Network' }).click();
  await expect(dashboard.getByLabel('Network requests')).toContainText('dashboard-network-marker');

  await dashboard.getByLabel('Network requests').getByText('dashboard-network-marker').click();
  await dashboard.getByRole('tab', { name: 'Response' }).click();
  await expect(dashboard.locator('.network-response-body')).toContainText('dashboard-response-payload-marker');
});

test('sidebar', async ({ cli, server, openDashboard, mcpBrowser }) => {
  test.fixme(mcpBrowser === 'firefox', 'firefox has bug around context creation that breaks this test');
  await cli('open', server.PREFIX);

  const dashboard = await openDashboard();
  const sidebar = dashboard.getByRole('navigation', { name: 'Sessions' });
  await expect(sidebar).toMatchAriaSnapshot(`
- heading "Sessions"
- heading "${test.info().outputDir}"
- list:
  - listitem:
    - text: default
    - list:
      - listitem:
        - button "New Tab ${server.PREFIX}/"
  `);

  await cli('open', '--session=foo', server.PREFIX);
  await expect(sidebar).toMatchAriaSnapshot(`
- heading "Sessions"
- heading "${test.info().outputDir}"
- list:
  - listitem:
    - text: default
    - list "default tabs":
      - listitem:
        - button "New Tab ${server.PREFIX}/"
  - listitem:
    - text: foo
    - list:
      - listitem:
        - button "New Tab ${server.PREFIX}/"
  `);
});
