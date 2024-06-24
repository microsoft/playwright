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

it('should fire', async ({ page, server }) => {
  page.on('dialog', dialog => {
    expect(dialog.type()).toBe('alert');
    expect(dialog.defaultValue()).toBe('');
    expect(dialog.message()).toBe('yo');
    void dialog.accept();
  });
  await page.evaluate(() => alert('yo'));
});

it('should allow accepting prompts @smoke', async ({ page, isElectron }) => {
  it.skip(isElectron, 'prompt() is not a thing in electron');

  page.on('dialog', dialog => {
    expect(dialog.type()).toBe('prompt');
    expect(dialog.defaultValue()).toBe('yes.');
    expect(dialog.message()).toBe('question?');
    void dialog.accept('answer!');
  });
  const result = await page.evaluate(() => prompt('question?', 'yes.'));
  expect(result).toBe('answer!');
});

it('should dismiss the prompt', async ({ page, isElectron }) => {
  it.skip(isElectron, 'prompt() is not a thing in electron');

  page.on('dialog', dialog => dialog.dismiss());
  const result = await page.evaluate(() => prompt('question?'));
  expect(result).toBe(null);
});

it('should accept the confirm prompt', async ({ page }) => {
  page.on('dialog', dialog => {
    void dialog.accept();
  });
  const result = await page.evaluate(() => confirm('boolean?'));
  expect(result).toBe(true);
});

it('should dismiss the confirm prompt', async ({ page }) => {
  page.on('dialog', dialog => {
    void dialog.dismiss();
  });
  const result = await page.evaluate(() => confirm('boolean?'));
  expect(result).toBe(false);
});

it('should be able to close context with open alert', async ({ page }) => {
  const alertPromise = page.waitForEvent('dialog');
  await page.evaluate(() => {
    window.builtinSetTimeout(() => alert('hello'), 0);
  });
  await alertPromise;
});

it('should handle multiple alerts', async ({ page }) => {
  page.on('dialog', dialog => {
    void dialog.accept().catch(e => {});
  });
  await page.setContent(`
    <p>Hello World</p>
    <script>
      alert('Please dismiss this dialog');
      alert('Please dismiss this dialog');
      alert('Please dismiss this dialog');
    </script>
  `);
  expect(await page.textContent('p')).toBe('Hello World');
});

it('should handle multiple confirms', async ({ page }) => {
  page.on('dialog', dialog => {
    void dialog.accept().catch(e => {});
  });
  await page.setContent(`
    <p>Hello World</p>
    <script>
      confirm('Please confirm me?');
      confirm('Please confirm me?');
      confirm('Please confirm me?');
    </script>
  `);
  expect(await page.textContent('p')).toBe('Hello World');
});

it('should auto-dismiss the prompt without listeners', async ({ page, isElectron }) => {
  it.skip(isElectron, 'prompt() is not a thing in electron');

  const result = await page.evaluate(() => prompt('question?'));
  expect(result).toBe(null);
});

it('should auto-dismiss the alert without listeners', async ({ page }) => {
  await page.setContent(`<div onclick="window.alert(123); window._clicked=true">Click me</div>`);
  await page.click('div');
  expect(await page.evaluate('window._clicked')).toBe(true);
});
