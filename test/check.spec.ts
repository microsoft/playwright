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
