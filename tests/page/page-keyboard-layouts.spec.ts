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

it.describe(`greek keyboard layout`, () => {
  it.beforeEach(async ({ page, server, toImpl }) => {
    toImpl(page).keyboard._testKeyboardLayout('he');
    await page.goto(server.PREFIX + '/input/keyboard.html');
  });

  it(`should fire key events on α`, async ({ page }) => {
    await page.keyboard.press('α');
    expect(await page.evaluate('getResult()')).toBe(
        ['Keydown: α KeyA 945 []',
          'Keypress: α KeyA 945 945 []',
          'Keyup: α KeyA 945 []'].join('\n'));
  });

  it(`should type ε on KeyE`, async ({ page }) => {
    await page.keyboard.press('KeyE');
    expect(await page.evaluate('getResult()')).toBe(
        ['Keydown: ε KeyE 949 []',
          'Keypress: ε KeyE 949 949 []',
          'Keyup: ε KeyE 949 []'].join('\n'));
  });

  it(`should fire key events on Σ`, async ({ page }) => {
    await page.keyboard.press('Σ');
    expect(await page.evaluate('getResult()')).toBe(
        ['Keydown: Σ KeyS 963 []',
          'Keypress: Σ KeyS 931 931 []',
          'Keyup: Σ KeyS 963 []'].join('\n'));
  });

  it(`should type Δ on Shift+KeyD`, async ({ page }) => {
    await page.keyboard.press('Shift+KeyD');
    expect(await page.evaluate('getResult()')).toBe(
        ['Keydown: Shift ShiftLeft 16 [Shift]',
          'Keydown: Δ KeyD 948 [Shift]',
          'Keypress: Δ KeyD 916 916 [Shift]',
          'Keyup: Δ KeyD 948 [Shift]',
          'Keyup: Shift ShiftLeft 16 []'].join('\n'));
    await expect(page.locator('textarea')).toHaveValue('Δ');
  });
});

it.describe(`portuguese keyboard layout`, () => {
  it.beforeEach(async ({ page, server, toImpl }) => {
    toImpl(page).keyboard._testKeyboardLayout('po');
    await page.goto(server.PREFIX + '/input/keyboard.html');
  });

  it(`should type backslash on Backquote`, async ({ page }) => {
    await page.keyboard.press('Backquote');
    expect(await page.evaluate('getResult()')).toBe(
        ['Keydown: \\ Backquote 92 []',
          'Keypress: \\ Backquote 92 92 []',
          'Keyup: \\ Backquote 92 []'].join('\n'));
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

it(`should fallback to us on invalid layout format`, async ({ page, toImpl, server }) => {
  // portuguese layout is po, not pt, should fallback
  toImpl(page).keyboard._testKeyboardLayout('pt');
  await page.goto(server.PREFIX + '/input/keyboard.html');
  await page.keyboard.press('Backquote');
  expect(await page.evaluate('getResult()')).toBe(
      ['Keydown: ` Backquote 96 []',
        'Keypress: ` Backquote 96 96 []',
        'Keyup: ` Backquote 96 []'].join('\n'));
});
