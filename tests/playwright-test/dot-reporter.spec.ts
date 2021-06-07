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

import colors from 'colors/safe';
import { test, expect, stripAscii } from './playwright-test-fixtures';

test('render expected', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('one', async ({}) => {
        expect(1).toBe(1);
      });
    `,
  });
  expect(result.output).toContain(colors.green('·'));
  expect(result.exitCode).toBe(0);
});

test('render unexpected', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('one', async ({}) => {
        expect(1).toBe(0);
      });
    `,
  });
  expect(result.output).toContain(colors.red('F'));
  expect(result.exitCode).toBe(1);
});

test('render unexpected after retry', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('one', async ({}) => {
        expect(1).toBe(0);
      });
    `,
  }, { retries: 3 });
  const text = stripAscii(result.output);
  expect(text).toContain('×××F');
  expect(result.output).toContain(colors.red('F'));
  expect(result.exitCode).toBe(1);
});

test('render flaky', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('one', async ({}, testInfo) => {
        expect(testInfo.retry).toBe(3);
      });
    `,
  }, { retries: 3 });
  const text = stripAscii(result.output);
  expect(text).toContain('×××±');
  expect(result.output).toContain(colors.yellow('±'));
  expect(text).toContain('1 flaky');
  expect(text).not.toContain('Retry #1');
  expect(result.exitCode).toBe(0);
});

test('should work from config', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { reporter: 'dot' };
    `,
    'a.test.js': `
      const { test } = pwt;
      test('one', async ({}) => {
        expect(1).toBe(1);
      });
    `,
  });
  expect(result.output).toContain(colors.green('·'));
  expect(result.exitCode).toBe(0);
});
