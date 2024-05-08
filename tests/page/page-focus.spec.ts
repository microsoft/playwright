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

import { test as it, expect } from './pageTest';

it('should work @smoke', async function({ page, browserName }) {
  it.skip(browserName === 'firefox');

  await page.setContent(`<div id=d1 tabIndex=0></div>`);
  expect(await page.evaluate(() => document.activeElement.nodeName)).toBe('BODY');
  await page.focus('#d1');
  expect(await page.evaluate(() => document.activeElement.id)).toBe('d1');
});

it('should emit focus event', async function({ page }) {
  await page.setContent(`<div id=d1 tabIndex=0></div>`);
  let focused = false;
  await page.exposeFunction('focusEvent', () => focused = true);
  await page.$eval('#d1', d1 => d1.addEventListener('focus', window['focusEvent']));
  await page.focus('#d1');
  expect(focused).toBe(true);
});

it('should emit blur event', async function({ page }) {
  await page.setContent(`<div id=d1 tabIndex=0>DIV1</div><div id=d2 tabIndex=0>DIV2</div>`);
  await page.focus('#d1');
  let focused = false;
  let blurred = false;
  await page.exposeFunction('focusEvent', () => focused = true);
  await page.exposeFunction('blurEvent', () => blurred = true);
  await page.$eval('#d1', d1 => d1.addEventListener('blur', window['blurEvent']));
  await page.$eval('#d2', d2 => d2.addEventListener('focus', window['focusEvent']));
  await page.focus('#d2');
  expect(focused).toBe(true);
  expect(blurred).toBe(true);
});

it('should traverse focus', async function({ page }) {
  await page.setContent(`<input id="i1"><input id="i2">`);
  let focused = false;
  await page.exposeFunction('focusEvent', () => focused = true);
  await page.$eval('#i2', i2 => (i2 as HTMLInputElement).addEventListener('focus', window['focusEvent']));

  await page.focus('#i1');
  await page.keyboard.type('First');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Last');

  expect(focused).toBe(true);
  expect(await page.$eval('#i1', e => (e as HTMLInputElement).value)).toBe('First');
  expect(await page.$eval('#i2', e => (e as HTMLInputElement).value)).toBe('Last');
});

it('should traverse focus in all directions', async function({ page }) {
  await page.setContent(`<input value="1"><input value="2"><input value="3">`);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => (document.activeElement as HTMLInputElement).value)).toBe('1');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => (document.activeElement as HTMLInputElement).value)).toBe('2');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => (document.activeElement as HTMLInputElement).value)).toBe('3');
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => (document.activeElement as HTMLInputElement).value)).toBe('2');
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => (document.activeElement as HTMLInputElement).value)).toBe('1');
});

it('should traverse only form elements', async function({ page, browserName, platform }) {
  it.skip(platform !== 'darwin' || browserName !== 'webkit',
      'Chromium and WebKit both have settings for tab traversing all links, but it is only on by default in WebKit.');

  await page.setContent(`
    <input id="input-1">
    <button id="button">button</button>
    <a href id="link">link</a>
    <input id="input-2">
  `);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement.id)).toBe('input-1');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement.id)).toBe('input-2');
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => document.activeElement.id)).toBe('input-1');
  await page.keyboard.press('Alt+Tab');
  expect(await page.evaluate(() => document.activeElement.id)).toBe('button');
  await page.keyboard.press('Alt+Tab');
  expect(await page.evaluate(() => document.activeElement.id)).toBe('link');
  await page.keyboard.press('Alt+Tab');
  expect(await page.evaluate(() => document.activeElement.id)).toBe('input-2');
  await page.keyboard.press('Alt+Shift+Tab');
  expect(await page.evaluate(() => document.activeElement.id)).toBe('link');
  await page.keyboard.press('Alt+Shift+Tab');
  expect(await page.evaluate(() => document.activeElement.id)).toBe('button');
  await page.keyboard.press('Alt+Shift+Tab');
  expect(await page.evaluate(() => document.activeElement.id)).toBe('input-1');
});

it('clicking checkbox should activate it', async ({ page, browserName, headless, platform }) => {
  it.fixme(browserName !== 'chromium');

  await page.setContent(`<input type=checkbox></input>`);
  await page.click('input');
  const nodeName = await page.evaluate(() => document.activeElement.nodeName);
  expect(nodeName).toBe('INPUT');
});

it('keeps focus on element when attempting to focus a non-focusable element', async ({ page }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/14254' });

  await page.setContent(`
      <div id="focusable" tabindex="0">focusable</div>
      <div id="non-focusable">not focusable</div>
      <script>
        window.eventLog = [];

        const focusable = document.getElementById("focusable");

        focusable.addEventListener('blur', () => window.eventLog.push('blur focusable'));
        focusable.addEventListener('focus', () => window.eventLog.push('focus focusable'));

        const nonFocusable = document.getElementById("non-focusable");
        nonFocusable.addEventListener('blur', () => window.eventLog.push('blur non-focusable'));
        nonFocusable.addEventListener('focus', () => window.eventLog.push('focus non-focusable'));
      </script>
    `);
  await page.locator('#focusable').click();
  expect.soft(await page.evaluate(() => document.activeElement?.id)).toBe('focusable');
  await page.locator('#non-focusable').focus();
  expect.soft(await page.evaluate(() => document.activeElement?.id)).toBe('focusable');
  expect.soft(await page.evaluate(() => window['eventLog'])).toEqual([
    'focus focusable',
  ]);
});
