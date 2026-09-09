/**
 * Copyright (c) Microsoft Corporation.
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

import { attachFrame } from '../config/utils';
import { test as it, expect } from './pageTest';

it('should evaluate in different worlds', async ({ page }) => {
  await page.evaluate(() => (window as any).marker = 'main');
  await page.evaluate(() => (window as any).marker = 'utility', undefined, { world: 'utility' });
  expect(await page.evaluate(() => (window as any).marker)).toBe('main');
  expect(await page.evaluate(() => (window as any).marker, undefined, { world: 'main' })).toBe('main');
  expect(await page.evaluate(() => (window as any).marker, undefined, { world: 'utility' })).toBe('utility');
});

it('should share the dom between worlds', async ({ page }) => {
  await page.setContent(`
    <div id=parent>
      <div class=child data-value=1>one</div>
      <div class=child data-value=2>two</div>
    </div>
  `);
  await page.evaluate(() => document.querySelector('.child')!.setAttribute('data-from-main', 'yes'));
  await page.evaluate(() => document.querySelector('.child')!.setAttribute('data-from-utility', 'yes'), undefined, { world: 'utility' });
  for (const world of ['main', 'utility'] as const) {
    const attributes = await page.evaluate(() => {
      const child = document.querySelector('.child')!;
      return {
        value: child.getAttribute('data-value'),
        fromMain: child.getAttribute('data-from-main'),
        fromUtility: child.getAttribute('data-from-utility'),
        text: child.textContent,
      };
    }, undefined, { world });
    expect(attributes).toEqual({ value: '1', fromMain: 'yes', fromUtility: 'yes', text: 'one' });
  }
});

it('should evaluate in different worlds in a frame', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const frame = await attachFrame(page, 'frame1', server.EMPTY_PAGE + '?frame');
  await frame.evaluate(() => (window as any).marker = 'main');
  expect(await frame.evaluate(() => (window as any).marker, undefined, { world: 'main' })).toBe('main');
  expect(await frame.evaluate(() => (window as any).marker, undefined, { world: 'utility' })).toBe(undefined);
  // Worlds are per-frame, so the main frame is not affected.
  expect(await page.evaluate(() => (window as any).marker)).toBe(undefined);
  expect(await frame.evaluate(() => location.search, undefined, { world: 'utility' })).toBe('?frame');
});

it('should evaluate locator in different worlds', async ({ page }) => {
  await page.setContent(`
    <div id=parent>
      <div class=child data-value=1>one</div>
      <div class=child data-value=2>two</div>
    </div>
  `);
  await page.evaluate(() => (window as any).marker = 'main');
  const locator = page.locator('.child').first();
  expect(await locator.evaluate(e => (window as any).marker)).toBe('main');
  expect(await locator.evaluate(e => (window as any).marker, undefined, { world: 'utility' })).toBe(undefined);
  // The element is the same in both worlds.
  for (const world of ['main', 'utility'] as const)
    expect(await locator.evaluate(e => e.getAttribute('data-value') + '/' + e.textContent, undefined, { world })).toBe('1/one');
});

it('should evaluate all in different worlds', async ({ page }) => {
  await page.setContent(`
    <div id=parent>
      <div class=child data-value=1>one</div>
      <div class=child data-value=2>two</div>
    </div>
  `);
  await page.evaluate(() => (window as any).marker = 'main');
  const locator = page.locator('.child');
  expect(await locator.evaluateAll(ee => (window as any).marker)).toBe('main');
  expect(await locator.evaluateAll(ee => (window as any).marker, undefined, { world: 'utility' })).toBe(undefined);
  // The elements are the same in both worlds.
  for (const world of ['main', 'utility'] as const)
    expect(await locator.evaluateAll(ee => ee.map(e => e.getAttribute('data-value') + '/' + e.textContent), undefined, { world })).toEqual(['1/one', '2/two']);
});

it('should eval on selector in different worlds', async ({ page }) => {
  await page.setContent(`
    <div id=parent>
      <div class=child data-value=1>one</div>
      <div class=child data-value=2>two</div>
    </div>
  `);
  await page.evaluate(() => (window as any).marker = 'main');
  expect(await page.$eval('.child', e => (window as any).marker)).toBe('main');
  expect(await page.$eval('.child', e => (window as any).marker, undefined, { world: 'utility' })).toBe(undefined);
  expect(await page.$$eval('.child', ee => (window as any).marker)).toBe('main');
  expect(await page.$$eval('.child', ee => (window as any).marker, undefined, { world: 'utility' })).toBe(undefined);
  for (const world of ['main', 'utility'] as const) {
    expect(await page.$eval('.child', e => e.getAttribute('data-value'), undefined, { world })).toBe('1');
    expect(await page.$$eval('.child', ee => ee.map(e => e.textContent), undefined, { world })).toEqual(['one', 'two']);
  }
});

it('should eval on selector inside an element handle in different worlds', async ({ page }) => {
  await page.setContent(`
    <div id=parent>
      <div class=child data-value=1>one</div>
      <div class=child data-value=2>two</div>
    </div>
  `);
  await page.evaluate(() => (window as any).marker = 'main');
  const parent = (await page.$('#parent'))!;
  expect(await parent.$eval('.child', e => (window as any).marker)).toBe('main');
  expect(await parent.$eval('.child', e => (window as any).marker, undefined, { world: 'utility' })).toBe(undefined);
  expect(await parent.$$eval('.child', ee => (window as any).marker)).toBe('main');
  expect(await parent.$$eval('.child', ee => (window as any).marker, undefined, { world: 'utility' })).toBe(undefined);
  for (const world of ['main', 'utility'] as const) {
    expect(await parent.$eval('.child', e => e.getAttribute('data-value'), undefined, { world })).toBe('1');
    expect(await parent.$$eval('.child', ee => ee.map(e => e.textContent), undefined, { world })).toEqual(['one', 'two']);
  }
});

it('should isolate the utility world from main world tampering', async ({ page }) => {
  await page.setContent(`
    <div id=parent>
      <div class=child data-value=1>one</div>
      <div class=child data-value=2>two</div>
    </div>
  `);
  await page.evaluate(() => {
    Element.prototype.getAttribute = () => 'tampered';
  });
  const locator = page.locator('.child').first();
  expect(await locator.evaluate(e => e.getAttribute('data-value'))).toBe('tampered');
  expect(await locator.evaluate(e => e.getAttribute('data-value'), undefined, { world: 'utility' })).toBe('1');
});
