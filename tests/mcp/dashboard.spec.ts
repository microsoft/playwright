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
import os from 'os';
import path from 'path';

import { test, expect, installSaveFilePickerMock } from './cli-fixtures';

function displayPath(p: string): string {
  const home = os.homedir();
  if (p === home)
    return '~';
  if (p.startsWith(home + path.sep))
    return '~' + p.slice(home.length);
  return p;
}

test.beforeEach(({}, testInfo) => {
  process.env.PLAYWRIGHT_SERVER_REGISTRY = testInfo.outputPath('registry');
});

test('should show browser session chip', async ({ cli, server, startDashboardServer }) => {
  await cli('open', server.EMPTY_PAGE);

  const dashboard = await startDashboardServer();
  const sessions = dashboard.getByRole('region', { name: /^Session / });
  await expect(sessions).toHaveCount(1);
});

test('should show placeholder chip for browser with no contexts', async ({ boundBrowser, startDashboardServer }) => {
  expect(boundBrowser.contexts()).toHaveLength(0);

  const dashboard = await startDashboardServer();
  const sessions = dashboard.getByRole('region', { name: /^Session / });
  await expect(sessions).toHaveCount(1);
  await expect(sessions.getByText('No tabs open.')).toBeVisible();
  await expect(sessions.getByRole('button', { name: 'New tab' })).toHaveCount(0);
});

test('should show one row per context for a single browser', async ({ boundBrowser, server, startDashboardServer }) => {
  const contextA = await boundBrowser.newContext();
  const pageA = await contextA.newPage();
  await pageA.goto(server.EMPTY_PAGE);

  const dashboard = await startDashboardServer();
  const sessions = dashboard.getByRole('region', { name: /^Session / });
  await expect(sessions).toHaveCount(1);

  const contextB = await boundBrowser.newContext();
  const pageB = await contextB.newPage();
  await pageB.goto(server.EMPTY_PAGE);
  await expect(sessions).toHaveCount(2);
});

test('should show current workspace sessions first', async ({ cli, server, startDashboardServer }) => {
  const wsA = test.info().outputPath('workspace-a');
  const wsB = test.info().outputPath('workspace-b');

  await fs.promises.mkdir(path.join(wsA, '.playwright'), { recursive: true });
  await fs.promises.mkdir(path.join(wsB, '.playwright'), { recursive: true });

  await cli('open', server.EMPTY_PAGE, { cwd: wsA });
  await cli('open', server.EMPTY_PAGE, { cwd: wsB });

  const checkOrder = async (first: string, second: string) => {
    const dashboard = await startDashboardServer({ cwd: first });
    const workspaceGroups = dashboard.getByRole('region', { name: /^Workspace / });
    await expect(workspaceGroups).toHaveCount(2);

    // Current workspace (first) should be first.
    await expect(workspaceGroups.nth(0).getByRole('heading', { level: 3 })).toHaveText(displayPath(first));
    await expect(workspaceGroups.nth(0).getByRole('region', { name: /^Session / })).toHaveCount(1);

    // Other workspace (second) should be second.
    await expect(workspaceGroups.nth(1).getByRole('heading', { level: 3 })).toHaveText(displayPath(second));
    await expect(workspaceGroups.nth(1).getByRole('region', { name: /^Session / })).toHaveCount(1);
  };

  await test.step('open dashboard in workspace A', async () => {
    await checkOrder(wsA, wsB);
  });

  await test.step('open dashboard in workspace B', async () => {
    await checkOrder(wsB, wsA);
  });
});

function activeSession(dashboard: import('playwright-core').Page) {
  return dashboard.getByRole('region', { name: /^Session / }).filter({ has: dashboard.getByRole('option', { selected: true }) });
}

test('should activate session when show is called with -s', async ({ cli, server, startDashboardServer }) => {
  await cli('-s=sessA', 'open', server.EMPTY_PAGE);
  await cli('-s=sessB', 'open', server.EMPTY_PAGE);

  const dashboard = await startDashboardServer({ session: 'sessB' });
  await expect(activeSession(dashboard)).toHaveAccessibleName('Session sessB');
});

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

test('daemon show: closing page exits the process', async ({ cli, connectToDashboard }) => {
  const bindTitle = `--playwright-internal--${crypto.randomUUID()}`;
  const { exitCode, dashboardPid } = await cli('show', { bindTitle });
  expect(exitCode).toBe(0);
  expect(dashboardPid).toBeDefined();
  expect(isAlive(dashboardPid)).toBe(true);

  const browser = await connectToDashboard(bindTitle);
  const page = browser.contexts()[0].pages()[0];
  await page.close();

  await expect(() => expect(isAlive(dashboardPid)).toBe(false)).toPass();
});

test('should allow typing in omnibox in interactive mode', async ({ cli, server, startDashboardServer }) => {
  server.setContent('/page1', '<html><body>Page 1</body></html>', 'text/html');
  server.setContent('/page2', '<html><body>Page 2</body></html>', 'text/html');
  await cli('open', server.PREFIX + '/page1');

  const dashboard = await startDashboardServer();
  await dashboard.getByRole('navigation', { name: 'Sessions' }).getByRole('option').first().click();
  await expect(dashboard.locator('#omnibox')).toHaveValue(/page1/);

  // Enter interactive mode.
  await dashboard.getByRole('button', { name: 'Enable interactive mode' }).click();
  await expect(dashboard.getByRole('main')).toHaveClass(/interactive/);

  const schemeless = `${server.HOST}/page2`;
  await dashboard.locator('#omnibox').click();
  await dashboard.locator('#omnibox').fill(schemeless);
  await expect(dashboard.locator('#omnibox')).toHaveValue(schemeless);

  await dashboard.locator('#omnibox').press('Enter');
  await expect(dashboard.locator('#omnibox')).toHaveValue(server.PREFIX + '/page2', { timeout: 10000 });
});

test('save recording streams WebM bytes to the chosen file', async ({ cli, server, startDashboardServer }) => {
  await cli('open', server.EMPTY_PAGE);

  const dashboard = await startDashboardServer();
  const awaitBytes = await installSaveFilePickerMock(dashboard);
  await dashboard.getByRole('navigation', { name: 'Sessions' }).getByRole('option').first().click();
  await expect(dashboard.locator('img#display')).toBeVisible();

  // Enter recording mode from the normal toolbar.
  await dashboard.getByRole('button', { name: 'Record video' }).click();
  await expect(dashboard.locator('.mode-record-label')).toBeVisible();

  // Click the toggled record button again to transition to the 'stopped' phase.
  await dashboard.getByRole('button', { name: 'Stop recording' }).click();

  // Save the recording.
  await dashboard.getByRole('button', { name: 'Save recording' }).click();

  const bytes = await awaitBytes();
  // WebM files start with the EBML magic bytes.
  expect(bytes.subarray(0, 4)).toEqual(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
});
