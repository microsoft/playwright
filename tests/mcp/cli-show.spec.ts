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
  await expect(page.locator('#status')).toHaveText('Connected');
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
  await expect(page.locator('#status')).toHaveText('Connected');
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
  await expect(page.locator('#status')).toHaveText('Connected');
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
  await expect(page.locator('#status')).toHaveText('Connected');
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
  await cli('open');
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();
  await expect(page.locator('#status')).toHaveText('Connected');
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
  await expect(page.locator('#status')).toHaveText('Connected');
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
  await expect(page.locator('#status')).toHaveText('Connected');
  await expect(page.getByRole('textbox', { name: 'Search or enter URL' })).toMatchAriaSnapshot(`
    - textbox "Search or enter URL": /.*\/title\.html/
  `);
});

test('display screencast image', async ({ cli, page }) => {
  await cli('open', 'data:text/html,<body style="background:red"></body>');
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();
  await expect(page.locator('#status')).toHaveText('Connected');
  await expect(page.getByRole('img', { name: 'screencast' })).toHaveAttribute('src', /^data:image\/jpeg;base64,/, { timeout: 15000 });
});

test('show with --port is blocking and does not use singleton', async ({ startCli }) => {
  const show1 = await startCli('show', '--port=0');
  await show1.waitForOutput('Listening on ');

  const show2 = await startCli('show', '--port=0');
  await show2.waitForOutput('Listening on ');

  await Promise.all([show1.kill('SIGINT'), show2.kill('SIGINT')]);
});
