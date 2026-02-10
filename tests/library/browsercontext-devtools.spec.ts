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

import type { APIRequestContext, Page } from 'playwright-core';

const it = contextTest.extend<{ rcPage: Page, controllerUrl: string, controller: APIRequestContext }>({
  controllerUrl: async ({ context }, use) => {
    const { url } = await (context as any)._devtoolsStart();
    await use(url);
    await (context as any)._devtoolsStop();
  },
  rcPage: async ({ controllerUrl, browserType }, use) => {
    const rcBrowser = await browserType.launch();
    const rcPage = await rcBrowser.newPage();
    await rcPage.goto(controllerUrl);
    await use(rcPage);
    await rcBrowser.close();
  },
  controller: async ({ controllerUrl, playwright }, use) => {
    const controller = await playwright.request.newContext({ baseURL: controllerUrl });
    await use(controller);
    await controller.dispose();
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

it('should show remote tabs in unified tab bar', async ({ rcPage, browser, controller }) => {
  const remoteContext = await browser.newContext();
  const { url: remoteUrl } = await (remoteContext as any)._devtoolsStart();
  const remoteWsUrl = remoteUrl.replace(/^http/, 'ws') + '/ws';

  const remotePage = await remoteContext.newPage();
  await remotePage.goto('data:text/html,<title>Remote Page</title>');

  const response = await controller.post('/sources?name=Remote&wsUrl=' + encodeURIComponent(remoteWsUrl));
  expect(response.status()).toBe(200);

  await expect(rcPage.locator('#tabstrip [role="tab"]')).toHaveCount(1);
  await expect(rcPage.locator('#tabstrip')).toMatchAriaSnapshot(`
    - tablist:
      - tab /Remote Page.*/
  `);

  await (remoteContext as any)._devtoolsStop();
  await remoteContext.close();
});

it('should navigate via omnibox', async ({ rcPage, page, server }) => {
  const omnibox = rcPage.locator('#omnibox');
  await omnibox.fill(server.PREFIX + '/title.html');
  await omnibox.press('Enter');
  await expect(page).toHaveURL(server.PREFIX + '/title.html');
  await expect(page).toHaveTitle('Woof-Woof');
});

it('should navigate back and forward via toolbar buttons', async ({ rcPage, page, server }) => {
  await page.goto(server.PREFIX + '/title.html');
  await expect(rcPage.locator('#omnibox')).toHaveValue(/\/title\.html$/);

  await page.goto(server.EMPTY_PAGE);
  await expect(rcPage.locator('#omnibox')).toHaveValue(/\/empty\.html$/);

  // Click back button.
  await rcPage.locator('.nav-btn[title="Back"]').click();
  await expect(page).toHaveURL(server.PREFIX + '/title.html');
  await expect(rcPage.locator('#omnibox')).toHaveValue(/\/title\.html$/);

  // Click forward button.
  await rcPage.locator('.nav-btn[title="Forward"]').click();
  await expect(page).toHaveURL(server.EMPTY_PAGE);
  await expect(rcPage.locator('#omnibox')).toHaveValue(/\/empty\.html$/);
});

it('should reload page via toolbar button', async ({ rcPage, page, server }) => {
  await page.goto(server.PREFIX + '/title.html');
  await page.evaluate(() => (window as any).__reloadTest = true);
  expect(await page.evaluate(() => (window as any).__reloadTest)).toBe(true);

  const [response] = await Promise.all([
    page.waitForNavigation(),
    rcPage.locator('.nav-btn[title="Reload"]').click(),
  ]);
  expect(response!.url()).toContain('/title.html');
  // After reload, the injected variable should be gone.
  expect(await page.evaluate(() => (window as any).__reloadTest)).toBe(undefined);
});

it('should send mouse clicks through screencast', async ({ rcPage, page }) => {
  await page.goto('data:text/html,<body style="margin:0"><div id="target" style="width:100vw;height:100vh"></div><script>window.clicked=false;document.getElementById("target").addEventListener("click",()=>{window.clicked=true})</script></body>');
  await expect(rcPage.locator('#display')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);

  // First click captures the screencast.
  const display = rcPage.locator('#display');
  await display.click();
  await expect(rcPage.locator('.screen')).toHaveClass(/captured/);

  // Second click sends the click through to the target page's full-viewport div.
  await display.click();
  await expect.poll(() => page.evaluate(() => (window as any).clicked)).toBe(true);
});

it('should send keyboard input through screencast', async ({ rcPage, page }) => {
  await page.goto('data:text/html,<body style="margin:0"><input id="inp" style="position:fixed;left:0;top:0;width:100vw;height:100vh;font-size:24px" /></body>');
  await expect(rcPage.locator('#display')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);

  // First click captures the screencast.
  const display = rcPage.locator('#display');
  await display.click();
  await expect(rcPage.locator('.screen')).toHaveClass(/captured/);

  // Second click hits the full-viewport input to focus it.
  await display.click();
  await expect(page.locator('#inp')).toBeFocused();

  // Type text through the screencast.
  const screen = rcPage.locator('.screen');
  await screen.pressSequentially('hello');

  await expect(page.locator('#inp')).toHaveValue('hello');
});

it('should release capture on Escape', async ({ rcPage, page }) => {
  await page.goto('data:text/html,<body>test</body>');
  await expect(rcPage.locator('#display')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);

  const display = rcPage.locator('#display');
  await display.click();
  await expect(rcPage.locator('.screen')).toHaveClass(/captured/);

  await rcPage.locator('.screen').press('Escape');
  await expect(rcPage.locator('.screen')).not.toHaveClass(/captured/);
});

it('should switch to a remote tab on click', async ({ rcPage, browser, controller }) => {
  const remoteContext = await browser.newContext();
  const { url: remoteUrl } = await (remoteContext as any)._devtoolsStart();
  const remoteWsUrl = remoteUrl.replace(/^http/, 'ws') + '/ws';

  const remotePage = await remoteContext.newPage();
  await remotePage.goto('data:text/html,<title>Remote Tab</title>');

  await controller.post('/sources?name=Remote&wsUrl=' + encodeURIComponent(remoteWsUrl));

  await expect(rcPage.locator('#tabstrip [role="tab"]')).toHaveCount(1, { timeout: 10000 });

  await rcPage.locator('#tabstrip [role="tab"]').first().click();
  await expect(rcPage.locator('#tabstrip [role="tab"]').first()).toHaveAttribute('aria-selected', 'true');

  await (remoteContext as any)._devtoolsStop();
  await remoteContext.close();
});

it('should send keyboard input to a remote tab through screencast', async ({ rcPage, browser, controller }) => {
  const remoteContext = await browser.newContext();
  const { url: remoteUrl } = await (remoteContext as any)._devtoolsStart();
  const remoteWsUrl = remoteUrl.replace(/^http/, 'ws') + '/ws';

  const remotePage = await remoteContext.newPage();
  await remotePage.goto('data:text/html,<body style="margin:0"><input id="inp" style="position:fixed;left:0;top:0;width:100vw;height:100vh;font-size:24px" /></body>');

  await controller.post('/sources?name=Remote&wsUrl=' + encodeURIComponent(remoteWsUrl));

  // Select the remote tab.
  await expect(rcPage.locator('#tabstrip [role="tab"]')).toHaveCount(1, { timeout: 10000 });
  await rcPage.locator('#tabstrip [role="tab"]').first().click();
  await expect(rcPage.locator('#display')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);

  // First click captures the screencast.
  const display = rcPage.locator('#display');
  await display.click();
  await expect(rcPage.locator('.screen')).toHaveClass(/captured/);

  // Second click hits the full-viewport input to focus it.
  await display.click();
  await expect(remotePage.locator('#inp')).toBeFocused();

  // Type text through the screencast.
  const screen = rcPage.locator('.screen');
  await screen.pressSequentially('hello');

  await expect(remotePage.locator('#inp')).toHaveValue('hello');

  await (remoteContext as any)._devtoolsStop();
  await remoteContext.close();
});
