/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect } from './playwright-test-fixtures';

test('max-failures should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const { test } = pwt;
      for (let i = 0; i < 10; ++i) {
        test('fail_' + i, () => {
          expect(true).toBe(false);
        });
      }
    `,
    'b.spec.js': `
      const { test } = pwt;
      for (let i = 0; i < 10; ++i) {
        test('fail_' + i, () => {
          expect(true).toBe(false);
        });
      }
    `
  }, { 'max-failures': 8 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(8);
  expect(result.output.split('\n').filter(l => l.includes('expect(')).length).toBe(16);
});

test('-x should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const { test } = pwt;
      for (let i = 0; i < 10; ++i) {
        test('fail_' + i, () => {
          expect(true).toBe(false);
        });
      }
    `,
    'b.spec.js': `
      const { test } = pwt;
      for (let i = 0; i < 10; ++i) {
        test('fail_' + i, () => {
          expect(true).toBe(false);
        });
      }
    `
  }, { '-x': true });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output.split('\n').filter(l => l.includes('expect(')).length).toBe(2);
});

test('max-failures should work with retries', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const { test } = pwt;
      for (let i = 0; i < 10; ++i) {
        test('fail_' + i, () => {
          expect(true).toBe(false);
        });
      }
    `,
  }, { 'max-failures': 2, 'retries': 4 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output.split('\n').filter(l => l.includes('Received:')).length).toBe(2);
});
