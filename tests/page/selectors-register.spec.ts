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

it.skip(!!process.env.PW_TEST_CONNECT_WS_ENDPOINT, 'selectors.register does not support reuse');

it('textContent should be atomic', async ({ playwright, page }) => {
  const createDummySelector = () => ({
    query(root, selector) {
      const result = root.querySelector(selector);
      if (result)
        void Promise.resolve().then(() => result.textContent = 'modified');
      return result;
    },
    queryAll(root: HTMLElement, selector: string) {
      const result = Array.from(root.querySelectorAll(selector));
      for (const e of result)
        void Promise.resolve().then(() => e.textContent = 'modified');
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
    query(root: HTMLElement, selector: string) {
      const result = root.querySelector(selector);
      if (result)
        void Promise.resolve().then(() => result.textContent = 'modified');
      return result;
    },
    queryAll(root: HTMLElement, selector: string) {
      const result = Array.from(root.querySelectorAll(selector));
      for (const e of result)
        void Promise.resolve().then(() => e.textContent = 'modified');
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
    query(root, selector) {
      const result = root.querySelector(selector);
      if (result)
        void Promise.resolve().then(() => result.textContent = 'modified');
      return result;
    },
    queryAll(root: HTMLElement, selector: string) {
      const result = Array.from(root.querySelectorAll(selector));
      for (const e of result)
        void Promise.resolve().then(() => e.textContent = 'modified');
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
    query(root: HTMLElement, selector: string) {
      const result = root.querySelector(selector);
      if (result)
        void Promise.resolve().then(() => result.setAttribute('foo', 'modified'));
      return result;
    },
    queryAll(root: HTMLElement, selector: string) {
      const result = Array.from(root.querySelectorAll(selector));
      for (const e of result)
        void Promise.resolve().then(() => (e as HTMLElement).setAttribute('foo', 'modified'));
      return result;
    }
  });
  await playwright.selectors.register('getAttribute', createDummySelector);
  await page.setContent(`<div foo=hello></div>`);
  const tc = await page.getAttribute('getAttribute=div', 'foo');
  expect(tc).toBe('hello');
  expect(await page.evaluate(() => document.querySelector('div').getAttribute('foo'))).toBe('modified');
});

it('isVisible should be atomic', async ({ playwright, page }) => {
  const createDummySelector = () => ({
    query(root, selector) {
      const result = root.querySelector(selector);
      if (result)
        void Promise.resolve().then(() => result.style.display = 'none');
      return result;
    },
    queryAll(root: HTMLElement, selector: string) {
      const result = Array.from(root.querySelectorAll(selector));
      for (const e of result)
        void Promise.resolve().then(() => (e as HTMLElement).style.display = 'none');
      return result;
    }
  });
  await playwright.selectors.register('isVisible', createDummySelector);
  await page.setContent(`<div>Hello</div>`);
  const result = await page.isVisible('isVisible=div');
  expect(result).toBe(true);
  expect(await page.evaluate(() => document.querySelector('div').style.display)).toBe('none');
});

it('should take java-style string', async ({ playwright, page }) => {
  const createDummySelector = `{
    query(root, selector) {
      return root.querySelector(selector);
    },
    queryAll(root, selector) {
      return root.querySelectorAll(selector);
    }
  }`;
  await playwright.selectors.register('objectLiteral', createDummySelector);
  await page.setContent(`<div>Hello</div>`);
  await page.textContent('objectLiteral=div');
});
