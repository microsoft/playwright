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

import { it, expect } from './fixtures';

it('should fire', async ({page, server}) => {
  page.on('dialog', dialog => {
    expect(dialog.type()).toBe('alert');
    expect(dialog.defaultValue()).toBe('');
    expect(dialog.message()).toBe('yo');
    dialog.accept();
  });
  await page.evaluate(() => alert('yo'));
});

it('should allow accepting prompts', async ({page}) => {
  page.on('dialog', dialog => {
    expect(dialog.type()).toBe('prompt');
    expect(dialog.defaultValue()).toBe('yes.');
    expect(dialog.message()).toBe('question?');
    dialog.accept('answer!');
  });
  const result = await page.evaluate(() => prompt('question?', 'yes.'));
  expect(result).toBe('answer!');
});

it('should dismiss the prompt', async ({page}) => {
  page.on('dialog', dialog => {
    dialog.dismiss();
  });
  const result = await page.evaluate(() => prompt('question?'));
  expect(result).toBe(null);
});

it('should accept the confirm prompt', async ({page}) => {
  page.on('dialog', dialog => {
    dialog.accept();
  });
  const result = await page.evaluate(() => confirm('boolean?'));
  expect(result).toBe(true);
});

it('should dismiss the confirm prompt', async ({page}) => {
  page.on('dialog', dialog => {
    dialog.dismiss();
  });
  const result = await page.evaluate(() => confirm('boolean?'));
  expect(result).toBe(false);
});

it('should be able to close context with open alert', (test, { browserName, platform }) => {
  test.fixme(browserName === 'webkit' && platform === 'darwin');
}, async ({browser}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const alertPromise = page.waitForEvent('dialog');
  await page.evaluate(() => {
    setTimeout(() => alert('hello'), 0);
  });
  await alertPromise;
  await context.close();
});
