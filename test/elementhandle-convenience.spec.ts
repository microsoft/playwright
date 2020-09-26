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

import { it, expect } from './fixtures';

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

it('getAttribute should work', async ({ page, server }) => {
  await page.goto(`${server.PREFIX}/dom.html`);
  const handle = await page.$('#outer');
  expect(await handle.getAttribute('name')).toBe('value');
  expect(await handle.getAttribute('foo')).toBe(null);
  expect(await page.getAttribute('#outer', 'name')).toBe('value');
  expect(await page.getAttribute('#outer', 'foo')).toBe(null);
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
  expect(error1.message).toContain('Not an HTMLElement');
  const handle = await page.$('svg');
  const error2 = await handle.innerText().catch(e => e);
  expect(error2.message).toContain('Not an HTMLElement');
});

it('textContent should work', async ({ page, server }) => {
  await page.goto(`${server.PREFIX}/dom.html`);
  const handle = await page.$('#inner');
  expect(await handle.textContent()).toBe('Text,\nmore text');
  expect(await page.textContent('#inner')).toBe('Text,\nmore text');
});

it('textContent should be atomic', async ({ playwright, page }) => {
  const createDummySelector = () => ({
    create(root, target) { },
    query(root, selector) {
      const result = root.querySelector(selector);
      if (result)
        Promise.resolve().then(() => result.textContent = 'modified');
      return result;
    },
    queryAll(root: HTMLElement, selector: string) {
      const result = Array.from(root.querySelectorAll(selector));
      for (const e of result)
        Promise.resolve().then(() => e.textContent = 'modified');
      return result;
    }
  });
  await playwright.selectors.register('textContent', createDummySelector);
  await page.setContent(`<div>Hello</div>`);
  const tc = await page.textContent('textContent=div');
  expect(tc).toBe('Hello');
  expect(await page.evaluate(() => document.querySelector('div').textContent)).toBe('modified');
});

it('innerText should be atomic', async ({ playwright, page }) => {
  const createDummySelector = () => ({
    create(root, target) { },
    query(root: HTMLElement, selector: string) {
      const result = root.querySelector(selector);
      if (result)
        Promise.resolve().then(() => result.textContent = 'modified');
      return result;
    },
    queryAll(root: HTMLElement, selector: string) {
      const result = Array.from(root.querySelectorAll(selector));
      for (const e of result)
        Promise.resolve().then(() => e.textContent = 'modified');
      return result;
    }
  });
  await playwright.selectors.register('innerText', createDummySelector);
  await page.setContent(`<div>Hello</div>`);
  const tc = await page.innerText('innerText=div');
  expect(tc).toBe('Hello');
  expect(await page.evaluate(() => document.querySelector('div').innerText)).toBe('modified');
});

it('innerHTML should be atomic', async ({ playwright, page }) => {
  const createDummySelector = () => ({
    create(root, target) { },
    query(root, selector) {
      const result = root.querySelector(selector);
      if (result)
        Promise.resolve().then(() => result.textContent = 'modified');
      return result;
    },
    queryAll(root: HTMLElement, selector: string) {
      const result = Array.from(root.querySelectorAll(selector));
      for (const e of result)
        Promise.resolve().then(() => e.textContent = 'modified');
      return result;
    }
  });
  await playwright.selectors.register('innerHTML', createDummySelector);
  await page.setContent(`<div>Hello<span>world</span></div>`);
  const tc = await page.innerHTML('innerHTML=div');
  expect(tc).toBe('Hello<span>world</span>');
  expect(await page.evaluate(() => document.querySelector('div').innerHTML)).toBe('modified');
});

it('getAttribute should be atomic', async ({ playwright, page }) => {
  const createDummySelector = () => ({
    create(root, target) { },
    query(root: HTMLElement, selector: string) {
      const result = root.querySelector(selector);
      if (result)
        Promise.resolve().then(() => result.setAttribute('foo', 'modified'));
      return result;
    },
    queryAll(root: HTMLElement, selector: string) {
      const result = Array.from(root.querySelectorAll(selector));
      for (const e of result)
        Promise.resolve().then(() => (e as HTMLElement).setAttribute('foo', 'modified'));
      return result;
    }
  });
  await playwright.selectors.register('getAttribute', createDummySelector);
  await page.setContent(`<div foo=hello></div>`);
  const tc = await page.getAttribute('getAttribute=div', 'foo');
  expect(tc).toBe('hello');
  expect(await page.evaluate(() => document.querySelector('div').getAttribute('foo'))).toBe('modified');
});
