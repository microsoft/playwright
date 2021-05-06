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

it('should check the box', async ({page}) => {
  await page.setContent(`<input id='checkbox' type='checkbox'></input>`);
  await page.check('input');
  expect(await page.evaluate(() => window['checkbox'].checked)).toBe(true);
});

it('should not check the checked box', async ({page}) => {
  await page.setContent(`<input id='checkbox' type='checkbox' checked></input>`);
  await page.check('input');
  expect(await page.evaluate(() => window['checkbox'].checked)).toBe(true);
});

it('should uncheck the box', async ({page}) => {
  await page.setContent(`<input id='checkbox' type='checkbox' checked></input>`);
  await page.uncheck('input');
  expect(await page.evaluate(() => window['checkbox'].checked)).toBe(false);
});

it('should not uncheck the unchecked box', async ({page}) => {
  await page.setContent(`<input id='checkbox' type='checkbox'></input>`);
  await page.uncheck('input');
  expect(await page.evaluate(() => window['checkbox'].checked)).toBe(false);
});

it('should check the box by label', async ({page}) => {
  await page.setContent(`<label for='checkbox'><input id='checkbox' type='checkbox'></input></label>`);
  await page.check('label');
  expect(await page.evaluate(() => window['checkbox'].checked)).toBe(true);
});

it('should check the box outside label', async ({page}) => {
  await page.setContent(`<label for='checkbox'>Text</label><div><input id='checkbox' type='checkbox'></input></div>`);
  await page.check('label');
  expect(await page.evaluate(() => window['checkbox'].checked)).toBe(true);
});

it('should check the box inside label w/o id', async ({page}) => {
  await page.setContent(`<label>Text<span><input id='checkbox' type='checkbox'></input></span></label>`);
  await page.check('label');
  expect(await page.evaluate(() => window['checkbox'].checked)).toBe(true);
});

it('should check the box outside shadow dom label', async ({page}) => {
  await page.setContent('<div></div>');
  await page.$eval('div', div => {
    const root = div.attachShadow({ mode: 'open' });
    const label = document.createElement('label');
    label.setAttribute('for', 'target');
    label.textContent = 'Click me';
    root.appendChild(label);
    const input = document.createElement('input');
    input.setAttribute('type', 'checkbox');
    input.setAttribute('id', 'target');
    root.appendChild(input);
  });
  await page.check('label');
  expect(await page.$eval('input', input => input.checked)).toBe(true);
});

it('should check radio', async ({page}) => {
  await page.setContent(`
    <input type='radio'>one</input>
    <input id='two' type='radio'>two</input>
    <input type='radio'>three</input>`);
  await page.check('#two');
  expect(await page.evaluate(() => window['two'].checked)).toBe(true);
});

it('should check the box by aria role', async ({page}) => {
  await page.setContent(`<div role='checkbox' id='checkbox'>CHECKBOX</div>
    <script>
      checkbox.addEventListener('click', () => checkbox.setAttribute('aria-checked', 'true'));
    </script>`);
  await page.check('div');
  expect(await page.evaluate(() => window['checkbox'].getAttribute('aria-checked'))).toBe('true');
});

it('should throw when not a checkbox', async ({page}) => {
  await page.setContent(`<div>Check me</div>`);
  const error = await page.check('div').catch(e => e);
  expect(error.message).toContain('Not a checkbox or radio button');
});

it('should check the box inside a button', async ({page}) => {
  await page.setContent(`<div role='button'><input type='checkbox'></div>`);
  await page.check('input');
  expect(await page.$eval('input', input => input.checked)).toBe(true);
  expect(await page.isChecked('input')).toBe(true);
  expect(await (await page.$('input')).isChecked()).toBe(true);
});

it('should check the label with position', async ({page, server}) => {
  await page.setContent(`
    <input id='checkbox' type='checkbox' style='width: 5px; height: 5px;'>
    <label for='checkbox'>
      <a href=${JSON.stringify(server.EMPTY_PAGE)}>I am a long link that goes away so that nothing good will happen if you click on me</a>
      Click me
    </label>`);
  const box = await (await page.$('text=Click me')).boundingBox();
  await page.check('text=Click me', { position: { x: box.width - 10, y: 2 } });
  expect(await page.$eval('input', input => input.checked)).toBe(true);
});

it('trial run should not check', async ({page}) => {
  await page.setContent(`<input id='checkbox' type='checkbox'></input>`);
  await page.check('input', { trial: true });
  expect(await page.evaluate(() => window['checkbox'].checked)).toBe(false);
});

it('trial run should not uncheck', async ({page}) => {
  await page.setContent(`<input id='checkbox' type='checkbox' checked></input>`);
  await page.uncheck('input', { trial: true });
  expect(await page.evaluate(() => window['checkbox'].checked)).toBe(true);
});
