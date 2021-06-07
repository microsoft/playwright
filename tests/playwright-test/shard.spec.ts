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
  'a.spec.ts': `
      const { test } = pwt;
    test('test1', async () => {
      console.log('test1-done');
    });
    test('test2', async () => {
      console.log('test2-done');
    });
    test('test3', async () => {
      console.log('test3-done');
    });
  `,
  'b.spec.ts': `
      const { test } = pwt;
    test('test4', async () => {
      console.log('test4-done');
    });
  `,
};

test('should respect shard=1/2', async ({ runInlineTest }) => {
  const result = await runInlineTest(tests, { shard: '1/2' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(result.skipped).toBe(1);
  expect(result.output).toContain('test1-done');
  expect(result.output).toContain('test2-done');
  expect(result.output).toContain('test3-done');
});

test('should respect shard=2/2', async ({ runInlineTest }) => {
  const result = await runInlineTest(tests, { shard: '2/2' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.skipped).toBe(3);
  expect(result.output).toContain('test4-done');
});
