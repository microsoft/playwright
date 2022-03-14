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

it('should work @smoke', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  const button = await page.$('button');
  await button.click();
  expect(await page.evaluate(() => window['result'])).toBe('Clicked');
});

it('should work with Node removed', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.evaluate(() => delete window['Node']);
  const button = await page.$('button');
  await button.click();
  expect(await page.evaluate(() => window['result'])).toBe('Clicked');
});

it('should work for Shadow DOM v1', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/shadow.html');
  const buttonHandle = await page.evaluateHandle(() => window['button'] as HTMLButtonElement);
  await buttonHandle.click();
  expect(await page.evaluate('clicked')).toBe(true);
});

it('should work for TextNodes', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  const buttonTextNode = await page.evaluateHandle(() => document.querySelector('button').firstChild);
  await buttonTextNode.click();
  expect(await page.evaluate(() => window['result'])).toBe('Clicked');
});

it('should throw for detached nodes', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  const button = await page.$('button');
  await page.evaluate(button => button.remove(), button);
  let error = null;
  await button.click().catch(err => error = err);
  expect(error.message).toContain('Element is not attached to the DOM');
});

it('should throw for hidden nodes with force', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  const button = await page.$('button');
  await page.evaluate(button => button.style.display = 'none', button);
  const error = await button.click({ force: true }).catch(err => err);
  expect(error.message).toContain('Element is not visible');
});

it('should throw for recursively hidden nodes with force', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  const button = await page.$('button');
  await page.evaluate(button => button.parentElement.style.display = 'none', button);
  const error = await button.click({ force: true }).catch(err => err);
  expect(error.message).toContain('Element is not visible');
});

it('should throw for <br> elements with force', async ({ page, server }) => {
  await page.setContent('hello<br>goodbye');
  const br = await page.$('br');
  const error = await br.click({ force: true }).catch(err => err);
  expect(error.message).toContain('Element is outside of the viewport');
});

it('should double click the button', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.evaluate(() => {
    window['double'] = false;
    const button = document.querySelector('button');
    button.addEventListener('dblclick', event => {
      window['double'] = true;
    });
  });
  const button = await page.$('button');
  await button.dblclick();
  expect(await page.evaluate('double')).toBe(true);
  expect(await page.evaluate('result')).toBe('Clicked');
});
