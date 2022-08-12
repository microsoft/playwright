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

import { test as it, expect } from './pageTest';

async function giveItAChanceToResolve(page) {
  for (let i = 0; i < 5; i++)
    await page.evaluate(() => new Promise(f => requestAnimationFrame(() => requestAnimationFrame(f))));
}

it('element state checks should work as expected for label with zero-sized input', async ({ page, server }) => {
  await page.setContent(`
    <label>
      Click me
      <input disabled style="width:0;height:0;padding:0;margin:0;border:0;">
    </label>
  `);
  // Visible checks the label.
  expect(await page.isVisible('text=Click me')).toBe(true);
  expect(await page.isHidden('text=Click me')).toBe(false);

  // Enabled checks the input.
  expect(await page.isEnabled('text=Click me')).toBe(false);
  expect(await page.isDisabled('text=Click me')).toBe(true);
});

it('should wait for enclosing disabled button', async ({ page }) => {
  await page.setContent('<button><span>Target</span></button>');
  const span = await page.$('text=Target');
  let done = false;
  const promise = span.waitForElementState('disabled').then(() => done = true);
  await giveItAChanceToResolve(page);
  expect(done).toBe(false);
  await span.evaluate(span => (span.parentElement as HTMLButtonElement).disabled = true);
  await promise;
});

it('should wait for enclosing button with a disabled fieldset', async ({ page }) => {
  await page.setContent('<fieldset disabled=true><button><span>Target</span></button></div>');
  const span = await page.$('text=Target');
  let done = false;
  const promise = span.waitForElementState('enabled').then(() => done = true);
  await giveItAChanceToResolve(page);
  expect(done).toBe(false);
  await span.evaluate(span => (span.parentElement.parentElement as HTMLFieldSetElement).disabled = false);
  await promise;
});

it('should wait for enclosing enabled button', async ({ page, server }) => {
  await page.setContent('<button disabled><span>Target</span></button>');
  const span = await page.$('text=Target');
  let done = false;
  const promise = span.waitForElementState('enabled').then(() => done = true);
  await giveItAChanceToResolve(page);
  expect(done).toBe(false);
  await span.evaluate(span => (span.parentElement as HTMLButtonElement).disabled = false);
  await promise;
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

it('should check the box by label', async ({ page }) => {
  await page.setContent(`<label for='checkbox'><input id='checkbox' type='checkbox'></input></label>`);
  await page.check('label');
  expect(await page.evaluate(() => window['checkbox'].checked)).toBe(true);
});

it('should check the box outside label', async ({ page }) => {
  await page.setContent(`<label for='checkbox'>Text</label><div><input id='checkbox' type='checkbox'></input></div>`);
  await page.check('label');
  expect(await page.evaluate(() => window['checkbox'].checked)).toBe(true);
});

it('should check the box inside label w/o id', async ({ page }) => {
  await page.setContent(`<label>Text<span><input id='checkbox' type='checkbox'></input></span></label>`);
  await page.check('label');
  expect(await page.evaluate(() => window['checkbox'].checked)).toBe(true);
});

it('should check the box outside shadow dom label', async ({ page }) => {
  await page.setContent('<div></div>');
  await page.$eval('div', div => {
    const root = div.attachShadow({ mode: 'open' });
    const label = document.createElement('label');
    label.setAttribute('for', 'target');
    label.textContent = 'Click me';
    root.appendChild(label);
    const input = document.createElement('input');
    input.setAttribute('type', 'checkbox');
    input.setAttribute('id', 'target');
    root.appendChild(input);
  });
  await page.check('label');
  expect(await page.$eval('input', input => input.checked)).toBe(true);
});

it('click should climb dom for inner label with pointer-events:none', async ({ page }) => {
  await page.setContent('<button onclick="javascript:window.__CLICKED=true;"><label style="pointer-events:none">Click target</label></button>');
  await page.click('text=Click target');
  expect(await page.evaluate('__CLICKED')).toBe(true);
});

it('click should climb up to [role=button]', async ({ page }) => {
  await page.setContent('<div role=button onclick="javascript:window.__CLICKED=true;"><div style="pointer-events:none"><span><div>Click target</div></span></div>');
  await page.click('text=Click target');
  expect(await page.evaluate('__CLICKED')).toBe(true);
});

it('click should climb up to a anchor', async ({ page }) => {
  // For Firefox its not allowed to return anything: https://bugzilla.mozilla.org/show_bug.cgi?id=1392046
  // Note the intermediate div - it is necessary, otherwise <a><non-clickable/></a> is not recognized as a clickable link.
  await page.setContent(`<a href="javascript:(function(){window.__CLICKED=true})()" id="outer"><div id="intermediate"><div id="inner" style="pointer-events: none">Inner</div></div></a>`);
  await page.click('#inner');
  expect(await page.evaluate('__CLICKED')).toBe(true);
});

it('click should climb up to a [role=link]', async ({ page }) => {
  await page.setContent(`<div role=link onclick="javascript:window.__CLICKED=true;" id="outer"><div id="inner" style="pointer-events: none">Inner</div></div>`);
  await page.click('#inner');
  expect(await page.evaluate('__CLICKED')).toBe(true);
});


it('should fill input with label', async ({ page }) => {
  await page.setContent(`<label for=target>Fill me</label><input id=target>`);
  await page.fill('text=Fill me', 'some value');
  expect(await page.$eval('input', input => input.value)).toBe('some value');
});

it('should fill input with label 2', async ({ page }) => {
  await page.setContent(`<label>Fill me<input id=target></label>`);
  await page.fill('text=Fill me', 'some value');
  expect(await page.$eval('input', input => input.value)).toBe('some value');
});

it('should fill input with span inside the label', async ({ page }) => {
  await page.setContent(`<label for=target><span>Fill me</span></label><input id=target>`);
  await page.fill('text=Fill me', 'some value');
  expect(await page.$eval('input', input => input.value)).toBe('some value');
});

it('should fill input inside the label', async ({ page }) => {
  await page.setContent(`<label><input id=target></label>`);
  await page.fill('input', 'some value');
  expect(await page.$eval('input', input => input.value)).toBe('some value');
});

it('should fill textarea with label', async ({ page }) => {
  await page.setContent(`<label for=target>Fill me</label><textarea id=target>hey</textarea>`);
  await page.fill('text=Fill me', 'some value');
  expect(await page.$eval('textarea', textarea => textarea.value)).toBe('some value');
});

it('should selectOption with sibling label', async ({ page, server }) => {
  await page.setContent(`<label for=pet-select>Choose a pet</label>
    <select id='pet-select'>
      <option value='dog'>Dog</option>
      <option value='cat'>Cat</option>
    </select>`);
  await page.selectOption('text=Choose a pet', 'cat');
  expect(await page.$eval('select', select => select.options[select.selectedIndex].text)).toEqual('Cat');
});

it('should selectOption with outer label', async ({ page, server }) => {
  await page.setContent(`<label for=pet-select>Choose a pet
    <select id='pet-select'>
      <option value='dog'>Dog</option>
      <option value='cat'>Cat</option>
    </select></label>`);
  await page.selectOption('text=Choose a pet', 'cat');
  expect(await page.$eval('select', select => select.options[select.selectedIndex].text)).toEqual('Cat');
});

it('setInputFiles should work with label', async ({ page, asset }) => {
  await page.setContent(`<label for=target>Choose a file</label><input id=target type=file>`);
  await page.setInputFiles('text=Choose a file', asset('file-to-upload.txt'));
  expect(await page.$eval('input', input => input.files.length)).toBe(1);
  expect(await page.$eval('input', input => input.files[0].name)).toBe('file-to-upload.txt');
});
