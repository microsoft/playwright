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
import { attachFrame } from '../config/utils';

it.skip(({ isAndroid }) => isAndroid);

it('should type into a textarea', async ({page}) => {
  await page.evaluate(() => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();
  });
  const text = 'Hello world. I am the text that was typed!';
  await page.keyboard.type(text);
  expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe(text);
});

it('should move with the arrow keys', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.type('textarea', 'Hello World!');
  expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe('Hello World!');
  for (let i = 0; i < 'World!'.length; i++)
    await page.keyboard.press('ArrowLeft');
  await page.keyboard.type('inserted ');
  expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe('Hello inserted World!');
  await page.keyboard.down('Shift');
  for (let i = 0; i < 'inserted '.length; i++)
    await page.keyboard.press('ArrowLeft');
  await page.keyboard.up('Shift');
  await page.keyboard.press('Backspace');
  expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe('Hello World!');
});

it('should send a character with ElementHandle.press', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  const textarea = await page.$('textarea');
  await textarea.press('a');
  expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe('a');

  await page.evaluate(() => window.addEventListener('keydown', e => e.preventDefault(), true));

  await textarea.press('b');
  expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe('a');
});

it('should send a character with insertText', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.focus('textarea');
  await page.keyboard.insertText('嗨');
  expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe('嗨');
  await page.evaluate(() => window.addEventListener('keydown', e => e.preventDefault(), true));
  await page.keyboard.insertText('a');
  expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe('嗨a');
});

it('insertText should only emit input event', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.focus('textarea');
  page.on('console', m => console.log(m.text()));
  const events = await page.evaluateHandle(() => {
    const events = [];
    document.addEventListener('keydown', e => events.push(e.type));
    document.addEventListener('keyup', e => events.push(e.type));
    document.addEventListener('keypress', e => events.push(e.type));
    document.addEventListener('input', e => events.push(e.type));
    return events;
  });
  await page.keyboard.insertText('hello world');
  expect(await events.jsonValue()).toEqual(['input']);
});


it.only('should verify correct text values for keyboard.imeSetComposition, imeCommitComposition', async ({page, server, browserName}) => {
  it.skip(browserName === 'firefox');
  it.skip(browserName === 'webkit');
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.focus('textarea');
  await page.keyboard.imeSetComposition('ｓ', 1, 1, { triggerKey: 's' });
  await page.keyboard.imeSetComposition('す', 1, 1, { triggerKey: 'u' });
  await page.keyboard.imeSetComposition('すｓ', 2, 2, { triggerKey: 's' });
  await page.keyboard.imeSetComposition('すｓｈ', 3, 3, { triggerKey: 'h' });
  await page.keyboard.imeSetComposition('すし', 2, 2, { triggerKey: 'i' });
  expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe('すし');
  await page.keyboard.imeCommitComposition('すし', { triggerKey: 'Enter'});
  expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe('すし');
});

it.only('should verify correct event sequence for keyboard.imeSetComposition, imeCommitComposition', async ({page, server, browserName}) => {
  it.skip(browserName === 'firefox');
  it.skip(browserName === 'webkit');
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.focus('textarea');
  const events = await page.evaluateHandle(() => {
    const events = [];
    document.addEventListener('keydown', e => events.push(e.type));
    document.addEventListener('keyup', e => events.push(e.type));
    document.addEventListener('compositionstart', e => events.push(e.type));
    document.addEventListener('input', e => events.push(e.type));
    document.addEventListener('compositionupdate', e => events.push(e.type));
    document.addEventListener('compositionend', e => events.push(e.type));
    return events;
  });
  await page.keyboard.imeSetComposition('ｓ', 1, 1, { triggerKey: 's', delay: 2000 });
  await page.keyboard.imeSetComposition('す', 1, 1, { triggerKey: 'u', delay: 2000 });
  await page.keyboard.imeCommitComposition('す', { triggerKey: 'Enter', delay: 2000});
  expect(await events.jsonValue()).toEqual(['keydown', 'compositionstart', 'compositionupdate', 'input',
    'keyup','keydown', 'compositionupdate', 'input', 'keyup', 'keydown', 'compositionupdate', 'input', 'compositionend',
    'keyup']);
});

it.only('should verify keyboard.imeSetComposition, imeCommitComposition reconversion scenario', async ({page, server, browserName}) => {
  it.skip(browserName === 'firefox');
  it.skip(browserName === 'webkit');
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.focus('textarea');
  await page.fill('textarea', 'すしおに');
  await page.press('textarea', 'ArrowLeft');
  await page.press('textarea', 'ArrowLeft');
  await page.press('textarea', 'ArrowLeft');
  await page.keyboard.imeSetComposition('オニ', 2, 2, { triggerKey: 'Meta+Slash', replacementStart: 0, replacementEnd: 1});
  expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe('オニしおに');
  await page.keyboard.imeCommitComposition('オニ', { triggerKey: 'Enter'});
  expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe('オニしおに');
});

it.only('should verify keyboard.imeSetComposition, imeCommitComposition no trigger key for commit', async ({page, server, browserName}) => {
  it.skip(browserName === 'firefox');
  it.skip(browserName === 'webkit');
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.focus('textarea');
  await page.fill('textarea', 'abcd');
  await page.keyboard.imeSetComposition('e', 1, 1, { triggerKey: 'e'});
  const selectionStart = await page.$eval('textarea', el => el.selectionStart);
  const selectionEnd = await page.$eval('textarea', el => el.selectionEnd);
  expect(selectionStart === 5).toBeTruthy();
  expect(selectionEnd === 5).toBeTruthy();
  await page.keyboard.imeCommitComposition('e');
  expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe('abcde');
});


it.only('should verify keyboard.imeCancelComposition output', async ({page, server, browserName}) => {
  it.skip(browserName === 'firefox');
  it.skip(browserName === 'webkit');
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.focus('textarea');
  await page.keyboard.imeSetComposition('ｓ', 1, 1, { triggerKey: 's' });
  await page.keyboard.imeSetComposition('す', 1, 1, { triggerKey: 'u' });
  await page.keyboard.imeSetComposition('すｓ', 2, 2, { triggerKey: 's' });
  await page.keyboard.imeSetComposition('すｓｈ', 3, 3, { triggerKey: 'h' });
  await page.keyboard.imeSetComposition('すし', 2, 2, { triggerKey: 'i' });
  await page.keyboard.imeCancelComposition('Escape');
  expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe('');

});

// Tests for demo

it('should verify keyboard.imeSetComposition, arrowDown to simulate choosing from IME menu', async ({ page }) => {
  await page.goto('https://w3c.github.io/uievents/tools/key-event-viewer.html');
  await page.focus('#input');
  await page.keyboard.imeSetComposition('ｓ', 1, 1, { triggerKey: 's', delay: 2000});
  await page.keyboard.imeSetComposition('す', 1, 1, { triggerKey: 'u', delay: 2000});
  await page.keyboard.imeSetComposition('すｓ', 2, 2, { triggerKey: 's', delay: 2000});
  await page.keyboard.imeSetComposition('すｓｈ', 3, 3, { triggerKey: 'h', delay: 2000});
  await page.keyboard.imeSetComposition('すし', 2, 2, { triggerKey: 'i', delay: 2000});
  expect(await page.evaluate(() => document.querySelector('#input').value)).toBe('すし');
  await page.keyboard.imeSetComposition('すし', 1, 1, { triggerKey: 'ArrowLeft', delay: 2000});
  await page.keyboard.imeSetComposition('すし', 0, 0, { triggerKey: 'ArrowLeft', delay: 2000});
  await page.keyboard.imeSetComposition('寿司屋', 3, 3, { triggerKey: 'ArrowDown', delay: 2000});
  expect(await page.evaluate(() => document.querySelector('#input').value)).toBe('寿司屋');
  await page.keyboard.imeSetComposition('寿司', 2, 2, { triggerKey: 'ArrowDown', delay: 2000});
  expect(await page.evaluate(() => document.querySelector('#input').value)).toBe('寿司');
  await page.keyboard.imeSetComposition('スシロー', 4, 4, { triggerKey: 'ArrowDown', delay: 2000});
  expect(await page.evaluate(() => document.querySelector('#input').value)).toBe('スシロー');
  await page.keyboard.imeCommitComposition('スシロー', { triggerKey: 'Enter', delay: 4000});
  expect(await page.evaluate(() => document.querySelector('#input').value)).toBe('スシロー');
  await page.pause();
});

// *********************************************************************************
// *********************************************************************************
// *********************************************************************************
// *********************************************************************************
// *********************************************************************************
// *********************************************************************************

it('should verify keyboard.imeCancelComposition output', async ({page}) => {
  await page.goto('https://w3c.github.io/uievents/tools/key-event-viewer.html');
  await page.focus('#input');
  await page.keyboard.imeSetComposition('ｓ', 1, 1, { triggerKey: 's', delay: 5000 });
  await page.keyboard.imeSetComposition('す', 1, 1, { triggerKey: 'u', delay: 5000 });
  await page.keyboard.imeCommitComposition('す', { triggerKey: 'Enter'});
  expect(await page.evaluate(() => document.querySelector('input').value)).toBe('す');
  await page.pause();
});

// *********************************************************************************
// *********************************************************************************
// *********************************************************************************
// *********************************************************************************
// *********************************************************************************
// *********************************************************************************
// *********************************************************************************

it('should verify keyboard.imeCancelComposition output', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.focus('textarea');
  await page.fill('textarea', 'abcd');
  const events = await page.evaluateHandle(() => {
    const events = [];
    document.addEventListener('compositionstart', e => events.push(e.type));
    document.addEventListener('input', e => events.push(e.type));
    document.addEventListener('compositionupdate', e => events.push(e.type));
    document.addEventListener('compositionend', e => events.push(e.type));
    document.addEventListener('keydown', e => events.push(e.type));
    document.addEventListener('keyup', e => events.push(e.type));
    return events;
  });
  await page.keyboard.imeSetComposition('e', 1, 1, { triggerKey: 'e', delay: 1000});
  await page.keyboard.imeCancelComposition('Escape');
  expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe('abcd');
  expect(await events.jsonValue()).toEqual(['keydown', 'compositionstart', 'compositionupdate',
    'input', 'keyup', 'keydown', 'compositionupdate', 'input', 'compositionend', 'keyup']);
});

// END OF TESTS FOR DEMO

it('should report shiftKey', async ({page, server, browserName, platform}) => {
  it.fail(browserName === 'firefox' && platform === 'darwin');

  await page.goto(server.PREFIX + '/input/keyboard.html');
  const keyboard = page.keyboard;
  const codeForKey = {'Shift': 16, 'Alt': 18, 'Control': 17};
  for (const modifierKey in codeForKey) {
    await keyboard.down(modifierKey);
    expect(await page.evaluate('getResult()')).toBe('Keydown: ' + modifierKey + ' ' + modifierKey + 'Left ' + codeForKey[modifierKey] + ' [' + modifierKey + ']');
    await keyboard.down('!');
    // Shift+! will generate a keypress
    if (modifierKey === 'Shift')
      expect(await page.evaluate('getResult()')).toBe('Keydown: ! Digit1 49 [' + modifierKey + ']\nKeypress: ! Digit1 33 33 [' + modifierKey + ']');
    else
      expect(await page.evaluate('getResult()')).toBe('Keydown: ! Digit1 49 [' + modifierKey + ']');

    await keyboard.up('!');
    expect(await page.evaluate('getResult()')).toBe('Keyup: ! Digit1 49 [' + modifierKey + ']');
    await keyboard.up(modifierKey);
    expect(await page.evaluate('getResult()')).toBe('Keyup: ' + modifierKey + ' ' + modifierKey + 'Left ' + codeForKey[modifierKey] + ' []');
  }
});

it('should report multiple modifiers', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/keyboard.html');
  const keyboard = page.keyboard;
  await keyboard.down('Control');
  expect(await page.evaluate('getResult()')).toBe('Keydown: Control ControlLeft 17 [Control]');
  await keyboard.down('Alt');
  expect(await page.evaluate('getResult()')).toBe('Keydown: Alt AltLeft 18 [Alt Control]');
  await keyboard.down(';');
  expect(await page.evaluate('getResult()')).toBe('Keydown: ; Semicolon 186 [Alt Control]');
  await keyboard.up(';');
  expect(await page.evaluate('getResult()')).toBe('Keyup: ; Semicolon 186 [Alt Control]');
  await keyboard.up('Control');
  expect(await page.evaluate('getResult()')).toBe('Keyup: Control ControlLeft 17 [Alt]');
  await keyboard.up('Alt');
  expect(await page.evaluate('getResult()')).toBe('Keyup: Alt AltLeft 18 []');
});

it('should send proper codes while typing', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/keyboard.html');
  await page.keyboard.type('!');
  expect(await page.evaluate('getResult()')).toBe(
      [ 'Keydown: ! Digit1 49 []',
        'Keypress: ! Digit1 33 33 []',
        'Keyup: ! Digit1 49 []'].join('\n'));
  await page.keyboard.type('^');
  expect(await page.evaluate('getResult()')).toBe(
      [ 'Keydown: ^ Digit6 54 []',
        'Keypress: ^ Digit6 94 94 []',
        'Keyup: ^ Digit6 54 []'].join('\n'));
});

it('should send proper codes while typing with shift', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/keyboard.html');
  const keyboard = page.keyboard;
  await keyboard.down('Shift');
  await page.keyboard.type('~');
  expect(await page.evaluate('getResult()')).toBe(
      [ 'Keydown: Shift ShiftLeft 16 [Shift]',
        'Keydown: ~ Backquote 192 [Shift]', // 192 is ` keyCode
        'Keypress: ~ Backquote 126 126 [Shift]', // 126 is ~ charCode
        'Keyup: ~ Backquote 192 [Shift]'].join('\n'));
  await keyboard.up('Shift');
});

it('should not type canceled events', async ({page, server}) => {
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
  expect(await page.$eval('textarea', textarea => textarea.value)).toBe('He Wrd!');
});

it('should press plus', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/keyboard.html');
  await page.keyboard.press('+');
  expect(await page.evaluate('getResult()')).toBe(
      [ 'Keydown: + Equal 187 []', // 192 is ` keyCode
        'Keypress: + Equal 43 43 []', // 126 is ~ charCode
        'Keyup: + Equal 187 []'].join('\n'));
});

it('should press shift plus', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/keyboard.html');
  await page.keyboard.press('Shift++');
  expect(await page.evaluate('getResult()')).toBe(
      [ 'Keydown: Shift ShiftLeft 16 [Shift]',
        'Keydown: + Equal 187 [Shift]', // 192 is ` keyCode
        'Keypress: + Equal 43 43 [Shift]', // 126 is ~ charCode
        'Keyup: + Equal 187 [Shift]',
        'Keyup: Shift ShiftLeft 16 []'].join('\n'));
});

it('should support plus-separated modifiers', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/keyboard.html');
  await page.keyboard.press('Shift+~');
  expect(await page.evaluate('getResult()')).toBe(
      [ 'Keydown: Shift ShiftLeft 16 [Shift]',
        'Keydown: ~ Backquote 192 [Shift]', // 192 is ` keyCode
        'Keypress: ~ Backquote 126 126 [Shift]', // 126 is ~ charCode
        'Keyup: ~ Backquote 192 [Shift]',
        'Keyup: Shift ShiftLeft 16 []'].join('\n'));
});

it('should support multiple plus-separated modifiers', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/keyboard.html');
  await page.keyboard.press('Control+Shift+~');
  expect(await page.evaluate('getResult()')).toBe(
      [ 'Keydown: Control ControlLeft 17 [Control]',
        'Keydown: Shift ShiftLeft 16 [Control Shift]',
        'Keydown: ~ Backquote 192 [Control Shift]', // 192 is ` keyCode
        'Keyup: ~ Backquote 192 [Control Shift]',
        'Keyup: Shift ShiftLeft 16 [Control]',
        'Keyup: Control ControlLeft 17 []'].join('\n'));
});

it('should shift raw codes', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/keyboard.html');
  await page.keyboard.press('Shift+Digit3');
  expect(await page.evaluate('getResult()')).toBe(
      [ 'Keydown: Shift ShiftLeft 16 [Shift]',
        'Keydown: # Digit3 51 [Shift]', // 51 is # keyCode
        'Keypress: # Digit3 35 35 [Shift]', // 35 is # charCode
        'Keyup: # Digit3 51 [Shift]',
        'Keyup: Shift ShiftLeft 16 []'].join('\n'));
});

it('should specify repeat property', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.focus('textarea');
  const lastEvent = await captureLastKeydown(page);
  await page.keyboard.down('a');
  expect(await lastEvent.evaluate(e => e.repeat)).toBe(false);
  await page.keyboard.press('a');
  expect(await lastEvent.evaluate(e => e.repeat)).toBe(true);

  await page.keyboard.down('b');
  expect(await lastEvent.evaluate(e => e.repeat)).toBe(false);
  await page.keyboard.down('b');
  expect(await lastEvent.evaluate(e => e.repeat)).toBe(true);

  await page.keyboard.up('a');
  await page.keyboard.down('a');
  expect(await lastEvent.evaluate(e => e.repeat)).toBe(false);
});

it('should type all kinds of characters', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.focus('textarea');
  const text = 'This text goes onto two lines.\nThis character is 嗨.';
  await page.keyboard.type(text);
  expect(await page.$eval('textarea', t => t.value)).toBe(text);
});

it('should specify location', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  const lastEvent = await captureLastKeydown(page);
  const textarea = await page.$('textarea');

  await textarea.press('Digit5');
  expect(await lastEvent.evaluate(e => e.location)).toBe(0);

  await textarea.press('ControlLeft');
  expect(await lastEvent.evaluate(e => e.location)).toBe(1);

  await textarea.press('ControlRight');
  expect(await lastEvent.evaluate(e => e.location)).toBe(2);

  await textarea.press('NumpadSubtract');
  expect(await lastEvent.evaluate(e => e.location)).toBe(3);
});

it('should press Enter', async ({page, server}) => {
  await page.setContent('<textarea></textarea>');
  await page.focus('textarea');
  const lastEventHandle = await captureLastKeydown(page);
  await testEnterKey('Enter', 'Enter', 'Enter');
  await testEnterKey('NumpadEnter', 'Enter', 'NumpadEnter');
  await testEnterKey('\n', 'Enter', 'Enter');
  await testEnterKey('\r', 'Enter', 'Enter');

  async function testEnterKey(key, expectedKey, expectedCode) {
    await page.keyboard.press(key);
    const lastEvent = await lastEventHandle.jsonValue();
    expect(lastEvent.key).toBe(expectedKey); // had the wrong key
    expect(lastEvent.code).toBe(expectedCode); // had the wrong code
    const value = await page.$eval('textarea', t => t.value);
    expect(value).toBe('\n'); // failed to create a newline
    await page.$eval('textarea', t => t.value = '');
  }
});

it('should throw on unknown keys', async ({page, server}) => {
  let error = await page.keyboard.press('NotARealKey').catch(e => e);
  expect(error.message).toContain('Unknown key: "NotARealKey"');

  error = await page.keyboard.press('ё').catch(e => e);
  expect(error && error.message).toBe('Unknown key: "ё"');

  error = await page.keyboard.press('😊').catch(e => e);
  expect(error && error.message).toBe('Unknown key: "😊"');
});

it('should type emoji', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.type('textarea', '👹 Tokyo street Japan 🇯🇵');
  expect(await page.$eval('textarea', textarea => textarea.value)).toBe('👹 Tokyo street Japan 🇯🇵');
});

it('should type emoji into an iframe', async ({page, server}) => {
  await page.goto(server.EMPTY_PAGE);
  await attachFrame(page, 'emoji-test', server.PREFIX + '/input/textarea.html');
  const frame = page.frames()[1];
  const textarea = await frame.$('textarea');
  await textarea.type('👹 Tokyo street Japan 🇯🇵');
  expect(await frame.$eval('textarea', textarea => textarea.value)).toBe('👹 Tokyo street Japan 🇯🇵');
});

it('should handle selectAll', async ({page, server, isMac}) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  const textarea = await page.$('textarea');
  await textarea.type('some text');
  const modifier = isMac ? 'Meta' : 'Control';
  await page.keyboard.down(modifier);
  await page.keyboard.press('a');
  await page.keyboard.up(modifier);
  await page.keyboard.press('Backspace');
  expect(await page.$eval('textarea', textarea => textarea.value)).toBe('');
});

it('should be able to prevent selectAll', async ({page, server, isMac}) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  const textarea = await page.$('textarea');
  await textarea.type('some text');
  await page.$eval('textarea', textarea => {
    textarea.addEventListener('keydown', event => {
      if (event.key === 'a' && (event.metaKey || event.ctrlKey))
        event.preventDefault();
    }, false);
  });
  const modifier = isMac ? 'Meta' : 'Control';
  await page.keyboard.down(modifier);
  await page.keyboard.press('a');
  await page.keyboard.up(modifier);
  await page.keyboard.press('Backspace');
  expect(await page.$eval('textarea', textarea => textarea.value)).toBe('some tex');
});

it('should support MacOS shortcuts', async ({page, server, platform, browserName}) => {
  it.skip(platform !== 'darwin');
  // @see https://github.com/microsoft/playwright/issues/5721
  it.fixme(browserName === 'firefox' && platform === 'darwin');

  await page.goto(server.PREFIX + '/input/textarea.html');
  const textarea = await page.$('textarea');
  await textarea.type('some text');
  // select one word backwards
  await page.keyboard.press('Shift+Control+Alt+KeyB');
  await page.keyboard.press('Backspace');
  expect(await page.$eval('textarea', textarea => textarea.value)).toBe('some ');
});

it('should press the meta key', async ({page, browserName, isMac}) => {
  const lastEvent = await captureLastKeydown(page);
  await page.keyboard.press('Meta');
  const {key, code, metaKey} = await lastEvent.jsonValue();
  if (browserName === 'firefox' && !isMac)
    expect(key).toBe('OS');
  else
    expect(key).toBe('Meta');

  if (browserName === 'firefox')
    expect(code).toBe('OSLeft');
  else
    expect(code).toBe('MetaLeft');

  if (browserName === 'firefox' && !isMac)
    expect(metaKey).toBe(false);
  else
    expect(metaKey).toBe(true);

});

it('should work after a cross origin navigation', async ({page, server}) => {
  await page.goto(server.PREFIX + '/empty.html');
  await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
  const lastEvent = await captureLastKeydown(page);
  await page.keyboard.press('a');
  expect(await lastEvent.evaluate(l => l.key)).toBe('a');
});

it('should expose keyIdentifier in webkit', async ({page, browserName}) => {
  it.skip(browserName !== 'webkit', 'event.keyIdentifier has been removed from all browsers except WebKit');

  const lastEvent = await captureLastKeydown(page);
  const keyMap = {
    'ArrowUp': 'Up',
    'ArrowDown': 'Down',
    'ArrowLeft': 'Left',
    'ArrowRight': 'Right',
    'Backspace': 'U+0008',
    'Tab': 'U+0009',
    'Delete': 'U+007F',
    'a': 'U+0041',
    'b': 'U+0042',
    'F12': 'F12',
  };
  for (const [key, keyIdentifier] of Object.entries(keyMap)) {
    await page.keyboard.press(key);
    expect(await lastEvent.evaluate(e => e.keyIdentifier)).toBe(keyIdentifier);
  }
});

it('should scroll with PageDown', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/scrollable.html');
  // A click is required for WebKit to send the event into the body.
  await page.click('body');
  await page.keyboard.press('PageDown');
  // We can't wait for the scroll to finish, so just wait for it to start.
  await page.waitForFunction(() => scrollY > 0);
});

it('should move around the selection in a contenteditable', async ({page, isMac}) => {
  await page.setContent(`<div contenteditable></div>`);
  await page.focus('div');
  const modifier = isMac ? 'Alt' : 'Control';
  await page.keyboard.type('Hello World');
  await page.keyboard.down(modifier);
  await page.keyboard.down('Shift');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.up('Shift');
  await page.keyboard.up(modifier);
  expect(await page.evaluate(() => window.getSelection().toString())).toBe('World');
});

it('should move to the start of the document', async ({page, isMac}) => {
  it.skip(!isMac);
  await page.setContent(`<div contenteditable></div>`);
  await page.focus('div');
  await page.keyboard.type('1\n2\n3\n');
  await page.keyboard.press('Shift+Meta+ArrowUp');
  expect(await page.evaluate(() => window.getSelection().toString())).toBe('1\n2\n3\n');
});

async function captureLastKeydown(page) {
  const lastEvent = await page.evaluateHandle(() => {
    const lastEvent = {
      repeat: false,
      location: -1,
      code: '',
      key: '',
      metaKey: false,
      keyIdentifier: 'unsupported'
    };
    document.addEventListener('keydown', e => {
      lastEvent.repeat = e.repeat;
      lastEvent.location = e.location;
      lastEvent.key = e.key;
      lastEvent.code = e.code;
      lastEvent.metaKey = e.metaKey;
      // keyIdentifier only exists in WebKit, and isn't in TypeScript's lib.
      lastEvent.keyIdentifier = 'keyIdentifier' in e && e['keyIdentifier'];
    }, true);
    return lastEvent;
  });
  return lastEvent;
}
