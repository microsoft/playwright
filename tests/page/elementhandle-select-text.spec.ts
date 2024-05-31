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

it('should select textarea', async ({ page, server, browserName }) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  const textarea = await page.$('textarea');
  await textarea.evaluate(textarea => textarea.value = 'some value');
  await textarea.selectText();
  if (browserName === 'firefox' || browserName === 'webkit') {
    expect(await textarea.evaluate(el => el.selectionStart)).toBe(0);
    expect(await textarea.evaluate(el => el.selectionEnd)).toBe(10);
  } else {
    expect(await page.evaluate(() => window.getSelection().toString())).toBe('some value');
  }
});

it('should select input', async ({ page, server, browserName }) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  const input = await page.$('input');
  await input.evaluate(input => input.value = 'some value');
  await input.selectText();
  if (browserName === 'firefox' || browserName === 'webkit') {
    expect(await input.evaluate(el => el.selectionStart)).toBe(0);
    expect(await input.evaluate(el => el.selectionEnd)).toBe(10);
  } else {
    expect(await page.evaluate(() => window.getSelection().toString())).toBe('some value');
  }
});

it('should select plain div', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  const div = await page.$('div.plain');
  await div.selectText();
  expect(await page.evaluate(() => window.getSelection().toString())).toBe('Plain div');
});

it('should timeout waiting for invisible element', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  const textarea = await page.$('textarea');
  await textarea.evaluate(e => e.style.display = 'none');
  const error = await textarea.selectText({ timeout: 3000 }).catch(e => e);
  expect(error.message).toContain('element is not visible');
});

it('should wait for visible', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  const textarea = await page.$('textarea');
  await textarea.evaluate(textarea => textarea.value = 'some value');
  await textarea.evaluate(e => e.style.display = 'none');
  let done = false;
  const promise = textarea.selectText({ timeout: 3000 }).then(() => done = true);
  await page.waitForTimeout(1000);
  expect(done).toBe(false);
  await textarea.evaluate(e => e.style.display = 'block');
  await promise;
});
