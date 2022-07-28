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
  const outer = page.locator('#outer');
  const inner = outer.locator('#inner');
  const check = page.locator('#check');
  const text = await inner.evaluateHandle(e => e.firstChild);
  await page.evaluate(() => 1);  // Give them a chance to calculate the preview.
  expect(String(outer)).toBe('Locator@#outer');
  expect(String(inner)).toBe('Locator@#outer >> #inner');
  expect(String(text)).toBe('JSHandle@#text=Text,↵more text');
  expect(String(check)).toBe('Locator@#check');
});

it('getAttribute should work', async ({ page, server }) => {
  await page.goto(`${server.PREFIX}/dom.html`);
  const locator = page.locator('#outer');
  expect(await locator.getAttribute('name')).toBe('value');
  expect(await locator.getAttribute('foo')).toBe(null);
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
  const locator = page.locator('#input');
  expect(await locator.inputValue()).toBe('input value');

  expect(await page.inputValue('#inner').catch(e => e.message)).toContain('Node is not an <input>, <textarea> or <select> element');
  const locator2 = page.locator('#inner');
  expect(await locator2.inputValue().catch(e => e.message)).toContain('Node is not an <input>, <textarea> or <select> element');
});

it('inputValue should work on label', async ({ page, server }) => {
  await page.setContent(`<label><input type=text></input></label>`);
  await page.fill('input', 'foo');
  expect(await page.locator('label').inputValue()).toBe('foo');
});

it('should get value of input with label', async ({ page }) => {
  await page.setContent(`<label for=target>Fill me</label><input id=target value="some value">`);
  expect(await page.inputValue('text=Fill me')).toBe('some value');
  await expect(page.locator('text=Fill me')).toHaveValue('some value');
});

it('should get value of input with span inside the label', async ({ page }) => {
  await page.setContent(`<label for=target><span>Fill me</span></label><input id=target value="some value">`);
  expect(await page.inputValue('text=Fill me')).toBe('some value');
  await expect(page.locator('text=Fill me')).toHaveValue('some value');
});

it('should get value of textarea with label', async ({ page }) => {
  await page.setContent(`<label for=target>Fill me</label><textarea id=target>hey</textarea>`);
  expect(await page.inputValue('text=Fill me')).toBe('hey');
  await expect(page.locator('text=Fill me')).toHaveValue('hey');

  await page.fill('textarea', 'Look at this');
  expect(await page.inputValue('text=Fill me')).toBe('Look at this');
  await expect(page.locator('text=Fill me')).toHaveValue('Look at this');
});


it('innerHTML should work', async ({ page, server }) => {
  await page.goto(`${server.PREFIX}/dom.html`);
  const locator = page.locator('#outer');
  expect(await locator.innerHTML()).toBe('<div id="inner">Text,\nmore text</div>');
  expect(await page.innerHTML('#outer')).toBe('<div id="inner">Text,\nmore text</div>');
});

it('innerText should work', async ({ page, server }) => {
  await page.goto(`${server.PREFIX}/dom.html`);
  const locator = page.locator('#inner');
  expect(await locator.innerText()).toBe('Text, more text');
  expect(await page.innerText('#inner')).toBe('Text, more text');
});

it('innerText should throw', async ({ page, server }) => {
  await page.setContent(`<svg>text</svg>`);
  const error1 = await page.innerText('svg').catch(e => e);
  expect(error1.message).toContain('Node is not an HTMLElement');
  const locator = page.locator('svg');
  const error2 = await locator.innerText().catch(e => e);
  expect(error2.message).toContain('Node is not an HTMLElement');
});

it('innerText should produce log', async ({ page, server }) => {
  await page.setContent(`<div>Hello</div>`);
  const locator = page.locator('span');
  const error = await locator.innerText({ timeout: 1000 }).catch(e => e);
  expect(error.message).toContain('waiting for selector "span"');
});

it('textContent should work', async ({ page, server }) => {
  await page.goto(`${server.PREFIX}/dom.html`);
  const locator = page.locator('#inner');
  expect(await locator.textContent()).toBe('Text,\nmore text');
  expect(await page.textContent('#inner')).toBe('Text,\nmore text');
});

it('isVisible and isHidden should work', async ({ page }) => {
  await page.setContent(`<div>Hi</div><span></span>`);

  const div = page.locator('div');
  expect(await div.isVisible()).toBe(true);
  expect(await div.isHidden()).toBe(false);
  expect(await page.isVisible('div')).toBe(true);
  expect(await page.isHidden('div')).toBe(false);

  const span = page.locator('span');
  expect(await span.isVisible()).toBe(false);
  expect(await span.isHidden()).toBe(true);
  expect(await page.isVisible('span')).toBe(false);
  expect(await page.isHidden('span')).toBe(true);

  expect(await page.isVisible('no-such-element')).toBe(false);
  expect(await page.isHidden('no-such-element')).toBe(true);
});

it('isEnabled and isDisabled should work', async ({ page }) => {
  await page.setContent(`
    <button disabled>button1</button>
    <button>button2</button>
    <div>div</div>
  `);
  const div = page.locator('div');
  expect(await div.isEnabled()).toBe(true);
  expect(await div.isDisabled()).toBe(false);
  expect(await page.isEnabled('div')).toBe(true);
  expect(await page.isDisabled('div')).toBe(false);
  const button1 = page.locator(':text("button1")');
  expect(await button1.isEnabled()).toBe(false);
  expect(await button1.isDisabled()).toBe(true);
  expect(await page.isEnabled(':text("button1")')).toBe(false);
  expect(await page.isDisabled(':text("button1")')).toBe(true);
  const button2 = page.locator(':text("button2")');
  expect(await button2.isEnabled()).toBe(true);
  expect(await button2.isDisabled()).toBe(false);
  expect(await page.isEnabled(':text("button2")')).toBe(true);
  expect(await page.isDisabled(':text("button2")')).toBe(false);
});

it('isEditable should work', async ({ page }) => {
  await page.setContent(`<input id=input1 disabled><textarea></textarea><input id=input2>`);
  await page.$eval('textarea', t => t.readOnly = true);
  const input1 = page.locator('#input1');
  expect(await input1.isEditable()).toBe(false);
  expect(await page.isEditable('#input1')).toBe(false);
  const input2 = page.locator('#input2');
  expect(await input2.isEditable()).toBe(true);
  expect(await page.isEditable('#input2')).toBe(true);
  const textarea = page.locator('textarea');
  expect(await textarea.isEditable()).toBe(false);
  expect(await page.isEditable('textarea')).toBe(false);
});

it('isChecked should work', async ({ page }) => {
  await page.setContent(`<input type='checkbox' checked><div>Not a checkbox</div>`);
  const element = page.locator('input');
  expect(await element.isChecked()).toBe(true);
  expect(await page.isChecked('input')).toBe(true);
  await element.evaluate(input => (input as HTMLInputElement).checked = false);
  expect(await element.isChecked()).toBe(false);
  expect(await page.isChecked('input')).toBe(false);
  const error = await page.isChecked('div').catch(e => e);
  expect(error.message).toContain('Not a checkbox or radio button');
});

it('allTextContents should work', async ({ page }) => {
  await page.setContent(`<div>A</div><div>B</div><div>C</div>`);
  expect(await page.locator('div').allTextContents()).toEqual(['A', 'B', 'C']);
});

it('allInnerTexts should work', async ({ page }) => {
  await page.setContent(`<div>A</div><div>B</div><div>C</div>`);
  expect(await page.locator('div').allInnerTexts()).toEqual(['A', 'B', 'C']);
});

it('isVisible and isHidden should work with details', async ({ page, isAndroid, isElectron }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/10674' });
  it.skip(isElectron, 'We don\'t disable the AutoExpandDetailsElement feature on Electron');
  it.skip(isAndroid, 'We can\'t disable the AutoExpandDetailsElement feature on Android');
  await page.setContent(`<details>
    <summary>click to open</summary>
      <ul>
        <li>hidden item 1</li>
        <li>hidden item 2</li>
        <li>hidden item 3</li>
      </ul
  </details>`);

  await expect(page.locator('ul')).toBeHidden();
});

it('should return page', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/frames/two-frames.html');
  const outer = page.locator('#outer');
  expect(outer.page()).toBe(page);

  const inner = outer.locator('#inner');
  expect(inner.page()).toBe(page);

  const inFrame = page.frames()[1].locator('div');
  expect(inFrame.page()).toBe(page);
});

it('isVisible inside a button', async ({ page }) => {
  await page.setContent(`<button><span></span>a button</button>`);
  const span = page.locator('span');
  expect(await span.isVisible()).toBe(false);
  expect(await span.isHidden()).toBe(true);
  expect(await page.isVisible('span')).toBe(false);
  expect(await page.isHidden('span')).toBe(true);
  await expect(span).not.toBeVisible();
  await expect(span).toBeHidden();
  await span.waitFor({ state: 'hidden' });
  await page.locator('button').waitFor({ state: 'visible' });
});

it('isVisible inside a role=button', async ({ page }) => {
  await page.setContent(`<div role=button><span></span>a button</div>`);
  const span = page.locator('span');
  expect(await span.isVisible()).toBe(false);
  expect(await span.isHidden()).toBe(true);
  expect(await page.isVisible('span')).toBe(false);
  expect(await page.isHidden('span')).toBe(true);
  await expect(span).not.toBeVisible();
  await expect(span).toBeHidden();
  await span.waitFor({ state: 'hidden' });
  await page.locator('[role=button]').waitFor({ state: 'visible' });
});
