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

const tests = {
  'helper.ts': `
    import { test as base, expect } from '@playwright/test';
    export const headlessTest = base.extend({ headless: false });
    export const headedTest = base.extend({ headless: true });
  `,
  'a1.spec.ts': `
    import { headlessTest, headedTest } from './helper';
    headlessTest('test1', async () => {
      console.log('test1-done');
    });
  `,
  'a2.spec.ts': `
    import { headlessTest, headedTest } from './helper';
    headedTest('test2', async () => {
      console.log('test2-done');
    });
  `,
  'a3.spec.ts': `
    import { headlessTest, headedTest } from './helper';
    headlessTest('test3', async () => {
      console.log('test3-done');
    });
  `,
  'b1.spec.ts': `
    import { headlessTest, headedTest } from './helper';
    headlessTest('test4', async () => {
      console.log('test4-done');
    });
  `,
  'b2.spec.ts': `
    import { headlessTest, headedTest } from './helper';
    headedTest('test5', async () => {
      console.log('test5-done');
    });
  `,
};

test('should respect shard=1/2', async ({ runInlineTest }) => {
  const result = await runInlineTest(tests, { shard: '1/2' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(result.skipped).toBe(0);
  expect(result.output).toContain('test1-done');
  expect(result.output).toContain('test2-done');
  expect(result.output).toContain('test3-done');
});

test('should respect shard=2/2', async ({ runInlineTest }) => {
  const result = await runInlineTest(tests, { shard: '2/2' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.skipped).toBe(0);
  expect(result.output).toContain('test4-done');
  expect(result.output).toContain('test5-done');
});

test('should not produce skipped tests for zero-sized shards', async ({ runInlineTest }) => {
  const result = await runInlineTest(tests, { shard: '10/10' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(0);
  expect(result.skipped).toBe(0);
  expect(result.output).not.toContain('-done');
});

test('should respect shard=1/2 in config', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...tests,
    'playwright.config.js': `
      module.exports = { shard: { current: 1, total: 2 } };
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(result.skipped).toBe(0);
  expect(result.output).toContain('test1-done');
  expect(result.output).toContain('test2-done');
  expect(result.output).toContain('test3-done');
});
