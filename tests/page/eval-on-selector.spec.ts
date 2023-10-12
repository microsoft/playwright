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

it('should work with css selector', async ({ page, server }) => {
  await page.setContent('<section id="testAttribute">43543</section>');
  const idAttribute = await page.$eval('css=section', e => e.id);
  expect(idAttribute).toBe('testAttribute');
});

it('should work with id selector', async ({ page, server }) => {
  await page.setContent('<section id="testAttribute">43543</section>');
  const idAttribute = await page.$eval('id=testAttribute', e => e.id);
  expect(idAttribute).toBe('testAttribute');
});

it('should work with data-test selector', async ({ page, server }) => {
  await page.setContent('<section data-test=foo id="testAttribute">43543</section>');
  const idAttribute = await page.$eval('data-test=foo', e => e.id);
  expect(idAttribute).toBe('testAttribute');
});

it('should work with data-testid selector', async ({ page, server }) => {
  await page.setContent('<section data-testid=foo id="testAttribute">43543</section>');
  const idAttribute = await page.$eval('data-testid=foo', e => e.id);
  expect(idAttribute).toBe('testAttribute');
});

it('should work with data-test-id selector', async ({ page, server }) => {
  await page.setContent('<section data-test-id=foo id="testAttribute">43543</section>');
  const idAttribute = await page.$eval('data-test-id=foo', e => e.id);
  expect(idAttribute).toBe('testAttribute');
});

it('should work with text selector in quotes', async ({ page, server }) => {
  await page.setContent('<section id="testAttribute">43543</section>');
  const idAttribute = await page.$eval('text="43543"', e => e.id);
  expect(idAttribute).toBe('testAttribute');
});

it('should work with xpath selector', async ({ page, server }) => {
  await page.setContent('<section id="testAttribute">43543</section>');
  const idAttribute = await page.$eval('xpath=/html/body/section', e => e.id);
  expect(idAttribute).toBe('testAttribute');
});

it('should work with text selector', async ({ page, server }) => {
  await page.setContent('<section id="testAttribute">43543</section>');
  const idAttribute = await page.$eval('text=43543', e => e.id);
  expect(idAttribute).toBe('testAttribute');
});

it('should auto-detect css selector', async ({ page, server }) => {
  await page.setContent('<section id="testAttribute">43543</section>');
  const idAttribute = await page.$eval('section', e => e.id);
  expect(idAttribute).toBe('testAttribute');
});

it('should auto-detect css selector with attributes', async ({ page, server }) => {
  await page.setContent('<section id="testAttribute">43543</section>');
  const idAttribute = await page.$eval('section[id="testAttribute"]', e => e.id);
  expect(idAttribute).toBe('testAttribute');
});

it('should auto-detect nested selectors', async ({ page, server }) => {
  await page.setContent('<div foo=bar><section>43543<span>Hello<div id=target></div></span></section></div>');
  const idAttribute = await page.$eval('div[foo=bar] > section >> "Hello" >> div', e => e.id);
  expect(idAttribute).toBe('target');
});

it('should accept arguments', async ({ page, server }) => {
  await page.setContent('<section>hello</section>');
  const text = await page.$eval('section', (e, suffix) => e.textContent + suffix, ' world!');
  expect(text).toBe('hello world!');
});

it('should accept ElementHandles as arguments', async ({ page, server }) => {
  await page.setContent('<section>hello</section><div> world</div>');
  const divHandle = await page.$('div');
  const text = await page.$eval('section', (e, div) => e.textContent + div.textContent, divHandle);
  expect(text).toBe('hello world');
});

it('should throw error if no element is found', async ({ page, server }) => {
  let error = null;
  await page.$eval('section', e => e.id).catch(e => error = e);
  expect(error.message).toContain('Failed to find element matching selector "section"');
});

it('should support >> syntax', async ({ page, server }) => {
  await page.setContent('<section><div>hello</div></section>');
  const text = await page.$eval('css=section >> css=div', (e, suffix) => e.textContent + suffix, ' world!');
  expect(text).toBe('hello world!');
});

it('should support >> syntax with different engines', async ({ page, server }) => {
  await page.setContent('<section><div><span>hello</span></div></section>');
  const text = await page.$eval('xpath=/html/body/section >> css=div >> text="hello"', (e, suffix) => e.textContent + suffix, ' world!');
  expect(text).toBe('hello world!');
});

it('should support spaces with >> syntax', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/deep-shadow.html');
  const text = await page.$eval(' css = div >>css=div>>css   = span  ', e => e.textContent);
  expect(text).toBe('Hello from root2');
});

it('should not stop at first failure with >> syntax', async ({ page, server }) => {
  await page.setContent('<div><span>Next</span><button>Previous</button><button>Next</button></div>');
  const html = await page.$eval('button >> "Next"', e => e.outerHTML);
  expect(html).toBe('<button>Next</button>');
});

it('should support * capture', async ({ page, server }) => {
  await page.setContent('<section><div><span>a</span></div></section><section><div><span>b</span></div></section>');
  expect(await page.$eval('*css=div >> "b"', e => e.outerHTML)).toBe('<div><span>b</span></div>');
  expect(await page.$eval('section >> *css=div >> "b"', e => e.outerHTML)).toBe('<div><span>b</span></div>');
  expect(await page.$eval('css=div >> *text="b"', e => e.outerHTML)).toBe('<span>b</span>');
  expect(await page.$('*')).toBeTruthy();
});

it('should throw on multiple * captures', async ({ page, server }) => {
  const error = await page.$eval('*css=div >> *css=span', e => e.outerHTML).catch(e => e);
  expect(error.message).toContain('Only one of the selectors can capture using * modifier');
});

it('should throw on malformed * capture', async ({ page, server }) => {
  const error = await page.$eval('*=div', e => e.outerHTML).catch(e => e);
  expect(error.message).toContain('Unknown engine "" while parsing selector *=div');
});

it('should work with spaces in css attributes', async ({ page, server }) => {
  await page.setContent('<div><input placeholder="Select date"></div>');
  expect(await page.waitForSelector(`[placeholder="Select date"]`)).toBeTruthy();
  expect(await page.waitForSelector(`[placeholder='Select date']`)).toBeTruthy();
  expect(await page.waitForSelector(`input[placeholder="Select date"]`)).toBeTruthy();
  expect(await page.waitForSelector(`input[placeholder='Select date']`)).toBeTruthy();
  expect(await page.$(`[placeholder="Select date"]`)).toBeTruthy();
  expect(await page.$(`[placeholder='Select date']`)).toBeTruthy();
  expect(await page.$(`input[placeholder="Select date"]`)).toBeTruthy();
  expect(await page.$(`input[placeholder='Select date']`)).toBeTruthy();
  expect(await page.$eval(`[placeholder="Select date"]`, e => e.outerHTML)).toBe('<input placeholder="Select date">');
  expect(await page.$eval(`[placeholder='Select date']`, e => e.outerHTML)).toBe('<input placeholder="Select date">');
  expect(await page.$eval(`input[placeholder="Select date"]`, e => e.outerHTML)).toBe('<input placeholder="Select date">');
  expect(await page.$eval(`input[placeholder='Select date']`, e => e.outerHTML)).toBe('<input placeholder="Select date">');
  expect(await page.$eval(`css=[placeholder="Select date"]`, e => e.outerHTML)).toBe('<input placeholder="Select date">');
  expect(await page.$eval(`css=[placeholder='Select date']`, e => e.outerHTML)).toBe('<input placeholder="Select date">');
  expect(await page.$eval(`css=input[placeholder="Select date"]`, e => e.outerHTML)).toBe('<input placeholder="Select date">');
  expect(await page.$eval(`css=input[placeholder='Select date']`, e => e.outerHTML)).toBe('<input placeholder="Select date">');
  expect(await page.$eval(`div >> [placeholder="Select date"]`, e => e.outerHTML)).toBe('<input placeholder="Select date">');
  expect(await page.$eval(`div >> [placeholder='Select date']`, e => e.outerHTML)).toBe('<input placeholder="Select date">');
});

it('should work with quotes in css attributes', async ({ page, server }) => {
  await page.setContent('<div><input placeholder="Select&quot;date"></div>');
  expect(await page.$(`[placeholder="Select\\"date"]`)).toBeTruthy();
  expect(await page.$(`[placeholder='Select"date']`)).toBeTruthy();
  await page.setContent('<div><input placeholder="Select &quot; date"></div>');
  expect(await page.$(`[placeholder="Select \\" date"]`)).toBeTruthy();
  expect(await page.$(`[placeholder='Select " date']`)).toBeTruthy();
  await page.setContent('<div><input placeholder="Select&apos;date"></div>');
  expect(await page.$(`[placeholder="Select'date"]`)).toBeTruthy();
  expect(await page.$(`[placeholder='Select\\'date']`)).toBeTruthy();
  await page.setContent('<div><input placeholder="Select &apos; date"></div>');
  expect(await page.$(`[placeholder="Select ' date"]`)).toBeTruthy();
  expect(await page.$(`[placeholder='Select \\' date']`)).toBeTruthy();
});

it('should work with spaces in css attributes when missing', async ({ page, server }) => {
  const inputPromise = page.waitForSelector(`[placeholder="Select date"]`);
  expect(await page.$(`[placeholder="Select date"]`)).toBe(null);
  await page.setContent('<div><input placeholder="Select date"></div>');
  await inputPromise;
});

it('should work with quotes in css attributes when missing', async ({ page, server }) => {
  const inputPromise = page.waitForSelector(`[placeholder="Select\\"date"]`);
  expect(await page.$(`[placeholder="Select\\"date"]`)).toBe(null);
  await page.setContent('<div><input placeholder="Select&quot;date"></div>');
  await inputPromise;
});

it('should return complex values', async ({ page, server }) => {
  await page.setContent('<section id="testAttribute">43543</section>');
  const idAttribute = await page.$eval('css=section', e => [{ id: e.id }]);
  expect(idAttribute).toEqual([{ id: 'testAttribute' }]);
});
