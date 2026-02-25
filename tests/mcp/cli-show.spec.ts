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
  showServer: async ({ cli }, use) => {
    const { output } = await cli('show', { env: { PWTEST_UNDER_TEST: '1' } });
    const urlMatch = output.match(/listening on (http:\/\/localhost:\d+)/);
    expect(urlMatch).toBeTruthy();
    await use(urlMatch![1]);
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

test('show interaction toggle', async ({ cli, page, server }) => {
  await cli('open', server.EMPTY_PAGE);
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();
  await expect(page.getByRole('button', { name: 'Read-only' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Interactive' })).toHaveAttribute('aria-pressed', 'false');

  await page.getByRole('button', { name: 'Interactive' }).click();
  await expect(page.getByRole('button', { name: 'Read-only' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Interactive' })).toHaveAttribute('aria-pressed', 'true');
});

test('clicking screen auto-engages interactive mode', async ({ cli, page, server }) => {
  await cli('open', server.PREFIX + '/css-transition.html');
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();

  // Starts in Read-only mode.
  await expect(page.getByRole('button', { name: 'Read-only' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Interactive' })).toHaveAttribute('aria-pressed', 'false');

  // Clicking the screen engages interactive mode.
  await page.locator('.screen').click();
  await expect(page.getByRole('button', { name: 'Interactive' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Read-only' })).toHaveAttribute('aria-pressed', 'false');
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

  await cli('open', server.EMPTY_PAGE);
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();

  await expect(page.getByRole('textbox', { name: 'Search or enter URL' })).toHaveValue(server.EMPTY_PAGE);
  await page.getByRole('textbox', { name: 'Search or enter URL' }).fill(server.PREFIX + '/omnibox-target.html');
  await page.getByRole('textbox', { name: 'Search or enter URL' }).press('Enter');

  await expect(page.getByRole('tab', { name: 'Omnibox Target' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Search or enter URL' })).toHaveValue(server.PREFIX + '/omnibox-target.html');
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
  await expect(omnibox).toHaveValue(server.PREFIX + '/history-first.html');
  await omnibox.fill(server.PREFIX + '/history-second.html');
  await omnibox.press('Enter');
  await expect(page.getByRole('tab', { name: 'History Second' })).toBeVisible();

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('tab', { name: 'History First' })).toBeVisible();

  await page.getByRole('button', { name: 'Forward' }).click();
  await expect(page.getByRole('tab', { name: 'History Second' })).toBeVisible();

  await expect(omnibox).toHaveValue(server.PREFIX + '/history-second.html');
  await omnibox.fill(server.PREFIX + '/reload-counter.html');
  await omnibox.press('Enter');
  await expect(page.getByRole('tab', { name: 'Reload Counter 1' })).toBeVisible();

  await page.getByRole('button', { name: 'Reload' }).click();
  await expect(page.getByRole('tab', { name: 'Reload Counter 2' })).toBeVisible();
});

test('chrome devtools', async ({ cli, page, server, mcpBrowser }) => {
  test.skip(mcpBrowser !== 'chromium' && mcpBrowser !== 'chrome');
  await cli('open', server.PREFIX);
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();

  await page.getByRole('button', { name: 'Interactive' }).click();
  await page.getByRole('button', { name: 'Chrome DevTools' }).click();
  const devtools = page.frameLocator('iframe[title="Chrome DevTools"]');
  await devtools.getByRole('tab', { name: 'Console' }).click();

  await cli('eval', 'console.log("hello-from-cli-show")');
  await expect(devtools.getByText('hello-from-cli-show')).toBeVisible();
});

test('read-only closes chrome devtools', async ({ cli, page, server, mcpBrowser }) => {
  test.skip(mcpBrowser !== 'chromium' && mcpBrowser !== 'chrome');
  await cli('open', server.PREFIX);
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();

  await page.getByRole('button', { name: 'Interactive' }).click();
  await page.getByRole('button', { name: 'Chrome DevTools' }).click();
  await expect(page.getByRole('button', { name: 'Chrome DevTools' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('iframe[title="Chrome DevTools"]')).toHaveCount(1);

  await page.getByRole('button', { name: 'Read-only' }).click();
  await expect(page.getByRole('button', { name: 'Chrome DevTools' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('iframe[title="Chrome DevTools"]')).toHaveCount(0);
});

test('pick locator disable paths', async ({ cli, page, server }) => {
  await cli('open', server.PREFIX + '/css-transition.html');
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();

  await expect(page.getByRole('button', { name: 'Pick locator' })).toHaveAttribute('aria-pressed', 'false');

  // Disable via toolbar toggle.
  await page.getByRole('button', { name: 'Pick locator' }).click();
  await expect(page.getByRole('button', { name: 'Pick locator' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Click an element to pick its locator')).toBeVisible();

  await page.getByRole('button', { name: 'Pick locator' }).click();
  await expect(page.getByRole('button', { name: 'Pick locator' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('Click an element to pick its locator')).toBeHidden();

  // Disable via Escape while focused on the screen.
  await page.getByRole('button', { name: 'Pick locator' }).click();
  await expect(page.getByRole('button', { name: 'Pick locator' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Click an element to pick its locator')).toBeVisible();

  await page.locator('.screen').click();
  await page.keyboard.press('Escape');

  await expect(page.getByRole('button', { name: 'Pick locator' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('Click an element to pick its locator')).toBeHidden();
});

test('pick locator copies locator to clipboard', async ({ cli, page, server, browserName }) => {
  server.setContent('/pick-locator-target.html', `<style>@keyframes a{0%{opacity:1}100%{opacity:.9}}</style><div id='picker-target' style='position:fixed; inset:0; background:red; animation:a 1s infinite'></div>`, 'text/html');

  await cli('open', server.PREFIX + '/pick-locator-target.html');
  await page.goto('/');
  if (browserName === 'chromium')
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('link', { name: /default/ }).click();

  await page.getByRole('button', { name: 'Interactive' }).click();
  await page.getByRole('button', { name: 'Pick locator' }).click();
  await expect(page.getByRole('button', { name: 'Pick locator' })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.screen').click();
  await expect(page.getByText(/^Copied:/)).toBeVisible();
  if (browserName === 'chromium') {
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('#picker-target');
  }
});

test('locator picking is disabled when switching back to Read-only', async ({ cli, page, server }) => {
  await cli('open', server.PREFIX + '/css-transition.html');
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();

  await page.getByRole('button', { name: 'Interactive' }).click();
  await page.getByRole('button', { name: 'Pick locator' }).click();
  await expect(page.getByRole('button', { name: 'Pick locator' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Click an element to pick its locator')).toBeVisible();

  await page.getByRole('button', { name: 'Read-only' }).click();
  await expect(page.getByRole('button', { name: 'Pick locator' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('Click an element to pick its locator')).toBeHidden();
});

test('copied locator toast clears on page change', async ({ cli, page, server, browserName }) => {
  server.setContent('/pick-locator-target.html', `<style>@keyframes a{0%{opacity:1}100%{opacity:.9}}</style><div id='picker-target' style='position:fixed; inset:0; background:red; animation:a 1s infinite'></div>`, 'text/html');
  server.setContent('/toast-next.html', `<title>Toast Next</title><h1>next</h1>`, 'text/html');

  await cli('open', server.PREFIX + '/pick-locator-target.html');
  await page.goto('/');
  if (browserName === 'chromium')
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('link', { name: /default/ }).click();

  await page.getByRole('button', { name: 'Interactive' }).click();
  await page.getByRole('button', { name: 'Pick locator' }).click();
  await expect(page.getByRole('button', { name: 'Pick locator' })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.screen').click();
  await expect(page.getByText(/^Copied:/)).toBeVisible();

  await expect(page.getByRole('textbox', { name: 'Search or enter URL' })).toHaveValue(server.PREFIX + '/pick-locator-target.html');
  await page.getByRole('textbox', { name: 'Search or enter URL' }).fill(server.PREFIX + '/toast-next.html');
  await page.getByRole('textbox', { name: 'Search or enter URL' }).press('Enter');

  await expect(page.getByRole('tab', { name: 'Toast Next' })).toBeVisible();
  await expect(page.getByText(/^Copied:/)).toBeHidden();
});

test('close session while viewing devtools shows disconnected overlay', async ({ cli, page, server }) => {
  await cli('open', server.PREFIX + '/css-transition.html');
  await page.goto('/');
  await page.getByRole('link', { name: /default/ }).click();
  await expect(page.getByRole('button', { name: 'Interactive' })).toBeEnabled();

  await cli('close');
  await expect(page.getByText('Disconnected')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Interactive' })).toBeDisabled();
});

test('running show twice gets same PID', async ({ cli }) => {
  const one = await cli('show', { env: { PWTEST_UNDER_TEST: '1' } });
  const two = await cli('show', { env: { PWTEST_UNDER_TEST: '1' } });
  expect(one.output).toEqual(two.output);
});

test('kill-all closes devtools', async ({ cli }) => {
  const one = await cli('show', { env: { PWTEST_UNDER_TEST: '1' } });
  await cli('kill-all');
  const two = await cli('show', { env: { PWTEST_UNDER_TEST: '1' } });
  expect(one.output).not.toEqual(two.output);
});
