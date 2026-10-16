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

it('ES-027 should work with css selector', async ({ page, server }) => {
  await page.setContent('<div>hello</div><div>beautiful</div><div>world!</div>');
  const divsCount = await page.$$eval('css=div', divs => divs.length);
  expect(divsCount).toBe(3);
});

it('ES-028 should work with text selector', async ({ page, server }) => {
  await page.setContent('<div>hello</div><div>beautiful</div><div>beautiful</div><div>world!</div>');
  const divsCount = await page.$$eval('text="beautiful"', divs => divs.length);
  expect(divsCount).toBe(2);
});

it('ES-029 should work with xpath selector', async ({ page, server }) => {
  await page.setContent('<div>hello</div><div>beautiful</div><div>world!</div>');
  const divsCount = await page.$$eval('xpath=/html/body/div', divs => divs.length);
  expect(divsCount).toBe(3);
});

it('ES-030 should auto-detect css selector', async ({ page, server }) => {
  await page.setContent('<div>hello</div><div>beautiful</div><div>world!</div>');
  const divsCount = await page.$$eval('div', divs => divs.length);
  expect(divsCount).toBe(3);
});

it('ES-031 should support >> syntax', async ({ page, server }) => {
  await page.setContent('<div><span>hello</span></div><div>beautiful</div><div><span>wo</span><span>rld!</span></div><span>Not this one</span>');
  const spansCount = await page.$$eval('css=div >> css=span', spans => spans.length);
  expect(spansCount).toBe(3);
});

it('ES-032 should support * capture', async ({ page, server }) => {
  await page.setContent('<section><div><span>a</span></div></section><section><div><span>b</span></div></section>');
  expect(await page.$$eval('*css=div >> "b"', els => els.length)).toBe(1);
  expect(await page.$$eval('section >> *css=div >> "b"', els => els.length)).toBe(1);
  expect(await page.$$eval('section >> *', els => els.length)).toBe(4);

  await page.setContent('<section><div><span>a</span><span>a</span></div></section>');
  expect(await page.$$eval('*css=div >> "a"', els => els.length)).toBe(1);
  expect(await page.$$eval('section >> *css=div >> "a"', els => els.length)).toBe(1);

  await page.setContent('<div><span>a</span></div><div><span>a</span></div><section><div><span>a</span></div></section>');
  expect(await page.$$eval('*css=div >> "a"', els => els.length)).toBe(3);
  expect(await page.$$eval('section >> *css=div >> "a"', els => els.length)).toBe(1);
});

it('ES-033 should support * capture when multiple paths match', async ({ page, server }) => {
  await page.setContent('<div><div><span></span></div></div><div></div>');
  expect(await page.$$eval('*css=div >> span', els => els.length)).toBe(2);
  await page.setContent('<div><div><span></span></div><span></span><span></span></div><div></div>');
  expect(await page.$$eval('*css=div >> span', els => els.length)).toBe(2);
});

it('ES-034 should return complex values', async ({ page, server }) => {
  await page.setContent('<div>hello</div><div>beautiful</div><div>world!</div>');
  const texts = await page.$$eval('css=div', divs => divs.map(div => div.textContent));
  expect(texts).toEqual(['hello', 'beautiful', 'world!']);
});

it('ES-035 should work with bogus Array.from', async ({ page, server }) => {
  await page.setContent('<div>hello</div><div>beautiful</div><div>world!</div>');
  await page.evaluate(() => {
    Array.from = () => [];
  });
  const divsCount = await page.$$eval('css=div', divs => divs.length);
  expect(divsCount).toBe(3);
});
