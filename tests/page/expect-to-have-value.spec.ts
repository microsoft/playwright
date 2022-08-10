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

import { stripAnsi } from '../config/utils';
import { test, expect } from './pageTest';

test('should work', async ({ page }) => {
  await page.setContent('<input id=node></input>');
  const locator = page.locator('#node');
  await locator.fill('Text content');
  await expect(locator).toHaveValue('Text content');
});

test('should work with label', async ({ page }) => {
  await page.setContent('<label><input></input></label>');
  await page.locator('label input').fill('Text content');
  await expect(page.locator('label')).toHaveValue('Text content');
});

test('should work with regex', async ({ page }) => {
  await page.setContent('<input id=node></input>');
  const locator = page.locator('#node');
  await locator.fill('Text content');
  await expect(locator).toHaveValue(/Text/);
});

test('should support failure', async ({ page }) => {
  await page.setContent('<input id=node></input>');
  const locator = page.locator('#node');
  await locator.fill('Text content');
  const error = await expect(locator).toHaveValue(/Text2/, { timeout: 1000 }).catch(e => e);
  expect(stripAnsi(error.message)).toContain('"Text content"');
});

test.describe('toHaveValues with multi-select', () => {
  test('works with text', async ({ page }) => {
    await page.setContent(`
      <select multiple>
        <option value="R">Red</option>
        <option value="G">Green</option>
        <option value="B">Blue</option>
      </select>
    `);
    const locator = page.locator('select');
    await locator.selectOption(['R', 'G']);
    await expect(locator).toHaveValues(['R', 'G']);
  });

  test('follows labels', async ({ page }) => {
    await page.setContent(`
      <label for="colors">Pick a Color</label>
      <select id="colors" multiple>
        <option value="R">Red</option>
        <option value="G">Green</option>
        <option value="B">Blue</option>
      </select>
    `);
    const locator = page.locator('text=Pick a Color');
    await locator.selectOption(['R', 'G']);
    await expect(locator).toHaveValues(['R', 'G']);
  });

  test('exact match with text failure', async ({ page }) => {
    await page.setContent(`
      <select multiple>
        <option value="RR">Red</option>
        <option value="GG">Green</option>
      </select>
    `);
    const locator = page.locator('select');
    await locator.selectOption(['RR', 'GG']);
    const error = await expect(locator).toHaveValues(['R', 'G'], { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(error.message)).toContain('-   "R"');
    expect(stripAnsi(error.message)).toContain('+   "RR"');
  });

  test('works with regex', async ({ page }) => {
    await page.setContent(`
      <select multiple>
        <option value="R">Red</option>
        <option value="G">Green</option>
        <option value="B">Blue</option>
      </select>
    `);
    const locator = page.locator('select');
    await locator.selectOption(['R', 'G']);
    await expect(locator).toHaveValues([/R/, /G/]);
  });

  test('fails when items not selected', async ({ page }) => {
    await page.setContent(`
      <select multiple>
        <option value="R">Red</option>
        <option value="G">Green</option>
        <option value="B">Blue</option>
      </select>
    `);
    const locator = page.locator('select');
    await locator.selectOption(['B']);
    const error = await expect(locator).toHaveValues([/R/, /G/], { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(error.message)).toContain('+   "B"');
  });

  test('fails when multiple not specified', async ({ page }) => {
    await page.setContent(`
      <select>
        <option value="R">Red</option>
        <option value="G">Green</option>
        <option value="B">Blue</option>
      </select>
    `);
    const locator = page.locator('select');
    await locator.selectOption(['B']);
    const error = await expect(locator).toHaveValues([/R/, /G/], { timeout: 1000 }).catch(e => e);
    expect(error.message).toContain('Not a select element with a multiple attribute');
  });

  test('fails when not a select element', async ({ page }) => {
    await page.setContent(`
      <input value="foo" />
    `);
    const locator = page.locator('input');
    const error = await expect(locator).toHaveValues([/R/, /G/], { timeout: 1000 }).catch(e => e);
    expect(error.message).toContain('Not a select element with a multiple attribute');
  });
});
