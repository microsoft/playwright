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

it('should throw for non-string selector', async ({ page }) => {
  const error = await page.$(null).catch(e => e);
  expect(error.message).toContain('selector: expected string, got object');
});

it('should query existing element with css selector @smoke', async ({ page, server }) => {
  await page.setContent('<section>test</section>');
  const element = await page.$('css=section');
  expect(element).toBeTruthy();
});

it('should query existing element with text selector', async ({ page, server }) => {
  await page.setContent('<section>test</section>');
  const element = await page.$('text="test"');
  expect(element).toBeTruthy();
});

it('should query existing element with xpath selector', async ({ page, server }) => {
  await page.setContent('<section>test</section>');
  const element = await page.$('xpath=/html/body/section');
  expect(element).toBeTruthy();
});

it('should return null for non-existing element', async ({ page, server }) => {
  const element = await page.$('non-existing-element');
  expect(element).toBe(null);
});

it('should auto-detect xpath selector', async ({ page, server }) => {
  await page.setContent('<section>test</section>');
  const element = await page.$('//html/body/section');
  expect(element).toBeTruthy();
});

it('should auto-detect xpath selector with starting parenthesis', async ({ page, server }) => {
  await page.setContent('<section>test</section>');
  const element = await page.$('(//section)[1]');
  expect(element).toBeTruthy();
});

it('should auto-detect xpath selector starting with ..', async ({ page, server }) => {
  await page.setContent('<div><section>test</section><span></span></div>');
  const span = await page.$('"test" >> ../span');
  expect(await span.evaluate(e => e.nodeName)).toBe('SPAN');
  const div = await page.$('"test" >> ..');
  expect(await div.evaluate(e => e.nodeName)).toBe('DIV');
});

it('should auto-detect text selector', async ({ page, server }) => {
  await page.setContent('<section>test</section>');
  const element = await page.$('"test"');
  expect(element).toBeTruthy();
});

it('should auto-detect css selector', async ({ page, server }) => {
  await page.setContent('<section>test</section>');
  const element = await page.$('section');
  expect(element).toBeTruthy();
});

it('should support >> syntax', async ({ page, server }) => {
  await page.setContent('<section><div>test</div></section>');
  const element = await page.$('css=section >> css=div');
  expect(element).toBeTruthy();
});

it('should query existing elements', async ({ page, server }) => {
  await page.setContent('<div>A</div><br/><div>B</div>');
  const elements = await page.$$('div');
  expect(elements.length).toBe(2);
  const promises = elements.map(element => page.evaluate(e => e.textContent, element));
  expect(await Promise.all(promises)).toEqual(['A', 'B']);
});

it('should return empty array if nothing is found', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const elements = await page.$$('div');
  expect(elements.length).toBe(0);
});

it('xpath should query existing element', async ({ page, server }) => {
  await page.setContent('<section>test</section>');
  const elements = await page.$$('xpath=/html/body/section');
  expect(elements[0]).toBeTruthy();
  expect(elements.length).toBe(1);
});

it('xpath should return empty array for non-existing element', async ({ page, server }) => {
  const element = await page.$$('//html/body/non-existing-element');
  expect(element).toEqual([]);
});

it('xpath should return multiple elements', async ({ page, server }) => {
  await page.setContent('<div></div><div></div>');
  const elements = await page.$$('xpath=/html/body/div');
  expect(elements.length).toBe(2);
});

it('$$ should work with bogus Array.from', async ({ page, server }) => {
  await page.setContent('<div>hello</div><div></div>');
  const div1 = await page.evaluateHandle(() => {
    Array.from = () => [];
    return document.querySelector('div');
  });
  const elements = await page.$$('div');
  expect(elements.length).toBe(2);
  // Check that element handle is functional and belongs to the main world.
  expect(await elements[0].evaluate((div, div1) => div === div1, div1)).toBe(true);
});
