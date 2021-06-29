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
import { test, expect } from './playwright-test-fixtures';

test('it should not allow multiple tests with the same name per suite', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'tests/example.spec.js': `
      const { test } = pwt;
      test('i-am-a-duplicate', async () => {});
      test('i-am-a-duplicate', async () => {});
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('duplicate test titles are not allowed');
  expect(result.output).toContain(`- title: i-am-a-duplicate`);
  expect(result.output).toContain(`  - tests${path.sep}example.spec.js:6`);
  expect(result.output).toContain(`  - tests${path.sep}example.spec.js:7`);
});

test('it should enforce unique test names based on the describe block name', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'tests/example.spec.js': `
      const { test } = pwt;
      test.describe('hello', () => { test('my world', () => {}) });
      test.describe('hello my', () => { test('world', () => {}) });
      test('hello my world', () => {});
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('duplicate test titles are not allowed');
  expect(result.output).toContain(`- title: hello my world`);
  expect(result.output).toContain(`  - tests${path.sep}example.spec.js:6`);
  expect(result.output).toContain(`  - tests${path.sep}example.spec.js:7`);
  expect(result.output).toContain(`  - tests${path.sep}example.spec.js:8`);
});

test('it should not allow a focused test when forbid-only is used', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'tests/focused-test.spec.js': `
      const { test } = pwt;
      test.only('i-am-focused', async () => {});
    `
  }, { 'forbid-only': true });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('--forbid-only found a focused test.');
  expect(result.output).toContain(`- tests${path.sep}focused-test.spec.js:6 > i-am-focused`);
});
