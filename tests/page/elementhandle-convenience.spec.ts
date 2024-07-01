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

it('should have a nice preview', async ({ page, server }) => {
  await page.goto(`${server.PREFIX}/dom.html`);
  const outer = await page.$('#outer');
  const inner = await page.$('#inner');
  const check = await page.$('#check');
  const text = await inner.evaluateHandle(e => e.firstChild);
  await page.evaluate(() => 1);  // Give them a chance to calculate the preview.
  expect(String(outer)).toBe('JSHandle@<div id="outer" name="value">…</div>');
  expect(String(inner)).toBe('JSHandle@<div id="inner">Text,↵more text</div>');
  expect(String(text)).toBe('JSHandle@#text=Text,↵more text');
  expect(String(check)).toBe('JSHandle@<input checked id="check" foo="bar"" type="checkbox"/>');
});

it('should have a nice preview for non-ascii attributes/children', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<div title="${'😛'.repeat(100)}">${'😛'.repeat(100)}`);
  const handle = await page.$('div');
  await expect.poll(() => String(handle)).toBe(`JSHandle@<div title=\"😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛\">😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛😛…</div>`);
});

it('getAttribute should work', async ({ page, server }) => {
  await page.goto(`${server.PREFIX}/dom.html`);
  const handle = await page.$('#outer');
  expect(await handle.getAttribute('name')).toBe('value');
  expect(await handle.getAttribute('foo')).toBe(null);
  expect(await page.getAttribute('#outer', 'name')).toBe('value');
  expect(await page.getAttribute('#outer', 'foo')).toBe(null);
});

it('inputValue should work', async ({ page, server }) => {
  await page.goto(`${server.PREFIX}/dom.html`);

  await page.selectOption('#select', 'foo');
  expect(await page.inputValue('#select')).toBe('foo');

  await page.fill('#textarea', 'text value');
  expect(await page.inputValue('#textarea')).toBe('text value');

  await page.fill('#input', 'input value');
  expect(await page.inputValue('#input')).toBe('input value');
  const handle = await page.$('#input');
  expect(await handle.inputValue()).toBe('input value');

  expect(await page.inputValue('#inner').catch(e => e.message)).toContain('Node is not an <input>, <textarea> or <select> element');
  const handle2 = await page.$('#inner');
  expect(await handle2.inputValue().catch(e => e.message)).toContain('Node is not an <input>, <textarea> or <select> element');
});

it('innerHTML should work', async ({ page, server }) => {
  await page.goto(`${server.PREFIX}/dom.html`);
  const handle = await page.$('#outer');
  expect(await handle.innerHTML()).toBe('<div id="inner">Text,\nmore text</div>');
  expect(await page.innerHTML('#outer')).toBe('<div id="inner">Text,\nmore text</div>');
});

it('innerText should work', async ({ page, server }) => {
  await page.goto(`${server.PREFIX}/dom.html`);
  const handle = await page.$('#inner');
  expect(await handle.innerText()).toBe('Text, more text');
  expect(await page.innerText('#inner')).toBe('Text, more text');
});

it('innerText should throw', async ({ page, server }) => {
  await page.setContent(`<svg>text</svg>`);
  const error1 = await page.innerText('svg').catch(e => e);
  expect(error1.message).toContain('Node is not an HTMLElement');
  const handle = await page.$('svg');
  const error2 = await handle.innerText().catch(e => e);
  expect(error2.message).toContain('Node is not an HTMLElement');
});

it('textContent should work', async ({ page, server }) => {
  await page.goto(`${server.PREFIX}/dom.html`);
  const handle = await page.$('#inner');
  expect(await handle.textContent()).toBe('Text,\nmore text');
  expect(await page.textContent('#inner')).toBe('Text,\nmore text');
});

it('textContent should work on ShadowRoot', async ({ page, server }) => {
  await page.setContent(`
    <div></div>
    <script>
      document.querySelector('div').attachShadow({ mode: 'open' }).innerHTML = '<div>hello</div>';
    </script>
  `);
  const div = await page.$('div');
  const root = await div.evaluateHandle(div => div.shadowRoot);
  expect(await root.textContent()).toBe('hello');
  // We do not match ShadowRoot as ":scope".
  expect(await root.$$(':scope div')).toEqual([]);
});

it('isVisible and isHidden should work', async ({ page }) => {
  await page.setContent(`<div>Hi</div><span></span>`);

  const div = await page.$('div');
  expect(await div.isVisible()).toBe(true);
  expect(await div.isHidden()).toBe(false);
  expect(await page.isVisible('div')).toBe(true);
  expect(await page.isHidden('div')).toBe(false);

  const span = await page.$('span');
  expect(await span.isVisible()).toBe(false);
  expect(await span.isHidden()).toBe(true);
  expect(await page.isVisible('span')).toBe(false);
  expect(await page.isHidden('span')).toBe(true);

  expect(await page.isVisible('no-such-element')).toBe(false);
  expect(await page.isHidden('no-such-element')).toBe(true);
});

it('isVisible should not throw when the DOM element is not connected', async ({ page }) => {
  await page.setContent(`<div id="root"></div>`);
  await page.evaluate(() => {
    function insert() {
      document.getElementById('root').innerHTML = '<div id="problem">Problem</div>';
      window.requestAnimationFrame(remove);
    }
    function remove() {
      const node = document.getElementById('problem');
      node?.parentNode?.removeChild(node);
      window.requestAnimationFrame(insert);
    }
    window.requestAnimationFrame(insert);
  });

  for (let i = 0; i < 10; i++)
    await page.isVisible('#problem');
});

it('isEnabled and isDisabled should work', async ({ page }) => {
  await page.setContent(`
    <button disabled>button1</button>
    <button>button2</button>
    <div>div</div>
  `);
  const div = await page.$('div');
  expect(await div.isEnabled()).toBe(true);
  expect(await div.isDisabled()).toBe(false);
  expect(await page.isEnabled('div')).toBe(true);
  expect(await page.isDisabled('div')).toBe(false);
  const button1 = await page.$(':text("button1")');
  expect(await button1.isEnabled()).toBe(false);
  expect(await button1.isDisabled()).toBe(true);
  expect(await page.isEnabled(':text("button1")')).toBe(false);
  expect(await page.isDisabled(':text("button1")')).toBe(true);
  const button2 = await page.$(':text("button2")');
  expect(await button2.isEnabled()).toBe(true);
  expect(await button2.isDisabled()).toBe(false);
  expect(await page.isEnabled(':text("button2")')).toBe(true);
  expect(await page.isDisabled(':text("button2")')).toBe(false);
});

it('isEnabled and isDisabled should work with <select/> option/optgroup correctly', async ({ page }) => {
  await page.setContent(`
    <select name="select">
      <option id="enabled1" value="1">Enabled</option>
      <option id="disabled1" value="2" disabled>Disabled</option>
      <optgroup label="Foo1">
        <option value="mercedes">Mercedes</option>
      </optgroup>
      <optgroup label="Foo2" disabled>
        <option value="mercedes">Mercedes</option>
      </optgroup>
    </select>
  `);
  expect((await (await page.$('#enabled1')).isEnabled())).toBe(true);
  expect((await (await page.$('#enabled1')).isDisabled())).toBe(false);
  expect((await (await page.$('#disabled1')).isEnabled())).toBe(false);
  expect((await (await page.$('#disabled1')).isDisabled())).toBe(true);
  expect((await (await page.$('optgroup >> nth=0')).isEnabled())).toBe(true);
  expect((await (await page.$('optgroup >> nth=0')).isDisabled())).toBe(false);
  expect((await (await page.$('optgroup >> nth=1')).isEnabled())).toBe(false);
  expect((await (await page.$('optgroup >> nth=1')).isDisabled())).toBe(true);
});

it('isEditable should work', async ({ page }) => {
  await page.setContent(`<input id=input1 disabled><textarea></textarea><input id=input2>`);
  await page.$eval('textarea', t => t.readOnly = true);
  const input1 = await page.$('#input1');
  expect(await input1.isEditable()).toBe(false);
  expect(await page.isEditable('#input1')).toBe(false);
  const input2 = await page.$('#input2');
  expect(await input2.isEditable()).toBe(true);
  expect(await page.isEditable('#input2')).toBe(true);
  const textarea = await page.$('textarea');
  expect(await textarea.isEditable()).toBe(false);
  expect(await page.isEditable('textarea')).toBe(false);
});

it('isChecked should work', async ({ page }) => {
  await page.setContent(`<input type='checkbox' checked><div>Not a checkbox</div>`);
  const handle = await page.$('input');
  expect(await handle.isChecked()).toBe(true);
  expect(await page.isChecked('input')).toBe(true);
  await handle.evaluate(input => input.checked = false);
  expect(await handle.isChecked()).toBe(false);
  expect(await page.isChecked('input')).toBe(false);
  const error = await page.isChecked('div').catch(e => e);
  expect(error.message).toContain('Not a checkbox or radio button');
});
