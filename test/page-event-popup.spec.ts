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

import { it, expect } from './fixtures';

it('should work', async ({browser}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => window['__popup'] = window.open('about:blank')),
  ]);
  expect(await page.evaluate(() => !!window.opener)).toBe(false);
  expect(await popup.evaluate(() => !!window.opener)).toBe(true);
  await context.close();
});

it('should work with window features', async ({browser, server}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => window['__popup'] = window.open(window.location.href, 'Title', 'toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=780,height=200,top=0,left=0')),
  ]);
  expect(await page.evaluate(() => !!window.opener)).toBe(false);
  expect(await popup.evaluate(() => !!window.opener)).toBe(true);
  await context.close();
});

it('should emit for immediately closed popups', async ({browser}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => {
      const win = window.open('about:blank');
      win.close();
    }),
  ]);
  expect(popup).toBeTruthy();
  await context.close();
});

it('should emit for immediately closed popups 2', async ({browser, server}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => {
      const win = window.open(window.location.href);
      win.close();
    }),
  ]);
  expect(popup).toBeTruthy();
  await context.close();
});

it('should be able to capture alert', async ({browser}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const evaluatePromise = page.evaluate(() => {
    const win = window.open('');
    win.alert('hello');
  });
  const popup = await page.waitForEvent('popup');
  const dialog = await popup.waitForEvent('dialog');
  expect(dialog.message()).toBe('hello');
  await dialog.dismiss();
  await evaluatePromise;
  await context.close();
});

it('should work with empty url', async ({browser}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => window['__popup'] = window.open('')),
  ]);
  expect(await page.evaluate(() => !!window.opener)).toBe(false);
  expect(await popup.evaluate(() => !!window.opener)).toBe(true);
  await context.close();
});

it('should work with noopener and no url', async ({browser}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => window['__popup'] = window.open(undefined, null, 'noopener')),
  ]);
  // Chromium reports `about:blank#blocked` here.
  expect(popup.url().split('#')[0]).toBe('about:blank');
  expect(await page.evaluate(() => !!window.opener)).toBe(false);
  expect(await popup.evaluate(() => !!window.opener)).toBe(false);
  await context.close();
});

it('should work with noopener and about:blank', async ({browser}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => window['__popup'] = window.open('about:blank', null, 'noopener')),
  ]);
  expect(await page.evaluate(() => !!window.opener)).toBe(false);
  expect(await popup.evaluate(() => !!window.opener)).toBe(false);
  await context.close();
});

it('should work with noopener and url', async ({browser, server}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(url => window['__popup'] = window.open(url, null, 'noopener'), server.EMPTY_PAGE),
  ]);
  expect(await page.evaluate(() => !!window.opener)).toBe(false);
  expect(await popup.evaluate(() => !!window.opener)).toBe(false);
  await context.close();
});

it('should work with clicking target=_blank', async ({browser, server}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<a target=_blank rel="opener" href="/one-style.html">yo</a>');
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.click('a'),
  ]);
  expect(await page.evaluate(() => !!window.opener)).toBe(false);
  expect(await popup.evaluate(() => !!window.opener)).toBe(true);
  await context.close();
});

it('should work with fake-clicking target=_blank and rel=noopener', async ({browser, server}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<a target=_blank rel=noopener href="/one-style.html">yo</a>');
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.$eval('a', a => a.click()),
  ]);
  expect(await page.evaluate(() => !!window.opener)).toBe(false);
  expect(await popup.evaluate(() => !!window.opener)).toBe(false);
  await context.close();
});

it('should work with clicking target=_blank and rel=noopener', async ({browser, server}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<a target=_blank rel=noopener href="/one-style.html">yo</a>');
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.click('a'),
  ]);
  expect(await page.evaluate(() => !!window.opener)).toBe(false);
  expect(await popup.evaluate(() => !!window.opener)).toBe(false);
  await context.close();
});

it('should not treat navigations as new popups', async ({browser, server}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<a target=_blank rel=noopener href="/one-style.html">yo</a>');
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.click('a'),
  ]);
  let badSecondPopup = false;
  page.on('popup', () => badSecondPopup = true);
  await popup.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
  await context.close();
  expect(badSecondPopup).toBe(false);
});

