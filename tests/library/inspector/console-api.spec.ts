/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test as it, expect } from './inspectorTest';

it.skip(({ mode }) => mode !== 'default');

let scriptPromise: Promise<void>;

it.beforeEach(async ({ page, recorderPageGetter }) => {
  scriptPromise = (async () => {
    await page.pause();
  })();
  await recorderPageGetter();
});

it.afterEach(async ({ recorderPageGetter }) => {
  const recorderPage = await recorderPageGetter();
  recorderPage.click('[title="Resume (F8)"]').catch(() => {});
  await scriptPromise;
  recorderPage.click('[title="Resume (F8)"]').catch(() => {});
});

it('should support playwright.$, playwright.$$', async ({ page }) => {
  const body = await page.evaluateHandle('playwright.$("body")');
  expect(await body.evaluate<string, HTMLBodyElement>((node: HTMLBodyElement) => node.nodeName)).toBe('BODY');
  const length = await page.evaluate('playwright.$$("body").length');
  expect(length).toBe(1);
});

it('should support playwright.selector', async ({ page }) => {
  const length = await page.evaluate('playwright.selector(document.body)');
  expect(length).toBe('body');
});

it('should support playwright.locator.value', async ({ page }) => {
  await page.setContent('<div>Hello<div>');
  const handle = await page.evaluateHandle(`playwright.locator('div', { hasText: 'Hello' }).element`);
  expect(await handle.evaluate<string, HTMLDivElement>((node: HTMLDivElement) => node.nodeName)).toBe('DIV');
});

it('should support playwright.locator.values', async ({ page }) => {
  await page.setContent('<div>Hello<div>Bar</div></div>');
  expect(await page.evaluate(`playwright.locator('div', { hasText: 'Hello' }).elements.length`)).toBe(1);
  expect(await page.evaluate(`playwright.locator('div', { hasText: 'HElLo' }).elements.length`)).toBe(1);
  expect(await page.evaluate(`playwright.locator('div', { hasText: /ELL/ }).elements.length`)).toBe(0);
  expect(await page.evaluate(`playwright.locator('div', { hasText: /ELL/i }).elements.length`)).toBe(1);
  expect(await page.evaluate(`playwright.locator('div', { hasText: /Hello/ }).elements.length`)).toBe(1);
  expect(await page.evaluate(`playwright.locator('div', { hasNotText: /Bar/ }).elements.length`)).toBe(0);
  expect(await page.evaluate(`playwright.locator('div', { hasNotText: /Hello/ }).elements.length`)).toBe(1);
});

it('should support playwright.locator({ has })', async ({ page }) => {
  await page.setContent(`
    <div>Hi</div>
    <div><span>Hello</span></div>
    <div><span>dont match</span></div>
  `);
  expect(await page.evaluate(`playwright.locator('div', { has: playwright.locator('span') }).element.innerHTML`)).toContain('Hello');
  expect(await page.evaluate(`playwright.locator('div', { has: playwright.locator('text=Hello') }).element.innerHTML`)).toContain('span');
  expect(await page.evaluate(`playwright.locator('div', { has: playwright.locator('span', { hasText: 'Hello' }) }).elements.length`)).toBe(1);
});

it('should support playwright.locator({ hasNot })', async ({ page }) => {
  await page.setContent('<div>Hi</div><div><span>Hello</span></div>');
  expect(await page.evaluate(`playwright.locator('div', { hasNot: playwright.locator('span') }).element.innerHTML`)).toContain('Hi');
  expect(await page.evaluate(`playwright.locator('div', { hasNot: playwright.locator('text=Hello') }).element.innerHTML`)).toContain('Hi');
});

it('should support locator.and()', async ({ page }) => {
  await page.setContent('<div data-testid=Hey>Hi</div>');
  expect(await page.evaluate(`playwright.locator('div').and(playwright.getByTestId('Hey')).elements.map(e => e.innerHTML)`)).toEqual(['Hi']);
});

it('should support locator.or()', async ({ page }) => {
  await page.setContent('<div>Hi</div><span>Hello</span>');
  expect(await page.evaluate(`playwright.locator('div').or(playwright.locator('span')).elements.map(e => e.innerHTML)`)).toEqual(['Hi', 'Hello']);
});

it('should support playwright.getBy*', async ({ page }) => {
  await page.setContent('<span>Hello</span><span title="world">World</span>');
  expect(await page.evaluate(`playwright.getByText('hello').element.innerHTML`)).toContain('Hello');
  expect(await page.evaluate(`playwright.getByTitle('world').element.innerHTML`)).toContain('World');
  expect(await page.evaluate(`playwright.locator('span').filter({ hasText: 'hello' }).element.innerHTML`)).toContain('Hello');
  expect(await page.evaluate(`playwright.locator('span').first().element.innerHTML`)).toContain('Hello');
  expect(await page.evaluate(`playwright.locator('span').last().element.innerHTML`)).toContain('World');
  expect(await page.evaluate(`playwright.locator('span').nth(1).element.innerHTML`)).toContain('World');
});

it('expected properties on playwright object', async ({ page }) => {
  expect(await page.evaluate(`Object.keys(playwright)`)).toEqual([
    '$',
    '$$',
    'inspect',
    'selector',
    'generateLocator',
    'resume',
    'locator',
    'getByTestId',
    'getByAltText',
    'getByLabel',
    'getByPlaceholder',
    'getByText',
    'getByTitle',
    'getByRole',
  ]);
});
