/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test as it, expect } from './pageTest';

it.describe(`greek keyboard layout`, () => {
  it.beforeEach(async ({ page, server, toImpl }) => {
    await page.keyboard.changeLayout('el-GR');
    await page.goto(server.PREFIX + '/input/keyboard.html');
  });

  it(`should fire key events on α`, async ({ page }) => {
    await page.keyboard.press('α');
    expect(await page.evaluate('getResult()')).toBe(
        ['Keydown: α KeyA 65 []',
          'Keypress: α KeyA 945 945 []',
          'Keyup: α KeyA 65 []'].join('\n'));
  });

  it(`should type ε on KeyE`, async ({ page }) => {
    await page.keyboard.press('KeyE');
    expect(await page.evaluate('getResult()')).toBe(
        ['Keydown: ε KeyE 69 []',
          'Keypress: ε KeyE 949 949 []',
          'Keyup: ε KeyE 69 []'].join('\n'));
  });

  it(`should fire key events on Σ`, async ({ page }) => {
    await page.keyboard.press('Σ');
    expect(await page.evaluate('getResult()')).toBe(
        ['Keydown: Σ KeyS 83 []',
          'Keypress: Σ KeyS 931 931 []',
          'Keyup: Σ KeyS 83 []'].join('\n'));
  });

  it(`should type Δ on Shift+KeyD`, async ({ page }) => {
    await page.keyboard.press('Shift+KeyD');
    expect(await page.evaluate('getResult()')).toBe(
        ['Keydown: Shift ShiftLeft 16 [Shift]',
          'Keydown: Δ KeyD 68 [Shift]',
          'Keypress: Δ KeyD 916 916 [Shift]',
          'Keyup: Δ KeyD 68 [Shift]',
          'Keyup: Shift ShiftLeft 16 []'].join('\n'));
    await expect(page.locator('textarea')).toHaveValue('Δ');
  });
});

it.describe(`portuguese keyboard layout`, () => {
  it.beforeEach(async ({ page, server, toImpl }) => {
    await page.keyboard.changeLayout('pt-PT');
    await page.goto(server.PREFIX + '/input/keyboard.html');
  });

  it(`should type backslash on Backquote`, async ({ page }) => {
    await page.keyboard.press('Backquote');
    expect(await page.evaluate('getResult()')).toBe(
        ['Keydown: \\ Backquote 220 []',
          'Keypress: \\ Backquote 92 92 []',
          'Keyup: \\ Backquote 220 []'].join('\n'));
  });

  it(`should type ! on Shift+Digit1`, async ({ page }) => {
    await page.keyboard.press('Shift+Digit1');
    expect(await page.evaluate('getResult()')).toBe(
        ['Keydown: Shift ShiftLeft 16 [Shift]',
          'Keydown: ! Digit1 49 [Shift]',
          'Keypress: ! Digit1 33 33 [Shift]',
          'Keyup: ! Digit1 49 [Shift]',
          'Keyup: Shift ShiftLeft 16 []'].join('\n'));
  });
});

it.describe(`us keyboard layout`, () => {
  it.beforeEach(async ({ page, server, toImpl }) => {
    await page.keyboard.changeLayout('en-US');
    await page.goto(server.PREFIX + '/input/keyboard.html');
  });

  it(`should type backslash on Backslash`, async ({ page }) => {
    await page.keyboard.press('Backslash');
    expect(await page.evaluate('getResult()')).toBe(
        ['Keydown: \\ Backslash 220 []',
          'Keypress: \\ Backslash 92 92 []',
          'Keyup: \\ Backslash 220 []'].join('\n'));
  });
});

it(`should throw exception on invalid layout format`, async ({ page }) => {
  await expect(async () => await page.keyboard.changeLayout('invalid')).rejects.toThrowError();
});

const testData = {
  'en_us': { keyCode: 65, key: 'a' },
  'el_gr': { keyCode: 65, key: 'α' },
  'pt_br': { keyCode: 65, key: 'a' },
  'pt_pt': { keyCode: 65, key: 'a' },
  'es_mx': { keyCode: 65, key: 'a' },
  'es_es': { keyCode: 65, key: 'a' },
};

for (const [locale, { key, keyCode }] of Object.entries(testData)) {
  it(`should fire events on KeyA for ${locale} locale`, async ({ page, server }) => {
    await page.keyboard.changeLayout(locale);
    await page.goto(server.PREFIX + '/input/keyboard.html');

    await page.keyboard.press('KeyA');
    const charCode = key.charCodeAt(0);
    expect(await page.evaluate('getResult()')).toBe(
        [`Keydown: ${key} KeyA ${keyCode} []`,
          `Keypress: ${key} KeyA ${charCode} ${charCode} []`,
          `Keyup: ${key} KeyA ${keyCode} []`].join('\n'));
  });
}
