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

const utils = require('./utils');
const os = require('os');

/**
 * @type {PageTestSuite}
 */
module.exports.describe = function({testRunner, expect, FFOX, CHROMIUM, WEBKIT, MAC}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('Keyboard', function() {
    it('should type into a textarea', async({page, server}) => {
      await page.evaluate(() => {
        const textarea = document.createElement('textarea');
        document.body.appendChild(textarea);
        textarea.focus();
      });
      const text = 'Hello world. I am the text that was typed!';
      await page.keyboard.type(text);
      expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe(text);
    });
    it('should move with the arrow keys', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/textarea.html');
      await page.type('textarea', 'Hello World!');
      expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe('Hello World!');
      for (let i = 0; i < 'World!'.length; i++)
        page.keyboard.press('ArrowLeft');
      await page.keyboard.type('inserted ');
      expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe('Hello inserted World!');
      page.keyboard.down('Shift');
      for (let i = 0; i < 'inserted '.length; i++)
        page.keyboard.press('ArrowLeft');
      page.keyboard.up('Shift');
      await page.keyboard.press('Backspace');
      expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe('Hello World!');
    });
    it('should send a character with ElementHandle.press', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/textarea.html');
      const textarea = await page.$('textarea');
      await textarea.press('a');
      expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe('a');

      await page.evaluate(() => window.addEventListener('keydown', e => e.preventDefault(), true));

      await textarea.press('b');
      expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe('a');
    });
    it('ElementHandle.press should support |text| option', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/textarea.html');
      const textarea = await page.$('textarea');
      await textarea.press('a', {text: 'ё'});
      expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe('ё');
    });
    it('should send a character with sendCharacter', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/textarea.html');
      await page.focus('textarea');
      await page.keyboard.sendCharacters('嗨');
      expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe('嗨');
      await page.evaluate(() => window.addEventListener('keydown', e => e.preventDefault(), true));
      await page.keyboard.sendCharacters('a');
      expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe('嗨a');
    });
    it.skip(FFOX)('should report shiftKey', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/keyboard.html');
      const keyboard = page.keyboard;
      const codeForKey = {'Shift': 16, 'Alt': 18, 'Control': 17};
      for (const modifierKey in codeForKey) {
        await keyboard.down(modifierKey);
        expect(await page.evaluate(() => getResult())).toBe('Keydown: ' + modifierKey + ' ' + modifierKey + 'Left ' + codeForKey[modifierKey] + ' [' + modifierKey + ']');
        await keyboard.down('!');
        // Shift+! will generate a keypress
        if (modifierKey === 'Shift')
          expect(await page.evaluate(() => getResult())).toBe('Keydown: ! Digit1 49 [' + modifierKey + ']\nKeypress: ! Digit1 33 33 [' + modifierKey + ']');
        else
          expect(await page.evaluate(() => getResult())).toBe('Keydown: ! Digit1 49 [' + modifierKey + ']');

        await keyboard.up('!');
        expect(await page.evaluate(() => getResult())).toBe('Keyup: ! Digit1 49 [' + modifierKey + ']');
        await keyboard.up(modifierKey);
        expect(await page.evaluate(() => getResult())).toBe('Keyup: ' + modifierKey + ' ' + modifierKey + 'Left ' + codeForKey[modifierKey] + ' []');
      }
    });
    it('should report multiple modifiers', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/keyboard.html');
      const keyboard = page.keyboard;
      await keyboard.down('Control');
      expect(await page.evaluate(() => getResult())).toBe('Keydown: Control ControlLeft 17 [Control]');
      await keyboard.down('Alt');
      expect(await page.evaluate(() => getResult())).toBe('Keydown: Alt AltLeft 18 [Alt Control]');
      await keyboard.down(';');
      expect(await page.evaluate(() => getResult())).toBe('Keydown: ; Semicolon 186 [Alt Control]');
      await keyboard.up(';');
      expect(await page.evaluate(() => getResult())).toBe('Keyup: ; Semicolon 186 [Alt Control]');
      await keyboard.up('Control');
      expect(await page.evaluate(() => getResult())).toBe('Keyup: Control ControlLeft 17 [Alt]');
      await keyboard.up('Alt');
      expect(await page.evaluate(() => getResult())).toBe('Keyup: Alt AltLeft 18 []');
    });
    it('should send proper codes while typing', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/keyboard.html');
      await page.keyboard.type('!');
      expect(await page.evaluate(() => getResult())).toBe(
          [ 'Keydown: ! Digit1 49 []',
            'Keypress: ! Digit1 33 33 []',
            'Keyup: ! Digit1 49 []'].join('\n'));
      await page.keyboard.type('^');
      expect(await page.evaluate(() => getResult())).toBe(
          [ 'Keydown: ^ Digit6 54 []',
            'Keypress: ^ Digit6 94 94 []',
            'Keyup: ^ Digit6 54 []'].join('\n'));
    });
    it('should send proper codes while typing with shift', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/keyboard.html');
      const keyboard = page.keyboard;
      await keyboard.down('Shift');
      await page.keyboard.type('~');
      expect(await page.evaluate(() => getResult())).toBe(
          [ 'Keydown: Shift ShiftLeft 16 [Shift]',
            'Keydown: ~ Backquote 192 [Shift]', // 192 is ` keyCode
            'Keypress: ~ Backquote 126 126 [Shift]', // 126 is ~ charCode
            'Keyup: ~ Backquote 192 [Shift]'].join('\n'));
      await keyboard.up('Shift');
    });
    it('should not type canceled events', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/textarea.html');
      await page.focus('textarea');
      await page.evaluate(() => {
        window.addEventListener('keydown', event => {
          event.stopPropagation();
          event.stopImmediatePropagation();
          if (event.key === 'l')
            event.preventDefault();
          if (event.key === 'o')
            event.preventDefault();
        }, false);
      });
      await page.keyboard.type('Hello World!');
      expect(await page.evaluate(() => textarea.value)).toBe('He Wrd!');
    });
    it('should specify repeat property', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/textarea.html');
      await page.focus('textarea');
      await page.evaluate(() => document.querySelector('textarea').addEventListener('keydown', e => window.lastEvent = e, true));
      await page.keyboard.down('a');
      expect(await page.evaluate(() => window.lastEvent.repeat)).toBe(false);
      await page.keyboard.press('a');
      expect(await page.evaluate(() => window.lastEvent.repeat)).toBe(true);

      await page.keyboard.down('b');
      expect(await page.evaluate(() => window.lastEvent.repeat)).toBe(false);
      await page.keyboard.down('b');
      expect(await page.evaluate(() => window.lastEvent.repeat)).toBe(true);

      await page.keyboard.up('a');
      await page.keyboard.down('a');
      expect(await page.evaluate(() => window.lastEvent.repeat)).toBe(false);
    });
    it('should type all kinds of characters', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/textarea.html');
      await page.focus('textarea');
      const text = 'This text goes onto two lines.\nThis character is 嗨.';
      await page.keyboard.type(text);
      expect(await page.evaluate('result')).toBe(text);
    });
    it('should specify location', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/textarea.html');
      await page.evaluate(() => {
        window.addEventListener('keydown', event => window.keyLocation = event.location, true);
      });
      const textarea = await page.$('textarea');

      await textarea.press('Digit5');
      expect(await page.evaluate('keyLocation')).toBe(0);

      await textarea.press('ControlLeft');
      expect(await page.evaluate('keyLocation')).toBe(1);

      await textarea.press('ControlRight');
      expect(await page.evaluate('keyLocation')).toBe(2);

      await textarea.press('NumpadSubtract');
      expect(await page.evaluate('keyLocation')).toBe(3);
    });
    it('should press Enter', async({page, server}) => {
      await page.setContent('<textarea></textarea>');
      await page.focus('textarea');
      await page.evaluate(() => window.addEventListener('keydown', e => window.lastEvent = {key: e.key, code:e.code}));
      await testEnterKey('Enter', 'Enter', 'Enter');
      await testEnterKey('NumpadEnter', 'Enter', 'NumpadEnter');
      await testEnterKey('\n', 'Enter', 'Enter');
      await testEnterKey('\r', 'Enter', 'Enter');

      async function testEnterKey(key, expectedKey, expectedCode) {
        await page.keyboard.press(key);
        const lastEvent = await page.evaluate('lastEvent');
        expect(lastEvent.key).toBe(expectedKey, `${JSON.stringify(key)} had the wrong key: ${lastEvent.key}`);
        expect(lastEvent.code).toBe(expectedCode, `${JSON.stringify(key)} had the wrong code: ${lastEvent.code}`);
        const value = await page.$eval('textarea', t => t.value);
        expect(value).toBe('\n', `${JSON.stringify(key)} failed to create a newline: ${JSON.stringify(value)}`);
        await page.$eval('textarea', t => t.value = '');
      }
    });
    it('should throw on unknown keys', async({page, server}) => {
      let error = await page.keyboard.press('NotARealKey').catch(e => e);
      expect(error.message).toBe('Unknown key: "NotARealKey"');

      error = await page.keyboard.press('ё').catch(e => e);
      expect(error && error.message).toBe('Unknown key: "ё"');

      error = await page.keyboard.press('😊').catch(e => e);
      expect(error && error.message).toBe('Unknown key: "😊"');
    });
    it('should type emoji', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/textarea.html');
      await page.type('textarea', '👹 Tokyo street Japan 🇯🇵');
      expect(await page.$eval('textarea', textarea => textarea.value)).toBe('👹 Tokyo street Japan 🇯🇵');
    });
    it('should type emoji into an iframe', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await utils.attachFrame(page, 'emoji-test', server.PREFIX + '/input/textarea.html');
      const frame = page.frames()[1];
      const textarea = await frame.$('textarea');
      await textarea.type('👹 Tokyo street Japan 🇯🇵');
      expect(await frame.$eval('textarea', textarea => textarea.value)).toBe('👹 Tokyo street Japan 🇯🇵');
    });
    it.skip(CHROMIUM && MAC)('should handle selectAll', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/textarea.html');
      const textarea = await page.$('textarea');
      await textarea.type('some text');
      const modifier = MAC ? 'Meta' : 'Control';
      await page.keyboard.down(modifier);
      await page.keyboard.press('a');
      await page.keyboard.up(modifier);
      await page.keyboard.press('Backspace');
      expect(await page.$eval('textarea', textarea => textarea.value)).toBe('');
    });
    it.skip(CHROMIUM && MAC)('should be able to prevent selectAll', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/textarea.html');
      const textarea = await page.$('textarea');
      await textarea.type('some text');
      await page.$eval('textarea', textarea => {
        textarea.addEventListener('keydown', event => {
          if (event.key === 'a' && (event.metaKey || event.ctrlKey))
            event.preventDefault();
        }, false);
      });
      const modifier = MAC ? 'Meta' : 'Control';
      await page.keyboard.down(modifier);
      await page.keyboard.press('a');
      await page.keyboard.up(modifier);
      await page.keyboard.press('Backspace');
      expect(await page.$eval('textarea', textarea => textarea.value)).toBe('some tex');
    });
    it('should press the meta key', async({page}) => {
      await page.evaluate(() => {
        window.result = null;
        document.addEventListener('keydown', event => {
          window.result = [event.key, event.code, event.metaKey];
        });
      });
      await page.keyboard.press('Meta');
      const [key, code, metaKey] = await page.evaluate('result');
      if (FFOX && !MAC)
        expect(key).toBe('OS');
      else
        expect(key).toBe('Meta');

      if (FFOX)
        expect(code).toBe('OSLeft');
      else
        expect(code).toBe('MetaLeft');

      if (FFOX && !MAC)
        expect(metaKey).toBe(false);
      else
        expect(metaKey).toBe(true);

    });
    it('should work after a cross origin navigation', async({page, server}) => {
      await page.goto(server.PREFIX + '/empty.html');
      await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
      await page.evaluate(() => {
        document.addEventListener('keydown', event => window.lastKey = event);
      })
      await page.keyboard.press('a');
      expect(await page.evaluate('lastKey.key')).toBe('a');
    })
  });
};
