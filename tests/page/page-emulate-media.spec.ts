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

import type { Page } from 'packages/playwright-test';
import { test as it, expect as baseExpect } from './pageTest';

const expect = baseExpect.extend({
  async toMatchMedia(page: Page, mediaQuery: string) {
    const pass = await page.evaluate(mediaQuery => matchMedia(mediaQuery).matches, mediaQuery).catch(() => false);
    return {
      message() {
        if (pass)
          return `Expected "${mediaQuery}" not to match, but it did`;
        else
          return `Expected "${mediaQuery}" to match, but it did not`;
      },
      pass,
      name: 'toMatchMedia',
    };
  },
});

it('should emulate type @smoke', async ({ page }) => {
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

it('should throw in case of bad media argument', async ({ page }) => {
  let error = null;
  // @ts-expect-error 'bad' is not a valid media type
  await page.emulateMedia({ media: 'bad' }).catch(e => error = e);
  expect(error.message).toContain('media: expected one of (screen|print|no-override)');
});

it('should emulate colorScheme should work @smoke', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(false);
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(false);
});

it('should default to light', async ({ page }) => {
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(false);

  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(false);

  await page.emulateMedia({ colorScheme: null });
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(false);
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(true);
});

it('should throw in case of bad colorScheme argument', async ({ page }) => {
  let error = null;
  // @ts-expect-error 'bad' is not a valid media type
  await page.emulateMedia({ colorScheme: 'bad' }).catch(e => error = e);
  expect(error.message).toContain('colorScheme: expected one of (dark|light|no-preference|no-override)');
});

it('should work during navigation', async ({ page, server }) => {
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

it('should change the actual colors in css', async ({ page }) => {
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

it('should emulate reduced motion', async ({ page }) => {
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: no-preference)').matches)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: no-preference)').matches)).toBe(false);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(false);
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: no-preference)').matches)).toBe(true);
  await page.emulateMedia({ reducedMotion: null });
});

it('should keep reduced motion and color emulation after reload', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/31328' });

  // Pre-conditions
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toEqual(false);
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(false);

  // Emulation
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toEqual(true);
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);

  // Force CanonicalBrowsingContext replacement in Firefox.
  server.setRoute('/empty.html', (req, res) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.end();
  });
  await page.goto(server.EMPTY_PAGE);

  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toEqual(true);
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
});

it('should emulate forcedColors ', async ({ page, browserName }) => {
  expect(await page.evaluate(() => matchMedia('(forced-colors: none)').matches)).toBe(true);
  await page.emulateMedia({ forcedColors: 'none' });
  expect(await page.evaluate(() => matchMedia('(forced-colors: none)').matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(false);
  await page.emulateMedia({ forcedColors: 'active' });
  expect(await page.evaluate(() => matchMedia('(forced-colors: none)').matches)).toBe(false);
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
  await page.emulateMedia({ forcedColors: null });
  expect(await page.evaluate(() => matchMedia('(forced-colors: none)').matches)).toBe(true);
});

it('should emulate contrast ', async ({ page }) => {
  await expect(page).toMatchMedia('(prefers-contrast: no-preference)');
  await page.emulateMedia({ contrast: 'no-preference' });
  await expect(page).toMatchMedia('(prefers-contrast: no-preference)');
  await expect(page).not.toMatchMedia('(prefers-contrast: more)');
  await page.emulateMedia({ contrast: 'more' });
  await expect(page).not.toMatchMedia('(prefers-contrast: no-preference)');
  await expect(page).toMatchMedia('(prefers-contrast: more)');
  await page.emulateMedia({ contrast: null });
  await expect(page).toMatchMedia('(prefers-contrast: no-preference)');
});
