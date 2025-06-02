/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

import { kTargetClosedErrorMessage } from '../config/errors';
import { browserTest as it, expect } from '../config/browserTest';
import { attachFrame, verifyViewport } from '../config/utils';
import type { Page } from '@playwright/test';

it('should create new context @smoke', async function({ browser }) {
  expect(browser.contexts().length).toBe(0);
  const context = await browser.newContext();
  expect(browser.contexts()).toEqual([context]);
  expect(browser).toBe(context.browser());
  const context2 = await browser.newContext();
  expect(browser.contexts()).toEqual([context, context2]);
  await context.close();
  expect(browser.contexts()).toEqual([context2]);
  expect(browser).toBe(context.browser());
  await context2.close();
});

it('should be able to click across browser contexts', async function({ browser }) {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/29096' });
  expect(browser.contexts().length).toBe(0);

  const createPage = async () => {
    const page = await browser.newPage();
    await page.setContent(`<button>Click me</button>`);
    await page.locator('button').evaluate(button => {
      window['clicks'] = 0;
      button.addEventListener('click', () => ++window['clicks'], false);
    });
    return page;
  };

  const clickInPage = async (page, count) => {
    for (let i = 0; i < count; ++i)
      await page.locator('button').click();
  };

  const getClicks = async page => page.evaluate(() => window['clicks']);

  const page1 = await createPage();
  const page2 = await createPage();

  const CLICK_COUNT = 20;
  await Promise.all([
    clickInPage(page1, CLICK_COUNT),
    clickInPage(page2, CLICK_COUNT),
  ]);
  expect(await getClicks(page1)).toBe(CLICK_COUNT);
  expect(await getClicks(page2)).toBe(CLICK_COUNT);

  await page1.close();
  await page2.close();
});

it('window.open should use parent tab context', async function({ browser, server }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(url => window.open(url), server.EMPTY_PAGE)
  ]);
  expect(popup.context()).toBe(context);
  await context.close();
});

it('should isolate localStorage and cookies @smoke', async function({ browser, server }) {
  // Create two incognito contexts.
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  expect(context1.pages().length).toBe(0);
  expect(context2.pages().length).toBe(0);

  // Create a page in first incognito context.
  const page1 = await context1.newPage();
  await page1.goto(server.EMPTY_PAGE);
  await page1.evaluate(() => {
    localStorage.setItem('name', 'page1');
    document.cookie = 'name=page1';
  });

  expect(context1.pages().length).toBe(1);
  expect(context2.pages().length).toBe(0);

  // Create a page in second incognito context.
  const page2 = await context2.newPage();
  await page2.goto(server.EMPTY_PAGE);
  await page2.evaluate(() => {
    localStorage.setItem('name', 'page2');
    document.cookie = 'name=page2';
  });

  expect(context1.pages().length).toBe(1);
  expect(context2.pages().length).toBe(1);
  expect(context1.pages()[0]).toBe(page1);
  expect(context2.pages()[0]).toBe(page2);

  // Make sure pages don't share localstorage or cookies.
  expect(await page1.evaluate(() => localStorage.getItem('name'))).toBe('page1');
  expect(await page1.evaluate(() => document.cookie)).toBe('name=page1');
  expect(await page2.evaluate(() => localStorage.getItem('name'))).toBe('page2');
  expect(await page2.evaluate(() => document.cookie)).toBe('name=page2');

  // Cleanup contexts.
  await Promise.all([
    context1.close(),
    context2.close()
  ]);
  expect(browser.contexts().length).toBe(0);
});

it('should propagate default viewport to the page', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 456, height: 789 } });
  const page = await context.newPage();
  await verifyViewport(page, 456, 789);
  await context.close();
});

it('should make a copy of default viewport', async ({ browser }) => {
  const viewport = { width: 456, height: 789 };
  const context = await browser.newContext({ viewport });
  viewport.width = 567;
  const page = await context.newPage();
  await verifyViewport(page, 456, 789);
  await context.close();
});

it('should respect deviceScaleFactor', async ({ browser }) => {
  const context = await browser.newContext({ deviceScaleFactor: 3 });
  const page = await context.newPage();
  expect(await page.evaluate('window.devicePixelRatio')).toBe(3);
  await context.close();
});

it('should not allow deviceScaleFactor with null viewport', async ({ browser }) => {
  const error = await browser.newContext({ viewport: null, deviceScaleFactor: 1 }).catch(e => e);
  expect(error.message).toContain('"deviceScaleFactor" option is not supported with null "viewport"');
});

it('should not allow isMobile with null viewport', async ({ browser }) => {
  const error = await browser.newContext({ viewport: null, isMobile: true }).catch(e => e);
  expect(error.message).toContain('"isMobile" option is not supported with null "viewport"');
});

it('close() should work for empty context', async ({ browser }) => {
  const context = await browser.newContext();
  await context.close();
});

it('close() should abort waitForEvent', async ({ browser }) => {
  const context = await browser.newContext();
  const promise = context.waitForEvent('page').catch(e => e);
  await context.close();
  const error = await promise;
  expect(error.message).toContain(kTargetClosedErrorMessage);
});

it('close() should be callable twice', async ({ browser }) => {
  const context = await browser.newContext();
  await context.close();
  await context.close();
});

it('should pass self to close event', async ({ browser }) => {
  const newContext = await browser.newContext();
  const [closedContext] = await Promise.all([
    newContext.waitForEvent('close'),
    newContext.close()
  ]);
  expect(closedContext).toBe(newContext);
});

it('should not report frameless pages on error', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  server.setRoute('/empty.html', (req, res) => {
    res.end(`<a href="${server.EMPTY_PAGE}" target="_blank">Click me</a>`);
  });
  let popup: Page | undefined;
  context.on('page', p => popup = p);
  await page.goto(server.EMPTY_PAGE);
  await page.click('"Click me"');
  await context.close();
  if (popup) {
    // This races on Firefox :/
    expect(popup.isClosed()).toBeTruthy();
    expect(popup.mainFrame()).toBeTruthy();
  }
});

it('should return all of the pages', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const second = await context.newPage();
  const allPages = context.pages();
  expect(allPages.length).toBe(2);
  expect(allPages).toContain(page);
  expect(allPages).toContain(second);
  await context.close();
});

it('should close all belonging pages once closing context', async function({ browser }) {
  const context = await browser.newContext();
  await context.newPage();
  expect(context.pages().length).toBe(1);

  await context.close();
  expect(context.pages().length).toBe(0);
});

it('should disable javascript', async ({ browser, browserName }) => {
  {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('data:text/html, <script>var something = "forbidden"</script>');
    let error = null;
    await page.evaluate('something').catch(e => error = e);
    if (browserName === 'webkit')
      expect(error!.message).toContain('Can\'t find variable: something');
    else
      expect(error!.message).toContain('something is not defined');
    await context.close();
  }

  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('data:text/html, <script>var something = "forbidden"</script>');
    expect(await page.evaluate('something')).toBe('forbidden');
    await context.close();
  }
});

it('should be able to navigate after disabling javascript', async ({ browser, server }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await context.close();
});

it('should not hang on promises after disabling javascript', async ({ browserName, contextFactory }) => {
  it.fixme(browserName === 'firefox');
  const context = await contextFactory({ javaScriptEnabled: false });
  const page = await context.newPage();
  expect(await page.evaluate(() => 1)).toBe(1);
  expect(await page.evaluate(async () => 2)).toBe(2);
});

it('setContent should work after disabling javascript', async ({ contextFactory }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/18235' });
  const context = await contextFactory({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.setContent('<h1>Hello</h1>');
  await expect(page.locator('h1')).toHaveText('Hello');
});

it('should work with offline option', async ({ browser, server, browserName }) => {
  const context = await browser.newContext({ offline: true });
  const page = await context.newPage();
  let error = null;
  if (browserName === 'firefox') {
    // Firefox navigates to an error page, and this navigation might conflict with the
    // next navigation we do in test.
    // So we need to wait for the navigation explicitly.
    await Promise.all([
      page.goto(server.EMPTY_PAGE).catch(e => error = e),
      page.waitForEvent('framenavigated'),
    ]);
  } else {
    await page.goto(server.EMPTY_PAGE).catch(e => error = e);
  }
  expect(error).toBeTruthy();
  await context.setOffline(false);
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response!.status()).toBe(200);
  await context.close();
});

it('fetch with keepalive should throw when offline', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/35701' },
}, async ({ contextFactory, server }) => {
  const context = await contextFactory();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  const url = server.PREFIX + '/fetch';
  server.setRoute('/fetch', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify('hello'));
  });

  const okResponse = await page.evaluate(url => fetch(url, { cache: 'no-store', keepalive: true }).then(response => response.json()), url);
  expect(okResponse).toEqual('hello');

  await context.setOffline(true);
  const offlineResponse = await page.evaluate(async url => {
    try {
      const response = await fetch(url, { cache: 'no-store', keepalive: true });
      return await response.json();
    } catch {
      return 'error';
    }
  }, url);
  expect(offlineResponse).toEqual('error');
});

it('should emulate navigator.onLine', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  expect(await page.evaluate(() => window.navigator.onLine)).toBe(true);
  await context.setOffline(true);
  expect(await page.evaluate(() => window.navigator.onLine)).toBe(false);
  await context.setOffline(false);
  expect(await page.evaluate(() => window.navigator.onLine)).toBe(true);
  await context.close();
});

it('should emulate media in popup', async ({ browser, server }) => {
  {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(url => { window.open(url); }, server.EMPTY_PAGE),
    ]);
    expect(await popup.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(false);
    expect(await popup.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
    await context.close();
  }
  {
    const page = await browser.newPage({ colorScheme: 'light' });
    await page.goto(server.EMPTY_PAGE);
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(url => { window.open(url); }, server.EMPTY_PAGE),
    ]);
    expect(await popup.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(true);
    expect(await popup.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(false);
    await page.close();
  }
});

it('should emulate media in cross-process iframe', async ({ browser, server }) => {
  const page = await browser.newPage({ colorScheme: 'dark' });
  await page.goto(server.EMPTY_PAGE);
  await attachFrame(page, 'frame1', server.CROSS_PROCESS_PREFIX + '/empty.html');
  const frame = page.frames()[1];
  expect(await frame.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
  await page.close();
});

it('default user agent', async ({ launchPersistent, browser, page, mode }) => {
  it.skip(mode !== 'default');
  const { userAgent } = await (browser as any)._channel.defaultUserAgentForTest();
  expect(await page.evaluate(() => navigator.userAgent)).toBe(userAgent);
});

it('should create two pages in parallel in various contexts', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/34586' }
}, async ({ browser }) => {
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  await Promise.all([
    context1.newPage(),
    context1.newPage(),
    context2.newPage(),
    context2.newPage(),
  ]);
  await context1.close();
  await context2.close();
  const context3 = await browser.newContext();
  await Promise.all([
    context3.newPage(),
    context3.newPage(),
  ]);
  await context3.close();
});
