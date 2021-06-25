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

test('should support toMatchText', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass', async ({ page }) => {
        await page.setContent('<div id=node>Text content</div>');
        const handle = page.locator('#node');
        await expect(handle).toMatchText(/Text/);
      });

      test('fail', async ({ page }) => {
        await page.setContent('<div id=node>Text content</div>');
        const handle = page.locator('#node');
        await expect(handle).toMatchText(/Text 2/, { timeout: 100 });
      });
      `,
  }, { workers: 1 });
  const output = stripAscii(result.output);
  expect(output).toContain('Error: expect(received).toMatchText(expected)');
  expect(output).toContain('Expected pattern: /Text 2/');
  expect(output).toContain('Received string:  "Text content"');
  expect(output).toContain('expect(handle).toMatchText');
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.exitCode).toBe(1);
});

test('should support toHaveText', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass', async ({ page }) => {
        await page.setContent('<div id=node>Text content</div>');
        const handle = page.locator('#node');
        await expect(handle).toHaveText('Text content');
      });

      test('fail', async ({ page }) => {
        await page.setContent('<div id=node>Text content</div>');
        const handle = page.locator('#node');
        await expect(handle).toHaveText('Text', { timeout: 100 });
      });
      `,
  }, { workers: 1 });
  const output = stripAscii(result.output);
  expect(output).toContain('Error: expect(received).toHaveText(expected)');
  expect(output).toContain('Expected string: "Text"');
  expect(output).toContain('Received string: "Text content"');
  expect(output).toContain('expect(handle).toHaveText');
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.exitCode).toBe(1);
});

test('should support toMatchText eventually', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass eventually', async ({ page }) => {
        await page.setContent('<div id=node>Text content</div>');
        const handle = page.locator('#node');
        await Promise.all([
          expect(handle).toMatchText(/Text 2/),
          page.waitForTimeout(1000).then(() => handle.evaluate(element => element.textContent = 'Text 2 content')),
        ]);
      });
      `,
  }, { workers: 1 });
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(0);
  expect(result.exitCode).toBe(0);
});

test('should support toMatchText with innerText', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass', async ({ page }) => {
        await page.setContent('<div id=node>Text content</div>');
        const handle = page.locator('#node');
        await expect(handle).toHaveText('Text content', { useInnerText: true });
      });
      `,
  }, { workers: 1 });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

