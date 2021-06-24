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

test('it should not allow multiple tests with the same name per suite', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'retry-failures.spec.js': `
      const { test } = pwt;
      test('pass', async () => {});
      test('pass', async () => {});
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('tests with the same name per Suite are not allowed.');
});

test('it should not allow a focused test when forbid-only is used', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'retry-failures.spec.js': `
      const { test } = pwt;
      test.only('pass', async () => {});
    `
  }, { 'forbid-only': true });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('--forbid-only found a focused test.');
});
