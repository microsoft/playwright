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

function removeAccents(str: string) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

it.beforeEach(async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/keyboard.html');
});

for (const fn of ['press', 'down', 'up']) {
  it(`should throw exception on ${fn} with accented key`, async ({ page }) => {
    await page.keyboard.changeLayout('pt');
    await expect(async () => await page.keyboard[fn]('á')).rejects.toThrowError(`Accented key not supported: "á"`);
  });

  it(`should throw exception on ${fn} with shifted accented key`, async ({ page }) => {
    await page.keyboard.changeLayout('pt');
    await expect(async () => await page.keyboard[fn]('à')).rejects.toThrowError(`Accented key not supported: "à"`);
  });
}

it(`should handle dead key`, async ({ page }) => {
  await page.keyboard.changeLayout('pt');
  await page.keyboard.press('BracketRight');
  await expect(page.locator('textarea')).toHaveValue('');
  expect(await page.evaluate('getResult()')).toBe(
      ['Keydown: Dead BracketRight 186 []',
        'Keyup: Dead BracketRight 186 []',].join('\n'));
});

it(`should handle shifted dead key`, async ({ page }) => {
  await page.keyboard.changeLayout('pt');
  await page.keyboard.press('Shift+BracketRight');
  await expect(page.locator('textarea')).toHaveValue('');
  expect(await page.evaluate('getResult()')).toBe(
      ['Keydown: Shift ShiftLeft 16 [Shift]',
        'Keydown: Dead BracketRight 186 [Shift]',
        'Keyup: Dead BracketRight 186 [Shift]',
        'Keyup: Shift ShiftLeft 16 []',].join('\n'));
});

it(`should throw exception on invalid layout format`, async ({ page }) => {
  await expect(async () => await page.keyboard.changeLayout('invalid')).rejects.toThrowError(`Keyboard layout name "invalid" not found`);
});

// key, code, keyCode
type SimpleKeyTest = [string, string, number];
// key, deadkeyCode, deadkeyKeyCode, letterCode, letterKeyCode
type AccentedKeyTest = [...SimpleKeyTest, string, number];

const testData: Record<string, (SimpleKeyTest | AccentedKeyTest)[]> = {
  'us': [['`', 'Backquote', 192], ['~', 'Shift+Backquote', 192]],
  'gb': [['`', 'Backquote', 223], ['¬', 'Shift+Backquote', 223]],
  'dk': [['ø', 'Quote', 222], ['ä', 'BracketRight', 186, 'KeyA', 65], ['â', 'Shift+BracketRight', 186, 'KeyA', 65], ['Â', 'Shift+BracketRight', 186, 'Shift+KeyA', 65]],
  'fr': [['q', 'KeyA', 81], ['â', 'BracketLeft', 221, 'KeyQ', 65], ['ä', 'Shift+BracketLeft', 221, 'KeyQ', 65], ['Ä', 'Shift+BracketLeft', 221, 'Shift+KeyQ', 65]],
  'de': [['#', 'Backslash', 191], ['á', 'Equal', 221, 'KeyA', 65], ['à', 'Shift+Equal', 221, 'KeyA', 65], ['À', 'Shift+Equal', 221, 'Shift+KeyA', 65]],
  'it': [['è', 'BracketLeft', 186], ['é', 'Shift+BracketLeft', 186]],
  'pt': [['\\', 'Backquote', 220], ['á', 'BracketRight', 186, 'KeyA', 65], ['à', 'Shift+BracketRight', 186, 'KeyA', 65], ['À', 'Shift+BracketRight', 186, 'Shift+KeyA', 65]],
  'br': [['\'', 'Backquote', 192], ['á', 'BracketLeft', 219, 'KeyA', 65], ['à', 'Shift+BracketLeft', 219, 'KeyA', 65], ['À', 'Shift+BracketLeft', 219, 'Shift+KeyA', 65]],
  'ru': [['ф', 'KeyA', 65], ['э', 'Quote', 222], ['Ф', 'Shift+KeyA', 65]],
  'ua': [['ф', 'KeyA', 65], ['є', 'Quote', 222], ['Ф', 'Shift+KeyA', 65]],
  'es': [['¡', 'Equal', 221], ['à', 'BracketLeft', 186, 'KeyA', 65], ['â', 'Shift+BracketLeft', 186, 'KeyA', 65], ['Â', 'Shift+BracketLeft', 186, 'Shift+KeyA', 65]],
  'latam': [['¿', 'Equal', 221], ['á', 'BracketLeft', 186, 'KeyA', 65], ['ä', 'Shift+BracketLeft', 186, 'KeyA', 65], ['Ä', 'Shift+BracketLeft', 186, 'Shift+KeyA', 65]],
  'ch': [['ü', 'BracketLeft', 186], ['ô', 'Equal', 221, 'KeyO', 79], ['ò', 'Shift+Equal', 221, 'KeyO', 79], ['Ò', 'Shift+Equal', 221, 'Shift+KeyO', 79]],
  'fr-CH': [['è', 'BracketLeft', 186], ['ô', 'Equal', 221, 'KeyO', 79], ['ò', 'Shift+Equal', 221, 'KeyO', 79], ['Ò', 'Shift+Equal', 221, 'Shift+KeyO', 79]],
};

for (const [locale, test] of Object.entries(testData)) {
  it.describe(`${locale} keyboard layout`, () => {

    it.beforeEach(async ({ page }) => {
      await page.keyboard.changeLayout(locale);
    });

    for (const [key, code, keyCode, letterCode, letterKeyCode] of test) {
      const [shifted, unshiftedCode] = code.startsWith('Shift+') ? [true, code.substring('Shift+'.length)] : [false, code];

      if (!letterCode) {

        it(`should fire events on ${code}`, async ({ page }) => {
          await page.keyboard.press(code);
          const charCode = key.charCodeAt(0);
          expect(await page.evaluate('getResult()')).toBe(
              [...(shifted ? [`Keydown: Shift ShiftLeft 16 [Shift]`] : []),
                `Keydown: ${key} ${unshiftedCode} ${keyCode} [${shifted ? 'Shift' : ''}]`,
                `Keypress: ${key} ${unshiftedCode} ${charCode} ${charCode} [${shifted ? 'Shift' : ''}]`,
                `Keyup: ${key} ${unshiftedCode} ${keyCode} [${shifted ? 'Shift' : ''}]`,
                ...(shifted ? [`Keyup: Shift ShiftLeft 16 []`] : [])].join('\n'));
        });

        it(`should fire events on "${key}"`, async ({ page }) => {
          await page.keyboard.press(key);
          const charCode = key.charCodeAt(0);
          const result = await page.evaluate('getResult()');
          // TODO shouldn't it send a Shift event if key is uppercase?
          expect(result).toBe(
              [`Keydown: ${key} ${unshiftedCode} ${keyCode} []`,
                `Keypress: ${key} ${unshiftedCode} ${charCode} ${charCode} []`,
                `Keyup: ${key} ${unshiftedCode} ${keyCode} []`].join('\n'));
        });
      } else {
        const [shiftedLetter, unshiftedLetterCode] = letterCode.startsWith('Shift+') ? [true, letterCode.substring('Shift+'.length)] : [false, letterCode];

        it(`should fire events in accented key for ${code} ${letterCode}`, async ({ page }) => {
          await page.keyboard.press(code);
          await page.keyboard.press(letterCode);
          const charCode = key.charCodeAt(0);
          expect(await page.evaluate('getResult()')).toBe(
              [...(shifted ? [`Keydown: Shift ShiftLeft 16 [Shift]`] : []),
                `Keydown: Dead ${unshiftedCode} ${keyCode} [${shifted ? 'Shift' : ''}]`,
                `Keyup: Dead ${unshiftedCode} ${keyCode} [${shifted ? 'Shift' : ''}]`,
                ...(shifted ? [`Keyup: Shift ShiftLeft 16 []`] : []),
                ...(shiftedLetter ? [`Keydown: Shift ShiftLeft 16 [Shift]`] : []),
                `Keydown: ${key} ${unshiftedLetterCode} ${letterKeyCode} [${shiftedLetter ? 'Shift' : ''}]`,
                `Keypress: ${key} ${unshiftedLetterCode} ${charCode} ${charCode} [${shiftedLetter ? 'Shift' : ''}]`,
                `Keyup: ${removeAccents(key)} ${unshiftedLetterCode} ${letterKeyCode} [${shiftedLetter ? 'Shift' : ''}]`,
                ...(shiftedLetter ? [`Keyup: Shift ShiftLeft 16 []`] : []),].join('\n'));
        });

        it(`should fire events when typing accented key "${key}"`, async ({ page }) => {
          await page.keyboard.type(key);
          const charCode = key.charCodeAt(0);
          expect(await page.evaluate('getResult()')).toBe(
              [...(shifted ? [`Keydown: Shift ShiftLeft 16 [Shift]`] : []),
                `Keydown: Dead ${unshiftedCode} ${keyCode} [${shifted ? 'Shift' : ''}]`,
                `Keyup: Dead ${unshiftedCode} ${keyCode} [${shifted ? 'Shift' : ''}]`,
                ...(shifted ? [`Keyup: Shift ShiftLeft 16 []`] : []),
                // TODO shouldn't it send a Shift event if letter is uppercase?
                `Keydown: ${key} ${unshiftedLetterCode} ${letterKeyCode} []`,
                `Keypress: ${key} ${unshiftedLetterCode} ${charCode} ${charCode} []`,
                `Keyup: ${removeAccents(key)} ${unshiftedLetterCode} ${letterKeyCode} []`,].join('\n'));
        });

      }
    }
  });
}
