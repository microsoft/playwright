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

test('should support toBeChecked', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass', async ({ page }) => {
        await page.setContent('<input type=checkbox checked></input>');
        const locator = page.locator('input');
        await expect(locator).toBeChecked();
      });

      test('pass not', async ({ page }) => {
        await page.setContent('<input type=checkbox></input>');
        const locator = page.locator('input');
        await expect(locator).not.toBeChecked();
      });

      test('fail', async ({ page }) => {
        await page.setContent('<input type=checkbox></input>');
        const locator = page.locator('input');
        await expect(locator).toBeChecked({ timeout: 1000 });
      });
      `,
  }, { workers: 1 });
  const output = stripAscii(result.output);
  expect(output).toContain('Error: expect(received).toBeChecked()');
  expect(output).toContain('expect(locator).toBeChecked');
  expect(result.passed).toBe(2);
  expect(result.failed).toBe(1);
  expect(result.exitCode).toBe(1);
});

test('should support toBeEditable, toBeEnabled, toBeDisabled, toBeEmpty', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('editable', async ({ page }) => {
        await page.setContent('<input></input>');
        const locator = page.locator('input');
        await expect(locator).toBeEditable();
      });

      test('enabled', async ({ page }) => {
        await page.setContent('<button>Text</button>');
        const locator = page.locator('button');
        await expect(locator).toBeEnabled();
      });

      test('disabled', async ({ page }) => {
        await page.setContent('<button disabled>Text</button>');
        const locator = page.locator('button');
        await expect(locator).toBeDisabled();
      });

      test('empty input', async ({ page }) => {
        await page.setContent('<input></input>');
        const locator = page.locator('input');
        await expect(locator).toBeEmpty();
      });

      test('non-empty input', async ({ page }) => {
        await page.setContent('<input value=text></input>');
        const locator = page.locator('input');
        await expect(locator).not.toBeEmpty();
      });

      test('empty DOM', async ({ page }) => {
        await page.setContent('<div style="width: 50; height: 50px"></div>');
        const locator = page.locator('div');
        await expect(locator).toBeEmpty();
      });
      `,
  }, { workers: 1 });
  expect(result.passed).toBe(6);
  expect(result.exitCode).toBe(0);
});

test('should support toBeVisible, toBeHidden', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('visible', async ({ page }) => {
        await page.setContent('<input></input>');
        const locator = page.locator('input');
        await expect(locator).toBeVisible();
      });

      test('not visible', async ({ page }) => {
        await page.setContent('<button style="display: none"></button>');
        const locator = page.locator('button');
        await expect(locator).not.toBeVisible();
      });

      test('hidden', async ({ page }) => {
        await page.setContent('<button style="display: none"></button>');
        const locator = page.locator('button');
        await expect(locator).toBeHidden();
      });

      test('not hidden', async ({ page }) => {
        await page.setContent('<input></input>');
        const locator = page.locator('input');
        await expect(locator).not.toBeHidden();
      });
      `,
  }, { workers: 1 });
  expect(result.passed).toBe(4);
  expect(result.exitCode).toBe(0);
});

test('should support toBeFocused', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('focused', async ({ page }) => {
        await page.setContent('<input></input>');
        const locator = page.locator('input');
        await locator.focus();
        await expect(locator).toBeFocused({ timeout: 1000 });
      });
      `,
  }, { workers: 1 });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});
