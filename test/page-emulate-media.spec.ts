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

import { it, expect } from './fixtures';
import { attachFrame } from './utils';

it('should emulate type', async ({page, server}) => {
  expect(await page.evaluate(() => matchMedia('screen').matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia('print').matches)).toBe(false);
  await page.emulateMedia({ media: 'print' });
  expect(await page.evaluate(() => matchMedia('screen').matches)).toBe(false);
  expect(await page.evaluate(() => matchMedia('print').matches)).toBe(true);
  await page.emulateMedia({});
  expect(await page.evaluate(() => matchMedia('screen').matches)).toBe(false);
  expect(await page.evaluate(() => matchMedia('print').matches)).toBe(true);
  await page.emulateMedia({ media: null });
  expect(await page.evaluate(() => matchMedia('screen').matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia('print').matches)).toBe(false);
});

it('should throw in case of bad type argument', async ({page, server}) => {
  let error = null;
  // @ts-expect-error 'bad' is not a valid media type
  await page.emulateMedia({ media: 'bad'}).catch(e => error = e);
  expect(error.message).toContain('media: expected one of (screen|print|null)');
});

it('should emulate scheme work', async ({page, server}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(false);
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(false);
});

it('should default to light', async ({page, server}) => {
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(false);

  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(false);

  await page.emulateMedia({ colorScheme: null });
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(false);
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(true);
});

it('should throw in case of bad argument', async ({page, server}) => {
  let error = null;
  // @ts-expect-error 'bad' is not a valid media type
  await page.emulateMedia({ colorScheme: 'bad' }).catch(e => error = e);
  expect(error.message).toContain('colorScheme: expected one of (dark|light|no-preference|null)');
});

it('should work during navigation', async ({page, server}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  const navigated = page.goto(server.EMPTY_PAGE);
  for (let i = 0; i < 9; i++) {
    await Promise.all([
      page.emulateMedia({ colorScheme: (['dark', 'light'] as const)[i & 1] }),
      new Promise(f => setTimeout(f, 1)),
    ]);
  }
  await navigated;
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
});

it('should work in popup', async ({browser, server}) => {
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

it('should work in cross-process iframe', async ({browser, server}) => {
  const page = await browser.newPage({ colorScheme: 'dark' });
  await page.goto(server.EMPTY_PAGE);
  await attachFrame(page, 'frame1', server.CROSS_PROCESS_PREFIX + '/empty.html');
  const frame = page.frames()[1];
  expect(await frame.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
  await page.close();
});

it('should change the actual colors in css', async ({page}) => {
  await page.setContent(`
    <style>
      @media (prefers-color-scheme: dark) {
        div {
          background: black;
          color: white;
        }
      }
      @media (prefers-color-scheme: light) {
        div {
          background: white;
          color: black;
        }
      }

    </style>
    <div>Hello</div>
  `);
  function getBackgroundColor() {
    return page.$eval('div', div => window.getComputedStyle(div).backgroundColor);
  }

  await page.emulateMedia({ colorScheme: 'light' });
  expect(await getBackgroundColor()).toBe('rgb(255, 255, 255)');

  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await getBackgroundColor()).toBe('rgb(0, 0, 0)');

  await page.emulateMedia({ colorScheme: 'light' });
  expect(await getBackgroundColor()).toBe('rgb(255, 255, 255)');
});
