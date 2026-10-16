/**
 * Copyright 2017 Google Inc. All rights reserved.
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

import type { Page } from '@playwright/test';
import { test as it, expect, rafraf } from './pageTest';

const giveItAChanceToFill = (page: Page) => rafraf(page, 5);

it('FI-001 should fill textarea @smoke', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.fill('textarea', 'some value');
  expect(await page.evaluate(() => window['result'])).toBe('some value');
});

it('FI-002 should fill input', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.fill('input', 'some value');
  expect(await page.evaluate(() => window['result'])).toBe('some value');
});

it('FI-003 should throw on unsupported inputs', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  for (const type of ['button', 'checkbox', 'file', 'image', 'radio', 'reset', 'submit']) {
    await page.$eval('input', (input, type) => input.setAttribute('type', type), type);
    let error = null;
    await page.fill('input', '').catch(e => error = e);
    expect(error.message).toContain(`Input of type "${type}" cannot be filled`);
  }
});

it('FI-004 should fill different input types', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  for (const type of ['password', 'search', 'tel', 'text', 'url', 'invalid-type']) {
    await page.$eval('input', (input, type) => input.setAttribute('type', type), type);
    await page.fill('input', 'text ' + type);
    expect(await page.evaluate(() => window['result'])).toBe('text ' + type);
  }
});

it('FI-005 should fill range input', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43328' },
}, async ({ page }) => {
  await page.setContent('<input type=range min=0 max=100 value=50>');
  await page.fill('input', '42');
  expect(await page.$eval('input', input => input.value)).toBe('42');
  // Valid numbers that the browser may serialize differently.
  for (const [value, expected] of [['42.0', 42], ['1e1', 10]] as const) {
    await page.fill('input', value);
    expect(await page.$eval('input', (input: HTMLInputElement) => input.valueAsNumber)).toBe(expected);
  }
});

it('FI-006 should fill color input', async ({ page }) => {
  await page.setContent('<input type=color value="#e66465">');
  await page.fill('input', '#aaaaaa');
  expect(await page.$eval('input', input => input.value)).toBe('#aaaaaa');
});

it('FI-007 should fill color input case insensitive', async ({ page, browserName, isWindows, channel }) => {
  await page.setContent('<input type=color value="#e66465">');
  await page.fill('input', '#AbCd00');
  if (browserName === 'webkit' && isWindows && channel !== 'webkit-wsl')
    expect(await page.$eval('input', input => input.value)).toBe('#AbCd00');
  else
    expect(await page.$eval('input', input => input.value)).toBe('#abcd00');
});

it('FI-008 should fill date input after clicking', async ({ page, server }) => {
  await page.setContent('<input type=date>');
  await page.click('input');
  await page.fill('input', '2020-03-02');
  expect(await page.$eval('input', input => input.value)).toBe('2020-03-02');
});

for (const [type, value] of Object.entries({
  'color': '#aaaaaa',
  'date': '2020-03-02',
  'time': '13:15',
  'datetime-local': '2020-03-02T13:15:30',
  'month': '2020-03',
  'range': '42',
  'week': '2020-W50'
})) {
  it(`FI-009 input event.composed should be true and cross shadow dom boundary - ${type}`, async ({ page, server, browserName, isWindows }) => {
    it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/28726' });
    it.skip(browserName !== 'chromium' && ['month', 'week'].includes(type), 'Some browser/platforms do not implement certain input types');
    it.skip(browserName === 'webkit' && isWindows && ['color', 'date', 'time', 'datetime-local'].includes(type), 'Some browser/platforms do not implement certain input types');
    await page.goto(server.EMPTY_PAGE);
    await page.setContent(`<body><script>
    const div = document.createElement('div');
    const shadowRoot = div.attachShadow({mode: 'open'});
    shadowRoot.innerHTML = '<input type=${type}></input>';
    document.body.appendChild(div);
  </script></body>`);
    await page.locator('body').evaluate(select => {
      (window as any).firedBodyEvents = [];
      for (const event of ['input', 'change']) {
        select.addEventListener(event, e => {
          (window as any).firedBodyEvents.push(e.type + ':' + e.composed);
        }, false);
      }
    });

    await page.locator('input').evaluate(select => {
      (window as any).firedEvents = [];
      for (const event of ['input', 'change']) {
        select.addEventListener(event, e => {
          (window as any).firedEvents.push(e.type + ':' + e.composed);
        }, false);
      }
    });
    await page.locator('input').fill(value);

    expect(await page.evaluate(() => window['firedEvents'])).toEqual(['input:true', 'change:false']);
    expect(await page.evaluate(() => window['firedBodyEvents'])).toEqual(['input:true']);
  });
}

it('FI-010 should fill time input', async ({ page }) => {
  await page.setContent('<input type=time>');
  await page.fill('input', '13:15');
  expect(await page.$eval('input', input => input.value)).toBe('13:15');
});

it('FI-011 should fill month input', async ({ page }) => {
  await page.setContent('<input type=month>');
  await page.fill('input', '2020-07');
  expect(await page.$eval('input', input => input.value)).toBe('2020-07');
});

it('FI-012 should fill week input', async ({ page }) => {
  await page.setContent('<input type=week>');
  await page.fill('input', '2020-W50');
  expect(await page.$eval('input', input => input.value)).toBe('2020-W50');
});

it('FI-013 should fill datetime-local input', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43370' },
}, async ({ page, server, browserName, isWindows, channel }) => {
  await page.setContent('<input type=datetime-local>');
  await page.fill('input', '2020-03-02T05:15');
  expect(await page.$eval('input', input => input.value)).toBe('2020-03-02T05:15');
  // The browser omits zero seconds. WebKit on Windows does not implement datetime-local inputs and keeps the value as is.
  await page.fill('input', '2020-03-02T06:20:00');
  if (browserName === 'webkit' && isWindows && channel !== 'webkit-wsl')
    expect(await page.$eval('input', input => input.value)).toBe('2020-03-02T06:20:00');
  else
    expect(await page.$eval('input', input => input.value)).toBe('2020-03-02T06:20');
});

it('FI-014 should fill contenteditable', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.fill('div[contenteditable]', 'some value');
  expect(await page.$eval('div[contenteditable]', div => div.textContent)).toBe('some value');
});

it('FI-015 should fill contenteditable with new lines', async ({ page, server, browserName, isBidi }) => {
  it.fixme(browserName === 'firefox' && !isBidi, 'Firefox does not handle new lines in contenteditable');

  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<div contenteditable="true"></div>`);
  await page.locator('div[contenteditable]').fill('John\nDoe');
  expect(await page.locator('div[contenteditable]').innerText()).toBe('John\nDoe');
});

it('FI-016 should not double-fill in contenteditable with beforeinput handler in Firefox', {
  annotation: {
    type: 'issue',
    description: 'https://github.com/microsoft/playwright/issues/36715'
  }
}, async ({ page, browserName, isBidi }) => {
  it.fixme(browserName === 'firefox' && !isBidi, 'https://github.com/microsoft/playwright/issues/36715');

  await page.setContent(`
    <div id="editor" contenteditable="true"></div>
    <script>
      const editor = document.getElementById('editor');
      editor.addEventListener('beforeinput', (event) => {
        event.preventDefault();
        editor.textContent = event.data;
      });
    </script>
  `);

  const locator = page.locator('#editor');
  const testValue = 'Playwright';
  await locator.fill(testValue);
  await expect(locator).toHaveText(testValue);
});

it('FI-017 should fill elements with existing value and selection', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/textarea.html');

  await page.$eval('input', input => input.value = 'value one');
  await page.fill('input', 'another value');
  expect(await page.evaluate(() => window['result'])).toBe('another value');

  await page.$eval('input', input => {
    input.selectionStart = 1;
    input.selectionEnd = 2;
  });
  await page.fill('input', 'maybe this one');
  expect(await page.evaluate(() => window['result'])).toBe('maybe this one');

  await page.$eval('div[contenteditable]', div => {
    div.innerHTML = 'some text <span>some more text<span> and even more text';
    const range = document.createRange();
    range.selectNodeContents(div.querySelector('span'));
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await page.fill('div[contenteditable]', 'replace with this');
  expect(await page.$eval('div[contenteditable]', div => div.textContent)).toBe('replace with this');
});

it('FI-018 should throw nice error without injected script stack when element is not an <input>', async ({ page, server }) => {
  let error = null;
  await page.setContent(`<select><option>value1</option></select>`);
  await page.fill('select', '').catch(e => error = e);
  expect(error.message).toContain('page.fill: Error: Element is not an <input>, <textarea> or [contenteditable] element\nCall log:');
});

it('FI-019 should throw if passed a non-string value', async ({ page, server }) => {
  let error = null;
  await page.goto(server.PREFIX + '/input/textarea.html');
  // @ts-expect-error fill only accepts string values
  await page.fill('textarea', 123).catch(e => error = e);
  expect(error.message).toContain('value: expected string, got number');
});

it('FI-020 should retry on disabled element', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.$eval('input', i => i.disabled = true);
  let done = false;

  const promise = page.fill('input', 'some value').then(() => done = true);
  await giveItAChanceToFill(page);
  expect(done).toBe(false);
  expect(await page.evaluate(() => window['result'])).toBe('');

  await page.$eval('input', i => i.disabled = false);
  await promise;
  expect(await page.evaluate(() => window['result'])).toBe('some value');
});

it('FI-021 should retry on readonly element', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.$eval('textarea', i => i.readOnly = true);
  let done = false;

  const promise = page.fill('textarea', 'some value').then(() => done = true);
  await giveItAChanceToFill(page);
  expect(done).toBe(false);
  expect(await page.evaluate(() => window['result'])).toBe('');

  await page.$eval('textarea', i => i.readOnly = false);
  await promise;
  expect(await page.evaluate(() => window['result'])).toBe('some value');
});

it('FI-022 should retry on invisible element', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.$eval('input', i => i.style.display = 'none');
  let done = false;

  const promise = page.fill('input', 'some value').then(() => done = true);
  await giveItAChanceToFill(page);
  expect(done).toBe(false);
  expect(await page.evaluate(() => window['result'])).toBe('');

  await page.$eval('input', i => i.style.display = 'inline');
  await promise;
  expect(await page.evaluate(() => window['result'])).toBe('some value');
});

it('FI-023 should be able to fill the body', async ({ page }) => {
  await page.setContent(`<body contentEditable="true"></body>`);
  await page.fill('body', 'some value');
  expect(await page.evaluate(() => document.body.textContent)).toBe('some value');
});

it('FI-024 should fill fixed position input', async ({ page }) => {
  await page.setContent(`<input style='position: fixed;' />`);
  await page.fill('input', 'some value');
  expect(await page.evaluate(() => document.querySelector('input').value)).toBe('some value');
});

it('FI-025 should be able to fill when focus is in the wrong frame', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43483' },
}, async ({ page }) => {
  await page.setContent(`
    <div contentEditable="true"></div>
    <iframe srcdoc="<body contenteditable><p>old</p></body>"></iframe>
  `);
  await page.focus('iframe');
  await page.fill('div', 'some value');
  expect(await page.$eval('div', d => d.textContent)).toBe('some value');
  const paragraph = page.frameLocator('iframe').locator('p');
  await paragraph.fill('new');
  await expect(paragraph).toHaveText('new');
});

it('FI-026 should be able to fill the input[type=number]', async ({ page }) => {
  await page.setContent(`<input id="input" type="number"></input>`);
  await page.fill('input', '42');
  expect(await page.evaluate(() => window['input'].value)).toBe('42');
});

it('FI-027 should be able to fill exponent into the input[type=number]', async ({ page }) => {
  await page.setContent(`<input id="input" type="number"></input>`);
  await page.fill('input', '-10e5');
  expect(await page.evaluate(() => window['input'].value)).toBe('-10e5');
});

it('FI-028 should be able to fill input[type=number] with empty string', async ({ page }) => {
  await page.setContent(`<input id="input" type="number" value="123"></input>`);
  await page.fill('input', '');
  expect(await page.evaluate(() => window['input'].value)).toBe('');
});

it('FI-029 should not be able to fill text into the input[type=number]', async ({ page }) => {
  await page.setContent(`<input id="input" type="number"></input>`);
  let error = null;
  await page.fill('input', 'abc').catch(e => error = e);
  expect(error.message).toContain('Cannot type text into input[type=number]');
});

it('FI-030 should be able to clear using fill()', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.fill('input', 'some value');
  expect(await page.evaluate(() => window['result'])).toBe('some value');
  await page.fill('input', '');
  expect(await page.evaluate(() => window['result'])).toBe('');
});

it('FI-031 should not throw when fill causes navigation', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.setContent('<input type=date>');
  await page.$eval('input', select => select.addEventListener('input', () => window.location.href = '/empty.html'));
  await Promise.all([
    page.fill('input', '2020-03-02'),
    page.waitForNavigation(),
  ]);
  expect(page.url()).toContain('empty.html');
});

it('FI-032 fill back to back', async ({ page }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/15925' });
  await page.setContent(`<input id="one"></input><input id="two"></input>`);
  await page.fill('id=one', 'first value');
  await page.fill('id=two', 'second value');
  await expect(page.locator('id=one')).toHaveValue('first value');
  await expect(page.locator('id=two')).toHaveValue('second value');
});

it('FI-033 should fill contenteditable with focus handler that collapses selection', {
  annotation: {
    type: 'issue',
    description: 'https://github.com/microsoft/playwright/issues/39492'
  }
}, async ({ page }) => {
  await page.setContent(`
    <div contenteditable="true">initial text</div>
    <script>
      const editor = document.querySelector('[contenteditable]');
      editor.addEventListener('focus', () => {
        const selection = window.getSelection();
        if (selection.rangeCount > 0)
          selection.collapseToEnd();
      });
    </script>
  `);

  await page.fill('div[contenteditable]', 'some value');
  expect(await page.locator('div[contenteditable]').textContent()).toBe('some value');
});

it('FI-034 should retry on inert element', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/42967' } }, async ({ page }) => {
  await page.setContent(`
    <div inert id=container>
      <input id=target>
    </div>
    <input id=outside>
  `);
  await page.focus('#outside');
  let done = false;

  const promise = page.fill('#target', 'some value').then(() => done = true);
  await giveItAChanceToFill(page);
  expect(done).toBe(false);
  expect(await page.$eval('#target', (i: HTMLInputElement) => i.value)).toBe('');
  expect(await page.$eval('#outside', (i: HTMLInputElement) => i.value)).toBe('');

  await page.$eval('#container', e => e.removeAttribute('inert'));
  await promise;
  expect(await page.$eval('#target', (i: HTMLInputElement) => i.value)).toBe('some value');
  expect(await page.$eval('#outside', (i: HTMLInputElement) => i.value)).toBe('');
});

it('FI-035 should retry on element outside of a modal dialog', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/42967' } }, async ({ page }) => {
  await page.setContent(`
    <input id=target>
    <dialog id=dialog><input id=inside></dialog>
    <script>
      document.getElementById('dialog').showModal();
    </script>
  `);
  let done = false;

  await page.fill('#inside', 'inside value');
  expect(await page.$eval('#inside', (i: HTMLInputElement) => i.value)).toBe('inside value');

  const promise = page.fill('#target', 'some value').then(() => done = true);
  await giveItAChanceToFill(page);
  expect(done).toBe(false);
  expect(await page.$eval('#target', (i: HTMLInputElement) => i.value)).toBe('');

  await page.$eval('#dialog', (e: HTMLDialogElement) => e.close());
  await promise;
  expect(await page.$eval('#target', (i: HTMLInputElement) => i.value)).toBe('some value');
});

it('FI-036 should fail with a nice error on inert element', async ({ page }) => {
  await page.setContent(`<div inert><input></div>`);
  const error = await page.fill('input', 'some value', { timeout: 1000 }).catch(e => e);
  expect(error.message).toContain('Timeout 1000ms exceeded');
  expect(error.message).toContain('element is inert');
});
