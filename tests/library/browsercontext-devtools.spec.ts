/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { contextTest, expect } from '../config/browserTest';

import type { Page } from 'playwright-core';

const it = contextTest.extend<{ rcPage: Page }>({
  launchOptions: async ({ launchOptions }, use, testInfo) => {
    await use({
      ...launchOptions,
      // @ts-expect-error
      cdpPort: 15123 + testInfo.parallelIndex * 4,
    });
  },
  rcPage: async ({ context, browserType }, use) => {
    const { url } = await (context as any)._devtoolsStart();
    const rcBrowser = await browserType.launch();
    const rcPage = await rcBrowser.newPage();
    await rcPage.goto(url);
    await use(rcPage);
    await rcBrowser.close();
    await (context as any)._devtoolsStop();
  },
});

it('should show connected status', async ({ rcPage }) => {
  await expect(rcPage.locator('#status')).toHaveText('Connected');
  await expect(rcPage.locator('#status')).toHaveClass(/connected/);
});

it('should show tab title after navigation', async ({ rcPage, page, server }) => {
  await page.goto(server.PREFIX + '/title.html');
  await expect(rcPage.locator('#tabstrip')).toMatchAriaSnapshot(`
    - tablist:
      - /children: equal
      - tab "Woof-Woof" [selected]
  `);
});

it('should show multiple tabs', async ({ rcPage, context, page, server }) => {
  await page.goto(server.PREFIX + '/title.html');
  const page2 = await context.newPage();
  await page2.goto(server.EMPTY_PAGE);
  await expect(rcPage.locator('#tabstrip')).toMatchAriaSnapshot(`
    - tablist:
      - /children: equal
      - tab "Woof-Woof" [selected]
      - tab /.*/ [selected=false]
  `);
});

it('should switch active tab on click', async ({ rcPage, context, page, server }) => {
  await page.goto(server.PREFIX + '/title.html');
  const page2 = await context.newPage();
  await page2.goto(server.EMPTY_PAGE);
  await expect(rcPage.locator('#tabstrip')).toMatchAriaSnapshot(`
    - tablist:
      - /children: equal
      - tab "Woof-Woof" [selected]
      - tab /.*/ [selected=false]
  `);
  // Click the second (unselected) tab.
  await rcPage.locator('#tabstrip [role="tab"]').last().click();
  await expect(rcPage.locator('#tabstrip')).toMatchAriaSnapshot(`
    - tablist:
      - /children: equal
      - tab "Woof-Woof" [selected=false]
      - tab /.*/ [selected]
  `);
});

it('should close tab via close button', async ({ rcPage, context, page, server }) => {
  await page.goto(server.PREFIX + '/title.html');
  const page2 = await context.newPage();
  await page2.goto(server.EMPTY_PAGE);
  await expect(rcPage.locator('#tabstrip')).toMatchAriaSnapshot(`
    - tablist:
      - /children: equal
      - tab "Woof-Woof" [selected]
      - tab /.*/ [selected=false]
  `);
  // Close the second tab.
  await rcPage.locator('#tabstrip [role="tab"]').last().locator('.tab-close').click();
  await expect(rcPage.locator('#tabstrip')).toMatchAriaSnapshot(`
    - tablist:
      - /children: equal
      - tab "Woof-Woof" [selected]
  `);
});

it('should show no-pages placeholder when all tabs are closed', async ({ rcPage, page }) => {
  await expect(rcPage.locator('#tabstrip')).toMatchAriaSnapshot(`
    - tablist:
      - /children: equal
      - tab /.*/ [selected]
  `);
  await page.close();
  await expect(rcPage.locator('#tabstrip')).toMatchAriaSnapshot(`
    - /children: deep-equal
    - tablist
  `);
  await expect(rcPage.locator('#no-pages')).toBeVisible();
  await expect(rcPage.locator('#no-pages')).toHaveText('No tabs open');
});

it('should open new tab via new-tab button', async ({ rcPage }) => {
  await expect(rcPage.locator('#tabstrip')).toMatchAriaSnapshot(`
    - /children: deep-equal
    - tablist
  `);
  await rcPage.locator('#new-tab-btn').click();
  await expect(rcPage.locator('#tabstrip')).toMatchAriaSnapshot(`
    - tablist:
      - /children: equal
      - tab /.*/ [selected]
  `);
});

it('should update omnibox on navigation', async ({ rcPage, page, server }) => {
  await page.goto(server.PREFIX + '/title.html');
  await expect(rcPage.locator('#omnibox')).toMatchAriaSnapshot(`
    - /children: deep-equal
    - textbox "Search or enter URL": /.*\/title\.html/
  `);
});

it('should display screencast image', async ({ rcPage, page }) => {
  await page.goto('data:text/html,<body style="background:red"></body>');
  await expect(rcPage.locator('#display')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
});

it('should pick locator', async ({ rcPage, page }) => {
  await page.goto('data:text/html,<body style="margin:0"><button style="width:100vw;height:100vh">Submit</button></body>');
  await expect(rcPage.locator('#display')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);

  await rcPage.getByTitle('Pick locator').click();
  await expect(rcPage.getByTitle('Cancel pick locator')).toBeVisible();
  await expect(rcPage.locator('.capture-hint.visible')).toHaveText('Click an element to pick its locator');

  await rcPage.locator('#display').click();

  await expect(rcPage.locator('.capture-hint.visible code')).toBeVisible();
  await expect(rcPage.locator('.capture-hint.visible')).toContainText('Copied:');
  await expect(rcPage.getByTitle('Pick locator')).toBeVisible();
});

it.describe('Chrome DevTools', () => {
  it.skip(({ browserName }) => browserName !== 'chromium', 'Chrome DevTools is only available in Chromium');
  it('should show Chrome DevTools panel', async ({ page, rcPage }) => {
    await page.goto('data:text/html,<body style="background:red"></body>');

    const showButton = rcPage.getByTitle('Show Chrome DevTools');
    await expect(showButton).toBeVisible();
    await showButton.click();
    await expect(rcPage.getByTitle('Hide Chrome DevTools')).toBeVisible();
    const inspectorFrame = rcPage.locator('.inspector-frame');
    await expect(inspectorFrame).toBeVisible();
    await expect(inspectorFrame).toHaveAttribute('title', 'Chrome DevTools');
    const devtools = rcPage.frameLocator('.inspector-frame');
    await expect(devtools.getByRole('tab', { name: 'Elements' })).toBeVisible();
  });
});
