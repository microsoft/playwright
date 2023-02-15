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

import { test, expect } from './playwright-test-fixtures';

test('render unexpected after retry', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test, expect } = require('@playwright/test');
      test('one', async ({}) => {
        expect(1).toBe(0);
      });
    `,
  }, { retries: 3, reporter: 'line' });
  const text = result.output;
  expect(text).toContain('[1/1] a.test.js:3:7 › one');
  expect(text).toContain('[2/1] (retries) a.test.js:3:7 › one (retry #1)');
  expect(text).toContain('[3/1] (retries) a.test.js:3:7 › one (retry #2)');
  expect(text).toContain('[4/1] (retries) a.test.js:3:7 › one (retry #3)');
  expect(text).toContain('1 failed');
  expect(text).toContain('1) a.test');
  expect(text).not.toContain('2) a.test');
  expect(text).toContain('Retry #1 ────');
  expect(text).toContain('Retry #2 ────');
  expect(text).toContain('Retry #3 ────');
  expect(result.exitCode).toBe(1);
});

test('render flaky', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('one', async ({}, testInfo) => {
        expect(testInfo.retry).toBe(3);
      });
    `,
  }, { retries: 3, reporter: 'line' });
  const text = result.output;
  expect(text).toContain('1 flaky');
  expect(result.exitCode).toBe(0);
});

test('should print flaky failures', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('foobar', async ({}, testInfo) => {
        expect(testInfo.retry).toBe(1);
      });
    `
  }, { retries: '1', reporter: 'line' });
  expect(result.exitCode).toBe(0);
  expect(result.flaky).toBe(1);
  expect(result.output).toContain('expect(testInfo.retry).toBe(1)');
});

test('should work on CI', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test, expect } = require('@playwright/test');
      test('one', async ({}) => {
        expect(1).toBe(0);
      });
    `,
  }, { reporter: 'line' }, { CI: '1' });
  const text = result.output;
  expect(text).toContain('[1/1] a.test.js:3:7 › one');
  expect(text).toContain('1 failed');
  expect(text).toContain('1) a.test');
  expect(result.exitCode).toBe(1);
});

test('should print output', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('foobar', async ({}, testInfo) => {
        process.stdout.write('one');
        process.stdout.write('two');
        console.log('full-line');
      });
    `
  }, { reporter: 'line' });
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain([
    'a.spec.ts:3:11 › foobar',
    'one',
    '',
    'two',
    '',
    'full-line',
  ].join('\n'));
});
