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
import path from 'path';

it('should hover @smoke', async ({ page, server, headless }) => {
  it.skip(!headless, 'headed messes up with hover');

  await page.goto(server.PREFIX + '/input/scrollable.html');
  const button = page.locator('#button-6');
  await button.hover();
  expect(await page.evaluate(() => document.querySelector('button:hover').id)).toBe('button-6');
});

it('should hover when Node is removed', async ({ page, server, headless }) => {
  it.skip(!headless, 'headed messes up with hover');

  await page.goto(server.PREFIX + '/input/scrollable.html');
  await page.evaluate(() => delete window['Node']);
  const button = page.locator('#button-6');
  await button.hover();
  expect(await page.evaluate(() => document.querySelector('button:hover').id)).toBe('button-6');
});

it('should fill input', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  const handle = page.locator('input');
  await handle.fill('some value');
  expect(await page.evaluate(() => window['result'])).toBe('some value');
});

it('should fill input when Node is removed', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.evaluate(() => delete window['Node']);
  const handle = page.locator('input');
  await handle.fill('some value');
  expect(await page.evaluate(() => window['result'])).toBe('some value');
});

it('should clear input', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  const handle = page.locator('input');
  await handle.fill('some value');
  expect(await page.evaluate(() => window['result'])).toBe('some value');
  await handle.clear();
  expect(await page.evaluate(() => window['result'])).toBe('');
});

it('should check the box', async ({ page }) => {
  await page.setContent(`<input id='checkbox' type='checkbox'></input>`);
  const input = page.locator('input');
  await input.check();
  expect(await page.evaluate('checkbox.checked')).toBe(true);
});

it('should check the box using setChecked', async ({ page }) => {
  await page.setContent(`<input id='checkbox' type='checkbox'></input>`);
  const input = page.locator('input');
  await input.setChecked(true);
  expect(await page.evaluate('checkbox.checked')).toBe(true);
  await input.setChecked(false);
  expect(await page.evaluate('checkbox.checked')).toBe(false);
});

it('should uncheck the box', async ({ page }) => {
  await page.setContent(`<input id='checkbox' type='checkbox' checked></input>`);
  const input = page.locator('input');
  await input.uncheck();
  expect(await page.evaluate('checkbox.checked')).toBe(false);
});

it('should select single option', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  const select = page.locator('select');
  await select.selectOption('blue');
  expect(await page.evaluate(() => window['result'].onInput)).toEqual(['blue']);
  expect(await page.evaluate(() => window['result'].onChange)).toEqual(['blue']);
});

it('should focus and blur a button', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  const button = page.locator('button');
  expect(await button.evaluate(button => document.activeElement === button)).toBe(false);

  let focused = false;
  let blurred = false;
  await page.exposeFunction('focusEvent', () => focused = true);
  await page.exposeFunction('blurEvent', () => blurred = true);
  await button.evaluate(button => {
    button.addEventListener('focus', window['focusEvent']);
    button.addEventListener('blur', window['blurEvent']);
  });

  await button.focus();
  expect(focused).toBe(true);
  expect(blurred).toBe(false);
  expect(await button.evaluate(button => document.activeElement === button)).toBe(true);

  await button.blur();
  expect(focused).toBe(true);
  expect(blurred).toBe(true);
  expect(await button.evaluate(button => document.activeElement === button)).toBe(false);
});

it('focus should respect strictness', async ({ page, server }) => {
  await page.setContent('<div>A</div><div>B</div>');
  const error = await page.locator('div').focus().catch(e => e);
  expect(error.message).toContain('strict mode violation');
});

it('should dispatch click event via ElementHandles', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  const button = page.locator('button');
  await button.dispatchEvent('click');
  expect(await page.evaluate(() => window['result'])).toBe('Clicked');
});

it('should upload the file', async ({ page, server, asset }) => {
  await page.goto(server.PREFIX + '/input/fileupload.html');
  const filePath = path.relative(process.cwd(), asset('file-to-upload.txt'));
  const input = page.locator('input[type=file]');
  await input.setInputFiles(filePath);
  expect(await page.evaluate(e => (e as HTMLInputElement).files[0].name, await input.elementHandle())).toBe('file-to-upload.txt');
});
