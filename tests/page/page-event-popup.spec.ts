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

import { test as it, expect } from './pageTest';

it('should work @smoke', async ({ page }) => {
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => window['__popup'] = window.open('about:blank')),
  ]);
  expect(await page.evaluate(() => !!window.opener)).toBe(false);
  expect(await popup.evaluate(() => !!window.opener)).toBe(true);
});

it('should work with window features', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => window['__popup'] = window.open(window.location.href, 'Title', 'toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=780,height=200,top=0,left=0')),
  ]);
  expect(await page.evaluate(() => !!window.opener)).toBe(false);
  expect(await popup.evaluate(() => !!window.opener)).toBe(true);
});

it('should emit for immediately closed popups', async ({ page }) => {
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => {
      const win = window.open('about:blank');
      win.close();
    }),
  ]);
  expect(popup).toBeTruthy();
});

it('should emit for immediately closed popups 2', async ({ page, server, browserName, video }) => {
  await page.goto(server.EMPTY_PAGE);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => {
      const win = window.open(window.location.href);
      win.close();
    }),
  ]);
  expect(popup).toBeTruthy();
});

it('should be able to capture alert', async ({ page }) => {
  const evaluatePromise = page.evaluate(() => {
    const win = window.open('');
    win.alert('hello');
  });
  const [popup, dialog] = await Promise.all([
    page.waitForEvent('popup'),
    page.context().waitForEvent('dialog'),
  ]);
  expect(dialog.message()).toBe('hello');
  expect(dialog.page()).toBe(popup);
  await dialog.dismiss();
  await evaluatePromise;
});

it('should work with empty url', async ({ page }) => {
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => window['__popup'] = window.open('')),
  ]);
  expect(await page.evaluate(() => !!window.opener)).toBe(false);
  expect(await popup.evaluate(() => !!window.opener)).toBe(true);
});

it('should work with noopener and no url', async ({ page }) => {
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => window['__popup'] = window.open(undefined, null, 'noopener')),
  ]);
  // Chromium reports `about:blank#blocked` here.
  expect(popup.url().split('#')[0]).toBe('about:blank');
  expect(await page.evaluate(() => !!window.opener)).toBe(false);
  expect(await popup.evaluate(() => !!window.opener)).toBe(false);
});

it('should work with noopener and about:blank', async ({ page }) => {
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => window['__popup'] = window.open('about:blank', null, 'noopener')),
  ]);
  expect(await page.evaluate(() => !!window.opener)).toBe(false);
  expect(await popup.evaluate(() => !!window.opener)).toBe(false);
});

it('should work with noopener and url', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(url => window['__popup'] = window.open(url, null, 'noopener'), server.EMPTY_PAGE),
  ]);
  expect(await page.evaluate(() => !!window.opener)).toBe(false);
  expect(await popup.evaluate(() => !!window.opener)).toBe(false);
});

it('should work with clicking target=_blank', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<a target=_blank rel="opener" href="/one-style.html">yo</a>');
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.click('a'),
  ]);
  expect(await page.evaluate(() => !!window.opener)).toBe(false);
  expect(await popup.evaluate(() => !!window.opener)).toBe(true);
  expect(popup.mainFrame().page()).toBe(popup);
});

it('should work with fake-clicking target=_blank and rel=noopener', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<a target=_blank rel=noopener href="/one-style.html">yo</a>');
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.$eval('a', a => a.click()),
  ]);
  expect(await page.evaluate(() => !!window.opener)).toBe(false);
  expect(await popup.evaluate(() => !!window.opener)).toBe(false);
});

it('should work with clicking target=_blank and rel=noopener', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<a target=_blank rel=noopener href="/one-style.html">yo</a>');
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.click('a'),
  ]);
  expect(await page.evaluate(() => !!window.opener)).toBe(false);
  expect(await popup.evaluate(() => !!window.opener)).toBe(false);
});

it('should report popup opened from iframes', async ({ page, server, browserName }) => {
  await page.goto(server.PREFIX + '/frames/two-frames.html');
  const frame = page.frame('uno');
  expect(frame).toBeTruthy();
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    frame.evaluate(() => window.open('')),
  ]);
  expect(popup).toBeTruthy();
});
