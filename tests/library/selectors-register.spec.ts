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

import { browserTest as it, expect } from '../config/browserTest';

const createTagSelector = () => ({
  query(root, selector) {
    return root.querySelector(selector);
  },
  queryAll(root, selector) {
    return Array.from(root.querySelectorAll(selector));
  }
});

it('should work', async ({ playwright, browser }) => {
  // Register one engine before creating context.
  await playwright.selectors.register('tag', `(${createTagSelector.toString()})()`);

  const context = await browser.newContext();
  // Register another engine after creating context.
  await playwright.selectors.register('tag2', `(${createTagSelector.toString()})()`);

  const page = await context.newPage();
  await page.setContent('<div><span></span></div><div></div>');

  expect(await page.$eval('tag=DIV', e => e.nodeName)).toBe('DIV');
  expect(await page.$eval('tag=SPAN', e => e.nodeName)).toBe('SPAN');
  expect(await page.$$eval('tag=DIV', es => es.length)).toBe(2);

  expect(await page.$eval('tag2=DIV', e => e.nodeName)).toBe('DIV');
  expect(await page.$eval('tag2=SPAN', e => e.nodeName)).toBe('SPAN');
  expect(await page.$$eval('tag2=DIV', es => es.length)).toBe(2);

  // Selector names are case-sensitive.
  const error = await page.$('tAG=DIV').catch(e => e);
  expect(error.message).toContain('Unknown engine "tAG" while parsing selector tAG=DIV');

  await context.close();
});

it('should work when registered on global', async ({ browser }) => {
  await require('@playwright/test').selectors.register('oop-tag', `(${createTagSelector.toString()})()`);

  const context = await browser.newContext();
  // Register another engine after creating context.
  await require('@playwright/test').selectors.register('oop-tag2', `(${createTagSelector.toString()})()`);

  const page = await context.newPage();
  await page.setContent('<div><span></span></div><div></div>');

  expect(await page.$eval('oop-tag=DIV', e => e.nodeName)).toBe('DIV');
  expect(await page.$eval('oop-tag=SPAN', e => e.nodeName)).toBe('SPAN');
  expect(await page.$$eval('oop-tag=DIV', es => es.length)).toBe(2);

  expect(await page.$eval('oop-tag2=DIV', e => e.nodeName)).toBe('DIV');
  expect(await page.$eval('oop-tag2=SPAN', e => e.nodeName)).toBe('SPAN');
  expect(await page.$$eval('oop-tag2=DIV', es => es.length)).toBe(2);

  await context.close();
});

it('should work with path', async ({ playwright, browser, asset }) => {
  const page = await browser.newPage();
  await playwright.selectors.register('foo', { path: asset('sectionselectorengine.js') });
  await page.setContent('<section></section>');
  expect(await page.$eval('foo=whatever', e => e.nodeName)).toBe('SECTION');
  await page.close();
});

it('should work in main and isolated world', async ({ playwright, browser }) => {
  const page = await browser.newPage();
  const createDummySelector = () => ({
    query(root, selector) {
      return window['__answer'];
    },
    queryAll(root, selector) {
      return window['__answer'] ? [window['__answer'], document.body, document.documentElement] : [];
    }
  });
  await playwright.selectors.register('main', createDummySelector);
  await playwright.selectors.register('isolated', createDummySelector, { contentScript: true });
  await page.setContent('<div><span><section></section></span></div>');
  await page.evaluate(() => window['__answer'] = document.querySelector('span'));
  // Works in main if asked.
  expect(await page.$eval('main=ignored', e => e.nodeName)).toBe('SPAN');
  expect(await page.$eval('css=div >> main=ignored', e => e.nodeName)).toBe('SPAN');
  expect(await page.$$eval('main=ignored', es => window['__answer'] !== undefined)).toBe(true);
  expect(await page.$$eval('main=ignored', es => es.filter(e => e).length)).toBe(3);
  // Works in isolated by default.
  expect(await page.$('isolated=ignored')).toBe(null);
  expect(await page.$('css=div >> isolated=ignored')).toBe(null);
  // $$eval always works in main, to avoid adopting nodes one by one.
  expect(await page.$$eval('isolated=ignored', es => window['__answer'] !== undefined)).toBe(true);
  expect(await page.$$eval('isolated=ignored', es => es.filter(e => e).length)).toBe(3);
  // At least one engine in main forces all to be in main.
  expect(await page.$eval('main=ignored >> isolated=ignored', e => e.nodeName)).toBe('SPAN');
  expect(await page.$eval('isolated=ignored >> main=ignored', e => e.nodeName)).toBe('SPAN');
  // Can be chained to css.
  expect(await page.$eval('main=ignored >> css=section', e => e.nodeName)).toBe('SECTION');
  await page.close();
});

it('should handle errors', async ({ playwright, browser }) => {
  const page = await browser.newPage();
  let error = await page.$('neverregister=ignored').catch(e => e);
  expect(error.message).toContain('Unknown engine "neverregister" while parsing selector neverregister=ignored');

  const createDummySelector = () => ({
    query(root, selector) {
      return root.querySelector('dummy');
    },
    queryAll(root, selector) {
      return Array.from(root.querySelectorAll('dummy'));
    }
  });

  error = await playwright.selectors.register('$', createDummySelector).catch(e => e);
  expect(error.message).toBe('selectors.register: Selector engine name may only contain [a-zA-Z0-9_] characters');

  // Selector names are case-sensitive.
  await playwright.selectors.register('dummy', createDummySelector);
  await playwright.selectors.register('duMMy', createDummySelector);

  error = await playwright.selectors.register('dummy', createDummySelector).catch(e => e);
  expect(error.message).toBe('selectors.register: "dummy" selector engine has been already registered');

  error = await playwright.selectors.register('css', createDummySelector).catch(e => e);
  expect(error.message).toBe('selectors.register: "css" is a predefined selector engine');
  await page.close();
});

it('should not rely on engines working from the root', async ({ playwright, browser }) => {
  const page = await browser.newPage();
  const createValueEngine = () => ({
    query(root, selector) {
      return root && root.value.includes(selector) ? root : undefined;
    },
    queryAll(root, selector) {
      return root && root.value.includes(selector) ? [root] : [];
    },
  });

  await playwright.selectors.register('__value', createValueEngine);
  await page.setContent(`<input id=input1 value=value1><input id=input2 value=value2>`);
  expect(await page.$eval('input >> __value=value2', e => e.id)).toBe('input2');
  await page.close();
});

it('should throw a nice error if the selector returns a bad value', async ({ playwright, browser }) => {
  const page = await browser.newPage();
  const createFakeEngine = () => ({
    query(root, selector) {
      return [document.body];
    },
    queryAll(root, selector) {
      return [[document.body]];
    },
  });

  await playwright.selectors.register('__fake', createFakeEngine);
  const error = await page.$('__fake=value2').catch(e => e);
  expect(error.message).toContain('Expected a Node but got [object Array]');
  await page.close();
});
