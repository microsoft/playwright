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

import path from 'path';
import { test, expect, stripAscii } from './playwright-test-fixtures';

test('should support toHaveCount', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass', async ({ page }) => {
        await page.setContent('<select><option>One</option></select>');
        const locator = page.locator('option');
        let done = false;
        const promise = expect(locator).toHaveCount(2).then(() => { done = true; });
        await page.waitForTimeout(1000);
        expect(done).toBe(false);
        await page.setContent('<select><option>One</option><option>Two</option></select>');
        await promise;
        expect(done).toBe(true);
      });
      `,
  }, { workers: 1 });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should support toHaveJSProperty', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass', async ({ page }) => {
        await page.setContent('<div></div>');
        await page.$eval('div', e => e.foo = { a: 1, b: 'string', c: new Date(1627503992000) });
        const locator = page.locator('div');
        await expect(locator).toHaveJSProperty('foo', { a: 1, b: 'string', c: new Date(1627503992000) });
      });

      test('fail', async ({ page }) => {
        await page.setContent('<div></div>');
        await page.$eval('div', e => e.foo = { a: 1, b: 'string', c: new Date(1627503992000) });
        const locator = page.locator('div');
        await expect(locator).toHaveJSProperty('foo', { a: 1, b: 'string', c: new Date(1627503992001) }, { timeout: 1000 });
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
        await expect(locator).toHaveClass('foo bar baz');
      });

      test('fail', async ({ page }) => {
        await page.setContent('<div class="bar baz"></div>');
        const locator = page.locator('div');
        await expect(locator).toHaveClass('foo bar baz', { timeout: 1000 });
      });
      `,
  }, { workers: 1 });
  const output = stripAscii(result.output);
  expect(output).toContain('expect(locator).toHaveClass');
  expect(output).toContain('Expected string: \"foo bar baz\"');
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.exitCode).toBe(1);
});

test('should support toHaveClass w/ array', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass', async ({ page }) => {
        await page.setContent('<div class="foo"></div><div class="bar"></div><div class="baz"></div>');
        const locator = page.locator('div');
        await expect(locator).toHaveClass(['foo', 'bar', /[a-z]az/]);
      });

      test('fail', async ({ page }) => {
        await page.setContent('<div class="foo"></div><div class="bar"></div><div class="bar"></div>');
        const locator = page.locator('div');
        await expect(locator).toHaveClass(['foo', 'bar', /[a-z]az/], { timeout: 1000 });
      });
      `,
  }, { workers: 1 });
  const output = stripAscii(result.output);
  expect(output).toContain('expect(received).toHaveClass(expected)');
  expect(output).toContain('-   /[a-z]az/,');
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.exitCode).toBe(1);
});

test('should support toHaveTitle', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass', async ({ page }) => {
        await page.setContent('<title>  Hello     world</title>');
        await expect(page).toHaveTitle('Hello  world');
      });

      test('fail', async ({ page }) => {
        await page.setContent('<title>Bye</title>');
        await expect(page).toHaveTitle('Hello', { timeout: 100 });
      });
      `,
  }, { workers: 1 });
  const output = stripAscii(result.output);
  expect(output).toContain('expect(page).toHaveTitle');
  expect(output).toContain('Expected string: \"Hello\"');
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.exitCode).toBe(1);
});

test('should support toHaveURL', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass', async ({ page }) => {
        await page.goto('data:text/html,<div>A</div>');
        await expect(page).toHaveURL('data:text/html,<div>A</div>');
      });

      test('fail', async ({ page }) => {
        await page.goto('data:text/html,<div>B</div>');
        await expect(page).toHaveURL('wrong', { timeout: 100 });
      });
      `,
  }, { workers: 1 });
  const output = stripAscii(result.output);
  expect(output).toContain('expect(page).toHaveURL');
  expect(output).toContain('Expected string: \"wrong\"');
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.exitCode).toBe(1);
});

test('should support toHaveURL with baseURL from webServer', async ({ runInlineTest }, testInfo) => {
  const port = testInfo.workerIndex + 10500;
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass', async ({ page }) => {
        await page.goto('/foobar');
        await expect(page).toHaveURL('/foobar');
        await expect(page).toHaveURL('http://localhost:${port}/foobar');
      });

      test('fail', async ({ page }) => {
        await page.goto('/foobar');
        await expect(page).toHaveURL('/kek', { timeout: 100 });
      });
      `,
    'playwright.config.ts': `
      module.exports = {
        webServer: {
          command: 'node ${JSON.stringify(path.join(__dirname, 'assets', 'simple-server.js'))} ${port}',
          port: ${port},
        },
      };
  `,
  }, { workers: 1 });
  const output = stripAscii(result.output);
  expect(output).toContain('expect(page).toHaveURL');
  expect(output).toContain(`Expected string: \"http://localhost:${port}/kek\"`);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.exitCode).toBe(1);
});

test('should support respect expect.timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `module.exports = { expect: { timeout: 1000 } }`,
    'a.test.ts': `
      const { test } = pwt;

      test('timeout', async ({ page }) => {
        await page.goto('data:text/html,<div>A</div>');
        await Promise.all([
          expect(page).toHaveURL('data:text/html,<div>B</div>'),
          new Promise(f => setTimeout(f, 2000)).then(() => expect(true).toBe(false))
        ]);
      });
      `,
  }, { workers: 1 });
  const output = stripAscii(result.output);
  expect(output).toContain('expect(received).toHaveURL(expected)');
  expect(result.failed).toBe(1);
  expect(result.exitCode).toBe(1);
});

test('should log scale the time', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass', async ({ page }) => {
        await page.setContent('<div id=div>Wrong</div>');
        await expect(page.locator('div')).toHaveText('Text', { timeout: 2000 });
      });
      `,
  }, { workers: 1 });
  const output = stripAscii(result.output);
  const tokens = output.split('unexpected value');
  // Log scale: 0, 100, 250, 500, 1000, 1000, should be less than 8.
  expect(tokens.length).toBeGreaterThan(1);
  expect(tokens.length).toBeLessThan(8);
  expect(result.passed).toBe(0);
  expect(result.exitCode).toBe(1);
});
