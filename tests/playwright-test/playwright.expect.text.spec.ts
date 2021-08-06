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

test('should support toHaveText w/ regex', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass', async ({ page }) => {
        await page.setContent('<div id=node>Text content</div>');
        const locator = page.locator('#node');
        await expect(locator).toHaveText(/Text/);
      });

      test('fail', async ({ page }) => {
        await page.setContent('<div id=node>Text content</div>');
        const locator = page.locator('#node');
        await expect(locator).toHaveText(/Text 2/, { timeout: 100 });
      });
      `,
  }, { workers: 1 });
  const output = stripAscii(result.output);
  expect(output).toContain('Error: expect(received).toHaveText(expected)');
  expect(output).toContain('Expected pattern: /Text 2/');
  expect(output).toContain('Received string:  "Text content"');
  expect(output).toContain('expect(locator).toHaveText');
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.exitCode).toBe(1);
});

test('should support toHaveText w/ text', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass', async ({ page }) => {
        await page.setContent('<div id=node>Text content</div>');
        const locator = page.locator('#node');
        await expect(locator).toHaveText('Text content');
      });

      test('pass contain', async ({ page }) => {
        await page.setContent('<div id=node>Text content</div>');
        const locator = page.locator('#node');
        await expect(locator).toContainText('Text');
      });

      test('fail', async ({ page }) => {
        await page.setContent('<div id=node>Text content</div>');
        const locator = page.locator('#node');
        await expect(locator).toHaveText('Text', { timeout: 100 });
      });
      `,
  }, { workers: 1 });
  const output = stripAscii(result.output);
  expect(output).toContain('Error: expect(received).toHaveText(expected)');
  expect(output).toContain('Expected string: "Text"');
  expect(output).toContain('Received string: "Text content"');
  expect(output).toContain('expect(locator).toHaveText');
  expect(result.passed).toBe(2);
  expect(result.failed).toBe(1);
  expect(result.exitCode).toBe(1);
});

test('should support toHaveText w/ array', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass', async ({ page }) => {
        await page.setContent('<div>Text 1</div><div>Text 2</div>');
        const locator = page.locator('div');
        await expect(locator).toHaveText(['Text 1', 'Text 2']);
      });

      test('fail', async ({ page }) => {
        await page.setContent('<div>Text 1</div><div>Text 3</div>');
        const locator = page.locator('div');
        await expect(locator).toHaveText(['Text 1', 'Text 2'], { timeout: 1000 });
      });
      `,
  }, { workers: 1 });
  const output = stripAscii(result.output);
  expect(output).toContain('Error: expect(received).toHaveText(expected) // deep equality');
  expect(output).toContain('await expect(locator).toHaveText');
  expect(output).toContain('-   \"Text 2\"');
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.exitCode).toBe(1);
});

test('should support toHaveText eventually', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass eventually', async ({ page }) => {
        await page.setContent('<div id=node>Text content</div>');
        const locator = page.locator('#node');
        await Promise.all([
          expect(locator).toHaveText(/Text 2/),
          page.waitForTimeout(1000).then(() => locator.evaluate(element => element.textContent = 'Text 2 content')),
        ]);
      });
      `,
  }, { workers: 1 });
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(0);
  expect(result.exitCode).toBe(0);
});

test('should support toHaveText with innerText', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass', async ({ page }) => {
        await page.setContent('<div id=node>Text content</div>');
        const locator = page.locator('#node');
        await expect(locator).toHaveText('Text content', { useInnerText: true });
      });
      `,
  }, { workers: 1 });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should support toHaveAttribute', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass', async ({ page }) => {
        await page.setContent('<div id=node>Text content</div>');
        const locator = page.locator('#node');
        await expect(locator).toHaveAttribute('id', 'node');
      });
      `,
  }, { workers: 1 });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should support toHaveCSS', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass', async ({ page }) => {
        await page.setContent('<div id=node style="color: rgb(255, 0, 0)">Text content</div>');
        const locator = page.locator('#node');
        await expect(locator).toHaveCSS('color', 'rgb(255, 0, 0)');
      });
      `,
  }, { workers: 1 });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should support toHaveId', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass', async ({ page }) => {
        await page.setContent('<div id=node>Text content</div>');
        const locator = page.locator('#node');
        await expect(locator).toHaveId('node');
      });
      `,
  }, { workers: 1 });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should support toHaveValue', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass', async ({ page }) => {
        await page.setContent('<input id=node></input>');
        const locator = page.locator('#node');
        await locator.fill('Text content');
        await expect(locator).toHaveValue('Text content');
      });
      `,
  }, { workers: 1 });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should print expected/received before timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('times out waiting for text', async ({ page }) => {
        await page.setContent('<div id=node>Text content</div>');
        await expect(page.locator('#node')).toHaveText('Text 2');
      });
      `,
  }, { workers: 1, timeout: 2000 });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Timeout of 2000ms exceeded.');
  expect(stripAscii(result.output)).toContain('Expected string: "Text 2"');
  expect(stripAscii(result.output)).toContain('Received string: "Text content"');
});
