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

test('show interaction toggle', async ({ cli, page }) => {
  await cli('open');
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();
  await expect(page.getByRole('button', { name: 'Read-only' })).toHaveClass(/active/);
  await expect(page.getByRole('button', { name: 'Interactive' })).not.toHaveClass(/active/);

  await page.getByRole('button', { name: 'Interactive' }).click();
  await expect(page.getByRole('button', { name: 'Read-only' })).not.toHaveClass(/active/);
  await expect(page.getByRole('button', { name: 'Interactive' })).toHaveClass(/active/);
});

test('screencast interaction is blocked until consent is enabled', async ({ cli, page }) => {
  await cli('open');
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();

  await page.locator('.screen').click();
  await expect(page.getByText('Switch to Interactive mode to control the page')).toBeVisible();

  await page.getByRole('button', { name: 'Interactive' }).click();
  await page.locator('.screen').hover();
  await expect(page.getByText('Switch to Interactive mode to control the page')).toBeHidden();
  await expect(page.getByText('Click to interact · Esc to release')).toBeVisible();
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

test('omnibox navigates on Enter', async ({ cli, page, server }) => {
  server.setContent('/omnibox-target.html', `<title>Omnibox Target</title><h1>target</h1>`, 'text/html');

  await cli('open');
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();

  await page.getByRole('textbox', { name: 'Search or enter URL' }).fill(server.PREFIX + '/omnibox-target.html');
  await page.getByRole('textbox', { name: 'Search or enter URL' }).press('Enter');

  await expect(page.getByRole('tab', { name: 'Omnibox Target' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Search or enter URL' })).toHaveValue(server.PREFIX + '/omnibox-target.html');
});

test('omnibox prefixes URL without scheme', async ({ cli, page }) => {
  await cli('open');
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();

  await page.getByRole('textbox', { name: 'Search or enter URL' }).fill('example.com');
  await page.getByRole('textbox', { name: 'Search or enter URL' }).press('Enter');

  await expect(page.getByRole('textbox', { name: 'Search or enter URL' })).toHaveValue(/https:\/\/example\.com/);
});

test('toolbar back/forward/reload', async ({ cli, page, server }) => {
  server.setContent('/history-first.html', `<title>History First</title><h1>first</h1>`, 'text/html');
  server.setContent('/history-second.html', `<title>History Second</title><h1>second</h1>`, 'text/html');
  server.setContent('/reload-counter.html', `
    <title>Reload Counter</title>
    <script>
      const next = (Number(sessionStorage.getItem('reload-count') || '0') + 1);
      sessionStorage.setItem('reload-count', String(next));
      document.title = 'Reload Counter ' + next;
    </script>
  `, 'text/html');

  await cli('open', server.PREFIX + '/history-first.html');
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();

  const omnibox = page.getByRole('textbox', { name: 'Search or enter URL' });
  await omnibox.fill(server.PREFIX + '/history-second.html');
  await omnibox.press('Enter');
  await expect(page.getByRole('tab', { name: 'History Second' })).toBeVisible();

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('tab', { name: 'History First' })).toBeVisible();

  await page.getByRole('button', { name: 'Forward' }).click();
  await expect(page.getByRole('tab', { name: 'History Second' })).toBeVisible();

  await omnibox.fill(server.PREFIX + '/reload-counter.html');
  await omnibox.press('Enter');
  await expect(page.getByRole('tab', { name: 'Reload Counter 1' })).toBeVisible();

  await page.getByRole('button', { name: 'Reload' }).click();
  await expect(page.getByRole('tab', { name: 'Reload Counter 2' })).toBeVisible();
});

test('display screencast image', async ({ cli, page }) => {
  await cli('open', 'data:text/html,<body style="background:red"></body>');
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();
  await expect(page.getByRole('img', { name: 'screencast' })).toHaveAttribute('src', /^data:image\/jpeg;base64,/, { timeout: 15000 });
});

test('chrome devtools', async ({ cli, page, server }) => {
  await cli('open', server.PREFIX);
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();

  await page.getByRole('button', { name: 'Interactive' }).click();
  await page.getByTitle('Show Chrome DevTools').click();
  const devtools = page.frameLocator('iframe[title="Chrome DevTools"]');
  await devtools.getByRole('tab', { name: 'Console' }).click();

  await cli('eval', 'console.log("hello-from-cli-show")');
  await expect(devtools.getByText('hello-from-cli-show')).toBeVisible();
});

test('pick locator disable paths', async ({ cli, page, server }) => {
  await cli('open', server.PREFIX + '/title.html');
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();

  await expect(page.getByTitle('Pick locator')).toBeDisabled();
  await expect(page.getByTitle('Show Chrome DevTools')).toBeDisabled();
  await expect(page.getByTitle('Cancel pick locator')).toBeHidden();

  await page.getByRole('button', { name: 'Interactive' }).click();

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

  await page.getByRole('button', { name: 'Interactive' }).click();
  await page.getByTitle('Pick locator').click();
  await page.waitForTimeout(500); // TODO: replace this with a more robust wait, e.g. on the button being enabled.
  await page.locator('.screen').click();
  await expect(page.getByText(/^Copied:/)).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('#picker-target');
});

test('locator picking is disabled when switching back to Read-only', async ({ cli, page, server }) => {
  await cli('open', server.PREFIX + '/title.html');
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();

  await page.getByRole('button', { name: 'Interactive' }).click();
  await page.getByTitle('Pick locator').click();
  await expect(page.getByTitle('Cancel pick locator')).toBeVisible();
  await expect(page.getByText('Click an element to pick its locator')).toBeVisible();

  await page.getByRole('button', { name: 'Read-only' }).click();
  await expect(page.getByTitle('Pick locator')).toBeDisabled();
  await expect(page.getByTitle('Cancel pick locator')).toBeHidden();
  await expect(page.getByText('Click an element to pick its locator')).toBeHidden();
});

test('copied locator toast clears on page change', async ({ cli, page, server }) => {
  server.setContent('/pick-locator-target.html', `<div id='picker-target' style='position:fixed; inset:0; background:red;'></div>`, 'text/html');
  server.setContent('/toast-next.html', `<title>Toast Next</title><h1>next</h1>`, 'text/html');

  await cli('open', server.PREFIX + '/pick-locator-target.html');
  await page.goto('/');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('link', { name: /default/ }).click();

  await page.getByRole('button', { name: 'Interactive' }).click();
  await page.getByTitle('Pick locator').click();
  await page.waitForTimeout(500); // TODO: replace this with a more robust wait, e.g. on the button being enabled.
  await page.locator('.screen').click();
  await expect(page.getByText(/^Copied:/)).toBeVisible();

  await page.getByRole('textbox', { name: 'Search or enter URL' }).fill(server.PREFIX + '/toast-next.html');
  await page.getByRole('textbox', { name: 'Search or enter URL' }).press('Enter');

  await expect(page.getByRole('tab', { name: 'Toast Next' })).toBeVisible();
  await expect(page.getByText(/^Copied:/)).toBeHidden();
});

test('show with --port is blocking and does not use singleton', async ({ startCli }) => {
  const show1 = await startCli('show', '--port=0');
  await show1.waitForOutput('Listening on ');

  const show2 = await startCli('show', '--port=0');
  await show2.waitForOutput('Listening on ');

  await Promise.all([show1.kill('SIGINT'), show2.kill('SIGINT')]);
});
