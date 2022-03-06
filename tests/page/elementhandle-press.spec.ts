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

import { test as it, expect } from './pageTest';

it('should work', async ({ page }) => {
  await page.setContent(`<input type='text' />`);
  await page.press('input', 'h');
  expect(await page.$eval('input', input => input.value)).toBe('h');
});

it('should not select existing value', async ({ page }) => {
  await page.setContent(`<input type='text' value='hello' />`);
  await page.press('input', 'w');
  expect(await page.$eval('input', input => input.value)).toBe('whello');
});

it('should reset selection when not focused', async ({ page }) => {
  await page.setContent(`<input type='text' value='hello' /><div tabIndex=2>text</div>`);
  await page.$eval('input', input => {
    input.selectionStart = 2;
    input.selectionEnd = 4;
    document.querySelector('div').focus();
  });
  await page.press('input', 'w');
  expect(await page.$eval('input', input => input.value)).toBe('whello');
});

it('should not modify selection when focused', async ({ page }) => {
  await page.setContent(`<input type='text' value='hello' />`);
  await page.$eval('input', input => {
    input.focus();
    input.selectionStart = 2;
    input.selectionEnd = 4;
  });
  await page.press('input', 'w');
  expect(await page.$eval('input', input => input.value)).toBe('hewo');
});

it('should work with number input', async ({ page, browserName }) => {
  it.fail(browserName === 'webkit', 'Started failing after https://github.com/WebKit/WebKit/commit/c92a2aea185d63b5e9998608a9c0321a461c496c');
  await page.setContent(`<input type='number' value=2 />`);
  await page.press('input', '1');
  expect(await page.$eval('input', input => input.value)).toBe('12');
});
