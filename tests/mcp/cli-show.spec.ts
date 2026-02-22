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

import { test as cliTest, expect } from './cli-fixtures';

const test = cliTest.extend<{ showServer: string }>({
  showServer: async ({ startCli }, use) => {
    const show = await startCli('show', '--port=0');
    await show.waitForOutput('Listening on ');
    await use(show.output.match(/Listening on (.+)/)[1]);
  },
  baseURL: ({ showServer }, use) => use(showServer),
});

test('grid', async ({ cli, page, server }) => {
  await cli('open', server.PREFIX);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'default' })).toMatchAriaSnapshot(`
    - link /default/:
      - button "Close session"
      - img "screencast"
  `);
});

test('show connected status', async ({ cli, page }) => {
  await cli('open');
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();
  await expect(page.locator('#status')).toHaveText('Connected');
  await expect(page.locator('#status')).toHaveClass(/connected/);
});

test('show tab title after navigation', async ({ cli, page, server }) => {
  await cli('open', server.PREFIX + '/title.html');
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();
  await expect(page.getByRole('tablist')).toMatchAriaSnapshot(`
    - tablist:
      - /children: equal
      - tab "Woof-Woof" [selected]
  `);
});

test('show multiple tabs', async ({ cli, page, server }) => {
  await cli('open', server.PREFIX + '/title.html');
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();
  await page.getByRole('button', { name: 'New Tab' }).click();
  await expect(page.getByRole('tablist')).toMatchAriaSnapshot(`
    - tablist:
      - /children: equal
      - tab "Woof-Woof"
      - tab "about:blank" [selected]
  `);
});

test('switch active tab on click', async ({ cli, page, server }) => {
  await cli('open', server.PREFIX + '/title.html');
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();
  await page.getByRole('button', { name: 'New Tab' }).click();
  await expect(page.getByRole('tablist')).toMatchAriaSnapshot(`
    - tablist:
      - /children: equal
      - tab "Woof-Woof"
      - tab "about:blank" [selected]
  `);
  await page.getByRole('tab', { name: 'Woof-Woof' }).click();
  await expect(page.getByRole('tablist')).toMatchAriaSnapshot(`
    - tablist:
      - /children: equal
      - tab "Woof-Woof" [selected]
      - tab "about:blank"
  `);
});

test('close tab via close button', async ({ cli, page, server }) => {
  await cli('open', server.PREFIX + '/title.html');
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();
  await page.getByRole('button', { name: 'New Tab' }).click();
  await expect(page.getByRole('tablist')).toMatchAriaSnapshot(`
    - tablist:
      - /children: equal
      - tab "Woof-Woof"
      - tab "about:blank" [selected]
  `);
  await page.getByRole('tab', { name: 'about:blank' }).getByRole('button', { name: 'Close tab' }).click();
  await expect(page.getByRole('tablist')).toMatchAriaSnapshot(`
    - tablist:
      - /children: equal
      - tab "Woof-Woof" [selected]
  `);
});

test('show no-pages placeholder when all tabs are closed', async ({ cli, page }) => {
  test.skip(process.platform === 'win32', 'closing the tab breaks following tests on windows, need to investigate');
  await cli('open');
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();
  await expect(page.getByRole('tablist')).toMatchAriaSnapshot(`
    - tablist:
      - /children: equal
      - tab /.*/ [selected]
  `);
  await page.getByRole('button', { name: 'Close tab' }).click();
  await expect(page.getByRole('tablist')).toMatchAriaSnapshot(`
    - /children: deep-equal
    - tablist
  `);
  await expect(page.locator('#no-pages')).toHaveText('No tabs open');
});

test('open new tab via new-tab button', async ({ cli, page }) => {
  await cli('open');
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();
  await expect(page.getByRole('tablist')).toMatchAriaSnapshot(`
    - tablist:
      - /children: equal
      - tab /.*/ [selected]
  `);
  await page.getByRole('button', { name: 'New Tab' }).click();
  await expect(page.getByRole('tablist')).toMatchAriaSnapshot(`
    - tablist:
      - /children: equal
      - tab /.*/
      - tab /.*/ [selected]
  `);
});

test('update omnibox on navigation', async ({ cli, page, server }) => {
  await cli('open', server.PREFIX + '/title.html');
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();
  await expect(page.getByRole('textbox', { name: 'Search or enter URL' })).toMatchAriaSnapshot(`
    - textbox "Search or enter URL": /.*\/title\.html/
  `);
});

test('chrome devtools', async ({ cli, page, server, mcpBrowser }) => {
  test.skip(mcpBrowser === 'firefox' || mcpBrowser === 'webkit');
  test.skip(process.platform === 'win32', 'somehow broken on windows CI, need to investigate');

  await cli('open', server.PREFIX);
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();

  await page.getByTitle('Show Chrome DevTools').click();
  const devtools = page.frameLocator('iframe');
  await devtools.getByRole('tab', { name: 'Console' }).click();

  await cli('eval', 'console.log("hello-from-cli-show")');
  await expect(devtools.getByText('hello-from-cli-show')).toBeVisible();
});

test('chrome devtools on unsupported browsers', async ({ cli, page, server, mcpBrowser }) => {
  test.skip(mcpBrowser !== 'firefox' && mcpBrowser !== 'webkit');

  await cli('open', server.PREFIX);
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();

  await expect(page.getByTitle('Pick locator')).toBeVisible();
  await expect(page.getByTitle('Show Chrome DevTools')).not.toBeVisible();
});

test('pick locator disable paths', async ({ cli, page, server }) => {
  await cli('open', server.PREFIX + '/title.html');
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();

  // Disable via toolbar toggle.
  await page.getByTitle('Pick locator').click();
  await expect(page.getByTitle('Cancel pick locator')).toBeVisible();
  await expect(page.getByText('Click an element to pick its locator')).toBeVisible();

  await page.getByTitle('Cancel pick locator').click();
  await expect(page.getByTitle('Pick locator')).toBeVisible();
  await expect(page.getByText('Click an element to pick its locator')).toBeHidden();

  // Disable via Escape while focused on the screen.
  await page.getByTitle('Pick locator').click();
  await expect(page.getByTitle('Cancel pick locator')).toBeVisible();
  await expect(page.getByText('Click an element to pick its locator')).toBeVisible();

  await page.locator('.screen').click();
  await page.keyboard.press('Escape');

  await expect(page.getByTitle('Pick locator')).toBeVisible();
  await expect(page.getByText('Click an element to pick its locator')).toBeHidden();
});

test('pick locator copies locator to clipboard', async ({ cli, page, server }) => {
  server.setContent('/pick-locator-target.html', `<div id='picker-target' style='position:fixed; inset:0; background:red;'></div>`, 'text/html');

  await cli('open', server.PREFIX + '/pick-locator-target.html');
  await page.goto('/');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('link', { name: /default/ }).click();

  await page.getByTitle('Pick locator').click();
  await page.waitForTimeout(2000); // TODO: replace this with a more robust wait, e.g. on the button being enabled.
  await page.locator('.screen').click();
  await expect(page.getByText(/^Copied:/)).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('#picker-target');
});

test('show with --port is blocking and does not use singleton', async ({ startCli }) => {
  const show1 = await startCli('show', '--port=0');
  await show1.waitForOutput('Listening on ');

  const show2 = await startCli('show', '--port=0');
  await show2.waitForOutput('Listening on ');
});
