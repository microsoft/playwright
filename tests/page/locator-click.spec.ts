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

it('should work @smoke', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  const button = page.locator('button');
  await button.click();
  expect(await page.evaluate(() => window['result'])).toBe('Clicked');
});

it('should work with Node removed', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.evaluate(() => delete window['Node']);
  const button = page.locator('button');
  await button.click();
  expect(await page.evaluate(() => window['result'])).toBe('Clicked');
});

it('should work for TextNodes', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  const buttonTextNode = await page.evaluateHandle(() => document.querySelector('button').firstChild);
  await buttonTextNode.click();
  expect(await page.evaluate(() => window['result'])).toBe('Clicked');
});

it('should double click the button', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.evaluate(() => {
    window['double'] = false;
    const button = document.querySelector('button');
    button.addEventListener('dblclick', event => {
      window['double'] = true;
    });
  });
  const button = page.locator('button');
  await button.dblclick();
  expect(await page.evaluate('double')).toBe(true);
  expect(await page.evaluate('result')).toBe('Clicked');
});

it('should click if the target element is removed in pointerup event', async ({ page }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/21995' });
  await page.setContent(`<button id=clickme>Clickable</button>`);
  await page.$eval('#clickme', element => element.addEventListener('pointerup', () => element.remove(), false));
  await page.locator('#clickme').click();
});

it('should click if the target element is removed in pointerdown event', async ({ page }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/21995' });
  await page.setContent(`<button id=clickme>Clickable</button>`);
  await page.$eval('#clickme', element => element.addEventListener('pointerdown', () => element.remove(), false));
  await page.locator('#clickme').click();
});
