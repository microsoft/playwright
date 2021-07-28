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

import { test, expect, stripAscii } from './playwright-test-fixtures';

test('should support toHaveLength', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass', async ({ page }) => {
        await page.setContent('<select><option>One</option><option>Two</option></select>');
        const locator = page.locator('option');
        await expect(locator).toHaveLength(2);
        await expect([1, 2]).toHaveLength(2);
      });
      `,
  }, { workers: 1 });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should support toHaveProp', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass', async ({ page }) => {
        await page.setContent('<div></div>');
        await page.$eval('div', e => e.foo = { a: 1, b: 'string', c: new Date(1627503992000) });
        const locator = page.locator('div');
        await expect(locator).toHaveProp('foo', { a: 1, b: 'string', c: new Date(1627503992000) });
      });

      test('fail', async ({ page }) => {
        await page.setContent('<div></div>');
        await page.$eval('div', e => e.foo = { a: 1, b: 'string', c: new Date(1627503992000) });
        const locator = page.locator('div');
        await expect(locator).toHaveProp('foo', { a: 1, b: 'string', c: new Date(1627503992001) }, { timeout: 1000 });
      });
      `,
  }, { workers: 1 });
  const output = stripAscii(result.output);
  expect(output).toContain('-   "c"');
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.exitCode).toBe(1);
});

test('should support toHaveClass', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass', async ({ page }) => {
        await page.setContent('<div class="foo bar baz"></div>');
        const locator = page.locator('div');
        await expect(locator).toHaveClass('foo');
      });

      test('fail', async ({ page }) => {
        await page.setContent('<div class="bar baz"></div>');
        const locator = page.locator('div');
        await expect(locator).toHaveClass('foo', { timeout: 1000 });
      });
      `,
  }, { workers: 1 });
  const output = stripAscii(result.output);
  expect(output).toContain('expect(locator).toHaveClass');
  expect(output).toContain('Expected substring: \"foo\"');
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.exitCode).toBe(1);
});
