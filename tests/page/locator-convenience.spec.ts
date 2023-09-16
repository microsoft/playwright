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
  expect.soft(String(outer)).toBe(`locator('#outer')`);
  expect.soft(String(inner)).toBe(`locator('#outer').locator('#inner')`);
  expect.soft(String(text)).toBe(`JSHandle@#text=Text,↵more text`);
  expect.soft(String(check)).toBe(`locator('#check')`);
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
  expect(error.message).toContain('waiting for locator(\'span\')');
});

it('textContent should work', async ({ page, server }) => {
  await page.goto(`${server.PREFIX}/dom.html`);
  const locator = page.locator('#inner');
  expect(await locator.textContent()).toBe('Text,\nmore text');
  expect(await page.textContent('#inner')).toBe('Text,\nmore text');
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

it('isChecked should work for indeterminate input', async ({ page }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/20190' });

  await page.setContent(`<input type="checkbox" checked>`);
  await page.locator('input').evaluate((e: HTMLInputElement) => e.indeterminate = true);

  expect(await page.locator('input').isChecked()).toBe(true);
  await expect(page.locator('input')).toBeChecked();

  await page.locator('input').uncheck();

  expect(await page.locator('input').isChecked()).toBe(false);
  await expect(page.locator('input')).not.toBeChecked();
});

it('allTextContents should work', async ({ page }) => {
  await page.setContent(`<div>A</div><div>B</div><div>C</div>`);
  expect(await page.locator('div').allTextContents()).toEqual(['A', 'B', 'C']);
});

it('allInnerTexts should work', async ({ page }) => {
  await page.setContent(`<div>A</div><div>B</div><div>C</div>`);
  expect(await page.locator('div').allInnerTexts()).toEqual(['A', 'B', 'C']);
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
