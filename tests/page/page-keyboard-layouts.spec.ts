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
    await expect(async () => await page.keyboard[fn]('á')).rejects.toThrowError();
  });

  it(`should throw exception on ${fn} with shifted accented key`, async ({ page }) => {
    await page.keyboard.changeLayout('pt');
    await expect(async () => await page.keyboard[fn]('à')).rejects.toThrowError();
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

it(`should handle dead key followed by space`, async ({ page }) => {
  await page.keyboard.changeLayout('pt');
  await page.keyboard.press('BracketRight');
  await page.keyboard.press('Space');
  await expect(page.locator('textarea')).toHaveValue('´');
  expect(await page.evaluate('getResult()')).toBe(
      ['Keydown: Dead BracketRight 186 []',
        'Keyup: Dead BracketRight 186 []',
        'Keydown: ´ Space 32 []',
        'Keypress: ´ Space 180 180 []',
        'Keyup:   Space 32 []',].join('\n'));
});

it(`should handle shifted dead key followed by space`, async ({ page }) => {
  await page.keyboard.changeLayout('pt');
  await page.keyboard.press('Shift+BracketRight');
  await page.keyboard.press('Space');
  await expect(page.locator('textarea')).toHaveValue('`');
  expect(await page.evaluate('getResult()')).toBe(
      ['Keydown: Shift ShiftLeft 16 [Shift]',
        'Keydown: Dead BracketRight 186 [Shift]',
        'Keyup: Dead BracketRight 186 [Shift]',
        'Keyup: Shift ShiftLeft 16 []',
        'Keydown: ` Space 32 []',
        'Keypress: ` Space 96 96 []',
        'Keyup:   Space 32 []',].join('\n'));
});

it(`should type accented key if deadkey is kept down while pressing key`, async ({ page }) => {
  await page.keyboard.changeLayout('pt');
  await page.keyboard.press('BracketRight+KeyA');
  await expect(page.locator('textarea')).toHaveValue('á');
  expect(await page.evaluate('getResult()')).toBe(
      ['Keydown: Dead BracketRight 186 []',
        'Keydown: á KeyA 65 []',
        'Keypress: á KeyA 225 225 []',
        'Keyup: a KeyA 65 []',
        'Keyup: Dead BracketRight 186 []',].join('\n'));
});

for (const key of ['Alt', 'Meta', 'Shift', 'CapsLock']) {
  it(`should not reset deadkey when ${key} is pressed`, async ({ page }) => {
    await page.keyboard.changeLayout('pt');
    await page.keyboard.press('BracketRight');
    await page.keyboard.press(key);
    await page.keyboard.press('KeyA');
    await expect(page.locator('textarea')).toHaveValue('á');
  });
}

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

it(`should handle all keyboard layouts`, async ({ page }) => {
  for (const [layoutName, test] of Object.entries(testData)) {

    await it.step(`${layoutName} layout`, async () => {
      await page.keyboard.changeLayout(layoutName);

      for (const [key, code, keyCode, letterCode, letterKeyCode] of test) {
        const [modifiersDown, modifiersUp, modifiers, codeWithoutModifiers] = code.startsWith('Shift+') ?
          [[`Keydown: Shift ShiftLeft 16 [Shift]`], [`Keyup: Shift ShiftLeft 16 []`], 'Shift', code.substring('Shift+'.length)] :
          [[], [], '', code];

        if (!letterCode) {

          await it.step(`fire events on ${code}`, async () => {
            await page.keyboard.press(code);
            const charCode = key.charCodeAt(0);
            expect(await page.evaluate('getResult()')).toBe(
                [...modifiersDown,
                  `Keydown: ${key} ${codeWithoutModifiers} ${keyCode} [${modifiers}]`,
                  `Keypress: ${key} ${codeWithoutModifiers} ${charCode} ${charCode} [${modifiers}]`,
                  `Keyup: ${key} ${codeWithoutModifiers} ${keyCode} [${modifiers}]`,
                  ...modifiersUp].join('\n'));
          });

          await it.step(`fire events on "${key}"`, async () => {
            await page.keyboard.press(key);
            const charCode = key.charCodeAt(0);
            const result = await page.evaluate('getResult()');
            // TODO shouldn't it send a Shift event if key is uppercase?
            expect(result).toBe(
                [`Keydown: ${key} ${codeWithoutModifiers} ${keyCode} []`,
                  `Keypress: ${key} ${codeWithoutModifiers} ${charCode} ${charCode} []`,
                  `Keyup: ${key} ${codeWithoutModifiers} ${keyCode} []`].join('\n'));
          });
        } else {
          const [modifiersLetterDown, modifiersLetterUp, modifiersLetter, letterCodeWithoutModifiers] = letterCode.startsWith('Shift+') ?
            [[`Keydown: Shift ShiftLeft 16 [Shift]`], [`Keyup: Shift ShiftLeft 16 []`], 'Shift', letterCode.substring('Shift+'.length)] :
            [[], [], '', letterCode];

          await it.step(`fire events in accented key for ${code} ${letterCode}`, async () => {
            await page.keyboard.press(code);
            await page.keyboard.press(letterCode);
            const charCode = key.charCodeAt(0);
            expect(await page.evaluate('getResult()')).toBe(
                [...modifiersDown,
                  `Keydown: Dead ${codeWithoutModifiers} ${keyCode} [${modifiers}]`,
                  `Keyup: Dead ${codeWithoutModifiers} ${keyCode} [${modifiers}]`,
                  ...modifiersUp,
                  ...modifiersLetterDown,
                  `Keydown: ${key} ${letterCodeWithoutModifiers} ${letterKeyCode} [${modifiersLetter}]`,
                  `Keypress: ${key} ${letterCodeWithoutModifiers} ${charCode} ${charCode} [${modifiersLetter}]`,
                  `Keyup: ${removeAccents(key)} ${letterCodeWithoutModifiers} ${letterKeyCode} [${modifiersLetter}]`,
                  ...modifiersLetterUp].join('\n'));
          });

          await it.step(`should fire events when typing accented key "${key}"`, async () => {
            await page.keyboard.type(key);
            const charCode = key.charCodeAt(0);
            expect(await page.evaluate('getResult()')).toBe(
                [...modifiersDown,
                  `Keydown: Dead ${codeWithoutModifiers} ${keyCode} [${modifiers}]`,
                  `Keyup: Dead ${codeWithoutModifiers} ${keyCode} [${modifiers}]`,
                  ...modifiersUp,
                  // TODO shouldn't it send a Shift event if letter is uppercase?
                  `Keydown: ${key} ${letterCodeWithoutModifiers} ${letterKeyCode} []`,
                  `Keypress: ${key} ${letterCodeWithoutModifiers} ${charCode} ${charCode} []`,
                  `Keyup: ${removeAccents(key)} ${letterCodeWithoutModifiers} ${letterKeyCode} []`,].join('\n'));
          });
        }
      }
    });
  }
});
