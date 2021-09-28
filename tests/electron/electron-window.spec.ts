/**
 * Copyright (c) Microsoft Corporation.
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

import { electronTest as test, expect } from './electronTest';

test('should click the button', async ({ newWindow, server }) => {
  const window = await newWindow();
  await window.goto(server.PREFIX + '/input/button.html');
  await window.click('button');
  expect(await window.evaluate('result')).toBe('Clicked');
});

test('should check the box', async ({ newWindow }) => {
  const window = await newWindow();
  await window.setContent(`<input id='checkbox' type='checkbox'></input>`);
  await window.check('input');
  expect(await window.evaluate('checkbox.checked')).toBe(true);
});

test('should not check the checked box', async ({ newWindow }) => {
  const window = await newWindow();
  await window.setContent(`<input id='checkbox' type='checkbox' checked></input>`);
  await window.check('input');
  expect(await window.evaluate('checkbox.checked')).toBe(true);
});

test('should type into a textarea', async ({ newWindow }) => {
  const window = await newWindow();
  await window.evaluate(() => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();
  });
  const text = 'Hello world. I am the text that was typed!';
  await window.keyboard.type(text);
  expect(await window.evaluate(() => document.querySelector('textarea').value)).toBe(text);
});
