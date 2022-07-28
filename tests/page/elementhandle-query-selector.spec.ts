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

it('should query existing element', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/playground.html');
  await page.setContent('<html><body><div class="second"><div class="inner">A</div></div></body></html>');
  const html = await page.$('html');
  const second = await html.$('.second');
  const inner = await second.$('.inner');
  const content = await page.evaluate(e => e.textContent, inner);
  expect(content).toBe('A');
});

it('should return null for non-existing element', async ({ page, server }) => {
  await page.setContent('<html><body><div class="second"><div class="inner">B</div></div></body></html>');
  const html = await page.$('html');
  const second = await html.$('.third');
  expect(second).toBe(null);
});

it('should work for adopted elements', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(url => window['__popup'] = window.open(url), server.EMPTY_PAGE),
  ]);
  const divHandle = await page.evaluateHandle(() => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const span = document.createElement('span');
    span.textContent = 'hello';
    div.appendChild(span);
    return div;
  });
  expect(await divHandle.$('span')).toBeTruthy();
  expect(await divHandle.$eval('span', e => e.textContent)).toBe('hello');

  await popup.waitForLoadState('domcontentloaded');
  await page.evaluate(() => {
    const div = document.querySelector('div');
    window['__popup'].document.body.appendChild(div);
  });
  expect(await divHandle.$('span')).toBeTruthy();
  expect(await divHandle.$eval('span', e => e.textContent)).toBe('hello');
});

it('should query existing elements', async ({ page, server }) => {
  await page.setContent('<html><body><div>A</div><br/><div>B</div></body></html>');
  const html = await page.$('html');
  const elements = await html.$$('div');
  expect(elements.length).toBe(2);
  const promises = elements.map(element => page.evaluate(e => e.textContent, element));
  expect(await Promise.all(promises)).toEqual(['A', 'B']);
});

it('should return empty array for non-existing elements', async ({ page, server }) => {
  await page.setContent('<html><body><span>A</span><br/><span>B</span></body></html>');
  const html = await page.$('html');
  const elements = await html.$$('div');
  expect(elements.length).toBe(0);
});


it('xpath should query existing element', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/playground.html');
  await page.setContent('<html><body><div class="second"><div class="inner">A</div></div></body></html>');
  const html = await page.$('html');
  const second = await html.$$(`xpath=./body/div[contains(@class, 'second')]`);
  const inner = await second[0].$$(`xpath=./div[contains(@class, 'inner')]`);
  const content = await page.evaluate(e => e.textContent, inner[0]);
  expect(content).toBe('A');
});

it('xpath should return null for non-existing element', async ({ page, server }) => {
  await page.setContent('<html><body><div class="second"><div class="inner">B</div></div></body></html>');
  const html = await page.$('html');
  const second = await html.$$(`xpath=/div[contains(@class, 'third')]`);
  expect(second).toEqual([]);
});
