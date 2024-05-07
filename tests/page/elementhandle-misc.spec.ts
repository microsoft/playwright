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

it('should hover', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/scrollable.html');
  const button = await page.$('#button-6');
  await button.hover();
  expect(await page.evaluate(() => document.querySelector('button:hover').id)).toBe('button-6');
});

it('should hover when Node is removed', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/scrollable.html');
  await page.evaluate(() => delete window['Node']);
  const button = await page.$('#button-6');
  await button.hover();
  expect(await page.evaluate(() => document.querySelector('button:hover').id)).toBe('button-6');
});

it('should fill input', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  const handle = await page.$('input');
  await handle.fill('some value');
  expect(await page.evaluate(() => window['result'])).toBe('some value');
});

it('should fill input when Node is removed', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.evaluate(() => delete window['Node']);
  const handle = await page.$('input');
  await handle.fill('some value');
  expect(await page.evaluate(() => window['result'])).toBe('some value');
});

it('should check the box', async ({ page }) => {
  await page.setContent(`<input id='checkbox' type='checkbox'></input>`);
  const input = await page.$('input');
  await input.check();
  expect(await page.evaluate('checkbox.checked')).toBe(true);
});

it('should check the box using setChecked', async ({ page }) => {
  await page.setContent(`<input id='checkbox' type='checkbox'></input>`);
  const input = await page.$('input');
  await input.setChecked(true);
  expect(await page.evaluate('checkbox.checked')).toBe(true);
  await input.setChecked(false);
  expect(await page.evaluate('checkbox.checked')).toBe(false);
});

it('should uncheck the box', async ({ page }) => {
  await page.setContent(`<input id='checkbox' type='checkbox' checked></input>`);
  const input = await page.$('input');
  await input.uncheck();
  expect(await page.evaluate('checkbox.checked')).toBe(false);
});

it('should select single option', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  const select = await page.$('select');
  await select.selectOption('blue');
  expect(await page.evaluate(() => window['result'].onInput)).toEqual(['blue']);
  expect(await page.evaluate(() => window['result'].onChange)).toEqual(['blue']);
});

it('should focus a button', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  const button = await page.$('button');
  expect(await button.evaluate(button => document.activeElement === button)).toBe(false);
  await button.focus();
  expect(await button.evaluate(button => document.activeElement === button)).toBe(true);
});

it('should allow disposing twice', async ({ page }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/29945' });
  await page.setContent('<section>39</section>');
  const element = await page.$('section');
  expect(element).toBeTruthy();
  await element.dispose();
  await element.dispose();
});
