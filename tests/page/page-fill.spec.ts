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

async function giveItAChanceToFill(page) {
  for (let i = 0; i < 5; i++)
    await page.evaluate(() => new Promise(f => requestAnimationFrame(() => requestAnimationFrame(f))));
}

it('should fill textarea', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.fill('textarea', 'some value');
  expect(await page.evaluate(() => window['result'])).toBe('some value');
});

it('should fill input', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.fill('input', 'some value');
  expect(await page.evaluate(() => window['result'])).toBe('some value');
});

it('should fill input with label', async ({page}) => {
  await page.setContent(`<label for=target>Fill me</label><input id=target>`);
  await page.fill('text=Fill me', 'some value');
  expect(await page.$eval('input', input => input.value)).toBe('some value');
});

it('should fill input with label 2', async ({page}) => {
  await page.setContent(`<label>Fill me<input id=target></label>`);
  await page.fill('text=Fill me', 'some value');
  expect(await page.$eval('input', input => input.value)).toBe('some value');
});

it('should fill input with span inside the label', async ({page}) => {
  await page.setContent(`<label for=target><span>Fill me</span></label><input id=target>`);
  await page.fill('text=Fill me', 'some value');
  expect(await page.$eval('input', input => input.value)).toBe('some value');
});

it('should fill input inside the label', async ({page}) => {
  await page.setContent(`<label><input id=target></label>`);
  await page.fill('input', 'some value');
  expect(await page.$eval('input', input => input.value)).toBe('some value');
});

it('should fill textarea with label', async ({page}) => {
  await page.setContent(`<label for=target>Fill me</label><textarea id=target>hey</textarea>`);
  await page.fill('text=Fill me', 'some value');
  expect(await page.$eval('textarea', textarea => textarea.value)).toBe('some value');
});

it('should throw on unsupported inputs', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  for (const type of ['button', 'checkbox', 'file', 'image', 'radio', 'range', 'reset', 'submit']) {
    await page.$eval('input', (input, type) => input.setAttribute('type', type), type);
    let error = null;
    await page.fill('input', '').catch(e => error = e);
    expect(error.message).toContain(`input of type "${type}" cannot be filled`);
  }
});

it('should fill different input types', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  for (const type of ['password', 'search', 'tel', 'text', 'url', 'invalid-type']) {
    await page.$eval('input', (input, type) => input.setAttribute('type', type), type);
    await page.fill('input', 'text ' + type);
    expect(await page.evaluate(() => window['result'])).toBe('text ' + type);
  }
});

it('should fill date input after clicking', async ({page, server}) => {
  await page.setContent('<input type=date>');
  await page.click('input');
  await page.fill('input', '2020-03-02');
  expect(await page.$eval('input', input => input.value)).toBe('2020-03-02');
});

it('should throw on incorrect date', async ({page, browserName}) => {
  it.skip(browserName === 'webkit', 'WebKit does not support date inputs');

  await page.setContent('<input type=date>');
  const error = await page.fill('input', '2020-13-05').catch(e => e);
  expect(error.message).toContain('Malformed value');
});

it('should fill time input', async ({page}) => {
  await page.setContent('<input type=time>');
  await page.fill('input', '13:15');
  expect(await page.$eval('input', input => input.value)).toBe('13:15');
});

it('should fill month input', async ({page}) => {
  await page.setContent('<input type=month>');
  await page.fill('input', '2020-07');
  expect(await page.$eval('input', input => input.value)).toBe('2020-07');
});

it('should throw on incorrect month', async ({page, browserName}) => {
  it.skip(browserName !== 'chromium', 'Only Chromium supports month inputs');

  await page.setContent('<input type=month>');
  const error = await page.fill('input', '2020-13').catch(e => e);
  expect(error.message).toContain('Malformed value');
});

it('should fill week input', async ({page}) => {
  await page.setContent('<input type=week>');
  await page.fill('input', '2020-W50');
  expect(await page.$eval('input', input => input.value)).toBe('2020-W50');
});

it('should throw on incorrect week', async ({page, browserName}) => {
  it.skip(browserName !== 'chromium', 'Only Chromium supports week inputs');

  await page.setContent('<input type=week>');
  const error = await page.fill('input', '2020-123').catch(e => e);
  expect(error.message).toContain('Malformed value');
});

it('should throw on incorrect time', async ({page, browserName}) => {
  it.skip(browserName === 'webkit', 'WebKit does not support time inputs');

  await page.setContent('<input type=time>');
  const error = await page.fill('input', '25:05').catch(e => e);
  expect(error.message).toContain('Malformed value');
});

it('should fill datetime-local input', async ({page, server}) => {
  await page.setContent('<input type=datetime-local>');
  await page.fill('input', '2020-03-02T05:15');
  expect(await page.$eval('input', input => input.value)).toBe('2020-03-02T05:15');
});

it('should throw on incorrect datetime-local', async ({page, server, browserName}) => {
  it.skip(browserName !== 'chromium', 'Only Chromium supports datetime-local inputs');

  await page.setContent('<input type=datetime-local>');
  const error = await page.fill('input', 'abc').catch(e => e);
  expect(error.message).toContain('Malformed value');
});

it('should fill contenteditable', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.fill('div[contenteditable]', 'some value');
  expect(await page.$eval('div[contenteditable]', div => div.textContent)).toBe('some value');
});

it('should fill elements with existing value and selection', async ({page, server}) => {
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

it('should throw when element is not an <input>, <textarea> or [contenteditable]', async ({page, server}) => {
  let error = null;
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.fill('body', '').catch(e => error = e);
  expect(error.message).toContain('Element is not an <input>');
});

it('should throw if passed a non-string value', async ({page, server}) => {
  let error = null;
  await page.goto(server.PREFIX + '/input/textarea.html');
  // @ts-expect-error fill only accepts string values
  await page.fill('textarea', 123).catch(e => error = e);
  expect(error.message).toContain('value: expected string, got number');
});

it('should retry on disabled element', async ({page, server}) => {
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

it('should retry on readonly element', async ({page, server}) => {
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

it('should retry on invisible element', async ({page, server}) => {
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

it('should be able to fill the body', async ({page}) => {
  await page.setContent(`<body contentEditable="true"></body>`);
  await page.fill('body', 'some value');
  expect(await page.evaluate(() => document.body.textContent)).toBe('some value');
});

it('should fill fixed position input', async ({page}) => {
  await page.setContent(`<input style='position: fixed;' />`);
  await page.fill('input', 'some value');
  expect(await page.evaluate(() => document.querySelector('input').value)).toBe('some value');
});

it('should be able to fill when focus is in the wrong frame', async ({page}) => {
  await page.setContent(`
    <div contentEditable="true"></div>
    <iframe></iframe>
  `);
  await page.focus('iframe');
  await page.fill('div', 'some value');
  expect(await page.$eval('div', d => d.textContent)).toBe('some value');
});

it('should be able to fill the input[type=number]', async ({page}) => {
  await page.setContent(`<input id="input" type="number"></input>`);
  await page.fill('input', '42');
  expect(await page.evaluate(() => window['input'].value)).toBe('42');
});

it('should be able to fill exponent into the input[type=number]', async ({page}) => {
  await page.setContent(`<input id="input" type="number"></input>`);
  await page.fill('input', '-10e5');
  expect(await page.evaluate(() => window['input'].value)).toBe('-10e5');
});

it('should be able to fill input[type=number] with empty string', async ({page}) => {
  await page.setContent(`<input id="input" type="number" value="123"></input>`);
  await page.fill('input', '');
  expect(await page.evaluate(() => window['input'].value)).toBe('');
});

it('should not be able to fill text into the input[type=number]', async ({page}) => {
  await page.setContent(`<input id="input" type="number"></input>`);
  let error = null;
  await page.fill('input', 'abc').catch(e => error = e);
  expect(error.message).toContain('Cannot type text into input[type=number]');
});

it('should be able to clear', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.fill('input', 'some value');
  expect(await page.evaluate(() => window['result'])).toBe('some value');
  await page.fill('input', '');
  expect(await page.evaluate(() => window['result'])).toBe('');
});

it('should not throw when fill causes navigation', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.setContent('<input type=date>');
  await page.$eval('input', select => select.addEventListener('input', () => window.location.href = '/empty.html'));
  await Promise.all([
    page.fill('input', '2020-03-02'),
    page.waitForNavigation(),
  ]);
  expect(page.url()).toContain('empty.html');
});
